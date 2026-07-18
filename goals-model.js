(function(root,factory){
  const eventModel=typeof module!=='undefined'&&module.exports?require('./event-demand-model.js'):root?.rcEventDemandModel;
  const api=factory(eventModel);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcGoalsModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(eventModel){
  'use strict';

  const DAY_MS=86400000;
  const priorityRank={A:0,B:1,C:2};
  const typeLabels={marathon:'Maratona','half-marathon':'Mezza maratona',running:'Gara running',hyrox:'HYROX',obstacle:'Spartan / obstacle race',triathlon:'Triathlon',athx:'ATHX',cycling:'Gara ciclismo','strength-test':'Test di forza',test:'Test',other:'Altro'};

  function iso(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function dateAtNoon(value){return new Date(`${value}T12:00:00`);}
  function localToday(){return iso(new Date());}
  function addDays(value,days){const date=dateAtNoon(value);date.setDate(date.getDate()+days);return iso(date);}
  function daysBetween(from,to){return Math.round((dateAtNoon(to)-dateAtNoon(from))/DAY_MS);}
  function mondayFor(value){const date=dateAtNoon(value);const day=date.getDay()||7;date.setDate(date.getDate()-day+1);return iso(date);}
  function activeSession(session){return session?.adaptiveAdjustment?.status!=='paused';}
  function performed(session){return['completed','partial'].includes(session?.outcome?.status);}
  function cleanPlanName(value){
    const source=String(value||'').replace(/\.[^.]+$/,'').replace(/20\d{2}/g,'').replace(/[_-]+/g,' ').replace(/([a-zà-ÿ])([A-Z])/g,'$1 $2').replace(/\s+/g,' ').trim();
    return source||'Obiettivo gara';
  }
  function isGoalGeneratedSession(session){return Boolean(session?.goalGenerated)||String(session?.id||'').startsWith('goal-session:');}
  function isRaceSession(session){return isGoalGeneratedSession(session)||session?.details?.runType==='Race'||/(^|\s)gara(?:\s|[-–:]|$)|race day|competition/i.test(`${session?.title||''} ${session?.planImport?.originalTitle||''}`);}
  function typeForSession(session){const text=`${session?.title||''} ${session?.planImport?.sourceName||''}`.toLowerCase();if(/hyrox/.test(text))return'hyrox';if(/triathlon|ironman/.test(text))return'triathlon';if(/athx/.test(text))return'athx';if(/spartan|obstacle/.test(text))return'obstacle';if(/mezza|half/.test(text))return'half-marathon';if(/marathon|maratona/.test(text))return'marathon';return session?.category==='running'?'running':'other';}
  function inferGoalFromPlan(sessions=[],options={}){
    const today=options.today||localToday();const candidates=(Array.isArray(sessions)?sessions:[]).filter(item=>item?.planImport&&isRaceSession(item)&&item.date>=today).sort((a,b)=>a.date.localeCompare(b.date));const race=candidates[0];if(!race)return null;
    const name=cleanPlanName(race.planImport.sourceName);
    return{id:`goal:${race.id}`,name,type:typeForSession(race),date:race.date,dateAuthority:'plan',priority:'A',target:String(options.target||''),status:'planned',result:'',notes:'',inferredFromSessionId:race.id,createdAt:options.now||new Date().toISOString(),updatedAt:options.now||new Date().toISOString()};
  }
  function syncGoalDates(goals=[],sessions=[]){
    const list=Array.isArray(goals)?goals:[],plans=Array.isArray(sessions)?sessions:[];let changed=false;
    const normalize=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();const races=plans.filter(isRaceSession);const next=list.map(goal=>{if(goal?.status!=='planned'||goal.dateAuthority==='manual')return goal;const normalized=normalize(goal.name),goalType=goal.type;const candidates=races.filter(item=>Math.abs(daysBetween(goal.date,item.date))<=21).map(item=>{const inferredName=inferGoalFromPlan([item],{today:'1900-01-01',now:goal.updatedAt})?.name||item.title;let score=0;if(item.planImport)score+=20;if(item.id===goal.inferredFromSessionId)score+=2;if(item.goalId===goal.id)score+=5;if(normalize(inferredName)===normalized||normalize(item.title)===normalized)score+=8;if(typeForSession(item)===goalType)score+=3;if(item.date===goal.date)score+=1;if(isGoalGeneratedSession(item))score-=4;return{item,score};}).filter(candidate=>candidate.score>=3).sort((a,b)=>b.score-a.score||a.item.date.localeCompare(b.item.date));const race=candidates[0]?.item||null;const inferredFromSessionId=race?.id||goal.inferredFromSessionId;if(!race||(race.date===goal.date&&inferredFromSessionId===goal.inferredFromSessionId&&goal.dateAuthority==='plan'))return goal;changed=true;return{...goal,date:race.date,dateAuthority:'plan',inferredFromSessionId,updatedAt:new Date().toISOString()};});
    return{goals:next,changed};
  }
  function reconcileGoalGeneratedSessions(sessions=[],goal,canonicalSessionId){
    const removedIds=[],detachedIds=[];const generatedId=`goal-session:${goal?.id}`;const next=(Array.isArray(sessions)?sessions:[]).flatMap(session=>{const belongsToGoal=session.goalId===goal?.id||session.id===generatedId;const superseded=isGoalGeneratedSession(session)&&belongsToGoal&&session.id!==canonicalSessionId;if(!superseded)return[session];if(!session.outcome){removedIds.push(session.id);return[];}const{goalId:ignoredGoal,goalGenerated:ignoredGenerated,goalSyncedAt:ignoredSync,...detached}=session;detachedIds.push(session.id);return[detached];});return{sessions:next,removedIds,detachedIds,changed:Boolean(removedIds.length||detachedIds.length)};
  }
  function targetMinutes(goal){const text=String(goal?.target||'');const clock=text.match(/(?:^|\D)(\d{1,2})\s*:\s*(\d{2})(?:\D|$)/);if(clock){const major=Number(clock[1]),minor=Number(clock[2]);return major<=12?major*60+minor:Math.round(major+minor/60);}const hours=text.match(/(\d+(?:[.,]\d+)?)\s*h/i);return hours?Math.round(Number(hours[1].replace(',','.'))*60):null;}
  function sessionFromGoal(goal,options={}){
    if(!goal?.id||goal.status!=='planned'||!goal.date)return null;const variant=eventModel?.variantFor?.(goal)||null,duration=targetMinutes(goal),priority={A:'essential',B:'important',C:'optional'}[goal.priority]||'important',stamp=options.now||new Date().toISOString();let category='test',durationMin=duration||variant?.sessionDurationMin||60,details={testType:'Competition',testRpe:10,testProtocol:[variant?.label,goal.target].filter(Boolean).join(' · ')};
    if(['marathon','half-marathon','running'].includes(goal.type)){category='running';durationMin=duration||variant?.sessionDurationMin||({marathon:240,'half-marathon':120,running:60}[goal.type]);details={runType:'Race',distanceKm:Number(variant?.distanceKm)||({marathon:42.195,'half-marathon':21.0975}[goal.type]||null),runTarget:'rpe',hrZone:'',paceMin:0,paceSec:0,runRpe:9,runBlocks:[]};}
    else if(goal.type==='hyrox'){category='hyrox';durationMin=duration||variant?.sessionDurationMin||90;details={hyroxFormat:variant?.label||'Competition',hyroxRpe:10,hyroxStructuredBlocks:[]};}
    else if(goal.type==='cycling'){category='cycling';durationMin=duration||120;details={rideType:'Race',powerSource:'FTP',ftpMin:0,ftpMax:0,cadence:0};}
    else if(goal.type==='obstacle'){durationMin=duration||variant?.sessionDurationMin||120;details={testType:variant?.label||'Obstacle race',testRpe:10,testProtocol:[variant?.formatSummary,goal.target].filter(Boolean).join(' · ')};}
    else if(goal.type==='triathlon'){durationMin=duration||variant?.sessionDurationMin||180;details={testType:variant?.label||'Triathlon',testRpe:10,testProtocol:[variant?.formatSummary,goal.target].filter(Boolean).join(' · ')};}
    else if(goal.type==='athx'){durationMin=duration||variant?.sessionDurationMin||150;details={testType:variant?.label||'ATHX',testRpe:10,testProtocol:[variant?.formatSummary,goal.target].filter(Boolean).join(' · ')};}
    else if(goal.type==='strength-test'){details={testType:'Strength test',testRpe:10,testProtocol:goal.target||''};}
    const context=[variant?.label,goal.target?`target: ${goal.target}`:'',goal.notes].filter(Boolean).join(' · ');
    return{id:`goal-session:${goal.id}`,goalId:goal.id,goalGenerated:true,goalSyncedAt:goal.updatedAt||stamp,date:goal.date,category,title:goal.name,durationMin,priority,details,notes:`Evento creato automaticamente dall’obiettivo${context?` · ${context}`:''}.`,outcome:null,titleMode:'custom',createdAt:stamp,updatedAt:stamp};
  }
  function goalSubstitutionSource(session){
    const fields=['date','category','title','durationMin','priority','details','notes','titleMode'];
    return Object.fromEntries(fields.map(field=>[field,session[field]===undefined?undefined:JSON.parse(JSON.stringify(session[field]))]).filter(([,value])=>value!==undefined));
  }
  function restoreGoalSubstitution(sessions=[],goalId,options={}){
    const stamp=options.now||new Date().toISOString(),restoredIds=[];
    const next=(Array.isArray(sessions)?sessions:[]).map(session=>{
      if(session?.goalSubstitution?.goalId!==goalId)return session;
      const source=session.adaptiveAdjustment?.source;if(!source)return session;
      const restored={...session,...JSON.parse(JSON.stringify(source)),updatedAt:stamp};
      delete restored.adaptiveAdjustment;delete restored.coachApplication;delete restored.goalSubstitution;restoredIds.push(session.id);return restored;
    });
    return{sessions:next,changed:Boolean(restoredIds.length),restoredIds};
  }
  function applyGoalSubstitution(sessions=[],goal,options={}){
    if(!goal?.id)return{sessions:Array.isArray(sessions)?sessions:[],changed:false,pausedIds:[],restoredIds:[]};
    const stamp=options.now||new Date().toISOString(),variant=eventModel?.variantFor?.(goal)||null;
    const eligible=goal.status==='planned'&&['B','C'].includes(goal.priority)&&variant?.family==='running'&&Number(variant.distanceKm)>=21;
    const goalSessionId=options.goalSessionId||`goal-session:${goal.id}`,pausedIds=[];
    const restoredIds=[];let changed=false;
    const items=(Array.isArray(sessions)?sessions:[]).map(session=>{
      if(session?.goalSubstitution?.goalId!==goal.id)return session;
      const source=session.adaptiveAdjustment?.source,long=source?.category==='running'&&(source?.details?.runType==='Long run'||/long|lungo/i.test(source?.title||''));
      if(eligible&&source?.date===goal.date&&long&&session.goalSubstitution.goalSessionId===goalSessionId)return session;
      if(!source)return session;
      const restored={...session,...JSON.parse(JSON.stringify(source)),updatedAt:stamp};
      delete restored.adaptiveAdjustment;delete restored.coachApplication;delete restored.goalSubstitution;restoredIds.push(session.id);changed=true;return restored;
    });
    if(!eligible)return{sessions:items,changed,pausedIds,restoredIds};
    const next=items.map(session=>{
      const long=session?.category==='running'&&(session.details?.runType==='Long run'||/long|lungo/i.test(session.title||''));
      if(session.goalSubstitution?.goalId===goal.id||session.id===goalSessionId||session.goalGenerated||session.goalId||session.outcome||session.date!==goal.date||!long)return session;
      const source=session.adaptiveAdjustment?.source||goalSubstitutionSource(session),previousInstructions=session.adaptiveAdjustment?.instructions||[];
      const instruction=`Seduta assorbita da ${goal.name}: la gara svolge il ruolo di lungo specifico della giornata.`;
      pausedIds.push(session.id);changed=true;
      return{...session,adaptiveAdjustment:{version:1,status:'paused',level:session.adaptiveAdjustment?.level||'steady',confidence:'high',preparedAt:stamp,instructions:[...previousInstructions.filter(item=>!item.startsWith('Seduta assorbita da ')),instruction,'La prescrizione originale resta conservata e può essere ripristinata.'],source},goalSubstitution:{version:1,goalId:goal.id,goalSessionId,appliedAt:stamp,reason:'same-day-specific-race'},updatedAt:stamp};
    });
    return{sessions:next,changed,pausedIds,restoredIds};
  }
  function sortPlanned(a,b){return(priorityRank[a.priority]??9)-(priorityRank[b.priority]??9)||a.date.localeCompare(b.date)||a.name.localeCompare(b.name,'it');}
  function classifyGoals(goals=[],today=localToday()){
    const list=(Array.isArray(goals)?goals:[]).filter(Boolean);const future=list.filter(item=>item.status==='planned'&&item.date>=today).sort(sortPlanned);const current=future[0]||null;
    return{current,upcoming:future.filter(item=>item!==current).sort((a,b)=>a.date.localeCompare(b.date)||sortPlanned(a,b)),awaitingResult:list.filter(item=>item.status==='planned'&&item.date<today).sort((a,b)=>b.date.localeCompare(a.date)),history:list.filter(item=>item.status!=='planned').sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt))};
  }
  function currentPhase(goal,sessions=[],today=localToday()){
    if(!goal)return null;const relevant=(Array.isArray(sessions)?sessions:[]).filter(item=>item.planImport?.phase&&item.date<=goal.date).sort((a,b)=>a.date.localeCompare(b.date));if(!relevant.length)return null;
    const next=relevant.find(item=>item.date>=today),selected=next||relevant.at(-1);return{label:selected.planImport.phase,week:selected.planImport.week,weekLabel:selected.planImport.weekLabel,date:selected.date};
  }
  function weeklyProgress(goal,sessions=[],today=localToday()){
    const start=mondayFor(today),end=addDays(start,6);const week=(Array.isArray(sessions)?sessions:[]).filter(item=>item.date>=start&&item.date<=end&&(!goal||item.date<=goal.date));const active=week.filter(activeSession),done=active.filter(performed),runs=active.filter(item=>item.category==='running'),doneRuns=done.filter(item=>item.category==='running');
    const plannedKm=runs.reduce((sum,item)=>sum+(Number(item.details?.distanceKm)||0),0),actualKm=doneRuns.reduce((sum,item)=>sum+(Number(item.outcome?.actualDistanceKm)||0),0);
    return{weekStart:start,weekEnd:end,sessions:active.length,completed:done.length,plannedKm:+plannedKm.toFixed(1),actualKm:+actualKm.toFixed(1),distanceKnown:doneRuns.some(item=>Number(item.outcome?.actualDistanceKm)>0)};
  }
  function nextKeySessions(goal,sessions=[],today=localToday(),limit=3){
    if(!goal)return[];return(Array.isArray(sessions)?sessions:[]).filter(item=>activeSession(item)&&!item.outcome&&item.date>=today&&item.date<=goal.date&&(item.priority==='essential'||item.details?.runType==='Long run'||item.details?.runType==='Race')).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,limit);
  }
  function goalDashboard(goal,sessions=[],today=localToday()){
    if(!goal)return null;const days=Math.max(0,daysBetween(today,goal.date));return{goal,days,weeks:Math.ceil(days/7),phase:currentPhase(goal,sessions,today),week:weeklyProgress(goal,sessions,today),keySessions:nextKeySessions(goal,sessions,today)};
  }

  return{typeLabels,iso,addDays,daysBetween,mondayFor,inferGoalFromPlan,syncGoalDates,reconcileGoalGeneratedSessions,sessionFromGoal,applyGoalSubstitution,restoreGoalSubstitution,classifyGoals,currentPhase,weeklyProgress,nextKeySessions,goalDashboard,cleanPlanName,isGoalGeneratedSession,isRaceSession,typeForSession};
});
