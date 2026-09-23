import React from 'react';

export default function ClassBanner({name,local,settings}){
  return <header className="relative isolate overflow-hidden rounded-xl bg-primary text-white" style={{aspectRatio:'6.4 / 1',minHeight:120}}>
    {settings?.banner&&<><img src={settings.banner} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" style={{objectPosition:`${settings.x??50}% ${settings.y??50}%`,transform:`scale(${(settings.zoom??100)/100})`,transformOrigin:`${settings.x??50}% ${settings.y??50}%`}}/><div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 to-black/20"/></>}
    <div className="flex h-full flex-col justify-center p-5 sm:p-8"><span className="text-[10px] font-semibold uppercase tracking-[0.25em]">Turma</span><h1 className="mt-1 text-2xl font-bold sm:text-3xl">{name}</h1><p className="mt-2 text-sm text-white/85">{local}</p></div>
  </header>;
}
