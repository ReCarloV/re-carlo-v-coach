(function(root,factory){
  const dependency=typeof module!=='undefined'&&module.exports?require('./whoop-import-model.js'):root?.rcWhoopImportModel;
  const core=factory(dependency);
  if(typeof module!=='undefined'&&module.exports)module.exports=core;
  if(root)root.rcWhoopApiModel=core;
})(typeof globalThis!=='undefined'?globalThis:this,function(importModel){
  'use strict';

  if(!importModel)throw new Error('Il modello WHOOP locale non è disponibile.');
  const KINDS=['cycles','sleeps','workouts','journal'];
  const SCOPES={cycles:'cycle',sleeps:'sleep',workouts:'workout',journal:'journal'};
  const number=value=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))?null:Number(value);
  const rounded=(value,digits=2)=>value===null?null:+Number(value).toFixed(digits);
  const millisToMinutes=value=>{const parsed=number(value);return parsed===null?null:rounded(parsed/60000);};
  const offsetMinutes=value=>{const match=/^([+-])(\d{2}):(\d{2})$/.exec(String(value||''));if(!match)return 0;const total=(Number(match[2])*60)+Number(match[3]);return match[1]==='-'?-total:total;};
  function isAppleMobileDevice(device={}){
    const userAgent=String(device.userAgent||'');const platform=String(device.platform||'');const touchPoints=Number(device.maxTouchPoints)||0;
    return /iphone|ipad|ipod/i.test(userAgent)||(/macintosh/i.test(userAgent)&&platform==='MacIntel'&&touchPoints>1);
  }
  function isLocalWhoopServiceOrigin(location={}){
    const hostname=String(location.hostname||'').toLowerCase();
    return String(location.protocol||'')==='http:'&&['127.0.0.1','localhost'].includes(hostname);
  }
  function localTimestamp(value,offset='+00:00'){
    const timestamp=Date.parse(String(value||''));
    if(!Number.isFinite(timestamp))return null;
    return new Date(timestamp+(offsetMinutes(offset)*60000)).toISOString().slice(0,19);
  }
  const dateFrom=value=>value?value.slice(0,10):null;
  const idPart=value=>String(value).replace(/[^0-9A-Za-z]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
  const sumObserved=values=>{const observed=values.map(number).filter(value=>value!==null);return observed.length?observed.reduce((sum,value)=>sum+value,0):null;};
  function sleepMetrics(record){
    const score=record?.score||{};const stages=score.stage_summary||{};const needed=score.sleep_needed||{};
    const light=millisToMinutes(stages.total_light_sleep_time_milli);const deep=millisToMinutes(stages.total_slow_wave_sleep_time_milli);const rem=millisToMinutes(stages.total_rem_sleep_time_milli);
    const sleepNeedMillis=sumObserved([needed.baseline_milli,needed.need_from_sleep_debt_milli,needed.need_from_recent_strain_milli,needed.need_from_recent_nap_milli]);
    return {sleepPerformancePct:number(score.sleep_performance_percentage),respiratoryRate:number(score.respiratory_rate),sleepDurationMin:rounded(sumObserved([light,deep,rem])),timeInBedMin:millisToMinutes(stages.total_in_bed_time_milli),lightSleepMin:light,deepSleepMin:deep,remSleepMin:rem,awakeMin:millisToMinutes(stages.total_awake_time_milli),sleepNeedMin:millisToMinutes(sleepNeedMillis),sleepDebtMin:millisToMinutes(needed.need_from_sleep_debt_milli),sleepEfficiencyPct:number(score.sleep_efficiency_percentage),sleepConsistencyPct:number(score.sleep_consistency_percentage)};
  }
  function normalizeSleep(record){
    const timezone=String(record?.timezone_offset||'+00:00');const sleepStart=localTimestamp(record?.start,timezone);const wakeStart=localTimestamp(record?.end,timezone);const nap=Boolean(record?.nap);const externalId=`${sleepStart}:${nap?'nap':'sleep'}`;
    return {id:`whoop:sleep:${idPart(externalId)}`,externalId,apiId:String(record?.id||''),cycleId:record?.cycle_id??null,cycleStart:sleepStart,cycleEnd:wakeStart,date:dateFrom(wakeStart||sleepStart),timezone,sleepStart,wakeStart,...sleepMetrics(record),nap,apiUpdatedAt:record?.updated_at||null};
  }
  function normalizeCycle(record,recovery,sleep){
    const timezone=String(record?.timezone_offset||sleep?.timezone||'+00:00');const cycleStart=localTimestamp(record?.start,timezone);const cycleEnd=localTimestamp(record?.end,timezone);const score=record?.score||{};const recoveryScore=recovery?.score||{};const externalId=cycleStart;
    return {id:`whoop:cycle:${idPart(externalId)}`,externalId,apiId:String(record?.id??''),cycleStart,cycleEnd,date:dateFrom(sleep?.wakeStart||cycleStart),timezone,recoveryScore:number(recoveryScore.recovery_score),restingHr:number(recoveryScore.resting_heart_rate),hrvMs:number(recoveryScore.hrv_rmssd_milli),skinTempC:number(recoveryScore.skin_temp_celsius),spo2Pct:number(recoveryScore.spo2_percentage),dayStrain:number(score.strain),energyKcal:score.kilojoule===null||score.kilojoule===undefined?null:rounded(Number(score.kilojoule)/4.184),maxHr:number(score.max_heart_rate),averageHr:number(score.average_heart_rate),...(sleep?sleepMetricsFromNormalized(sleep):emptySleepMetrics()),apiUpdatedAt:record?.updated_at||null};
  }
  function emptySleepMetrics(){return{sleepStart:null,wakeStart:null,sleepPerformancePct:null,respiratoryRate:null,sleepDurationMin:null,timeInBedMin:null,lightSleepMin:null,deepSleepMin:null,remSleepMin:null,awakeMin:null,sleepNeedMin:null,sleepDebtMin:null,sleepEfficiencyPct:null,sleepConsistencyPct:null};}
  function sleepMetricsFromNormalized(sleep){const result={};['sleepStart','wakeStart','sleepPerformancePct','respiratoryRate','sleepDurationMin','timeInBedMin','lightSleepMin','deepSleepMin','remSleepMin','awakeMin','sleepNeedMin','sleepDebtMin','sleepEfficiencyPct','sleepConsistencyPct'].forEach(field=>{result[field]=sleep[field]??null;});return result;}
  function zonePercentages(score,durationMin){
    const zones=score?.zone_durations||{};const durationMillis=number(durationMin)===null?null:Number(durationMin)*60000;
    return [1,2,3,4,5].map(zone=>{const value=number(zones[`zone_${['zero','one','two','three','four','five'][zone]}_milli`]);return value===null||!durationMillis?null:rounded(value/durationMillis*100,1);});
  }
  function normalizeWorkout(record){
    const timezone=String(record?.timezone_offset||'+00:00');const start=localTimestamp(record?.start,timezone);const end=localTimestamp(record?.end,timezone);const durationMin=Number.isFinite(Date.parse(record?.end)-Date.parse(record?.start))?rounded((Date.parse(record.end)-Date.parse(record.start))/60000):null;const score=record?.score||{};const name=String(record?.sport_name||'Allenamento WHOOP');const externalId=start;
    return {id:`whoop:workout:${idPart(externalId)}`,externalId,apiId:String(record?.id||''),cycleStart:start,cycleEnd:end,date:dateFrom(start),timezone,start,end,durationMin,name,category:importModel.workoutCategory(name),strain:number(score.strain),calories:score.kilojoule===null||score.kilojoule===undefined?null:rounded(Number(score.kilojoule)/4.184),maxHr:number(score.max_heart_rate),averageHr:number(score.average_heart_rate),hrZonePct:zonePercentages(score,durationMin),gpsEnabled:Number(score.distance_meter)>0,distanceKm:score.distance_meter===null||score.distance_meter===undefined?null:rounded(Number(score.distance_meter)/1000,3),altitudeGainM:number(score.altitude_gain_meter),apiUpdatedAt:record?.updated_at||null};
  }
  function normalizeWhoopApiPayload(payload){
    const sleeps=(Array.isArray(payload?.sleeps)?payload.sleeps:[]).map(normalizeSleep);const mainSleepByCycle=new Map(sleeps.filter(item=>!item.nap&&item.cycleId!==null).map(item=>[String(item.cycleId),item]));const recoveryByCycle=new Map((Array.isArray(payload?.recoveries)?payload.recoveries:[]).map(item=>[String(item.cycle_id),item]));
    const cycles=(Array.isArray(payload?.cycles)?payload.cycles:[]).map(item=>normalizeCycle(item,recoveryByCycle.get(String(item.id)),mainSleepByCycle.get(String(item.id))));const workouts=(Array.isArray(payload?.workouts)?payload.workouts:[]).map(normalizeWorkout);
    return {cycles,sleeps,workouts,journal:[]};
  }
  const comparable=record=>{const copy={...record};delete copy.source;return copy;};
  const equal=(left,right)=>JSON.stringify(comparable(left))===JSON.stringify(comparable(right));
  function buildWhoopApiSync(records,existing={},now=new Date()){
    const importedAt=now instanceof Date?now.toISOString():new Date(now).toISOString();const suffix=importedAt.replace(/[^0-9]/g,'').slice(0,17);const batchId=`whoop-api-${suffix}`;const incoming={};const addedIds={};const updatedIds={};let duplicates=0;const all=[];
    KINDS.forEach(kind=>{
      const current=new Map((Array.isArray(existing[kind])?existing[kind]:[]).map(item=>[item.id,item]));incoming[kind]=[];addedIds[kind]=[];updatedIds[kind]=[];
      (Array.isArray(records?.[kind])?records[kind]:[]).forEach(record=>{all.push(record);const previous=current.get(record.id);if(previous&&equal(record,previous)){duplicates+=1;return;}const source=previous?{...previous.source,sourceMode:'api',syncedAt:importedAt}:{provider:'whoop',scope:SCOPES[kind],externalId:record.externalId,sourceFile:'WHOOP API v2',batchId,importedAt,sourceMode:'api',syncedAt:importedAt};const normalized={...record,source};incoming[kind].push(normalized);if(previous)updatedIds[kind].push(record.id);else addedIds[kind].push(record.id);});
    });
    const dates=all.map(item=>item.date).filter(Boolean).sort();const updatedCount=Object.values(updatedIds).reduce((sum,ids)=>sum+ids.length,0);const addedCount=Object.values(addedIds).reduce((sum,ids)=>sum+ids.length,0);
    const batch={id:batchId,provider:'whoop',sourceMode:'api',importedAt,sourceName:'Sincronizzazione automatica WHOOP',sourceRows:all.length,addedIds,updatedIds,updatedCount,duplicateCount:duplicates,conflictCount:0,earliestDate:dates[0]||null,latestDate:dates.at(-1)||null};
    return {batch,records:incoming,addedCount,updatedCount,unchangedCount:duplicates};
  }

  return{isAppleMobileDevice,isLocalWhoopServiceOrigin,localTimestamp,normalizeSleep,normalizeWorkout,normalizeWhoopApiPayload,buildWhoopApiSync};
});
