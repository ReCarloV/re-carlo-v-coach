(function(root,factory){
  const model=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=model;
  if(root)root.rcFastingTrackerModel=model;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='1.0.0';

  function validDate(value){return typeof value==='string'&&value.trim()!==''&&!Number.isNaN(Date.parse(value));}
  function activeRecord(records=[]){return records.find(item=>item&&item.endedAt===null)||null;}
  function sorted(records=[]){return [...records].sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt)));}
  function durationMinutes(record,now=new Date()){
    if(!record||!validDate(record.startedAt))return 0;
    const end=record.endedAt?new Date(record.endedAt):new Date(now);
    return Math.max(0,Math.round((end-new Date(record.startedAt))/60000));
  }
  function formatDuration(minutes){
    const total=Math.max(0,Math.round(Number(minutes)||0)),days=Math.floor(total/1440),hours=Math.floor((total%1440)/60),mins=total%60;
    return [days?`${days} g`:'',hours?`${hours} h`:'',(!days&&mins)||(!days&&!hours)?`${mins} min`:''].filter(Boolean).join(' ');
  }
  function createId(now,id){return id||`fasting-${new Date(now).getTime()}-${Math.random().toString(36).slice(2,8)}`;}
  function start(records=[],now=new Date(),id){
    if(activeRecord(records))throw new Error('Un fasting è già in corso.');
    const timestamp=new Date(now).toISOString(),record={id:createId(timestamp,id),startedAt:timestamp,endedAt:null,createdAt:timestamp,updatedAt:timestamp};
    return{records:sorted([...records,record]),record};
  }
  function finish(records=[],now=new Date()){
    const active=activeRecord(records);if(!active)throw new Error('Non c’è un fasting in corso.');
    const endedAt=new Date(now).toISOString();if(new Date(endedAt)<=new Date(active.startedAt))throw new Error('La fine deve essere successiva all’inizio.');
    const record={...active,endedAt,updatedAt:endedAt};
    return{records:sorted(records.map(item=>item.id===active.id?record:item)),record};
  }
  function addManual(records=[],input={},now=new Date(),id){
    if(!validDate(input.startedAt)||!validDate(input.endedAt))throw new Error('Inserisci inizio e fine validi.');
    const startedAt=new Date(input.startedAt).toISOString(),endedAt=new Date(input.endedAt).toISOString();
    if(new Date(endedAt)<=new Date(startedAt))throw new Error('La fine deve essere successiva all’inizio.');
    const timestamp=new Date(now).toISOString(),record={id:createId(timestamp,id),startedAt,endedAt,createdAt:timestamp,updatedAt:timestamp};
    return{records:sorted([...records,record]),record};
  }
  function remove(records=[],id){return records.filter(item=>item.id!==id);}

  return{VERSION,activeRecord,sorted,durationMinutes,formatDuration,start,finish,addManual,remove};
});
