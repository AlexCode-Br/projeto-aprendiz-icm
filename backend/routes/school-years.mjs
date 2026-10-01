export function createSchoolYearRoutes(context) {
  const { db, json, readJson, authorize, cleanText, validateSchoolYear, hasValidationErrors, invalid, schoolYearView, duplicateError } = context;
  return async function route(request, response, url, ip) {
    if(request.method==='GET'&&url.pathname==='/api/school-years'){
      if(!await authorize(request,response,['gestor','professor']))return;
      const periods=await db.prepare('SELECT * FROM school_years ORDER BY active DESC,start_date DESC,id DESC').all();
      return json(response,200,{periods:periods.map(schoolYearView),activeId:Number(periods.find(period=>period.active===1)?.id||0)});
    }

    if(request.method==='POST'&&url.pathname==='/api/school-years'){
      const session=await authorize(request,response,['gestor']);if(!session)return;
      const body=await readJson(request);
      const values={label:cleanText(body.label,40),start_date:cleanText(body.start_date||body.startDate,10),end_date:cleanText(body.end_date||body.endDate,10)};
      const errors=validateSchoolYear(values);
      if(hasValidationErrors(errors))return invalid(response,errors);
      const activate=body.ativar===true||body.active===true;
      try{
        const id=await db.transaction(async()=>{
          if(activate)await db.prepare('UPDATE school_years SET active=0,closed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE active=1').run();
          const result=await db.prepare('INSERT INTO school_years (label,start_date,end_date,active,dates_confirmed) VALUES (?,?,?,?,1)')
            .run(values.label,values.start_date,values.end_date,activate?1:0);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,activate?'school_year_created_and_activated':'school_year_created',ip);
          return Number(result.lastInsertRowid);
        });
        return json(response,201,{id,message:activate?'Período criado e ativado.':'Período criado. Ative-o quando o período vigente terminar.'});
      }catch(error){
        if(duplicateError(error))return json(response,409,{message:'Já existe um período com este nome ou outro período está ativo.'});
        throw error;
      }
    }

    const schoolYearMatch=url.pathname.match(/^\/api\/school-years\/(\d+)$/);
    if(schoolYearMatch&&request.method==='PUT'){
      const session=await authorize(request,response,['gestor']);if(!session)return;
      const id=Number(schoolYearMatch[1]),current=await db.prepare('SELECT * FROM school_years WHERE id=?').get(id);
      if(!current)return json(response,404,{message:'Período letivo não encontrado.'});
      if(current.closed_at)return json(response,409,{message:'Períodos encerrados são históricos imutáveis e não podem ser alterados.'});
      const body=await readJson(request);
      const values={label:cleanText(body.label,40),start_date:cleanText(body.start_date||body.startDate,10),end_date:cleanText(body.end_date||body.endDate,10)};
      const errors=validateSchoolYear(values);
      if(hasValidationErrors(errors))return invalid(response,errors);
      const activate=body.ativar===true||body.active===true;
      try{
        await db.transaction(async()=>{
          if(activate&&current.active!==1)await db.prepare('UPDATE school_years SET active=0,closed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE active=1 AND id<>?').run(id);
          await db.prepare('UPDATE school_years SET label=?,start_date=?,end_date=?,dates_confirmed=1,active=?,closed_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?')
            .run(values.label,values.start_date,values.end_date,(current.active===1||activate)?1:0,id);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,activate&&current.active!==1?'school_year_activated':'school_year_updated',ip);
        });
        return json(response,200,{success:true,message:activate&&current.active!==1?'Novo período ativo. O período anterior foi encerrado.':'Período atualizado.'});
      }catch(error){
        if(duplicateError(error))return json(response,409,{message:'Já existe um período com este nome ou outro período está ativo.'});
        throw error;
      }
    }
    return json(response, 404, { message: 'Rota não encontrada.' });
  };
}
