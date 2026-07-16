(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcPlanViewModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function iso(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function dateAtNoon(value){return value instanceof Date?new Date(value.getFullYear(),value.getMonth(),value.getDate(),12):new Date(`${value}T12:00:00`);}
  function addDays(value,days){const date=dateAtNoon(value);date.setDate(date.getDate()+days);return iso(date);}
  function mondayFor(value){const date=dateAtNoon(value),day=date.getDay()||7;date.setDate(date.getDate()-day+1);return iso(date);}
  function sessionsForWeek(sessions=[],weekStart){const end=addDays(weekStart,6);return(Array.isArray(sessions)?sessions:[]).filter(item=>item?.date>=weekStart&&item.date<=end);}
  function sessionsForMonth(sessions=[],cursor){const date=dateAtNoon(cursor),prefix=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;return(Array.isArray(sessions)?sessions:[]).filter(item=>String(item?.date||'').startsWith(prefix));}
  function weekLabel(weekStart,locale='it-IT'){const start=dateAtNoon(weekStart),end=dateAtNoon(addDays(weekStart,6)),sameMonth=start.getMonth()===end.getMonth();return sameMonth?`Settimana ${start.getDate()}–${end.toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric'})}`:`Settimana ${start.toLocaleDateString(locale,{day:'numeric',month:'short'})} – ${end.toLocaleDateString(locale,{day:'numeric',month:'short',year:'numeric'})}`;}
  function validDateKey(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;const date=dateAtNoon(value);return!Number.isNaN(date.getTime())&&iso(date)===value;}
  function calendarMovePolicy(session,options={}){
    if(!session)return{allowed:false,code:'missing',message:'Seduta non trovata.'};
    if(session.outcome)return{allowed:false,code:'recorded',message:'Le sedute già registrate restano nella loro data storica.'};
    if(options.hasEvidence)return{allowed:false,code:'observed',message:'Questa seduta ha dati Strava o WHOOP collegati: rivedi prima l’abbinamento.'};
    if(options.isRace)return{allowed:false,code:'race',message:'Le gare si spostano dalla pagina Obiettivi, così data e countdown restano allineati.'};
    return{allowed:true,code:'movable',message:'Trascina la seduta sul nuovo giorno.'};
  }
  function moveSessionDate(sessions=[],sessionId,targetDate,options={}){
    const list=Array.isArray(sessions)?sessions:[];const index=list.findIndex(item=>String(item?.id)===String(sessionId));const session=index>=0?list[index]:null;const policy=calendarMovePolicy(session,options);
    if(!policy.allowed)return{sessions:list,changed:false,policy};
    if(!validDateKey(targetDate))return{sessions:list,changed:false,policy:{allowed:false,code:'invalid-date',message:'Il giorno di destinazione non è valido.'}};
    if(session.date===targetDate)return{sessions:list,changed:false,policy:{allowed:true,code:'same-date',message:'La seduta è già in questo giorno.'}};
    const moved={...session,date:targetDate,updatedAt:options.now||new Date().toISOString()};const next=list.map((item,itemIndex)=>itemIndex===index?moved:item);
    return{sessions:next,changed:true,session:moved,previousDate:session.date,policy};
  }
  return{iso,addDays,mondayFor,sessionsForWeek,sessionsForMonth,weekLabel,validDateKey,calendarMovePolicy,moveSessionDate};
});
