import { studentCalendar } from '../../shared/student-calendar.mjs';
import { churchName } from '../../shared/catalog-options.mjs';

const churchKey=value=>churchName(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

const mergeChurchOptions=(churches,locations)=>{
  const churchByKey=new Map(churches.map(row=>[churchKey(row.nome),row]));
  const options=locations.map(location=>{
    const church=churchByKey.get(churchKey(location.nome));
    return {id:church?Number(church.id):`location:${Number(location.id)}`,nome:location.nome};
  });
  const known=new Set(locations.map(row=>churchKey(row.nome)));
  for(const church of churches)if(!known.has(churchKey(church.nome)))options.push({id:Number(church.id),nome:churchName(church.nome)});
  return options.sort((left,right)=>left.nome.localeCompare(right.nome,'pt-BR',{sensitivity:'base'}));
};

// Every audience check is correlated to the authenticated student, never a request student ID.
export const studentAudience = `EXISTS (SELECT 1 FROM student_announcement_audiences saa
  WHERE saa.announcement_id=a.id AND (saa.all_students=1 OR EXISTS (
    SELECT 1 FROM student_announcement_classes sac
    JOIN enrollments e ON e.class_id=sac.class_id AND e.student_id=? AND e.status='ativa'
    JOIN classes c ON c.id=e.class_id AND c.active=1
    JOIN school_years sy ON sy.id=c.school_year_id AND sy.active=1 AND sy.closed_at IS NULL
    WHERE sac.announcement_id=a.id)))`;

export function createStudentPortalRoutes(context) {
  const {db,json,authorize,readJson,announcementScheduledCondition,sanitizeAnnouncementContent,securityHeaders,supabaseAdmin,announcementStorageBucket}=context;
  const published=`a.active=1 AND ${announcementScheduledCondition('a.scheduled_at')} AND ${studentAudience}`;
  const ownedClasses=studentId=>db.prepare(`SELECT c.id,co.name AS curso,l.name AS local,c.label,
    e.status,e.enrolled_at,sy.id AS periodo_id,sy.label AS periodo,sy.active AS periodo_ativo,
    sy.start_date,sy.end_date,sy.dates_confirmed
    FROM enrollments e JOIN classes c ON c.id=e.class_id AND c.active=1
    JOIN courses co ON co.id=c.course_id JOIN locations l ON l.id=c.location_id
    JOIN school_years sy ON sy.id=c.school_year_id
    WHERE e.student_id=? AND e.status IN ('ativa','concluida') ORDER BY sy.start_date DESC,co.name,c.id`).all(studentId);
  return async (request,response,url,ip)=>{
    const audienceMatch=url.pathname.match(/^\/api\/student-audiences\/(\d+)$/);
    if (audienceMatch) {
      const manager=await authorize(request,response,['gestor']); if (!manager) return;
      const id=Number(audienceMatch[1]);
      if (!await db.prepare('SELECT id FROM announcements WHERE id=? AND active=1').get(id)) return json(response,404,{message:'Informativo não encontrado.'});
      const classes=await db.prepare(`SELECT c.id,co.name AS curso,l.name AS local FROM classes c
        JOIN courses co ON co.id=c.course_id JOIN locations l ON l.id=c.location_id
        JOIN school_years sy ON sy.id=c.school_year_id AND sy.active=1 AND sy.closed_at IS NULL
        WHERE c.active=1 ORDER BY co.name,l.name,c.id`).all();
      if (request.method==='GET') {
        const audience=await db.prepare('SELECT all_students FROM student_announcement_audiences WHERE announcement_id=?').get(id);
        const selected=await db.prepare('SELECT class_id FROM student_announcement_classes WHERE announcement_id=?').all(id);
        return json(response,200,{mode:audience ? audience.all_students ? 'all' : 'classes' : 'none',selected:selected.map(row=>Number(row.class_id)),classes});
      }
      if (request.method!=='PUT') return json(response,405,{message:'Método não permitido.'});
      const body=await readJson(request), ids=[...new Set(Array.isArray(body.selected)?body.selected.map(Number):[])];
      if (!['none','all','classes'].includes(body.mode) || (body.mode==='classes' && (!ids.length || ids.some(id=>!classes.some(c=>Number(c.id)===id))))) return json(response,400,{message:'Selecione um público e turmas válidas.'});
      await db.transaction(async()=>{
        await db.prepare('DELETE FROM student_announcement_classes WHERE announcement_id=?').run(id);
        await db.prepare('DELETE FROM student_announcement_audiences WHERE announcement_id=?').run(id);
        if (body.mode!=='none') {
          await db.prepare('INSERT INTO student_announcement_audiences (announcement_id,all_students) VALUES (?,?)').run(id,body.mode==='all'?1:0);
          if (body.mode==='classes') for (const classId of ids) await db.prepare('INSERT INTO student_announcement_classes (announcement_id,class_id) VALUES (?,?)').run(id,classId);
        }
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(manager.user_id,`student_announcement_audience:${id}:${body.mode}`,ip);
      });
      return json(response,200,{message:'Público de alunos atualizado. O aviso aparecerá na data de publicação.'});
    }
    const session=await authorize(request,response,['aluno']); if (!session) return;
    const studentId=session.student_id;
    const courseMatch=url.pathname.match(/^\/api\/aluno\/cursos\/(\d+)$/);
    if(courseMatch&&request.method==='GET'){
      const course=(await ownedClasses(studentId)).find(c=>Number(c.id)===Number(courseMatch[1]));
      if(!course)return json(response,404,{message:'Curso não encontrado.'});
      return json(response,200,{id:Number(course.id),curso:course.curso,local:course.local,label:course.label,periodo:course.periodo,periodId:course.periodo_id,status:course.status});
    }
    if (request.method==='PUT' && url.pathname==='/api/aluno/perfil') {
      const body=await readJson(request);
      if (Object.keys(body).some(key=>!['telefone','church_id','classe','instrumento','guardian_name','guardian_phone','guardian_consent'].includes(key))) return json(response,400,{message:'Este formulário permite alterar apenas dados pessoais. Matrículas e permissões não podem ser alteradas.'});
      const phone=context.cleanText(body.telefone,30),guardianName=context.cleanText(body.guardian_name,100),guardianPhone=context.cleanText(body.guardian_phone,30);
      const churchValue=String(body.church_id??'').trim();
      let church=/^\d+$/.test(churchValue)?await db.prepare('SELECT id,name FROM churches WHERE id=? AND active=1').get(Number(churchValue)):null;
      let suggestedChurchName='';
      const locationMatch=churchValue.match(/^location:(\d+)$/);
      if(locationMatch){
        const location=await db.prepare("SELECT id,name FROM locations WHERE id=? AND active=1 AND LOWER(name) NOT IN ('ead','remoto')").get(Number(locationMatch[1]));
        if(location){
          const churches=await db.prepare('SELECT id,name FROM churches WHERE active=1').all();
          church=churches.find(row=>churchKey(row.name)===churchKey(location.name))||null;
          if(!church)suggestedChurchName=location.name;
        }
      }
      const errors={telefone:context.phoneError(phone),church_id:church?'':'Selecione uma igreja cadastrada.',classe:['Adolescente','Jovem','Senhora','Varão'].includes(body.classe)?'':'Selecione uma classe válida.',instrumento:typeof body.instrumento==='boolean'?'':'Informe se possui instrumento.'};
      if(suggestedChurchName)errors.church_id='';
      if(body.classe==='Adolescente'){
        errors.guardian_name=context.personNameError(guardianName,'nome do responsável');
        errors.guardian_phone=context.phoneError(guardianPhone);
        errors.guardian_consent=body.guardian_consent===true?'':'Confirme a autorização do responsável legal.';
      }
      if(context.hasValidationErrors(errors))return context.invalid(response,errors);
      await db.transaction(async()=>{
        if(suggestedChurchName){
          await db.prepare('INSERT INTO churches (name,active) VALUES (?,1) ON CONFLICT DO NOTHING').run(suggestedChurchName);
          church=await db.prepare('SELECT id,name,active FROM churches WHERE LOWER(name)=LOWER(?)').get(suggestedChurchName);
          if(!church)throw new Error('student_church_not_saved');
          if(Number(church.active)===0)await db.prepare('UPDATE churches SET active=1 WHERE id=?').run(church.id);
        }
        await db.prepare(`UPDATE students SET phone=?,church_id=?,age_group=?,has_instrument=?,guardian_name=?,guardian_phone=?,
          guardian_consent_at=CASE WHEN ?=1 THEN COALESCE(guardian_consent_at,CURRENT_TIMESTAMP) ELSE guardian_consent_at END,
          updated_at=CURRENT_TIMESTAMP WHERE id=? AND active=1`).run(phone,church.id,body.classe,body.instrumento?1:0,body.classe==='Adolescente'?guardianName:null,body.classe==='Adolescente'?guardianPhone:null,body.classe==='Adolescente'?1:0,studentId);
        await db.prepare('INSERT INTO audit_log(user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'student_personal_data_updated',ip);
      });
      return json(response,200,{message:'Seus dados pessoais foram atualizados.'});
    }
    if (request.method==='GET' && url.pathname==='/api/aluno/perfil') {
      const profile=await db.prepare(`SELECT s.name AS nome,s.email,s.phone AS telefone,s.age_group AS classe,
        s.church_id,s.guardian_name,s.guardian_phone,s.guardian_consent_at,
        s.has_instrument AS instrumento,ch.name AS igreja FROM students s LEFT JOIN churches ch ON ch.id=s.church_id WHERE s.id=?`).get(studentId);
      const churches=await db.prepare('SELECT id,name AS nome FROM churches WHERE active=1 ORDER BY name').all();
      const locations=await db.prepare("SELECT id,name AS nome FROM locations WHERE active=1 AND LOWER(name) NOT IN ('ead','remoto') ORDER BY name").all();
      return json(response,200,{...profile,churches:mergeChurchOptions(churches,locations)});
    }
    if (request.method==='GET' && ['/api/aluno/turmas','/api/aluno/calendario','/api/aluno/frequencia'].includes(url.pathname)) {
      const classes=await ownedClasses(studentId);
      const periods=[...new Map(classes.map(c=>[c.periodo_id,{id:c.periodo_id,label:c.periodo,active:c.periodo_ativo===1}])).values()];
      const supplied=url.searchParams.get('periodo');
      const periodId=supplied ? Number(supplied) : Number(periods.find(p=>p.active)?.id || periods[0]?.id || 0);
      if (supplied && (!Number.isSafeInteger(periodId) || !periods.some(p=>Number(p.id)===periodId))) return json(response,404,{message:'Período não encontrado.'});
      let selected=classes.filter(c=>Number(c.periodo_id)===periodId);
      const classId=url.searchParams.get('turma');
      if (classId) {
        if (!selected.some(c=>Number(c.id)===Number(classId))) return json(response,404,{message:'Turma não encontrada.'});
        selected=selected.filter(c=>Number(c.id)===Number(classId));
      }
      const ids=selected.map(c=>Number(c.id)), placeholders=ids.map(()=>'?').join(',');
      const slots=ids.length ? await db.prepare(`SELECT class_id,weekday_index,start_minutes FROM class_schedules WHERE class_id IN (${placeholders})`).all(...ids) : [];
      const dates=ids.length ? await db.prepare(`SELECT class_id,class_date,start_minutes FROM class_schedule_dates WHERE class_id IN (${placeholders})`).all(...ids) : [];
      const safeClasses=selected.map(c=>({id:Number(c.id),curso:c.curso,local:c.local,label:c.label,status:c.status,periodo:c.periodo,
        horarios:[...slots,...dates].filter(s=>Number(s.class_id)===Number(c.id)).map(s=>({dia:s.weekday_index??null,data:s.class_date?String(s.class_date).slice(0,10):null,minutos:Number(s.start_minutes)}))}));
      if (url.pathname.endsWith('/turmas')) return json(response,200,{turmas:safeClasses,periods,periodId});
      if (url.pathname.endsWith('/calendario')) {
        const month=url.searchParams.get('mes') || context.zonedTodayDate().slice(0,7);
        if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return json(response,400,{message:'Mês inválido.'});
        return json(response,200,{aulas:studentCalendar(selected,[...slots,...dates],month),periods,periodId,mes:month,turmas:safeClasses});
      }
      const page=Math.max(1,Math.min(100000,parseInt(url.searchParams.get('page'),10)||1));
      const attendanceScope=`FROM attendance_records ar JOIN attendance_sessions ats ON ats.id=ar.session_id
        JOIN classes c ON c.id=ats.class_id JOIN courses co ON co.id=c.course_id JOIN locations l ON l.id=c.location_id
        WHERE ar.student_id=? AND c.id IN (${placeholders})`;
      const summary=ids.length?await db.prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN ar.status='presente' THEN 1 ELSE 0 END) AS presentes,
        SUM(CASE WHEN ar.status='justificado' THEN 1 ELSE 0 END) AS justificadas ${attendanceScope}`).get(studentId,...ids):{total:0,presentes:0,justificadas:0};
      const records=ids.length?await db.prepare(`SELECT ar.status,ats.class_date AS data,c.id AS turma_id,co.name AS curso,l.name AS local ${attendanceScope} ORDER BY ats.class_date DESC,ats.id DESC LIMIT 5 OFFSET ?`).all(studentId,...ids,(page-1)*5):[];
      const total=Number(summary.total),present=Number(summary.presentes||0),justified=Number(summary.justificadas||0);
      return json(response,200,{registros:records.map(r=>({...r,turmaId:Number(r.turma_id),data:String(r.data).slice(0,10)})),total,presentes:present,justificadas:justified,percentual:total?Math.round((present+justified)/total*100):null,periods,periodId,turmas:safeClasses});
    }
    if (request.method==='GET' && url.pathname==='/api/aluno/nao-lidos') {
      const row=await db.prepare(`SELECT COUNT(*) AS total FROM announcements a WHERE ${published}
        AND NOT EXISTS (SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id=a.id AND ar.user_id=?)`).get(studentId,session.user_id);
      const latest=await db.prepare(`SELECT a.id,
        EXISTS(SELECT 1 FROM student_course_announcements sca WHERE sca.announcement_id=a.id) AS mural
        FROM announcements a WHERE ${published}
          AND NOT EXISTS (SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id=a.id AND ar.user_id=?)
        ORDER BY a.scheduled_at DESC,a.id DESC LIMIT 1`).get(studentId,session.user_id);
      let targetClass=null;
      if(latest){
        targetClass=Boolean(latest.mural)
          ?await db.prepare('SELECT class_id FROM student_course_announcements WHERE announcement_id=?').get(latest.id)
          :await db.prepare(`SELECT sac.class_id FROM student_announcement_classes sac
            JOIN enrollments e ON e.class_id=sac.class_id AND e.student_id=? AND e.status='ativa'
            JOIN classes c ON c.id=e.class_id AND c.active=1
            JOIN school_years sy ON sy.id=c.school_year_id AND sy.active=1 AND sy.closed_at IS NULL
            WHERE sac.announcement_id=? ORDER BY sac.class_id LIMIT 1`).get(studentId,latest.id);
        if(!targetClass)targetClass=await db.prepare(`SELECT e.class_id FROM enrollments e
          JOIN classes c ON c.id=e.class_id AND c.active=1
          JOIN school_years sy ON sy.id=c.school_year_id AND sy.active=1 AND sy.closed_at IS NULL
          WHERE e.student_id=? AND e.status='ativa' ORDER BY e.enrolled_at,e.class_id LIMIT 1`).get(studentId);
      }
      return json(response,200,{total:Number(row.total),turmaId:targetClass?Number(targetClass.class_id):null,origem:latest?(latest.mural?'mural':'informativos'):null});
    }
    if (request.method==='GET' && ['/api/aluno/informativos','/api/aluno/notificacoes'].includes(url.pathname)) {
      const page=Math.max(1,Math.min(100000,parseInt(url.searchParams.get('page'),10)||1));
      const classId=url.searchParams.get('turma');
      const origin=url.searchParams.get('origem');
      if(origin&&!['mural','gestao'].includes(origin))return json(response,400,{message:'Origem de publicação inválida.'});
      if(classId&&!(await ownedClasses(studentId)).some(c=>Number(c.id)===Number(classId)))return json(response,404,{message:'Curso não encontrado.'});
      const courseFilter=classId?' AND EXISTS (SELECT 1 FROM student_announcement_classes sac WHERE sac.announcement_id=a.id AND sac.class_id=?)':'';
      const originFilter=origin==='mural'
        ? ' AND EXISTS (SELECT 1 FROM student_course_announcements sca_origin WHERE sca_origin.announcement_id=a.id)'
        : origin==='gestao'
          ? ' AND NOT EXISTS (SELECT 1 FROM student_course_announcements sca_origin WHERE sca_origin.announcement_id=a.id)'
          : '';
      const params=[studentId,...(classId?[Number(classId)]:[])];
      const count=await db.prepare(`SELECT COUNT(*) AS total FROM announcements a WHERE ${published}${courseFilter}${originFilter}`).get(...params);
      const rows=await db.prepare(`SELECT a.id,a.title,a.content,a.category,a.scheduled_at,a.pinned,
        EXISTS(SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id=a.id AND ar.user_id=?) AS has_read,
        COALESCE((SELECT sca.requires_acknowledgement FROM student_course_announcements sca WHERE sca.announcement_id=a.id),0) AS requires_acknowledgement
        FROM announcements a WHERE ${published}${courseFilter}${originFilter} ORDER BY a.pinned DESC,a.scheduled_at DESC,a.id DESC LIMIT 5 OFFSET ?`).all(session.user_id,...params,(page-1)*5);
      const ids=rows.map(r=>r.id), attachments=ids.length ? await db.prepare(`SELECT id,announcement_id,filename,mime_type,size_bytes FROM announcement_attachments WHERE announcement_id IN (${ids.map(()=>'?').join(',')}) ORDER BY id`).all(...ids) : [];
      return json(response,200,{total:Number(count.total),items:rows.map(r=>({id:Number(r.id),titulo:r.title,conteudo:sanitizeAnnouncementContent(r.content),categoria:r.category,data:r.scheduled_at,lido:Boolean(r.has_read),confirmado:Boolean(r.has_read),fixado:Boolean(r.pinned),requerConfirmacao:Boolean(r.requires_acknowledgement),
        anexos:attachments.filter(a=>Number(a.announcement_id)===Number(r.id)).map(a=>({id:Number(a.id),nome:a.filename,tipo:a.mime_type,tamanho:Number(a.size_bytes),url:`/api/aluno/informativos/${r.id}/anexos/${a.id}`}))}))});
    }
    const read=url.pathname.match(/^\/api\/aluno\/informativos\/(\d+)\/lido$/);
    const attachment=url.pathname.match(/^\/api\/aluno\/informativos\/(\d+)\/anexos\/(\d+)$/);
    if (read || attachment) {
      const id=Number((read||attachment)[1]);
      if (!await db.prepare(`SELECT a.id FROM announcements a WHERE a.id=? AND ${published}`).get(id,studentId)) return json(response,404,{message:'Informativo não encontrado.'});
      if (read && request.method==='POST') {
        const marked=await db.prepare('INSERT INTO announcement_reads (announcement_id,user_id) VALUES (?,?) ON CONFLICT(announcement_id,user_id) DO NOTHING').run(id,session.user_id);
        const wallPost=await db.prepare('SELECT requires_acknowledgement FROM student_course_announcements WHERE announcement_id=?').get(id);
        if(marked.changes&&Boolean(wallPost?.requires_acknowledgement))await db.prepare('INSERT INTO audit_log(user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`course_wall_acknowledged:${id}`,ip);
        return json(response,200,{success:true,confirmado:true});
      }
      if (attachment && request.method==='GET') {
        const file=await db.prepare('SELECT filename,mime_type,data_url,storage_path FROM announcement_attachments WHERE id=? AND announcement_id=?').get(Number(attachment[2]),id);
        if (!file) return json(response,404,{message:'Anexo não encontrado.'});
        let buffer;
        if (file.storage_path) {
          if (!supabaseAdmin) return json(response,503,{message:'Armazenamento indisponível.'});
          const {data,error}=await supabaseAdmin.storage.from(announcementStorageBucket).download(file.storage_path);
          if (error || !data) return json(response,502,{message:'Não foi possível carregar o anexo.'});
          buffer=Buffer.from(await data.arrayBuffer());
        } else buffer=Buffer.from(String(file.data_url||'').split(',')[1]||'','base64');
        response.writeHead(200,{...securityHeaders(file.mime_type),'Content-Disposition':`${url.searchParams.get('download')==='1'?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,'Cache-Control':'private, no-store','Content-Length':String(buffer.length)});
        return response.end(buffer);
      }
    }
    return json(response,404,{message:'Rota não encontrada.'});
  };
}
