import { churchName } from '../../shared/catalog-options.mjs';

export function createStudentRoutes(context) {
  const {
    db,
    json,
    readJson,
    cleanEmail,
    authorize,
    cleanText,
    hasValidationErrors,
    invalid,
    duplicateError,
    selectedSchoolYear,
    catalogNameError,
    validateStudentContact,
    notificationService,
    profilePhotoStorage,
    studentSelect,
    studentView,
    validateStudent,
    studentClassIds,
    studentCourseNames,
    activeClassesForStudent,
    issueStudentInvite,
    issueStudentEmailChange,
  } = context;

  const prepareChurch = async value => {
    const raw=String(value??'').trim(),numericId=/^\d+$/.test(raw)?Number(raw):null;
    if(Number.isSafeInteger(numericId)&&numericId>0){
      const existing=await db.prepare('SELECT id,name,active FROM churches WHERE id=?').get(numericId);
      return existing?.active===1
        ? {id:Number(existing.id),name:existing.name,needsSave:false,error:''}
        : {id:null,name:'',needsSave:false,error:'Selecione uma igreja disponível.'};
    }
    const name=churchName(cleanText(value,100)),error=catalogNameError(name,'igreja');
    if(error)return {id:null,name,needsSave:false,error};
    const existing=await db.prepare('SELECT id,name,active FROM churches WHERE LOWER(name)=LOWER(?)').get(name);
    return existing?.active===1
      ? {id:Number(existing.id),name:existing.name,needsSave:false,error:''}
      : {id:existing?Number(existing.id):null,name,needsSave:true,error:''};
  };

  const savePreparedChurch = async (choice,session,ip) => {
    if(!choice.needsSave)return choice;
    if(choice.id){
      await db.prepare('UPDATE churches SET name=?,active=1 WHERE id=?').run(choice.name,choice.id);
      await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'church_reactivated',ip);
      return {...choice,needsSave:false};
    }
    await db.prepare('INSERT INTO churches (name,active) VALUES (?,1) ON CONFLICT DO NOTHING').run(choice.name);
    const saved=await db.prepare('SELECT id,name FROM churches WHERE LOWER(name)=LOWER(?) AND active=1').get(choice.name);
    if(!saved)throw new Error('student_church_not_saved');
    await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'church_created',ip);
    return {id:Number(saved.id),name:saved.name,needsSave:false,error:''};
  };

  const bulkStudentIds = value => {
    if (!Array.isArray(value) || !value.length || value.length > 100) return null;
    if (value.some(id => !Number.isInteger(Number(id)) || Number(id) < 1)) return null;
    return [...new Set(value.map(Number))].sort((left, right) => left - right);
  };

  const classNotificationLabel = classRow => {
    const courseName = String(classRow.course_name || 'Turma').trim();
    const classLabel = String(classRow.label || '').trim();
    const locationName = String(classRow.location_name || '').trim();
    const normalizeLabel = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[‐‑‒–—―]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
    const normalizedClassLabel = normalizeLabel(classLabel);
    const defaultLabels = new Set([
      normalizeLabel(courseName),
      normalizeLabel(`${courseName} - ${locationName}`),
    ]);
    const className = classLabel && !defaultLabels.has(normalizedClassLabel)
      ? `${courseName} — ${classLabel}`
      : courseName;
    return `${className}${locationName ? `, em ${locationName}` : ''}`;
  };

  const notifyProfessorsAboutEnrollmentChanges = async (studentId, studentName, { added = [], removed = [] }, operation) => {
    const classesByProfessor = new Map();
    for (const classRow of added) {
      const professorId = Number(classRow.professor_id);
      if (!professorId) continue;
      const professorChanges = classesByProfessor.get(professorId) || { added: [], removed: [] };
      professorChanges.added.push(classRow);
      classesByProfessor.set(professorId, professorChanges);
    }
    for (const classRow of removed) {
      const professorId = Number(classRow.professor_id);
      if (!professorId) continue;
      const professorChanges = classesByProfessor.get(professorId) || { added: [], removed: [] };
      professorChanges.removed.push(classRow);
      classesByProfessor.set(professorId, professorChanges);
    }
    await Promise.all([...classesByProfessor].map(([professorId, changes]) => {
      const bodyParts = [];
      if (changes.added.length) {
        const descriptions = changes.added.map(classNotificationLabel);
        bodyParts.push(descriptions.length === 1
          ? `Uma nova matrícula de ${studentName} foi registrada na turma ${descriptions[0]}.`
          : `Novas matrículas de ${studentName} foram registradas nas turmas:\n${descriptions.map(description => `- ${description}`).join('\n')}`);
      }
      if (changes.removed.length) {
        const descriptions = changes.removed.map(classNotificationLabel);
        bodyParts.push(descriptions.length === 1
          ? `A matrícula de ${studentName} foi removida da turma ${descriptions[0]}.`
          : `As matrículas de ${studentName} foram removidas das turmas:\n${descriptions.map(description => `- ${description}`).join('\n')}`);
      }
      const body = bodyParts.join('\n\n');
      const classRows = [...changes.added, ...changes.removed];
      const classKey = classRows.map(classRow => Number(classRow.id)).sort((left, right) => left - right).join('-');
      const subject = changes.added.length && changes.removed.length
        ? 'Alteração na matrícula do aluno'
        : changes.added.length ? 'Novo aluno em sua turma' : 'Aluno removido da sua turma';
      return notificationService.notifyProfessor(
        professorId,
        'newStudent',
        subject,
        body,
        `${operation}/${studentId}/classes-${classKey}`,
      );
    }));
  };

  const anonymizeStudents = async (studentIds, session, ip) => {
    const placeholders = studentIds.map(() => '?').join(',');
    let storagePaths = [];
    await db.transaction(async () => {
      const lockClause = db.dialect === 'postgres' ? ' FOR UPDATE' : '';
      const students = await db.prepare(`SELECT id FROM students WHERE id IN (${placeholders}) AND active=1 ORDER BY id${lockClause}`).all(...studentIds);
      if (students.length !== studentIds.length) {
        const error = new Error('Um dos alunos selecionados não está mais disponível. Atualize a lista e tente novamente.');
        error.code = 'STUDENT_SELECTION_CHANGED';
        throw error;
      }
      storagePaths = (await db.prepare(`SELECT storage_path FROM profile_photos WHERE owner_type='student' AND owner_id IN (${placeholders}) AND storage_path IS NOT NULL`).all(...studentIds)).map(row => row.storage_path);
      await db.prepare(`DELETE FROM profile_photos WHERE owner_type='student' AND owner_id IN (${placeholders})`).run(...studentIds);
      await db.prepare(`DELETE FROM student_contacts WHERE student_id IN (${placeholders})`).run(...studentIds);
      await db.prepare(`UPDATE dropout_events SET reason='Dados anonimizados por solicitação',reason_category='outro' WHERE student_id IN (${placeholders})`).run(...studentIds);
      await db.prepare(`INSERT INTO dropout_events (student_id,class_id,reason,reason_category,occurred_at)
        SELECT student_id,class_id,?,?,? FROM enrollments WHERE student_id IN (${placeholders}) AND status='ativa'`)
        .run('Dados anonimizados por solicitação','outro',new Date().toISOString().slice(0,10),...studentIds);
      await db.prepare(`UPDATE enrollments SET status='cancelada',transferred_to_class_id=NULL WHERE student_id IN (${placeholders}) AND status='ativa'`).run(...studentIds);
      await db.prepare(`UPDATE students SET name='Aluno anonimizado #' || id,email=NULL,phone=NULL,guardian_name=NULL,guardian_phone=NULL,guardian_consent_at=NULL,church_id=NULL,age_group=NULL,has_instrument=0,active=0,anonymized_at=CURRENT_TIMESTAMP,anonymized_by=?,updated_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders}) AND active=1`).run(session.user_id,...studentIds);
      const auditValues = studentIds.map(() => '(?,?,?)').join(',');
      await db.prepare(`INSERT INTO audit_log (user_id,action,ip) VALUES ${auditValues}`).run(...studentIds.flatMap(id => [session.user_id,`student_anonymized:${id}`,ip]));
    });
    await profilePhotoStorage.removePaths(storagePaths);
  };

  return async function studentRoutes(request, response, url, ip) {
      if(request.method==='GET'&&url.pathname==='/api/churches'){
        if(!await authorize(request,response,['gestor','professor']))return;
        const rows=await db.prepare('SELECT id,name AS nome,active FROM churches WHERE active=1 ORDER BY name').all();
        return json(response,200,rows.map(row=>({id:Number(row.id),nome:churchName(row.nome),ativo:row.active===1})));
      }
      if(request.method==='POST'&&url.pathname==='/api/churches'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const body=await readJson(request),name=churchName(cleanText(body.nome,100)),errorMessage=catalogNameError(name,'igreja');
        if(errorMessage)return invalid(response,{nome:errorMessage});
        const existing=await db.prepare('SELECT id,active FROM churches WHERE LOWER(name)=LOWER(?)').get(name);
        if(existing?.active===1)return json(response,409,{message:'Esta igreja já está cadastrada.'});
        if(existing){
          await db.prepare('UPDATE churches SET name=?,active=1 WHERE id=?').run(name,existing.id);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'church_reactivated',ip);
          return json(response,200,{id:Number(existing.id),nome:name});
        }
        const result=await db.prepare('INSERT INTO churches (name) VALUES (?)').run(name);
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'church_created',ip);
        return json(response,201,{id:Number(result.lastInsertRowid),nome:name});
      }
      const churchMatch=url.pathname.match(/^\/api\/churches\/(\d+)$/);
      if(churchMatch&&request.method==='PUT'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const id=Number(churchMatch[1]),body=await readJson(request),name=churchName(cleanText(body.nome,100)),errorMessage=catalogNameError(name,'igreja');
        if(errorMessage)return invalid(response,{nome:errorMessage});
        try{
          const result=await db.prepare('UPDATE churches SET name=? WHERE id=? AND active=1').run(name,id);
          if(!result.changes)return json(response,404,{message:'Igreja não encontrada.'});
        }catch(error){if(duplicateError(error))return json(response,409,{message:'Já existe uma igreja com este nome.'});throw error;}
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'church_updated',ip);
        return json(response,200,{success:true});
      }
      if(churchMatch&&request.method==='DELETE'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const id=Number(churchMatch[1]);
        if(await db.prepare('SELECT id FROM students WHERE church_id=? LIMIT 1').get(id))return json(response,409,{message:'Esta igreja está vinculada a alunos e não pode ser desativada.'});
        const result=await db.prepare('UPDATE churches SET active=0 WHERE id=? AND active=1').run(id);
        if(!result.changes)return json(response,404,{message:'Igreja não encontrada.'});
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'church_deactivated',ip);
        return json(response,200,{success:true});
      }

      if(request.method==='POST'&&url.pathname==='/api/alunos/bulk/enroll'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const period=await selectedSchoolYear(request,response,{writable:true});if(!period)return;
        const body=await readJson(request),studentIds=bulkStudentIds(body.student_ids),classId=Number(body.class_id);
        if(!studentIds)return json(response,400,{message:'Selecione entre 1 e 100 alunos válidos.'});
        if(!Number.isInteger(classId)||classId<1)return json(response,400,{message:'Selecione uma turma válida.'});
        try{
          const result=await db.transaction(async()=>{
            const classLock=db.dialect==='postgres'?' FOR UPDATE':'';
            const classRow=await db.prepare(`SELECT classes.id,classes.course_id,classes.professor_id,classes.capacity,classes.label,courses.name AS course_name,locations.name AS location_name FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id WHERE classes.id=? AND classes.school_year_id=? AND classes.active=1 AND courses.active=1 AND locations.active=1${classLock}`).get(classId,period.id);
            if(!classRow){const error=new Error('A turma selecionada não está mais disponível.');error.code='BULK_CLASS_NOT_FOUND';throw error;}
            const placeholders=studentIds.map(()=>'?').join(','),studentLock=db.dialect==='postgres'?' FOR UPDATE':'';
            const students=await db.prepare(`SELECT id,name FROM students WHERE id IN (${placeholders}) AND active=1 ORDER BY id${studentLock}`).all(...studentIds);
            if(students.length!==studentIds.length){const error=new Error('Um dos alunos selecionados não está mais disponível. Atualize a lista e tente novamente.');error.code='STUDENT_SELECTION_CHANGED';throw error;}
            const activeEnrollments=await db.prepare(`SELECT enrollments.student_id,classes.id AS class_id,classes.course_id FROM enrollments JOIN classes ON classes.id=enrollments.class_id WHERE enrollments.student_id IN (${placeholders}) AND enrollments.status='ativa' AND classes.active=1 AND classes.school_year_id=? ORDER BY enrollments.student_id,classes.id`).all(...studentIds,period.id);
            const targetStudents=new Set(activeEnrollments.filter(row=>Number(row.class_id)===classId).map(row=>Number(row.student_id)));
            const sameCourseStudents=new Set(activeEnrollments.filter(row=>Number(row.course_id)===Number(classRow.course_id)).map(row=>Number(row.student_id)));
            const courseCounts=new Map();
            for(const enrollment of activeEnrollments){
              const studentId=Number(enrollment.student_id),courses=courseCounts.get(studentId)||new Set();
              courses.add(Number(enrollment.course_id));courseCounts.set(studentId,courses);
            }
            const overLimit=students.find(student=>!sameCourseStudents.has(Number(student.id))&&(courseCounts.get(Number(student.id))?.size||0)>=3);
            if(overLimit){const error=new Error(`${overLimit.name} já está vinculado ao limite de 3 cursos.`);error.code='BULK_COURSE_LIMIT';throw error;}
            const newEnrollmentIds=studentIds.filter(id=>!targetStudents.has(id));
            if(classRow.capacity){
              const occupied=await db.prepare("SELECT COUNT(*) AS total FROM enrollments WHERE class_id=? AND status='ativa'").get(classId);
              if(Number(occupied.total)+newEnrollmentIds.length>Number(classRow.capacity)){const error=new Error(`A turma possui apenas ${Math.max(0,Number(classRow.capacity)-Number(occupied.total))} vaga(s) disponível(is) para ${newEnrollmentIds.length} nova(s) matrícula(s).`);error.code='BULK_CAPACITY';throw error;}
            }
            const newEnrollmentSet=new Set(newEnrollmentIds);
            const transferred=new Set(activeEnrollments.filter(row=>newEnrollmentSet.has(Number(row.student_id))&&Number(row.course_id)===Number(classRow.course_id)&&Number(row.class_id)!==classId).map(row=>Number(row.student_id))).size;
            if(newEnrollmentIds.length){
              const newPlaceholders=newEnrollmentIds.map(()=>'?').join(',');
              await db.prepare(`UPDATE enrollments SET status='cancelada',transferred_to_class_id=? WHERE student_id IN (${newPlaceholders}) AND status='ativa' AND class_id IN (SELECT id FROM classes WHERE school_year_id=? AND course_id=? AND id<>?)`).run(classId,...newEnrollmentIds,period.id,classRow.course_id,classId);
              const enrollmentValues=newEnrollmentIds.map(()=>"(?,?,'ativa',NULL,NULL)").join(',');
              await db.prepare(`INSERT INTO enrollments (student_id,class_id,status,completed_at,transferred_to_class_id) VALUES ${enrollmentValues} ON CONFLICT(student_id,class_id) DO UPDATE SET status='ativa',enrolled_at=CASE WHEN enrollments.status='ativa' THEN enrollments.enrolled_at ELSE CURRENT_TIMESTAMP END,completed_at=NULL,transferred_to_class_id=NULL`).run(...newEnrollmentIds.flatMap(id=>[id,classId]));
              await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`students_bulk_enrolled:${classId}:${newEnrollmentIds.length}`,ip);
            }
            return{classRow,selected:studentIds.length,added:newEnrollmentIds.length,alreadyEnrolled:targetStudents.size,transferred};
          });
          if(result.added){
            await notificationService.notifyProfessor(result.classRow.professor_id,'newStudent','Alunos adicionados à turma',`${result.added} ${result.added===1?'aluno foi adicionado':'alunos foram adicionados'} à turma ${classNotificationLabel(result.classRow)}.`,`students-bulk-enrolled/${classId}/${Date.now()}`);
          }
          const message=result.added===0
            ? `Nenhum aluno foi adicionado: ${result.selected===1?'o aluno selecionado já estava matriculado':'todos os alunos selecionados já estavam matriculados'} nesta turma.`
            : result.alreadyEnrolled
              ? `${result.added} ${result.added===1?'aluno foi adicionado':'alunos foram adicionados'} à turma. ${result.alreadyEnrolled} ${result.alreadyEnrolled===1?'já estava matriculado':'já estavam matriculados'} e não recebeu nova notificação.`
              : `${result.added} ${result.added===1?'aluno foi adicionado':'alunos foram adicionados'} à turma com sucesso.`;
          return json(response,200,{success:true,selected:result.selected,added:result.added,alreadyEnrolled:result.alreadyEnrolled,transferred:result.transferred,message});
        }catch(error){
          if(error.code==='BULK_CLASS_NOT_FOUND')return json(response,404,{message:error.message});
          if(['STUDENT_SELECTION_CHANGED','BULK_COURSE_LIMIT','BULK_CAPACITY'].includes(error.code))return json(response,409,{message:error.message});
          throw error;
        }
      }

      if(request.method==='POST'&&url.pathname==='/api/alunos/bulk/anonymize'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const period=await selectedSchoolYear(request,response,{writable:true});if(!period)return;
        const body=await readJson(request),studentIds=bulkStudentIds(body.student_ids);
        if(!studentIds)return json(response,400,{message:'Selecione entre 1 e 100 alunos válidos.'});
        try{await anonymizeStudents(studentIds,session,ip);}
        catch(error){if(error.code==='STUDENT_SELECTION_CHANGED')return json(response,409,{message:error.message});throw error;}
        return json(response,200,{success:true,anonymized:studentIds.length,message:`Os dados pessoais de ${studentIds.length} aluno(s) foram anonimizados de forma irreversível.`});
      }
    
      const studentContactMatch=url.pathname.match(/^\/api\/alunos\/(\d+)\/contatos$/);
      if(studentContactMatch&&request.method==='GET'){
        if(!await authorize(request,response,['gestor']))return;
        const studentId=Number(studentContactMatch[1]);
        const rows=await db.prepare(`SELECT student_contacts.id,student_contacts.note,student_contacts.outcome,student_contacts.contacted_at,COALESCE(users.name,'Usuário removido') AS registered_by FROM student_contacts LEFT JOIN users ON users.id=student_contacts.user_id WHERE student_contacts.student_id=? ORDER BY student_contacts.contacted_at DESC,student_contacts.id DESC LIMIT 50`).all(studentId);
        return json(response,200,rows.map(row=>({id:Number(row.id),note:row.note,outcome:row.outcome,contactedAt:row.contacted_at,registeredBy:row.registered_by})));
      }
      if(studentContactMatch&&request.method==='POST'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const period=await selectedSchoolYear(request,response,{writable:true});if(!period)return;
        const studentId=Number(studentContactMatch[1]),body=await readJson(request),values={note:cleanText(body.note,1000),outcome:cleanText(body.outcome,30)},errors=validateStudentContact(values);
        if(hasValidationErrors(errors))return invalid(response,errors);
        const student=await db.prepare("SELECT students.id FROM students JOIN enrollments ON enrollments.student_id=students.id JOIN classes ON classes.id=enrollments.class_id WHERE students.id=? AND students.active=1 AND enrollments.status='ativa' AND classes.active=1 AND classes.school_year_id=? LIMIT 1").get(studentId,period.id);
        if(!student)return json(response,404,{message:'Aluno ativo não encontrado neste período.'});
        const result=await db.transaction(async()=>{
          const inserted=await db.prepare('INSERT INTO student_contacts (student_id,user_id,note,outcome) VALUES (?,?,?,?)').run(studentId,session.user_id,values.note,values.outcome);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'student_contact_registered',ip);
          return inserted;
        });
        return json(response,201,{id:Number(result.lastInsertRowid),success:true});
      }
    
      if (request.method === 'GET' && url.pathname === '/alunos') {
        if (!await authorize(request, response, ['gestor'])) return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const page = Math.max(1, Math.min(100000, Math.trunc(Number(url.searchParams.get('page')) || 1)));
        const limit = Math.min(50, Math.max(1, Math.trunc(Number(url.searchParams.get('limit')) || 10)));
        const search = `%${String(url.searchParams.get('search') || '').trim()}%`;
        for (const key of ['church_id', 'turma_id']) {
          const value = url.searchParams.get(key);
          if (value && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1)) return json(response,400,{message:'Selecione filtros válidos.'});
        }
        const conditions = ["students.active=1", "(students.name LIKE ? OR COALESCE(students.email,'') LIKE ? OR COALESCE(students.phone,'') LIKE ?)"];
        const params = [search, search, search];
        for (const [param, column] of [['church_id', 'students.church_id'], ['classe', 'students.age_group']]) {
          const value = url.searchParams.get(param);
          if (value) { conditions.push(`${column}=?`); params.push(value); }
        }
        const courseFilter=url.searchParams.get('curso'),classFilter=url.searchParams.get('turma_id');
        if(courseFilter||classFilter){
          const enrollmentConditions = ["se.student_id=students.id", "se.status='ativa'", 'sc.active=1', 'sc.school_year_id=?'];
          params.push(period.id);
          for (const [value, column] of [[courseFilter, 'selected_course.name'], [classFilter, 'sc.id']]) {
            if (value) { enrollmentConditions.push(`${column}=?`); params.push(value); }
          }
          conditions.push(`EXISTS (SELECT 1 FROM enrollments se JOIN classes sc ON sc.id=se.class_id JOIN courses selected_course ON selected_course.id=sc.course_id WHERE ${enrollmentConditions.join(' AND ')})`);
        }
        const where = conditions.join(' AND ');
        const total = (await db.prepare(`SELECT COUNT(*) AS total FROM students WHERE ${where}`).get(...params)).total;
        const rows = await db.prepare(`${studentSelect} WHERE ${where} GROUP BY students.id ORDER BY students.name,students.id LIMIT ? OFFSET ?`).all(period.id,...params,limit,(page-1)*limit);
        return json(response, 200, { alunos: rows.map(studentView), total });
      }
    
      if (request.method === 'POST' && url.pathname === '/alunos') {
        const session = await authorize(request, response, ['gestor']); if (!session) return;
        const period=await selectedSchoolYear(request,response,{writable:true});if(!period)return;
        const body = await readJson(request);
        const name = cleanText(body.nome,100), email = cleanEmail(body.contato || body.email), phone=cleanText(body.telefone,30);
        const guardianName=body.classe==='Adolescente'?cleanText(body.guardian_name,100):'',guardianPhone=body.classe==='Adolescente'?cleanText(body.guardian_phone,30):'',guardianConsent=body.classe==='Adolescente'&&body.guardian_consent===true,churchChoice=await prepareChurch(body.church_id||body.local);
        const rawClassIds=Array.isArray(body.turmas)?body.turmas:[],classIds=studentClassIds(rawClassIds),courseNames=studentCourseNames(body.curso);
        const selections=rawClassIds.length?rawClassIds:courseNames;
        const errors=validateStudent({...body,nome:name,contato:email,telefone:phone,guardian_name:guardianName,guardian_phone:guardianPhone,guardian_consent:guardianConsent,turmas:selections,local:churchChoice.name||churchChoice.id||''});
        if(churchChoice.error)errors.local=churchChoice.error;
        if(rawClassIds.some(value => !Number.isInteger(Number(value)) || Number(value) <= 0))errors.curso='Selecione somente turmas válidas.';
        if(hasValidationErrors(errors))return invalid(response,errors);
        if(await db.prepare('SELECT id FROM users WHERE LOWER(email)=LOWER(?)').get(email))return json(response,409,{message:'Este e-mail já pertence a uma conta do sistema.'});
        let classRows = [];
        try {
          const studentId=await db.transaction(async()=>{
            const selection = await activeClassesForStudent(classIds, courseNames, period.id);
            if (selection.error) {
              const error = new Error(selection.error);
              error.code = 'CLASS_SELECTION_INVALID';
              throw error;
            }
            classRows = selection.classes;
            const church=await savePreparedChurch(churchChoice,session,ip);
            const result = await db.prepare('INSERT INTO students (name,email,phone,guardian_name,guardian_phone,guardian_consent_at,church_id,age_group,has_instrument) VALUES (?,?,?,?,?,?,?,?,?)').run(name,email||null,phone,guardianName||null,guardianPhone||null,guardianConsent?new Date().toISOString():null,church.id,body.classe,body.instrumento === 'Sim' ? 1 : 0);
            for (const classRow of classRows) {
              await db.prepare('INSERT INTO enrollments (student_id,class_id) VALUES (?,?)').run(result.lastInsertRowid,classRow.id);
            }
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'student_created',ip);
            return Number(result.lastInsertRowid);
          });
          const classSummary=classRows.map(item=>item.course_name).join(', ');
          await notificationService.notifyManagers('newStudent','Novo aluno cadastrado',`${name} foi cadastrado${classSummary?` nas turmas de ${classSummary}`:''}.`,`student-created/${studentId}`);
          await notifyProfessorsAboutEnrollmentChanges(studentId,name,{ added: classRows },'student-created');
          const invitation=await issueStudentInvite({studentId,createdBy:session.user_id,ip,auditAction:'student_invited_automatically'});
          return json(response, 201, { id: studentId, invitation: invitation.inviteSent
            ? {sent:true,message:'Convite de acesso enviado automaticamente.',sentAt:invitation.sentAt,expiresAt:invitation.expiresAt}
            : {sent:false,message:invitation.message||'Aluno cadastrado, mas o convite de acesso não pôde ser enviado.'} });
        } catch (error) {
          if (error.code === 'CLASS_SELECTION_INVALID') return invalid(response, { curso: error.message });
          if (error.code === '23505' || String(error).includes('UNIQUE')) return json(response, 409, { message: 'Já existe um aluno com este e-mail.' });
          throw error;
        }
      }
    
      const studentMatch = url.pathname.match(/^\/alunos\/(\d+)$/);
      if (studentMatch && request.method === 'GET') {
        if (!await authorize(request, response, ['gestor'])) return;
        const period = await selectedSchoolYear(request,response); if (!period) return;
        const row = await db.prepare(`${studentSelect} WHERE students.id=? AND students.active=1 GROUP BY students.id`).get(period.id,Number(studentMatch[1]));
        if (!row) return json(response,404,{message:'Aluno não encontrado.'});
        return json(response,200,studentView(row));
      }
      if (studentMatch && request.method === 'PUT') {
        const session = await authorize(request, response, ['gestor']); if (!session) return;
        const period=await selectedSchoolYear(request,response,{writable:true});if(!period)return;
        const id = Number(studentMatch[1]), body = await readJson(request);
        const name=cleanText(body.nome,100),email=cleanEmail(body.contato||body.email),phone=cleanText(body.telefone,30),guardianName=body.classe==='Adolescente'?cleanText(body.guardian_name,100):'',guardianPhone=body.classe==='Adolescente'?cleanText(body.guardian_phone,30):'',guardianConsent=body.classe==='Adolescente'&&body.guardian_consent===true,churchChoice=await prepareChurch(body.church_id||body.local),rawClassIds=Array.isArray(body.turmas)?body.turmas:[],classIds=studentClassIds(rawClassIds),courseNames=studentCourseNames(body.curso);
        const selections=rawClassIds.length?rawClassIds:courseNames;
        const errors=validateStudent({...body,nome:name,contato:email,telefone:phone,guardian_name:guardianName,guardian_phone:guardianPhone,guardian_consent:guardianConsent,turmas:selections,local:churchChoice.name||churchChoice.id||''});
        if(churchChoice.error)errors.local=churchChoice.error;
        if(rawClassIds.some(value => !Number.isInteger(Number(value)) || Number(value) <= 0))errors.curso='Selecione somente turmas válidas.';
        if(hasValidationErrors(errors))return invalid(response,errors);
        const currentStudent=await db.prepare(`SELECT s.id,s.email,s.guardian_consent_at,sa.user_id,u.active AS account_active
          FROM students s LEFT JOIN student_accounts sa ON sa.student_id=s.id LEFT JOIN users u ON u.id=sa.user_id
          WHERE s.id=? AND s.active=1`).get(id);
        if(!currentStudent)return json(response,404,{message:'Aluno ativo não encontrado.'});
        const emailChanged=cleanEmail(currentStudent.email)!==email;
        if(emailChanged){
          const duplicate=await db.prepare(`SELECT id FROM users WHERE LOWER(email)=LOWER(?) AND id<>COALESCE(?,0)
            UNION SELECT id FROM students WHERE LOWER(email)=LOWER(?) AND id<>?`).get(email,currentStudent.user_id,email,id);
          if(duplicate)return json(response,409,{message:'Já existe uma conta ou aluno com este e-mail.'});
        }
        try {
          const enrollmentChanges=await db.transaction(async()=>{
            const { classes: classRows, error: classError } = await activeClassesForStudent(classIds, courseNames, period.id,id);
            if (classError) {
              const error = new Error(classError);
              error.code = 'CLASS_SELECTION_INVALID';
              throw error;
            }
            const guardianConsentAt=guardianConsent?(currentStudent.guardian_consent_at||new Date().toISOString()):currentStudent.guardian_consent_at;
            const church=await savePreparedChurch(churchChoice,session,ip);
            const savedEmail=emailChanged&&currentStudent.account_active===1?currentStudent.email:email;
            await db.prepare(`UPDATE students SET name=?,email=?,phone=?,guardian_name=?,guardian_phone=?,guardian_consent_at=?,church_id=?,age_group=?,has_instrument=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND active=1`)
              .run(name,savedEmail,phone,guardianName||null,guardianPhone||null,guardianConsentAt,church.id,body.classe,body.instrumento==='Sim'?1:0,id);
            const enrollmentLock=db.dialect==='postgres'?' FOR UPDATE':'';
            const currentEnrollments=await db.prepare("SELECT enrollments.id,enrollments.class_id,classes.course_id,classes.professor_id,classes.label,courses.name AS course_name,locations.name AS location_name FROM enrollments JOIN classes ON classes.id=enrollments.class_id JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id WHERE enrollments.student_id=? AND enrollments.status='ativa' AND classes.school_year_id=?"+enrollmentLock).all(id,period.id);
            const currentClassIds=new Set(currentEnrollments.map(enrollment=>Number(enrollment.class_id)));
            const selectedIds=new Set(classRows.map(classRow=>Number(classRow.id)));
            const selectedByCourse=new Map(classRows.map(classRow=>[Number(classRow.course_id),Number(classRow.id)]));
            for(const enrollment of currentEnrollments){
              if(selectedIds.has(Number(enrollment.class_id)))continue;
              await db.prepare("UPDATE enrollments SET status='cancelada',transferred_to_class_id=? WHERE id=?")
                .run(selectedByCourse.get(Number(enrollment.course_id))||null,enrollment.id);
            }
            for (const classRow of classRows) {
              await db.prepare(`INSERT INTO enrollments (student_id,class_id,status,completed_at,transferred_to_class_id) VALUES (?,?,'ativa',NULL,NULL) ON CONFLICT(student_id,class_id) DO UPDATE SET status='ativa',enrolled_at=CASE WHEN enrollments.status='ativa' THEN enrollments.enrolled_at ELSE CURRENT_TIMESTAMP END,completed_at=NULL,transferred_to_class_id=NULL`).run(id,classRow.id);
            }
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'student_updated',ip);
            return {
              added: classRows.filter(classRow=>!currentClassIds.has(Number(classRow.id))),
              removed: currentEnrollments.filter(enrollment=>!selectedIds.has(Number(enrollment.class_id))),
            };
          });
          if(enrollmentChanges.added.length || enrollmentChanges.removed.length) {
            await notifyProfessorsAboutEnrollmentChanges(id,name,enrollmentChanges,`student-updated/${Date.now()}`);
          }
          let emailConfirmation=null;
          if(emailChanged&&currentStudent.account_active===1){
            emailConfirmation=await issueStudentEmailChange({studentId:id,newEmail:email,requestedBy:session.user_id,ip,auditAction:'student_email_change_requested_by_manager'});
          }else if(emailChanged&&!currentStudent.user_id){
            const invitation=await issueStudentInvite({studentId:id,createdBy:session.user_id,ip,auditAction:'student_reinvited_after_email_change'});
            emailConfirmation={...invitation,kind:'invitation',sent:invitation.inviteSent,message:invitation.inviteSent?'Convite enviado ao novo e-mail. O endereço será confirmado na ativação da conta.':invitation.message};
          }
          return json(response, 200, { success: true, emailConfirmation });
        } catch (error) {
          if (error.code === 'CLASS_SELECTION_INVALID') return invalid(response, { curso: error.message });
          if (error.code === '23505' || String(error).includes('UNIQUE')) return json(response, 409, { message: 'Já existe um aluno com este e-mail.' });
          throw error;
        }
      }
      if (studentMatch && request.method === 'DELETE') {
        const session = await authorize(request, response, ['gestor']); if (!session) return;
        const id = Number(studentMatch[1]);
        try{await anonymizeStudents([id],session,ip);}
        catch(error){if(error.code==='STUDENT_SELECTION_CHANGED')return json(response,404,{message:'Aluno ativo não encontrado.'});throw error;}
        return json(response, 200, { success: true, anonymized: true, message: 'Os dados pessoais do aluno foram anonimizados de forma irreversível.' });
      }
    
      if (request.method === 'GET' && (url.pathname === '/professores/meus-alunos' || url.pathname === '/api/professores/me/alunos')) {
        const session = await authorize(request, response, ['professor']); if (!session) return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const requestedPage = Number(url.searchParams.get('page') || 1);
        const page = Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1;
        const apiRoute=url.pathname.startsWith('/api/');
        const requestedLimit=Number(url.searchParams.get('limit') || (apiRoute?100:10));
        const limit=Math.min(apiRoute?100:50,Math.max(1,Number.isSafeInteger(requestedLimit)?requestedLimit:(apiRoute?100:10)));
        const orderBy=url.searchParams.get('order')==='recent'
          ? 'MAX(enrollments.enrolled_at) DESC,students.id DESC'
          : 'students.name,students.id';
        const search = `%${String(url.searchParams.get('search') || '').trim()}%`;
        const profile = await db.prepare('SELECT id FROM professor_profiles WHERE user_id=? AND active=1').get(session.user_id);
        if (!profile) return json(response, 403, { message: 'Perfil de professor não configurado.' });
        const classConditions = ['classes.active=1', 'classes.school_year_id=?', 'classes.professor_id=?'];
        const classParams = [period.id, profile.id];
        const course = String(url.searchParams.get('curso') || '').trim();
        if (course) { classConditions.push('classes.course_id IN (SELECT id FROM courses WHERE name=?)'); classParams.push(course); }
        const studentConditions = ['students.active=1', "(students.name LIKE ? OR COALESCE(students.email,'') LIKE ? OR COALESCE(students.phone,'') LIKE ?)"];
        const studentParams = [search, search, search];
        for (const [key, column, conditions, params] of [
          ['turma_id', 'classes.id', classConditions, classParams],
          ['church_id', 'students.church_id', studentConditions, studentParams],
        ]) {
          const raw = url.searchParams.get(key);
          if (!raw) continue;
          if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < 1) return json(response, 400, { message: 'Filtro inválido.' });
          conditions.push(`${column}=?`); params.push(Number(raw));
        }
        const group = String(url.searchParams.get('classe') || '').trim();
        if (group) { studentConditions.push('students.age_group=?'); studentParams.push(group); }
        const scope = classConditions.join(' AND ');
        studentConditions.push(`students.id IN (SELECT enrollments.student_id FROM enrollments JOIN classes ON classes.id=enrollments.class_id WHERE enrollments.status='ativa' AND ${scope})`);
        const where = studentConditions.join(' AND ');
        const params = [...studentParams, ...classParams];
        const total = (await db.prepare(`SELECT COUNT(*) AS total FROM students WHERE ${where}`).get(...params)).total;
        // Limit the aggregated class list to this professor as well. The previous
        // query selected the right students but exposed their other active classes.
        const professorStudentSelect=studentSelect.replace(
          'LEFT JOIN classes ON classes.id=enrollments.class_id AND classes.active=1 AND classes.school_year_id=?',
          'LEFT JOIN classes ON classes.id=enrollments.class_id AND classes.active=1 AND classes.school_year_id=? AND classes.professor_id=?',
        );
        const rows = await db.prepare(`${professorStudentSelect} WHERE ${where} GROUP BY students.id ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(period.id,profile.id,...params,limit,(page-1)*limit);
        const attendance = rows.length ? await db.prepare(`
          SELECT attendance_records.student_id,COUNT(*) AS registros,
            SUM(CASE WHEN attendance_records.status IN ('presente','justificado') THEN 1 ELSE 0 END) AS presencas
          FROM attendance_records
          JOIN attendance_sessions ON attendance_sessions.id=attendance_records.session_id
          JOIN classes ON classes.id=attendance_sessions.class_id
          WHERE ${scope} AND attendance_records.student_id IN (${rows.map(() => '?').join(',')})
            AND EXISTS (SELECT 1 FROM enrollments WHERE enrollments.student_id=attendance_records.student_id AND enrollments.class_id=classes.id AND enrollments.status='ativa')
          GROUP BY attendance_records.student_id
        `).all(...classParams,...rows.map(row => row.id)) : [];
        const attendanceByStudent = new Map(attendance.map(row => [Number(row.student_id), row]));
        // Options are scoped independently of the current search so filters remain usable.
        const turmas = await db.prepare(`SELECT classes.id,courses.name AS nome,locations.name AS local FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id WHERE classes.active=1 AND classes.school_year_id=? AND classes.professor_id=? ORDER BY courses.name,locations.name,classes.id`).all(period.id,profile.id);
        const igrejas = await db.prepare(`SELECT DISTINCT churches.id,churches.name AS nome FROM churches JOIN students ON students.church_id=churches.id JOIN enrollments ON enrollments.student_id=students.id JOIN classes ON classes.id=enrollments.class_id WHERE students.active=1 AND enrollments.status='ativa' AND classes.active=1 AND classes.school_year_id=? AND classes.professor_id=? ORDER BY churches.name`).all(period.id,profile.id);
        return json(response, 200, { alunos: rows.map(row => {
          const record = attendanceByStudent.get(Number(row.id));
          return { ...studentView(row), frequencia: record ? Math.round(100 * Number(record.presencas) / Number(record.registros)) : null };
        }), total, filtros: { turmas, igrejas } });
      }
    
      if (request.method === 'GET' && url.pathname === '/api/catalogos') {
        if (!await authorize(request, response, ['gestor'])) return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const cursos = await db.prepare(`
          SELECT courses.id,courses.name AS nome,courses.active,
            COUNT(DISTINCT classes.id) AS turmas_total,
            COUNT(DISTINCT CASE WHEN classes.active=1 THEN classes.id END) AS turmas_ativas,
            COUNT(DISTINCT enrollments.id) AS matriculas_total
          FROM courses
          LEFT JOIN classes ON classes.course_id=courses.id AND classes.school_year_id=?
          LEFT JOIN enrollments ON enrollments.class_id=classes.id
          GROUP BY courses.id,courses.name,courses.active ORDER BY courses.name
        `).all(period.id);
        const locais = await db.prepare(`
          SELECT locations.id,locations.name AS nome,locations.active,
            COUNT(DISTINCT classes.id) AS turmas_total,
            COUNT(DISTINCT CASE WHEN classes.active=1 THEN classes.id END) AS turmas_ativas,
            COUNT(DISTINCT enrollments.id) AS matriculas_total,
            COUNT(DISTINCT professor_profiles.id) AS professores_total,
            COUNT(DISTINCT CASE WHEN professor_profiles.active=1 THEN professor_profiles.id END) AS professores_ativos
          FROM locations
          LEFT JOIN classes ON classes.location_id=locations.id AND classes.school_year_id=?
          LEFT JOIN enrollments ON enrollments.class_id=classes.id
          LEFT JOIN professor_profiles ON professor_profiles.id=classes.professor_id
          GROUP BY locations.id,locations.name,locations.active ORDER BY locations.name
        `).all(period.id);
        return json(response, 200, {
          cursos: cursos.map(row => ({ ...row, ativo: row.active === 1, turmas: Number(row.turmas_total || 0), turmasAtivas: Number(row.turmas_ativas || 0), matriculas: Number(row.matriculas_total || 0) })),
          locais: locais.map(row => ({ ...row, ativo: row.active === 1, turmas: Number(row.turmas_total || 0), turmasAtivas: Number(row.turmas_ativas || 0), matriculas: Number(row.matriculas_total || 0), professores: Number(row.professores_total || 0), professoresAtivos: Number(row.professores_ativos || 0) })),
        });
      }
    return json(response, 404, { message: 'Rota não encontrada.' });
  };
}
