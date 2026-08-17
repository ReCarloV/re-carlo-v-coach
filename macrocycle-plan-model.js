(function(root,factory){
  const goalsModel=typeof module!=='undefined'&&module.exports?require('./goals-model.js'):root?.rcGoalsModel;
  const programming=typeof module!=='undefined'&&module.exports?require('./event-programming-model.js'):root?.rcEventProgrammingModel;
  const api=factory(goalsModel,programming);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcMacrocyclePlanModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(goalsModel,programming){
  'use strict';

  const VERSION='1.3.0';
  const DAY_MS=86400000;
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const dateAtNoon=value=>new Date(`${value}T12:00:00`);
  const iso=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function addDays(value,days){const date=dateAtNoon(value);date.setDate(date.getDate()+days);return iso(date);}
  function mondayFor(value){const date=dateAtNoon(value);const day=date.getDay()||7;date.setDate(date.getDate()-day+1);return iso(date);}
  function roundFive(value){return Math.max(5,Math.round(Number(value||0)/5)*5);}
  function uniqueDays(days=[]){const valid=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];return valid.filter(day=>days.includes(day));}
  function normalizeAvailability(value={}){
    const sessions=Math.max(1,Math.min(6,Number(value.sessions)||5)),sessionMinutes=Math.max(30,Math.min(180,roundFive(value.sessionMinutes||60))),longRunMinutes=Math.max(45,Math.min(240,roundFive(value.longRunMinutes||120)));
    let days=uniqueDays(Array.isArray(value.days)?value.days:[]);if(!days.length)days=['Lun','Mar','Mer','Gio','Dom'];
    return{sessions:Math.min(sessions,days.length),sessionMinutes,longRunMinutes,days,weekendLong:['yes','maybe','no'].includes(value.weekendLong)?value.weekendLong:'yes',constraints:String(value.constraints||'').trim()};
  }
  function availabilityForGoal(goal,history=[],fallback={}){
    if(goal?.trainingAvailability)return normalizeAvailability(goal.trainingAvailability);
    const latest=(Array.isArray(history)?history:[]).filter(Boolean).sort((a,b)=>String(b.weekStart||'').localeCompare(String(a.weekStart||'')))[0];
    return normalizeAvailability(latest||fallback);
  }
  function calibratedAvailability(value,athleteState,weekIndex=0){
    const declared=normalizeAvailability(value),capacity=athleteState?.capacity,ordinarySessionMinutes=Math.min(70,declared.sessionMinutes);
    if(!capacity?.usable||!Number.isFinite(Number(capacity.sessionsPerWeek)))return{...declared,sessions:declared.sessions,sessionMinutes:ordinarySessionMinutes,declaredSessions:declared.sessions,declaredSessionMinutes:declared.sessionMinutes,capacitySourceDays:null};
    return{...declared,sessions:declared.sessions,sessionMinutes:ordinarySessionMinutes,declaredSessions:declared.sessions,declaredSessionMinutes:declared.sessionMinutes,observedSessionsPerWeek:Number(capacity.sessionsPerWeek),capacitySourceDays:capacity.sourceDays};
  }
  function recentLongAnchor(sessions=[],today){
    const start=addDays(today,-56),runs=(Array.isArray(sessions)?sessions:[]).filter(item=>item?.category==='running'&&item.date>=start&&item.date<=today&&['completed','partial'].includes(item.outcome?.status));
    const duration=item=>Number(item.outcome?.actualDurationMin)||0,longs=runs.filter(item=>item.details?.runType==='Long run'||/long|lungo/i.test(item.title||''));
    return Math.max(0,...(longs.length?longs:runs).map(duration));
  }
  function longTargetFor({phaseKey,weekIndex,availability,anchorMinutes,family}){
    if(family!=='running'||phaseKey==='race-week')return null;
    const cap=Number(availability.longRunMinutes)||120,start=Math.min(cap,Math.max(75,Number(availability.sessionMinutes)+30,Number(anchorMinutes)||0)),progressed=Math.min(cap,start+Math.max(0,weekIndex)*5);
    const phaseFactor={base:1,build:1,'specific-build':1,specific:1,peak:.9,taper:.65}[phaseKey]??1;
    const deload=(weekIndex+1)%4===0&&!['peak','taper'].includes(phaseKey)?.85:1;
    return Math.min(cap,roundFive(progressed*phaseFactor*deload));
  }
  function stableSignature(goals=[],availabilityHistory=[],athleteState=null){
    const history=(Array.isArray(availabilityHistory)?availabilityHistory:[]).filter(Boolean).sort((a,b)=>String(b.weekStart||'').localeCompare(String(a.weekStart||'')));
    const source=JSON.stringify({goals:(Array.isArray(goals)?goals:[]).filter(item=>item?.status!=='cancelled').map(item=>({id:item.id,date:item.date,priority:item.priority,type:item.type,variant:item.variant||'',status:item.status,updatedAt:item.updatedAt,trainingAvailability:item.trainingAvailability||null})),fallback:history[0]||null,athlete:athleteState?{fingerprint:athleteState.fingerprint||null,sessionsPerWeek:athleteState.capacity?.sessionsPerWeek??null,longestRunningMinutes:athleteState.capacity?.longestRunningMinutes??null}:null,version:VERSION});
    let hash=2166136261;for(let index=0;index<source.length;index++){hash^=source.charCodeAt(index);hash=Math.imul(hash,16777619);}return`macro-${(hash>>>0).toString(16).padStart(8,'0')}`;
  }
  function build(input={}){
    const today=input.today||iso(new Date()),allGoals=(Array.isArray(input.goals)?input.goals:[]).filter(item=>item?.status!=='cancelled'),primaryGoals=allGoals.filter(item=>item.status==='planned'&&item.priority==='A'&&item.date>=today).sort((a,b)=>a.date.localeCompare(b.date)),sessions=Array.isArray(input.sessions)?input.sessions:[],history=Array.isArray(input.availabilityHistory)?input.availabilityHistory:[];
    const athleteState=input.athleteState||null;if(!primaryGoals.length)return{version:VERSION,signature:stableSignature(allGoals,history,athleteState),weeks:[],startWeek:null,endDate:null};
    const startWeek=input.startWeek?mondayFor(input.startWeek):addDays(mondayFor(today),7),endDate=primaryGoals.map(item=>item.date).sort().at(-1),stateAnchor=athleteState?.capacity?.usable?Number(athleteState.capacity.longestRunningMinutes)||0:0,anchorMinutes=stateAnchor||recentLongAnchor(sessions,today),weeks=[],maxWeeks=Math.max(1,Math.min(104,Number(input.maxWeeks)||104));
    let cursor=startWeek,runningWeekIndex=0;
    while(cursor<=endDate&&weeks.length<maxWeeks){
      const goal=primaryGoals.find(item=>item.date>=cursor)||null;if(!goal)break;
      const declaredAvailability=availabilityForGoal(goal,history,input.fallbackAvailability),availability=calibratedAvailability(declaredAvailability,athleteState,weeks.length),pack=programming?.packFor?.(goal)||null,phase=programming?.phaseFor?.(goal,cursor)||null,longTargetMinutes=longTargetFor({phaseKey:phase?.key,weekIndex:runningWeekIndex,availability,anchorMinutes,family:pack?.family});
      weeks.push({weekStart:cursor,weekEnd:addDays(cursor,6),goalId:goal.id,goalName:goal.name,goalDate:goal.date,packKey:pack?.key||null,packLabel:pack?.label||'Pack da definire',packFamily:pack?.family||null,phaseKey:phase?.key||null,phaseLabel:phase?.label||'Fase da definire',availability:{...availability,...(longTargetMinutes?{plannedLongMinutes:longTargetMinutes}:{})}});
      if(pack?.family==='running')runningWeekIndex++;cursor=addDays(cursor,7);
    }
    return{version:VERSION,signature:stableSignature(allGoals,history,athleteState),createdAt:input.createdAt||new Date().toISOString(),today,startWeek,endDate,anchorMinutes,athleteStateFingerprint:athleteState?.fingerprint||null,weeks};
  }

  return{VERSION,addDays,mondayFor,normalizeAvailability,availabilityForGoal,calibratedAvailability,recentLongAnchor,longTargetFor,stableSignature,build};
});
