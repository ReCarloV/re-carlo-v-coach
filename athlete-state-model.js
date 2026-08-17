(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcAthleteStateModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='1.0.0';
  const LOWER_BODY=/(hip|quad|knee|ankle|glute|hamstring|calf|shin|foot|adductor)/i;
  const ORGANIZATION_REASONS=new Set(['time','logistics']);
  const iso=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const dateAtNoon=value=>new Date(`${value}T12:00:00`);
  function addDays(value,days){const date=dateAtNoon(value);date.setDate(date.getDate()+days);return iso(date);}
  function number(value){if(value===null||value===undefined||value==='')return null;const parsed=Number(value);return Number.isFinite(parsed)?parsed:null;}
  function round(value,digits=1){if(!Number.isFinite(Number(value)))return null;const scale=10**digits;return Math.round(Number(value)*scale)/scale;}
  function mean(values){const valid=values.map(number).filter(value=>value!==null);return valid.length?valid.reduce((sum,value)=>sum+value,0)/valid.length:null;}
  function timestamp(value){const parsed=new Date(value).getTime();return Number.isFinite(parsed)?parsed:null;}
  function performed(session){return ['completed','partial'].includes(session?.outcome?.status);}
  function isNeutralSkip(session){return session?.outcome?.status==='skipped'&&session?.outcome?.skipReason==='program-change';}
  function activeSession(session){return session&&!session.demoDataset&&session.adaptiveAdjustment?.status!=='paused'&&session.category!=='recovery'&&!isNeutralSkip(session);}
  function relevantPlanned(session){return activeSession(session)&&session.priority!=='optional';}
  function executionCredit(session){
    const outcome=session?.outcome;if(!outcome||outcome.status==='skipped')return 0;if(outcome.status==='completed')return 1;
    const planned=number(session.durationMin),actual=number(outcome.actualDurationMin),ratio=planned&&actual!==null?actual/planned:null;return Math.max(.25,Math.min(.9,ratio||.5));
  }
  function stableHash(value){const source=JSON.stringify(value);let hash=2166136261;for(let index=0;index<source.length;index++){hash^=source.charCodeAt(index);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16).padStart(8,'0');}
  function distanceKmForSession(session){const value=number(session?.outcome?.actualDistanceKm);return value!==null&&value>=0?value:null;}
  function distanceKmForStrava(activity){const value=number(activity?.distanceM);return value!==null&&value>=0?value/1000:null;}
  function durationForStrava(activity){const seconds=number(activity?.movingSec)??number(activity?.elapsedSec);return seconds!==null&&seconds>=0?seconds/60:null;}
  function startFor(record){return timestamp(record?.localStart||record?.start||record?.date);}
  function linkedSourceIds(sessions=[],decisions=[]){
    const strava=new Set(),whoop=new Set(),pairedWhoopToStrava=new Map(),performedSessionIds=new Set(sessions.map(item=>item.id));
    sessions.forEach(session=>{const evidence=session?.outcome?.deviceEvidence;if(!evidence)return;if(evidence.stravaActivityId)strava.add(evidence.stravaActivityId);if(evidence.whoopWorkoutId)whoop.add(evidence.whoopWorkoutId);});
    decisions.filter(item=>item?.status==='confirmed').forEach(item=>{
      if(item.sessionId&&performedSessionIds.has(item.sessionId)&&item.stravaActivityId)strava.add(item.stravaActivityId);
      if(item.sessionId&&performedSessionIds.has(item.sessionId)&&item.whoopWorkoutId)whoop.add(item.whoopWorkoutId);
      if(!item.sessionId&&item.stravaActivityId&&item.whoopWorkoutId)pairedWhoopToStrava.set(item.whoopWorkoutId,item.stravaActivityId);
    });
    return{strava,whoop,pairedWhoopToStrava};
  }
  function sessionObservation(session){
    const duration=number(session.outcome?.actualDurationMin),distanceKm=distanceKmForSession(session),load=number(session.outcome?.sessionLoad);
    return{id:`session:${session.id}`,date:session.date,category:session.category||'other',source:'session',durationMin:duration,distanceKm,sessionLoad:load,sessionId:session.id,start:null};
  }
  function stravaObservation(activity){return{id:`strava:${activity.id}`,date:activity.date,category:activity.category||'other',source:'strava',durationMin:durationForStrava(activity),distanceKm:distanceKmForStrava(activity),sessionLoad:null,stravaActivityId:activity.id,start:startFor(activity)};}
  function whoopObservation(workout){return{id:`whoop:${workout.id}`,date:workout.date,category:workout.category||'other',source:'whoop',durationMin:number(workout.durationMin),distanceKm:number(workout.distanceKm),sessionLoad:null,whoopWorkoutId:workout.id,start:startFor(workout)};}
  function compatibleExternal(a,b){
    if(a.date!==b.date||a.category!==b.category)return false;
    const delta=a.start!==null&&b.start!==null?Math.abs(a.start-b.start)/60000:null;if(delta!==null&&delta>150)return false;
    const first=number(a.durationMin),second=number(b.durationMin);if(first!==null&&second!==null&&Math.max(first,second)>0&&Math.min(first,second)/Math.max(first,second)<.65)return false;
    return delta!==null||first!==null&&second!==null;
  }
  function mergeExternal(strava,whoop){return{...strava,id:`${strava.id}|${whoop.id}`,durationMin:strava.durationMin??whoop.durationMin,distanceKm:strava.distanceKm??whoop.distanceKm,sources:['strava','whoop'],whoopWorkoutId:whoop.whoopWorkoutId};}
  function buildObservations(input={}){
    const sessions=(Array.isArray(input.sessions)?input.sessions:[]).filter(item=>activeSession(item)&&performed(item));
    const decisions=Array.isArray(input.reconciliationDecisions)?input.reconciliationDecisions:[],links=linkedSourceIds(sessions,decisions);
    const observations=sessions.map(sessionObservation),strava=(Array.isArray(input.activities)?input.activities:[]).filter(item=>item&&!item.demoDataset&&!links.strava.has(item.id)).map(stravaObservation),whoop=(Array.isArray(input.whoopWorkouts)?input.whoopWorkouts:[]).filter(item=>item&&!item.demoDataset&&!links.whoop.has(item.id)).map(whoopObservation);
    const usedWhoop=new Set();
    strava.forEach(activity=>{
      const explicit=[...links.pairedWhoopToStrava.entries()].find(([,stravaId])=>stravaId===activity.stravaActivityId)?.[0];
      let index=explicit?whoop.findIndex(item=>item.whoopWorkoutId===explicit):whoop.findIndex(item=>!usedWhoop.has(item.whoopWorkoutId)&&compatibleExternal(activity,item));
      if(index>=0){usedWhoop.add(whoop[index].whoopWorkoutId);observations.push(mergeExternal(activity,whoop[index]));}else observations.push(activity);
    });
    whoop.filter(item=>!usedWhoop.has(item.whoopWorkoutId)&&!links.pairedWhoopToStrava.has(item.whoopWorkoutId)).forEach(item=>observations.push(item));
    return observations.filter(item=>item.date).sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));
  }
  function adherenceFor(sessions,start,end,today){
    const due=(Array.isArray(sessions)?sessions:[]).filter(session=>session.date>=start&&session.date<=end&&session.date<=today&&relevantPlanned(session)&&!(session.date===today&&!session.outcome));
    const recorded=due.filter(session=>session.outcome),performedCount=recorded.filter(performed).length;
    return{due:due.length,recorded:recorded.length,performed:performedCount,missing:Math.max(0,due.length-recorded.length),coverage:due.length?recorded.length/due.length:null,adherence:due.length?due.reduce((sum,session)=>sum+executionCredit(session),0)/due.length:null};
  }
  function categoryCounts(observations){return observations.reduce((counts,item)=>{counts[item.category]=(counts[item.category]||0)+1;return counts;},{});}
  function windowSummary(input,observations,days,endDate){
    const start=addDays(endDate,-days+1),items=observations.filter(item=>item.date>=start&&item.date<=endDate),weeks=days/7,durations=items.map(item=>number(item.durationMin)).filter(value=>value!==null),sessionItems=items.filter(item=>item.source==='session'),loads=sessionItems.map(item=>number(item.sessionLoad)).filter(value=>value!==null),running=items.filter(item=>item.category==='running'),runKm=running.map(item=>number(item.distanceKm)).filter(value=>value!==null),runMinutes=running.map(item=>number(item.durationMin)).filter(value=>value!==null),adherence=adherenceFor(input.sessions,start,endDate,input.today),dates=new Set(items.map(item=>item.date));
    const outcomes=(Array.isArray(input.sessions)?input.sessions:[]).filter(session=>session.date>=start&&session.date<=endDate&&activeSession(session)&&session.outcome),skips=outcomes.filter(session=>session.outcome.status==='skipped');
    return{start,end:endDate,days,weeks,observations:items.length,observedDays:dates.size,observedWeeks:new Set([...dates].map(date=>{const value=dateAtNoon(date),day=value.getDay()||7;value.setDate(value.getDate()-day+1);return iso(value);})).size,categories:categoryCounts(items),sessionsPerWeek:items.length?round(items.length/weeks,1):null,minutesKnown:durations.length,minutesCoverage:items.length?durations.length/items.length:null,totalMinutes:durations.length?round(durations.reduce((sum,value)=>sum+value,0),0):null,minutesPerWeek:durations.length?round(durations.reduce((sum,value)=>sum+value,0)/weeks,0):null,running:{count:running.length,perWeek:running.length?round(running.length/weeks,1):null,kmKnown:runKm.length,kmCoverage:running.length?runKm.length/running.length:null,totalKm:runKm.length?round(runKm.reduce((sum,value)=>sum+value,0),1):null,kmPerWeek:runKm.length?round(runKm.reduce((sum,value)=>sum+value,0)/weeks,1):null,longestKm:runKm.length?round(Math.max(...runKm),1):null,longestMinutes:runMinutes.length?round(Math.max(...runMinutes),0):null},internalLoad:{sessions:sessionItems.length,known:loads.length,coverage:sessionItems.length?loads.length/sessionItems.length:null,total:loads.length?round(loads.reduce((sum,value)=>sum+value,0),0):null,perWeek:loads.length?round(loads.reduce((sum,value)=>sum+value,0)/weeks,0):null,unit:'AU durata × RPE'},adherence,response:{hard:outcomes.filter(session=>performed(session)&&(number(session.outcome.rpe)>=8||session.outcome.execution==='harder')).length,fatigueSkips:skips.filter(session=>session.outcome.skipReason==='fatigue').length,painSkips:skips.filter(session=>session.outcome.skipReason==='pain').length,organizationSkips:skips.filter(session=>ORGANIZATION_REASONS.has(session.outcome.skipReason)).length}};
  }
  function symptomState(issues=[],today){
    const readings=[];(Array.isArray(issues)?issues:[]).forEach(issue=>{
      const history=Array.isArray(issue.history)&&issue.history.length?issue.history:[issue.startedAt?{date:issue.startedAt,pain:issue.initialPain}:null].filter(Boolean);
      history.forEach(entry=>{const date=entry?.date?iso(new Date(entry.date)):null,pain=number(entry?.pain);if(date&&pain!==null&&date<=today)readings.push({issueId:issue.id||null,zone:issue.zone||'',zoneLabel:issue.zoneLabel||issue.zone||'Fastidio',date,pain,lowerBody:LOWER_BODY.test(issue.zone||'')});});
    });
    readings.sort((a,b)=>a.date.localeCompare(b.date));const recent=readings.filter(item=>item.date>=addDays(today,-27)),recent14=readings.filter(item=>item.date>=addDays(today,-13)),previous14=readings.filter(item=>item.date>=addDays(today,-27)&&item.date<addDays(today,-13));
    const latestByIssue=new Map();readings.forEach(item=>latestByIssue.set(item.issueId||item.zone,item));const activeLatest=[...(Array.isArray(issues)?issues:[])].filter(issue=>issue.status!=='resolved').map(issue=>latestByIssue.get(issue.id||issue.zone)).filter(Boolean),latest=activeLatest.sort((a,b)=>b.pain-a.pain)[0]||null;
    const recentMean=mean(recent14.map(item=>item.pain)),previousMean=mean(previous14.map(item=>item.pain)),delta=recentMean!==null&&previousMean!==null?recentMean-previousMean:null;
    let trend='unknown';if(delta!==null)trend=delta>=1?'rising':delta<=-1?'improving':'stable';else if(recent.length>=2){const change=recent.at(-1).pain-recent[0].pain;trend=change>=2?'rising':change<=-2?'improving':'stable';}
    return{readings28:recent.length,activeIssues:activeLatest.length,latestMax:latest?.pain??null,latestZone:latest?.zoneLabel||null,lowerBodyMax:activeLatest.filter(item=>item.lowerBody).reduce((max,item)=>Math.max(max,item.pain),0)||null,recentMean:round(recentMean,1),previousMean:round(previousMean,1),delta:round(delta,1),trend,updated:activeLatest.some(item=>item.date>=addDays(today,-7))};
  }
  function capacityFrom(mesocycle,chronic){
    const source=mesocycle.observedWeeks>=3&&mesocycle.observations>=6?mesocycle:chronic.observedWeeks>=6&&chronic.observations>=12?chronic:null;
    return{usable:Boolean(source),sourceDays:source?.days||null,sessionsPerWeek:source?.sessionsPerWeek??null,minutesPerWeek:source?.minutesPerWeek??null,runningPerWeek:source?.running.perWeek??null,runningKmPerWeek:source?.running.kmPerWeek??null,longestRunningMinutes:source?.running.longestMinutes??null,longestRunningKm:source?.running.longestKm??null,categories:source?.categories||{}};
  }
  function progressionGate(mesocycle,symptoms){
    const enoughHistory=mesocycle.observedWeeks>=3&&mesocycle.observations>=8&&mesocycle.adherence.due>=8;
    const dataComplete=enoughHistory&&(mesocycle.adherence.coverage??0)>=.75&&(mesocycle.adherence.adherence??0)>=.8;
    const responseStable=mesocycle.response.fatigueSkips<=1&&mesocycle.response.painSkips===0&&(mesocycle.observations?mesocycle.response.hard/mesocycle.observations<=.35:true);
    const symptomsStable=symptoms.trend!=='rising'&&(symptoms.latestMax??0)<=2;
    const reasons=[];if(!enoughHistory)reasons.push('Servono almeno 3 settimane osservate, 8 sedute reali e 8 sedute dovute.');if(enoughHistory&&!dataComplete)reasons.push('Copertura e aderenza delle ultime 4 settimane devono essere almeno 75% e 80%.');if(!responseStable)reasons.push('Fatica, dolore o risposte più impegnative ricorrenti bloccano la progressione.');if(!symptomsStable)reasons.push('Il trend dei fastidi non è compatibile con un aumento automatico.');
    return{allowed:enoughHistory&&dataComplete&&responseStable&&symptomsStable,enoughHistory,dataComplete,responseStable,symptomsStable,reasons};
  }
  function build(input={}){
    const today=input.today||iso(new Date()),normalized={...input,today,sessions:Array.isArray(input.sessions)?input.sessions:[]},observations=buildObservations(normalized),acute=windowSummary(normalized,observations,7,today),mesocycle=windowSummary(normalized,observations,28,today),previousMesocycle=windowSummary(normalized,observations,28,addDays(today,-28)),chronic=windowSummary(normalized,observations,84,today),symptoms=symptomState(input.bodyIssues,today),capacity=capacityFrom(mesocycle,chronic),progression=progressionGate(mesocycle,symptoms),organization={recurring:mesocycle.response.organizationSkips>=2,count28:mesocycle.response.organizationSkips},response={caution:mesocycle.response.fatigueSkips>=2||mesocycle.response.painSkips>0||mesocycle.observations>=6&&mesocycle.response.hard/mesocycle.observations>.35,hardRate:mesocycle.observations?mesocycle.response.hard/mesocycle.observations:null,...mesocycle.response};
    const fingerprint=`athlete-${stableHash({version:VERSION,today,acute:{observations:acute.observations,load:acute.internalLoad.total},mesocycle:{observations:mesocycle.observations,adherence:mesocycle.adherence,minutes:mesocycle.totalMinutes,categories:mesocycle.categories},chronic:{observations:chronic.observations,minutes:chronic.totalMinutes,categories:chronic.categories},symptoms,organization,response})}`;
    const confidence=mesocycle.observedWeeks>=3&&(mesocycle.adherence.coverage??0)>=.75?'high':mesocycle.observations>=4?'medium':'low';
    return{version:VERSION,today,fingerprint,confidence,observations,windows:{acute,mesocycle,previousMesocycle,chronic},acute,mesocycle,previousMesocycle,chronic,symptoms,capacity,progression,signals:{organization,response,symptoms:{rising:symptoms.trend==='rising',latestMax:symptoms.latestMax,lowerBodyMax:symptoms.lowerBodyMax}}};
  }

  return{VERSION,addDays,build,buildObservations,windowSummary,symptomState,progressionGate,linkedSourceIds,compatibleExternal};
});
