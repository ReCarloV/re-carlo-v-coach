(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcDeviceFreshnessModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const DAY_MS=86400000;
  function iso(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function dateAtNoon(value){return new Date(`${value}T12:00:00`);}
  function ageDays(date,today){return date?Math.max(0,Math.round((dateAtNoon(today)-dateAtNoon(date))/DAY_MS)):null;}
  function timestampDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?null:iso(date);}
  function latestDate(items,fields=['date']){return(Array.isArray(items)?items:[]).map(item=>fields.map(field=>item?.[field]).find(Boolean)).filter(Boolean).map(value=>String(value).slice(0,10)).sort().at(-1)||null;}
  function lastImportDate(batches){return(Array.isArray(batches)?batches:[]).map(item=>timestampDate(item.importedAt)).filter(Boolean).sort().at(-1)||null;}
  function stateFor(recordDate,importDate,today,maxRecordAge){
    if(!recordDate&&!importDate)return{state:'missing',label:'Non collegato',tone:'waiting',recordDate:null,importDate:null,ageDays:null,showOnDashboard:false};
    const age=ageDays(recordDate||importDate,today);const importAge=ageDays(importDate,today);const fresh=recordDate&&age<=maxRecordAge&&importDate&&importAge<=2;
    return{state:fresh?'fresh':'snapshot',label:fresh?'Snapshot recente':'Snapshot manuale',tone:fresh?'fresh':'snapshot',recordDate,importDate,ageDays:age,importAgeDays:importAge,showOnDashboard:Boolean(fresh)};
  }
  function analyzeDeviceFreshness(input={}){
    const today=input.today||iso(new Date());const stravaRecord=latestDate(input.importedActivities,['date']),stravaImport=lastImportDate(input.importBatches);const whoopRecord=latestDate([...(input.whoopCycles||[]),...(input.whoopSleeps||[])],['date']),whoopImport=lastImportDate(input.whoopImportBatches);
    return{today,strava:stateFor(stravaRecord,stravaImport,today,2),whoop:stateFor(whoopRecord,whoopImport,today,1)};
  }
  function ageLabel(source){if(source.state==='missing')return'Nessun dato importato';if(source.showOnDashboard)return source.ageDays===0?'Aggiornato a oggi':source.ageDays===1?'Ultimo dato ieri':`Ultimo dato ${source.ageDays} giorni fa`;return source.ageDays===null?'Import manuale disponibile':`Ultimo dato ${source.ageDays===0?'oggi':source.ageDays===1?'ieri':`${source.ageDays} giorni fa`} · non è una connessione automatica`;}

  return{analyzeDeviceFreshness,ageLabel,ageDays,latestDate,lastImportDate,stateFor};
});
