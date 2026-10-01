export function courseWallDestination(role,classId){
  if(role==='aluno')return `/aluno/cursos/${classId}?view=mural`;
  if(role==='professor')return `/professor/turmas?turma=${classId}`;
  return '/configuracoes';
}

async function courseWallParticipants(db,classId){
  return db.prepare(`SELECT u.id AS user_id,u.role FROM users u
    JOIN professor_profiles pp ON pp.user_id=u.id AND pp.active=1
    JOIN classes c ON c.professor_id=pp.id AND c.id=? AND c.active=1
    WHERE u.active=1 AND u.role='professor'
    UNION
    SELECT u.id AS user_id,u.role FROM users u
    JOIN student_accounts sa ON sa.user_id=u.id
    JOIN students s ON s.id=sa.student_id AND s.active=1 AND s.anonymized_at IS NULL
    JOIN enrollments e ON e.student_id=s.id AND e.class_id=? AND e.status='ativa'
    WHERE u.active=1 AND u.role='aluno'`).all(classId,classId);
}

export async function notifyCourseWallGroup({db,notificationService,notificationOutbox,logger,classId,courseName,actorUserId,actorName,event,eventId}){
  const preference=event==='post'?'wallPosts':'wallComments';
  const subject=event==='post'?`Nova publicação — ${courseName}`:`Nova mensagem — ${courseName}`;
  const body=event==='post'
    ?`${actorName} publicou uma nova mensagem no mural da turma.`
    :`${actorName} comentou em uma publicação do mural da turma.`;
  const participants=await courseWallParticipants(db,classId);
  const recipients=participants.filter(item=>['professor','aluno'].includes(item.role)&&Number(item.user_id)!==Number(actorUserId));
  if(notificationOutbox)return notificationOutbox.enqueueMany(recipients.map(item=>({
    userId:item.user_id,preference,subject,body,
    idempotencyKey:`course-wall/${event}/${classId}/${eventId}/user-${item.user_id}`,
    tag:`course-wall/${classId}`,
    destination:courseWallDestination(item.role,classId),
    channels:{email:false,push:true},
  })));
  const results=await Promise.allSettled(recipients.map(item=>
    notificationService.notifyUser(item.user_id,preference,subject,body,`course-wall/${event}/${classId}/${eventId}/user-${item.user_id}`,{destination:courseWallDestination(item.role,classId),tag:`course-wall/${classId}`,channels:{email:false,push:true}})));
  for(const [index,result] of results.entries())if(result.status==='rejected')logger.error('course_wall_notification_failed',result.reason,{classId,event,eventId,recipientIndex:index});
}

export async function notifyCourseWallLike({notificationService,notificationOutbox,classId,courseName,postId,ownerUserId,ownerRole,actorUserId,actorName}){
  if(Number(ownerUserId)===Number(actorUserId))return;
  const item={userId:ownerUserId,preference:'wallLikes',subject:`${actorName} curtiu sua publicação`,
    body:`Sua publicação no mural da turma ${courseName} recebeu uma nova curtida.`,
    idempotencyKey:`course-wall/like/${classId}/${postId}/actor-${actorUserId}`,
    tag:`course-wall/${classId}/likes`,destination:courseWallDestination(ownerRole,classId),channels:{email:false,push:true}};
  if(notificationOutbox)return notificationOutbox.enqueueMany([item]);
  await notificationService.notifyUser(item.userId,item.preference,item.subject,item.body,item.idempotencyKey,{destination:item.destination,tag:item.tag,channels:item.channels});
}
