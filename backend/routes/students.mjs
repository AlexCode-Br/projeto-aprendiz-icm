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
    activeChurch,
    studentSelect,
    studentView,
    validateStudent,
    studentClassIds,
    studentCourseNames,
    activeClassesForStudent,
  } = context;

  return async function studentRoutes(request, response, url, ip) {
      if(request.method==='GET'&&url.pathname==='/api/churches'){
        if(!await authorize(request,response,['gestor','professor']))return;
        const rows=await db.prepare('SELECT id,name AS nome,active FROM churches WHERE active=1 ORDER BY name').all();
        return json(response,200,rows.map(row=>({id:Number(row.id),nome:row.nome,ativo:row.active===1})));
      }
      if(request.method==='POST'&&url.pathname==='/api/churches'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const body=await readJson(request),name=cleanText(body.nome,100),errorMessage=catalogNameError(name,'igreja');
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
        const id=Number(churchMatch[1]),body=await readJson(request),name=cleanText(body.nome,100),errorMessage=catalogNameError(name,'igreja');
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
    
      const studentContactMatch=url.pathname.match(/^\/api\/alunos\/(\d+)\/contatos$/);
      if(studentContactMatch&&request.method==='GET'){
        if(!await authorize(request,response,['gestor']))return;
        const studentId=Number(studentContactMatch[1]);
        const rows=await db.prepare(`SELECT student_contacts.id,student_contacts.note,student_contacts.outcome,student_contacts.contacted_at,users.name AS registered_by FROM student_contacts JOIN users ON users.id=student_contacts.user_id WHERE student_contacts.student_id=? ORDER BY student_contacts.contacted_at DESC,student_contacts.id DESC LIMIT 50`).all(studentId);
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
        const page = Math.max(1, Number(url.searchParams.get('page') || 1));
        const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 10)));
        const search = `%${String(url.searchParams.get('search') || '').trim()}%`;
        const total = (await db.prepare(`SELECT COUNT(DISTINCT students.id) AS total FROM students JOIN enrollments ON enrollments.student_id=students.id AND enrollments.status='ativa' JOIN classes ON classes.id=enrollments.class_id AND classes.active=1 WHERE classes.school_year_id=? AND students.active=1 AND (students.name LIKE ? OR COALESCE(students.email,'') LIKE ?)`).get(period.id,search,search)).total;
        const rows = await db.prepare(`${studentSelect} WHERE students.active=1 AND (students.name LIKE ? OR COALESCE(students.email,'') LIKE ?) AND EXISTS (SELECT 1 FROM enrollments selected_enrollments JOIN classes selected_classes ON selected_classes.id=selected_enrollments.class_id WHERE selected_enrollments.student_id=students.id AND selected_enrollments.status='ativa' AND selected_classes.active=1 AND selected_classes.school_year_id=?) GROUP BY students.id ORDER BY students.name LIMIT ? OFFSET ?`).all(period.id,search,search,period.id,limit,(page-1)*limit);
        return json(response, 200, { alunos: rows.map(studentView), total });
      }
    
      if (request.method === 'POST' && url.pathname === '/alunos') {
        const session = await authorize(request, response, ['gestor']); if (!session) return;
        const period=await selectedSchoolYear(request,response,{writable:true});if(!period)return;
        const body = await readJson(request);
        const name = cleanText(body.nome,100), email = cleanEmail(body.contato || body.email), phone=cleanText(body.telefone,30);
        const guardianName=body.classe==='Adolescente'?cleanText(body.guardian_name,100):'',guardianPhone=body.classe==='Adolescente'?cleanText(body.guardian_phone,30):'',guardianConsent=body.classe==='Adolescente'&&body.guardian_consent===true,church=await activeChurch(body.church_id||body.local);
        const rawClassIds=Array.isArray(body.turmas)?body.turmas:[],classIds=studentClassIds(rawClassIds),courseNames=studentCourseNames(body.curso);
        const selections=rawClassIds.length?rawClassIds:courseNames;
        const errors=validateStudent({...body,nome:name,contato:email,telefone:phone,guardian_name:guardianName,guardian_phone:guardianPhone,guardian_consent:guardianConsent,turmas:selections,local:church?.id||''});
        if(!church)errors.local='Selecione uma igreja de origem cadastrada.';
        if(rawClassIds.some(value => !Number.isInteger(Number(value)) || Number(value) <= 0))errors.curso='Selecione somente turmas válidas.';
        if(hasValidationErrors(errors))return invalid(response,errors);
        const { classes: classRows, error: classError } = await activeClassesForStudent(classIds, courseNames, period.id);
        if (classError) return invalid(response, { curso: classError });
        try {
          const studentId=await db.transaction(async()=>{
            const result = await db.prepare('INSERT INTO students (name,email,phone,guardian_name,guardian_phone,guardian_consent_at,church_id,age_group,has_instrument) VALUES (?,?,?,?,?,?,?,?,?)').run(name,email||null,phone,guardianName||null,guardianPhone||null,guardianConsent?new Date().toISOString():null,church.id,body.classe,body.instrumento === 'Sim' ? 1 : 0);
            for (const classRow of classRows) {
              await db.prepare('INSERT INTO enrollments (student_id,class_id) VALUES (?,?)').run(result.lastInsertRowid,classRow.id);
            }
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'student_created',ip);
            return Number(result.lastInsertRowid);
          });
          const classSummary=classRows.map(item=>item.course_name).join(', ');
          await notificationService.notifyManagers('newStudent','Novo aluno cadastrado',`${name} foi cadastrado${classSummary?` nas turmas de ${classSummary}`:''}.`,`student-created/${studentId}`);
          for(const professorId of [...new Set(classRows.map(item=>Number(item.professor_id)).filter(Boolean))]){
            await notificationService.notifyProfessor(professorId,'newStudent','Novo aluno em sua turma',`${name} foi incluído em uma de suas turmas.`,`student-created/${studentId}`);
          }
          return json(response, 201, { id: studentId });
        } catch (error) {
          if (error.code === '23505' || String(error).includes('UNIQUE')) return json(response, 409, { message: 'Já existe um aluno com este e-mail.' });
          throw error;
        }
      }
    
      const studentMatch = url.pathname.match(/^\/alunos\/(\d+)$/);
      if (studentMatch && request.method === 'PUT') {
        const session = await authorize(request, response, ['gestor']); if (!session) return;
        const period=await selectedSchoolYear(request,response,{writable:true});if(!period)return;
        const id = Number(studentMatch[1]), body = await readJson(request);
        const name=cleanText(body.nome,100),email=cleanEmail(body.contato||body.email),phone=cleanText(body.telefone,30),guardianName=body.classe==='Adolescente'?cleanText(body.guardian_name,100):'',guardianPhone=body.classe==='Adolescente'?cleanText(body.guardian_phone,30):'',guardianConsent=body.classe==='Adolescente'&&body.guardian_consent===true,church=await activeChurch(body.church_id||body.local),rawClassIds=Array.isArray(body.turmas)?body.turmas:[],classIds=studentClassIds(rawClassIds),courseNames=studentCourseNames(body.curso);
        const selections=rawClassIds.length?rawClassIds:courseNames;
        const errors=validateStudent({...body,nome:name,contato:email,telefone:phone,guardian_name:guardianName,guardian_phone:guardianPhone,guardian_consent:guardianConsent,turmas:selections,local:church?.id||''});
        if(!church)errors.local='Selecione uma igreja de origem cadastrada.';
        if(rawClassIds.some(value => !Number.isInteger(Number(value)) || Number(value) <= 0))errors.curso='Selecione somente turmas válidas.';
        if(hasValidationErrors(errors))return invalid(response,errors);
        const { classes: classRows, error: classError } = await activeClassesForStudent(classIds, courseNames, period.id,id);
        if (classError) return invalid(response, { curso: classError });
        const currentStudent=await db.prepare('SELECT id,guardian_consent_at FROM students WHERE id=? AND active=1').get(id);
        if(!currentStudent)return json(response,404,{message:'Aluno ativo não encontrado.'});
        try {
          await db.transaction(async()=>{
            const guardianConsentAt=guardianConsent?(currentStudent.guardian_consent_at||new Date().toISOString()):currentStudent.guardian_consent_at;
            await db.prepare(`UPDATE students SET name=?,email=?,phone=?,guardian_name=?,guardian_phone=?,guardian_consent_at=?,church_id=?,age_group=?,has_instrument=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND active=1`)
              .run(name,email||null,phone,guardianName||null,guardianPhone||null,guardianConsentAt,church.id,body.classe,body.instrumento==='Sim'?1:0,id);
            const currentEnrollments=await db.prepare("SELECT enrollments.id,enrollments.class_id,classes.course_id FROM enrollments JOIN classes ON classes.id=enrollments.class_id WHERE enrollments.student_id=? AND enrollments.status='ativa' AND classes.school_year_id=?").all(id,period.id);
            const selectedIds=new Set(classRows.map(classRow=>Number(classRow.id)));
            const selectedByCourse=new Map(classRows.map(classRow=>[Number(classRow.course_id),Number(classRow.id)]));
            for(const enrollment of currentEnrollments){
              if(selectedIds.has(Number(enrollment.class_id)))continue;
              await db.prepare("UPDATE enrollments SET status='cancelada',transferred_to_class_id=? WHERE id=?")
                .run(selectedByCourse.get(Number(enrollment.course_id))||null,enrollment.id);
            }
            for (const classRow of classRows) {
              await db.prepare(`INSERT INTO enrollments (student_id,class_id,status,completed_at,transferred_to_class_id) VALUES (?,?,'ativa',NULL,NULL) ON CONFLICT(student_id,class_id) DO UPDATE SET status='ativa',completed_at=NULL,transferred_to_class_id=NULL`).run(id,classRow.id);
            }
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'student_updated',ip);
          });
          return json(response, 200, { success: true });
        } catch (error) {
          if (error.code === '23505' || String(error).includes('UNIQUE')) return json(response, 409, { message: 'Já existe um aluno com este e-mail.' });
          throw error;
        }
      }
      if (studentMatch && request.method === 'DELETE') {
        const session = await authorize(request, response, ['gestor']); if (!session) return;
        const id = Number(studentMatch[1]);
        const student = await db.prepare('SELECT id FROM students WHERE id=? AND active=1').get(id);
        if (!student) return json(response, 404, { message: 'Aluno ativo não encontrado.' });
        await profilePhotoStorage.remove('student',id);
        await db.transaction(async () => {
          const enrollments = await db.prepare("SELECT class_id FROM enrollments WHERE student_id=? AND status='ativa'").all(id);
          await db.prepare('DELETE FROM student_contacts WHERE student_id=?').run(id);
          await db.prepare("UPDATE dropout_events SET reason='Dados anonimizados por solicitação',reason_category='outro' WHERE student_id=?").run(id);
          for (const enrollment of enrollments) {
            await db.prepare('INSERT INTO dropout_events (student_id,class_id,reason,reason_category,occurred_at) VALUES (?,?,?,?,?)').run(id,enrollment.class_id,'Dados anonimizados por solicitação','outro',new Date().toISOString().slice(0,10));
          }
          await db.prepare("UPDATE enrollments SET status='cancelada',transferred_to_class_id=NULL WHERE student_id=? AND status='ativa'").run(id);
          await db.prepare(`UPDATE students SET name=?,email=NULL,phone=NULL,guardian_name=NULL,guardian_phone=NULL,guardian_consent_at=NULL,church_id=NULL,age_group=NULL,has_instrument=0,active=0,anonymized_at=CURRENT_TIMESTAMP,anonymized_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(`Aluno anonimizado #${id}`,session.user_id,id);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`student_anonymized:${id}`,ip);
        });
        return json(response, 200, { success: true, anonymized: true, message: 'Os dados pessoais do aluno foram anonimizados de forma irreversível.' });
      }
    
      if (request.method === 'GET' && (url.pathname === '/professores/meus-alunos' || url.pathname === '/api/professores/me/alunos')) {
        const session = await authorize(request, response, ['professor']); if (!session) return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const page = Math.max(1, Number(url.searchParams.get('page') || 1));
        const limit = url.pathname.startsWith('/api/') ? 100 : Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 10)));
        const search = `%${String(url.searchParams.get('search') || '').trim()}%`;
        const profile = await db.prepare('SELECT id FROM professor_profiles WHERE user_id=? AND active=1').get(session.user_id);
        if (!profile) return json(response, 403, { message: 'Perfil de professor não configurado.' });
        const total = (await db.prepare(`SELECT COUNT(DISTINCT students.id) AS total FROM students JOIN enrollments ON enrollments.student_id=students.id JOIN classes ON classes.id=enrollments.class_id WHERE students.active=1 AND enrollments.status='ativa' AND classes.active=1 AND classes.school_year_id=? AND classes.professor_id=? AND (students.name LIKE ? OR COALESCE(students.email,'') LIKE ?)`).get(period.id,profile.id,search,search)).total;
        const rows = await db.prepare(`${studentSelect} WHERE students.active=1 AND students.id IN (SELECT enrollments.student_id FROM enrollments JOIN classes ON classes.id=enrollments.class_id WHERE enrollments.status='ativa' AND classes.active=1 AND classes.school_year_id=? AND classes.professor_id=?) AND (students.name LIKE ? OR COALESCE(students.email,'') LIKE ?) GROUP BY students.id ORDER BY students.name LIMIT ? OFFSET ?`).all(period.id,period.id,profile.id,search,search,limit,(page-1)*limit);
        return json(response, 200, { alunos: rows.map(studentView), total });
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
