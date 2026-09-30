import React from 'react';

export default function ClassBanner({name,local,settings,actions,actionsPosition='bottom'}){
  return <header className={`relative isolate aspect-[6.4/1] w-full min-w-0 overflow-hidden rounded-xl bg-primary text-white ${actions?'min-h-36 sm:min-h-40':'min-h-32'}`}>
    {settings?.banner&&<><img src={settings.banner} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" style={{objectPosition:`${settings.x??50}% ${settings.y??50}%`,transform:`scale(${(settings.zoom??100)/100})`,transformOrigin:`${settings.x??50}% ${settings.y??50}%`}}/><div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 to-black/20"/></>}
    <div className={`flex min-h-32 flex-col justify-center p-5 sm:p-8 ${actions?'pr-28 sm:pr-8':''}`}><span className="text-[10px] font-semibold uppercase tracking-[0.25em]">Turma</span><h1 className="mt-1 break-words text-2xl font-bold sm:text-3xl">{name}</h1>{local&&<p className="mt-2 text-sm text-white/85">{local}</p>}</div>
    {actions&&<div className={actionsPosition==='top'?'absolute right-4 top-4 sm:right-5 sm:top-5':'absolute right-4 top-4 flex gap-2 sm:inset-x-8 sm:bottom-6 sm:top-auto sm:justify-end'}>{actions}</div>}
  </header>;
}
