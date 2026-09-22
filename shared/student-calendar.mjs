// Calendar dates are civil dates in the school's timezone, not device-local instants.
export function studentCalendar(classes, slots, month) {
  if (!/^(20\d{2})-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Mês inválido.');
  const [year, number]=month.split('-').map(Number);
  const days=new Date(Date.UTC(year,number,0)).getUTCDate();
  const events=new Map();
  const byId=new Map(classes.map(item=>[Number(item.id),item]));
  for (let day=1;day<=days;day++) {
    const date=`${month}-${String(day).padStart(2,'0')}`;
    const weekday=(new Date(Date.UTC(year,number-1,day)).getUTCDay()+6)%7;
    for (const slot of slots) {
      const item=byId.get(Number(slot.class_id));
      if (!item || (slot.class_date ? String(slot.class_date).slice(0,10)!==date : Number(slot.weekday_index)!==weekday)) continue;
      if (date<String(item.enrolled_at).slice(0,10)) continue;
      if (item.dates_confirmed===1 && (date<String(item.start_date).slice(0,10) || date>String(item.end_date).slice(0,10))) continue;
      const time=`${String(Math.floor(slot.start_minutes/60)).padStart(2,'0')}:${String(slot.start_minutes%60).padStart(2,'0')}`;
      const key=`${date}/${item.id}/${time}`;
      events.set(key,{id:key,turmaId:Number(item.id),curso:item.curso,local:item.local,data:date,hora:time});
    }
  }
  const ordered=[...events.values()].sort((a,b)=>(a.data+a.hora).localeCompare(b.data+b.hora));
  const slotTotals=new Map();
  for(const event of ordered){
    const key=`${event.data}/${event.hora}`;
    slotTotals.set(key,(slotTotals.get(key)||0)+1);
  }
  return ordered.map(event=>({...event,conflito:(slotTotals.get(`${event.data}/${event.hora}`)||0)>1}));
}
