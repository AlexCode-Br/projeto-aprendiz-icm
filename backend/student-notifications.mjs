import { studentAudience } from './routes/student-portal.mjs';

// Bounded, leased deliveries. No academic content is exposed on a lock screen.
export async function deliverStudentNotices({db,notificationService,announcementScheduledCondition,logger=console}) {
  const now=new Date().toISOString();
  const rows=await db.prepare(`SELECT a.id AS announcement_id,sa.user_id,
    (SELECT MIN(sac.class_id) FROM student_announcement_classes sac WHERE sac.announcement_id=a.id) AS class_id
    FROM announcements a
    JOIN student_accounts sa ON 1=1 JOIN students s ON s.id=sa.student_id AND s.active=1 AND s.anonymized_at IS NULL
    JOIN users u ON u.id=sa.user_id AND u.active=1 AND u.role='aluno'
    LEFT JOIN student_notice_deliveries d ON d.announcement_id=a.id AND d.user_id=sa.user_id
    WHERE a.active=1 AND a.author_user_id<>sa.user_id AND ${announcementScheduledCondition('a.scheduled_at')}
      AND NOT EXISTS(SELECT 1 FROM student_course_announcements sca WHERE sca.announcement_id=a.id)
      AND ${studentAudience.replace('?', 'sa.student_id')}
      AND (d.announcement_id IS NULL OR (d.finished=0 AND d.attempts<3 AND d.lease_until<=?))
    ORDER BY a.scheduled_at,a.id,sa.user_id LIMIT 50`).all(now);
  let processed=0;
  for (const row of rows) {
    const lease=new Date(Date.now()+5*60000).toISOString();
    const claim=await db.prepare(`INSERT INTO student_notice_deliveries (announcement_id,user_id,lease_until,attempts,finished)
      VALUES (?,?,?,1,0) ON CONFLICT(announcement_id,user_id) DO UPDATE SET lease_until=excluded.lease_until,
      attempts=student_notice_deliveries.attempts+1
      WHERE student_notice_deliveries.finished=0 AND student_notice_deliveries.attempts<3 AND student_notice_deliveries.lease_until<=?`)
      .run(row.announcement_id,row.user_id,lease,now);
    if (!claim.changes) continue;
    try {
      // Recheck visibility after acquiring the lease (enrollment/audience can change).
      const eligible=await db.prepare(`SELECT a.id FROM announcements a JOIN student_accounts sa ON sa.user_id=?
        JOIN students s ON s.id=sa.student_id AND s.active=1 AND s.anonymized_at IS NULL
        WHERE a.id=? AND a.active=1 AND ${announcementScheduledCondition('a.scheduled_at')}
        AND ${studentAudience.replace('?', 'sa.student_id')}`).get(row.user_id,row.announcement_id);
      if (!eligible) continue;
      const destination=row.class_id?`/aluno/cursos/${row.class_id}?view=informativos`:'/aluno/dashboard';
      const result=await notificationService.notifyUser(row.user_id,'systemNews','Novo informativo — Projeto Aprendiz',
        'Há um novo informativo da gestão destinado à sua turma.',`student-announcement/${row.announcement_id}/${row.user_id}`,destination);
      if (result.sent || result.reason==='disabled') await db.prepare('UPDATE student_notice_deliveries SET finished=1 WHERE announcement_id=? AND user_id=? AND lease_until=?').run(row.announcement_id,row.user_id,lease);
      processed++;
    } catch(error) { logger.error('student_notice_delivery_failed',error,{announcementId:row.announcement_id,userId:row.user_id}); }
  }
  return {processed};
}
