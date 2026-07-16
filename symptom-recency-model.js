(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcSymptomRecencyModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const CURRENT_DAYS=2;
  const RECENT_DAYS=7;

  function localDateKey(value){
    if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
    const date=value instanceof Date?value:new Date(value);
    if(Number.isNaN(date.getTime()))return null;
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function todayKey(){return localDateKey(new Date());}
  function dayNumber(value){const key=localDateKey(value);return key?Math.round(new Date(`${key}T12:00:00`).getTime()/86400000):null;}
  function daysBetween(earlier,later){const first=dayNumber(earlier),last=dayNumber(later);return first===null||last===null?null:Math.max(0,last-first);}
  function validPain(value){const pain=Number(value);return Number.isFinite(pain)&&pain>=0&&pain<=10?pain:null;}
  function latestReading(issue={},asOf=todayKey()){
    const cutoff=localDateKey(asOf)||todayKey();
    const readings=(Array.isArray(issue.history)?issue.history:[]).map(entry=>({pain:validPain(entry?.pain),at:entry?.date,source:entry?.source||'storico',key:localDateKey(entry?.date)})).filter(entry=>entry.pain!==null&&entry.key&&entry.key<=cutoff).sort((a,b)=>new Date(a.at)-new Date(b.at));
    if(readings.length)return readings.at(-1);
    const initialPain=validPain(issue.initialPain),startedKey=localDateKey(issue.startedAt);
    if(initialPain!==null&&startedKey&&startedKey<=cutoff)return {pain:initialPain,at:issue.startedAt,source:'profilo',key:startedKey};
    return null;
  }
  function ageLabel(days){if(days===null)return 'data non disponibile';if(days===0)return 'oggi';if(days===1)return 'ieri';return `${days} giorni fa`;}
  function readingStatus(issue={},asOf=todayKey()){
    const reading=latestReading(issue,asOf);
    if(!reading)return {freshness:'missing',confidence:'low',label:'Da aggiornare',tone:'warn',ageDays:null,ageLabel:'mai valutato',latestPain:null,lastReadAt:null,isFresh:false,requiresUpdate:true};
    const ageDays=daysBetween(reading.key,asOf);
    if(ageDays<=CURRENT_DAYS)return {freshness:'current',confidence:'high',label:'Aggiornato',tone:'good',ageDays,ageLabel:ageLabel(ageDays),latestPain:reading.pain,lastReadAt:reading.at,isFresh:true,requiresUpdate:false};
    if(ageDays<=RECENT_DAYS)return {freshness:'recent',confidence:'medium',label:'Recente',tone:'neutral',ageDays,ageLabel:ageLabel(ageDays),latestPain:reading.pain,lastReadAt:reading.at,isFresh:true,requiresUpdate:false};
    return {freshness:'stale',confidence:'low',label:'Da aggiornare',tone:'warn',ageDays,ageLabel:ageLabel(ageDays),latestPain:reading.pain,lastReadAt:reading.at,isFresh:false,requiresUpdate:true};
  }
  function decorate(issue,asOf=todayKey()){return {...issue,...readingStatus(issue,asOf)};}

  return {CURRENT_DAYS,RECENT_DAYS,localDateKey,daysBetween,latestReading,readingStatus,decorate};
});
