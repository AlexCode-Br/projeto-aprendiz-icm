const DAY_MS = 86_400_000;

function shiftDate(date, days) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function mondayOfWeek(date) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shiftDate(date, -(day === 0 ? 6 : day - 1));
}

export function createNotificationJobs({ db, sendEmail, pendingAttendance, atRiskStudents, zonedTodayDate, baseUrl }) {
  async function deliver({ type, referenceKey, recipient, subject, body }) {
    await db.prepare(`INSERT INTO scheduled_notifications (notification_type,reference_key,recipient,status)
      VALUES (?,?,?,'pending') ON CONFLICT(notification_type,reference_key,recipient) DO NOTHING`).run(type,referenceKey,recipient);
    const notification=await db.prepare('SELECT id,status FROM scheduled_notifications WHERE notification_type=? AND reference_key=? AND recipient=?').get(type,referenceKey,recipient);
    if(notification?.status==='sent')return 'skipped';
    await db.prepare("UPDATE scheduled_notifications SET status='pending',attempts=attempts+1,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(notification.id);
    try{
      await sendEmail(recipient,subject,body,`${type}/${referenceKey}/${recipient}`);
      await db.prepare("UPDATE scheduled_notifications SET status='sent',sent_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(notification.id);
      return 'sent';
    }catch(error){
      await db.prepare("UPDATE scheduled_notifications SET status='failed',last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(String(error?.message||'Falha desconhecida').slice(0,500),notification.id);
      return 'failed';
    }
  }

  async function runAttendanceReminders() {
    const period=await db.prepare('SELECT * FROM school_years WHERE active=1 AND closed_at IS NULL ORDER BY id DESC LIMIT 1').get();
    if(!period)return{sent:0,failed:0,skipped:0};
    const pending=await pendingAttendance(period),result={sent:0,failed:0,skipped:0};
    for(const item of pending){
      const outcome=await deliver({
        type:'attendance_reminder',
        referenceKey:`${item.classId}:${item.data}`,
        recipient:item.professorEmail,
        subject:`Chamada pendente — ${item.curso}`,
        body:`Olá, ${item.professor}. A chamada da turma ${item.curso}, em ${item.local}, referente a ${item.data.split('-').reverse().join('/')}, ainda não foi registrada.\n\nAcesse ${baseUrl}/professor/frequencia para concluir o registro.`,
      });
      result[outcome]+=1;
    }
    return result;
  }

  async function runWeeklyManagerSummary() {
    const period=await db.prepare('SELECT * FROM school_years WHERE active=1 AND closed_at IS NULL ORDER BY id DESC LIMIT 1').get();
    if(!period)return{sent:0,failed:0,skipped:0};
    const today=zonedTodayDate(),weekStart=mondayOfWeek(today),tomorrow=shiftDate(today,1);
    const [enrollments,risk,pending,tickets,managers]=await Promise.all([
      db.prepare(`SELECT COUNT(*) AS total FROM enrollments JOIN classes ON classes.id=enrollments.class_id
        WHERE classes.school_year_id=? AND enrollments.enrolled_at>=? AND enrollments.enrolled_at<?`).get(period.id,weekStart,tomorrow),
      atRiskStudents(period.id),
      pendingAttendance(period),
      db.prepare("SELECT COUNT(*) AS total FROM support_tickets WHERE status<>'Resolvido'").get(),
      db.prepare("SELECT email,name FROM users WHERE role='gestor' AND active=1 ORDER BY id").all(),
    ]);
    const result={sent:0,failed:0,skipped:0};
    for(const manager of managers){
      const outcome=await deliver({
        type:'weekly_manager_summary',
        referenceKey:`${period.id}:${weekStart}`,
        recipient:manager.email,
        subject:`Resumo semanal — ${period.label}`,
        body:`Olá, ${manager.name}. Este é o resumo do Projeto Aprendiz desde ${weekStart.split('-').reverse().join('/')}:\n\n• Novas matrículas: ${Number(enrollments.total||0)}\n• Alunos em risco: ${risk.length}\n• Chamadas pendentes: ${pending.length}\n• Tickets abertos: ${Number(tickets.total||0)}\n\nAcesse ${baseUrl}/gestor/dashboard para ver os detalhes.`,
      });
      result[outcome]+=1;
    }
    return result;
  }

  return { runAttendanceReminders, runWeeklyManagerSummary };
}

export function startNotificationScheduler({ runAttendanceReminders, runWeeklyManagerSummary, intervalMs = 60 * 60_000, startupDelayMs = 30_000, logger = console }) {
  let timer=null,running=false,stopped=false;
  const schedule=delay=>{
    if(stopped)return;
    timer=setTimeout(tick,delay);
    timer.unref?.();
  };
  const tick=async()=>{
    if(running||stopped)return schedule(intervalMs);
    running=true;
    try{
      await runAttendanceReminders();
      await runWeeklyManagerSummary();
    }catch(error){logger.error('Falha ao executar notificações agendadas:',error);}
    finally{running=false;schedule(intervalMs);}
  };
  schedule(startupDelayMs);
  return{stop(){stopped=true;if(timer)clearTimeout(timer);}};
}
