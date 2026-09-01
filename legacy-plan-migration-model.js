(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcLegacyPlanMigrationModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const MONTHS={gennaio:1,febbraio:2,marzo:3,aprile:4,maggio:5,giugno:6,luglio:7,agosto:8,settembre:9,ottobre:10,novembre:11,dicembre:12};
  const pad=value=>String(value).padStart(2,'0');
  const dateKey=(year,month,day)=>`${year}-${pad(month)}-${pad(day)}`;
  function weekEnd(label,year){
    const match=String(label||'').trim().toLowerCase().match(/(\d{1,2})(?:\s+([a-zà]+))?\s*[-–]\s*(\d{1,2})\s+([a-zà]+)/i);if(!match)return'';
    const startMonth=MONTHS[match[2]||match[4]],endMonth=MONTHS[match[4]],startDay=Number(match[1]),endDay=Number(match[3]);if(!startMonth||!endMonth)return'';let endYear=year;if(endMonth<startMonth||endMonth===startMonth&&endDay<startDay)endYear+=1;const date=new Date(endYear,endMonth-1,endDay,12);if(date.getFullYear()!==endYear||date.getMonth()!==endMonth-1||date.getDate()!==endDay)return'';return dateKey(endYear,endMonth,endDay);
  }
  function isRaceSession(session){return session?.details?.runType==='Race'||/(^|\s)gara(?:\s|[-–:]|$)|race day|competition/i.test(`${session?.title||''} ${session?.planImport?.originalTitle||''}`);}
  function wasEditedAfterImport(session){const imported=Date.parse(session?.planImport?.importedAt||''),updated=Date.parse(session?.updatedAt||'');return Number.isFinite(imported)&&Number.isFinite(updated)&&updated-imported>60000;}
  function hasPendingMigration(sessions=[]){return(Array.isArray(sessions)?sessions:[]).some(session=>session?.planImport&&session.planImport.retired!==true);}
  function migrateImportedRaceDate(session){
    if(!session?.planImport||session.planImport.retired===true||!session.planImport.weekLabel||!isRaceSession(session))return session;
    const year=Number(String(session.date||'').slice(0,4));if(!Number.isInteger(year))return session;const expected=weekEnd(session.planImport.weekLabel,year);return expected&&expected!==session.date?{...session,date:expected,updatedAt:new Date().toISOString()}:session;
  }
  function retireImportedPlan(sessions=[],options={}){
    const today=options.today||dateKey(new Date().getFullYear(),new Date().getMonth()+1,new Date().getDate()),archivedIds=[],archivedSessions=[],detachedIds=[],historicalIds=[];
    const next=(Array.isArray(sessions)?sessions:[]).flatMap(session=>{
      if(!session?.planImport||session.planImport.retired===true)return[session];
      if(session.outcome||session.date<today){historicalIds.push(session.id);return[{...session,planImport:{...session.planImport,retired:true}}];}
      if(session.coachApplication||session.adaptiveAdjustment||wasEditedAfterImport(session)){
        const{planImport,...kept}=session;detachedIds.push(session.id);return[{...kept,externalPlanReference:{...planImport,retired:true},...(session.coachApplication||session.adaptiveAdjustment?{generated:true}:{})}];
      }
      archivedIds.push(session.id);archivedSessions.push({...session,planImport:{...session.planImport,retired:true},archivedExternalPlan:true,archiveReason:isRaceSession(session)?'goal-race-replaced':'external-plan-retired'});return[];
    });
    return{sessions:next,changed:Boolean(archivedIds.length||detachedIds.length||historicalIds.length),archivedIds,archivedSessions,detachedIds,historicalIds};
  }
  function migrateLegacyPlan(sessions=[],options={}){
    if(!hasPendingMigration(sessions))return{sessions,changed:false,archivedIds:[],archivedSessions:[],detachedIds:[],historicalIds:[]};
    const corrected=sessions.map(migrateImportedRaceDate),result=retireImportedPlan(corrected,options);
    return{...result,changed:result.changed||corrected.some((session,index)=>session!==sessions[index])};
  }

  return{hasPendingMigration,migrateImportedRaceDate,retireImportedPlan,migrateLegacyPlan};
});
