(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcCoachPlanExchangeModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const BRIEF_VERSION=1;
  const PLAN_VERSION=1;
  const APP_NAME='Re Carlo V Personal Coach';
  const categories=new Set(['running','swimming','cycling','strength','hyrox','metcon','test','recovery']);
  const priorities=new Set(['essential','important','optional']);
  const structuredFields={running:'runBlocks',cycling:'rideBlocks',strength:'strengthBlocks',swimming:'swimStructuredBlocks',hyrox:'hyroxStructuredBlocks',metcon:'metconStructuredBlocks'};
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const isObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
  const text=(value,max=5000)=>typeof value==='string'&&value.trim()&&value.length<=max;
  const timestamp=value=>typeof value==='string'&&!Number.isNaN(Date.parse(value));
  function dateKey(value){
    if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))return false;
    const parsed=new Date(`${value}T00:00:00.000Z`);return!Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
  }
  function iso(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function addDays(value,days){const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+days);return iso(date);}
  function mondayFor(value){const date=new Date(`${value}T12:00:00`),day=date.getDay()||7;date.setDate(date.getDate()-day+1);return iso(date);}
  function stable(value){
    if(value===undefined)return undefined;if(value===null||typeof value==='string'||typeof value==='boolean')return value;
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    if(Array.isArray(value))return value.map(stable);
    if(isObject(value)){const result={};Object.keys(value).sort().forEach(key=>{const next=stable(value[key]);if(next!==undefined)result[key]=next;});return result;}
    return undefined;
  }
  function hash(value){let result=2166136261;for(let index=0;index<value.length;index+=1){result^=value.charCodeAt(index);result=Math.imul(result,16777619);}return(result>>>0).toString(16).padStart(8,'0');}
  function error(code,message,details=[]){const failure=new Error(message);failure.name='CoachPlanError';failure.code=code;failure.details=details;throw failure;}
  function boundedArray(value,max,label){if(!Array.isArray(value)||value.length>max)error('INVALID_COACH_PLAN',`${label} non è valido.`);return value;}
  function activeGoal(goals,today){return[...(Array.isArray(goals)?goals:[])].filter(goal=>goal?.status==='planned'&&goal.priority==='A'&&dateKey(goal.date)&&goal.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0]||null;}
  function sessionBrief(session){
    return stable({
      id:session.id,date:session.date,category:session.category,title:session.title,durationMin:session.durationMin,startTime:session.startTime||null,priority:session.priority,
      details:session.details||{},notes:session.notes||'',rationale:session.rationale||'',outcome:session.outcome||null,
      goalId:session.goalId||session.baselinePlan?.goalId||session.coachPlan?.goalId||null,goalGenerated:Boolean(session.goalGenerated),
      plan:{baseline:session.baselinePlan||null,coach:session.coachPlan||null,adaptive:session.adaptiveAdjustment||null,application:session.coachApplication||null,manualOverride:Boolean(session.manualOverride)}
    });
  }
  function activityBrief(activity){return stable({id:activity.id,date:activity.date,localStart:activity.localStart,type:activity.type,sport:activity.sport,name:activity.name,durationMin:activity.durationMin,distanceKm:activity.distanceKm,averageHr:activity.averageHr,maxHr:activity.maxHr,elevationM:activity.elevationM,calories:activity.calories,source:activity.source?.provider||'strava'});}
  function whoopCycleBrief(item){return stable({id:item.id,date:item.date||item.cycleDate,start:item.cycleStart,end:item.cycleEnd,recoveryScore:item.recoveryScore,dayStrain:item.dayStrain,restingHr:item.restingHr,hrvMs:item.hrvMs,spo2:item.spo2,skinTempC:item.skinTempC});}
  function whoopSleepBrief(item){return stable({id:item.id,date:item.date||item.sleepDate,start:item.sleepStart,end:item.sleepEnd,sleepPerformance:item.sleepPerformance,sleepConsistency:item.sleepConsistency,sleepEfficiency:item.sleepEfficiency,respiratoryRate:item.respiratoryRate,asleepMinutes:item.asleepMinutes,inBedMinutes:item.inBedMinutes});}
  function whoopWorkoutBrief(item){return stable({id:item.id,date:item.date,start:item.start,end:item.end,sport:item.sport,durationMin:item.durationMin,strain:item.strain,averageHr:item.averageHr,maxHr:item.maxHr,calories:item.calories,distanceKm:item.distanceKm});}
  function profileBrief(profile,hrZones){
    const fields=['firstName','lastName','nickname','birthDate','heightCm','weightKg','level','sports','equipment','maxHr','restingHr','ftp','hrZoneMethod','ftpZoneMethod','strengthFormula','strengthMaxes','personalBests','heartRateSources','bodyMeasurementSources'];
    return stable({...Object.fromEntries(fields.filter(field=>Object.prototype.hasOwnProperty.call(profile||{},field)).map(field=>[field,clone(profile[field])])),hrZones:Array.isArray(hrZones)?clone(hrZones):null});
  }
  function adherenceSummary(sessions,from,to){
    const due=sessions.filter(item=>item.date>=from&&item.date<=to&&item.adaptiveAdjustment?.status!=='paused'),recorded=due.filter(item=>item.outcome),completed=recorded.filter(item=>item.outcome.status==='completed'),partial=recorded.filter(item=>item.outcome.status==='partial'),skipped=recorded.filter(item=>item.outcome.status==='skipped');
    return{due:due.length,recorded:recorded.length,completed:completed.length,partial:partial.length,skipped:skipped.length,recordedRate:due.length?Number((recorded.length/due.length).toFixed(3)):null};
  }
  function daysBetween(from,to){
    const start=new Date(`${from}T12:00:00`),end=new Date(`${to}T12:00:00`);return Math.max(0,Math.round((end-start)/86400000));
  }
  function assessReviewNeed(input={},options={}){
    const today=options.today||iso(options.now instanceof Date?options.now:new Date(options.now||Date.now())),goals=Array.isArray(input.goals)?input.goals:[],goal=options.goal||activeGoal(goals,today),plans=Array.isArray(input.coachPlans)?input.coachPlans:[];
    const plan=plans.filter(item=>item.goalId===goal?.id&&item.status==='active').sort((a,b)=>Number(b.revision)-Number(a.revision)||String(b.importedAt||'').localeCompare(String(a.importedAt||'')))[0]||null;
    if(!goal||!plan)return{level:'missing',label:'Piano da preparare',summary:'Non è presente una revisione attiva per l’obiettivo principale.',reasons:['Esporta il dossier iniziale e importa il piano preparato nella task Elite Coach.'],metrics:{due:0,recorded:0,adherence:null,keyMissed:0,manualChanges:0,daysSinceRevision:0},goalId:goal?.id||null,planId:null,revision:null,nextReviewDate:null};
    const importedDate=String(plan.importedAt||plan.generatedAt||plan.validFrom).slice(0,10),from=importedDate>plan.validFrom?importedDate:plan.validFrom,sessions=Array.isArray(input.sessions)?input.sessions:[];
    const planSessions=sessions.filter(item=>item.coachPlan?.planId===plan.id&&item.date>=from),due=planSessions.filter(item=>item.date<today&&item.adaptiveAdjustment?.status!=='paused'),recorded=due.filter(item=>item.outcome),completed=recorded.filter(item=>item.outcome.status==='completed').length,partial=recorded.filter(item=>item.outcome.status==='partial').length;
    const adherence=due.length?Number(((completed+partial*.6)/due.length).toFixed(3)):null,keyMissed=due.filter(item=>item.priority==='essential'&&!['completed','partial'].includes(item.outcome?.status)).length,manualChanges=planSessions.filter(item=>item.manualOverride).length;
    const goalChanged=timestamp(goal.updatedAt)&&timestamp(plan.importedAt)&&new Date(goal.updatedAt)>new Date(plan.importedAt),highSymptom=(input.bodyIssues||[]).some(item=>item?.status!=='resolved'&&Number(item.latestPain??item.initialPain)>=5),daysSinceRevision=daysBetween(importedDate,today),reasons=[];
    if(goalChanged)reasons.push('L’obiettivo o la disponibilità strutturale sono cambiati dopo l’ultima importazione.');
    if(keyMissed>=2)reasons.push(`${keyMissed} sedute essenziali dovute non risultano completate.`);
    if(due.length>=4&&adherence!==null&&adherence<.7)reasons.push(`Aderenza ponderata al ${Math.round(adherence*100)}% sulle sedute dovute della revisione.`);
    if(highSymptom)reasons.push('È presente un fastidio attivo con intensità almeno 5/10: serve una revisione prudente, non una diagnosi automatica.');
    let level=reasons.length?'due':'current';
    if(level==='current'&&manualChanges>=2){level='recommended';reasons.push(`${manualChanges} sedute del piano sono state modificate manualmente.`);}
    if(level==='current'&&daysSinceRevision>=21&&recorded.length>=6){level='recommended';reasons.push(`Sono trascorsi ${daysSinceRevision} giorni e sono disponibili ${recorded.length} nuovi esiti dalla revisione ${plan.revision}.`);}
    if(level==='current')reasons.push('La revisione attiva è recente e non emergono segnali strutturali sufficienti per sostituirla.');
    const labels={due:'Revisione necessaria',recommended:'Revisione consigliata',current:'Piano aggiornato'};
    return{level,label:labels[level],summary:level==='due'?'Il piano va rivalutato nella task Elite Coach prima di modificarne la struttura.':level==='recommended'?'Ci sono abbastanza nuovi dati per un controllo del piano, senza urgenza.':'L’app continua a registrare dati e ad applicare solo adattamenti operativi conservativi.',reasons,metrics:{due:due.length,recorded:recorded.length,adherence,keyMissed,manualChanges,daysSinceRevision},goalId:goal.id,planId:plan.id,revision:Number(plan.revision),reviewedFrom:from,nextReviewDate:addDays(importedDate,21)};
  }
  function createBrief(input={},options={}){
    const now=options.now instanceof Date?options.now:new Date(options.now||Date.now()),today=options.today||iso(now),goal=options.goal||activeGoal(input.goals,today);
    if(!goal)error('NO_PRIORITY_A_GOAL','Serve un obiettivo futuro di priorità A per creare il dossier del Coach.');
    const historyFrom=addDays(today,-83),whoopFrom=addDays(today,-27),sessions=Array.isArray(input.sessions)?input.sessions:[],goals=Array.isArray(input.goals)?input.goals:[],review=assessReviewNeed(input,{today,goal});
    const recentSessions=sessions.filter(item=>item.date>=historyFrom&&item.date<today).sort((a,b)=>a.date.localeCompare(b.date)).map(sessionBrief);
    const futureSessions=sessions.filter(item=>item.date>=today&&item.date<=goal.date).sort((a,b)=>a.date.localeCompare(b.date)).map(sessionBrief);
    const availability=(goal.trainingAvailability&&clone(goal.trainingAvailability))||[...(input.weeklyAvailabilityHistory||[])].sort((a,b)=>String(b.weekStart).localeCompare(String(a.weekStart)))[0]||null;
    return stable({
      app:APP_NAME,kind:'coach-brief',schemaVersion:BRIEF_VERSION,exportedAt:now.toISOString(),today,
      athlete:profileBrief(input.profile||{},input.hrZones),
      objective:{primary:clone(goal),secondary:goals.filter(item=>item.status==='planned'&&item.id!==goal.id&&item.date>=today).sort((a,b)=>a.date.localeCompare(b.date)).map(clone)},
      availability,
      observations:{
        historyWindow:{from:historyFrom,to:addDays(today,-1),days:84},adherence:adherenceSummary(sessions,historyFrom,addDays(today,-1)),sinceRevision:{from:review.reviewedFrom||null,planId:review.planId,revision:review.revision,status:review.level,metrics:review.metrics,reasons:review.reasons},sessions:recentSessions,
        activities:(input.importedActivities||[]).filter(item=>item.date>=historyFrom&&item.date<today).map(activityBrief),
        whoop:{window:{from:whoopFrom,to:today,days:28},cycles:(input.whoopCycles||[]).filter(item=>(item.date||item.cycleDate||String(item.cycleStart||'').slice(0,10))>=whoopFrom).map(whoopCycleBrief),sleeps:(input.whoopSleeps||[]).filter(item=>(item.date||item.sleepDate||String(item.sleepStart||'').slice(0,10))>=whoopFrom).map(whoopSleepBrief),workouts:(input.whoopWorkouts||[]).filter(item=>(item.date||String(item.start||'').slice(0,10))>=whoopFrom).map(whoopWorkoutBrief)},
        preSessionCheckins:(input.preSessionCheckins||[]).filter(item=>(item.sessionDate||String(item.createdAt||'').slice(0,10))>=historyFrom).map(clone),
        bodyIssues:(input.bodyIssues||[]).filter(item=>item.status==='active'||String(item.resolvedAt||'').slice(0,10)>=historyFrom).map(clone)
      },
      currentPlan:{review,sessions:futureSessions,coachPlans:clone(input.coachPlans||[])},
      outputContract:{kind:'coach-plan',schemaVersion:PLAN_VERSION,importRule:'Restituisci un unico file JSON valido. Le gare già presenti negli obiettivi non vanno duplicate come sedute.',requiredSessionStructure:'Ogni seduta deve avere prescrizione strutturata nei details e rationale; nessun dato sensore futuro va inventato.'}
    });
  }
  function validateBlocks(session,errors){
    const field=structuredFields[session.category];if(!field||session.category==='test'||session.category==='recovery')return;
    const race=session.details?.runType==='Race'||session.goalGenerated;if(race)return;
    if(!Array.isArray(session.details?.[field])||!session.details[field].length)errors.push(`${session.date} · ${session.title}: manca ${field}.`);
  }
  function validatePlanPackage(raw,context={}){
    const value=typeof raw==='string'?(()=>{try{return JSON.parse(raw);}catch(_){error('INVALID_JSON','Il file del Coach non contiene JSON valido.');}})():clone(raw);
    if(!isObject(value)||value.app!==APP_NAME||value.kind!=='coach-plan'||value.schemaVersion!==PLAN_VERSION)error('INVALID_COACH_PLAN','Il file non è un piano Coach compatibile con questa app.');
    const plan=value.plan;if(!isObject(plan)||!text(plan.goalId,160)||!text(plan.goalName,200)||!Number.isInteger(Number(plan.revision))||Number(plan.revision)<1||Number(plan.revision)>999||!timestamp(plan.generatedAt)||!dateKey(plan.validFrom)||!dateKey(plan.validTo)||plan.validTo<plan.validFrom)error('INVALID_COACH_PLAN','Identità, revisione o intervallo del piano non sono validi.');
    if(context.goal&&plan.goalId!==context.goal.id)error('GOAL_MISMATCH',`Il piano è per “${plan.goalName}”, non per l’obiettivo selezionato “${context.goal.name}”.`);
    if(context.goal&&plan.validTo>context.goal.date)error('PLAN_AFTER_GOAL','Il piano contiene giorni successivi alla gara principale.');
    if(context.today&&plan.validFrom<context.today)error('PLAN_IN_PAST','Il nuovo piano non può riscrivere giornate già trascorse.');
    const methodology=plan.methodology;if(!isObject(methodology)||!text(methodology.summary,5000)||!Array.isArray(methodology.assumptions)||methodology.assumptions.length>40||methodology.assumptions.some(item=>!text(item,1000))||!Array.isArray(methodology.evidence)||methodology.evidence.length>60||methodology.evidence.some(item=>!isObject(item)||!text(item.label,500)||!text(item.url,2000)))error('INVALID_COACH_PLAN','Metodo, assunzioni o fonti del piano non sono validi.');
    const policy=plan.adaptationPolicy;if(!isObject(policy)||!Number.isFinite(Number(policy.maxVolumeReductionPct))||Number(policy.maxVolumeReductionPct)<0||Number(policy.maxVolumeReductionPct)>80||typeof policy.intensityDowngradeAllowed!=='boolean'||!Array.isArray(policy.structuralReviewTriggers)||policy.structuralReviewTriggers.some(item=>!text(item,500)))error('INVALID_COACH_PLAN','La politica di adattamento del piano non è valida.');
    const sessions=boundedArray(value.sessions,500,'L’elenco delle sedute'),errors=[],ids=new Set();
    if(!sessions.length)errors.push('Il piano non contiene sedute.');
    sessions.forEach((session,index)=>{
      if(!isObject(session)||!dateKey(session.date)||session.date<plan.validFrom||session.date>plan.validTo||!categories.has(session.category)||!text(session.title,300)||!Number.isFinite(Number(session.durationMin))||Number(session.durationMin)<=0||Number(session.durationMin)>600||!priorities.has(session.priority)||!isObject(session.details))errors.push(`Seduta ${index+1}: data, categoria, titolo, durata, priorità o dettagli non validi.`);
      if(session.id!==undefined&&(!text(session.id,200)||ids.has(session.id)))errors.push(`Seduta ${index+1}: identificativo non valido o duplicato.`);if(session.id)ids.add(session.id);
      if(session.startTime!==undefined&&!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(session.startTime))errors.push(`${session.date||`Seduta ${index+1}`}: orario non valido.`);
      if(session.notes!==undefined&&typeof session.notes!=='string')errors.push(`${session.date||`Seduta ${index+1}`}: note non valide.`);
      if(!text(session.rationale,5000))errors.push(`${session.date||`Seduta ${index+1}`}: manca una motivazione leggibile.`);
      if(session.phaseKey!==undefined&&typeof session.phaseKey!=='string')errors.push(`${session.date||`Seduta ${index+1}`}: fase non valida.`);
      if(session.phaseLabel!==undefined&&!text(session.phaseLabel,300))errors.push(`${session.date||`Seduta ${index+1}`}: etichetta della fase non valida.`);
      validateBlocks(session,errors);
    });
    if(errors.length)error('INVALID_COACH_SESSIONS','Alcune sedute del piano non rispettano il contratto.',errors);
    return value;
  }
  function planIdFor(plan){return plan.id&&text(plan.id,200)?plan.id:`coach-plan-${hash(`${plan.goalId}|${plan.revision}|${plan.generatedAt}`)}`;}
  function normalizePlanSession(session,index,plan,goal,importedAt,signature,planId){
    const id=session.id||`coach-session-${hash(`${planId}|${index}|${session.date}|${session.category}|${session.title}`)}`;
    return{
      id,date:session.date,category:session.category,title:session.title.trim(),durationMin:Number(session.durationMin),startTime:session.startTime||'09:00',priority:session.priority,
      details:clone(session.details),notes:typeof session.notes==='string'?session.notes:'',rationale:session.rationale.trim(),outcome:null,titleMode:'custom',generated:true,generatorVersion:6,
      createdAt:importedAt,updatedAt:importedAt,
      baselinePlan:{version:3,signature,goalId:goal.id,goalName:goal.name,weekStart:mondayFor(session.date),phaseKey:session.phaseKey||null,phaseLabel:session.phaseLabel||'Piano Coach',generatedAt:plan.generatedAt},
      coachPlan:{version:1,planId,revision:Number(plan.revision),goalId:goal.id,generatedAt:plan.generatedAt,importedAt,source:'codex'}
    };
  }
  function buildImport(raw,context={}){
    const today=context.today||iso(new Date()),goals=Array.isArray(context.goals)?context.goals:[],goal=context.goal||goals.find(item=>item.id===raw?.plan?.goalId)||activeGoal(goals,today),value=validatePlanPackage(raw,{goal,today});
    if(!goal)error('GOAL_NOT_FOUND','L’obiettivo del piano non esiste più nell’app.');
    const plans=Array.isArray(context.coachPlans)?clone(context.coachPlans):[],sessions=Array.isArray(context.sessions)?clone(context.sessions):[],retired=Array.isArray(context.retiredPlanSessions)?clone(context.retiredPlanSessions):[];
    const planId=planIdFor(value.plan);if(plans.some(item=>item.id===planId&&item.revision===Number(value.plan.revision)))error('DUPLICATE_COACH_PLAN','Questa revisione del piano è già stata importata.');
    const importedAt=context.now instanceof Date?context.now.toISOString():new Date(context.now||Date.now()).toISOString(),signature=`macro-${hash(`${planId}|${value.plan.revision}`)}`;
    let incoming=value.sessions.map((session,index)=>normalizePlanSession(session,index,value.plan,goal,importedAt,signature,planId));
    const raceKeys=new Set(sessions.filter(item=>item.goalGenerated&&item.date>=value.plan.validFrom&&item.date<=value.plan.validTo).map(item=>`${item.date}|${item.category}`)),omitted=[];
    incoming=incoming.filter(item=>{if(!raceKeys.has(`${item.date}|${item.category}`))return true;omitted.push(item);return false;});
    const replaceable=sessions.filter(item=>item.date>=value.plan.validFrom&&item.date<=value.plan.validTo&&item.baselinePlan?.goalId===goal.id&&!item.outcome&&!item.manualOverride&&!item.goalGenerated&&item.date>=today);
    const replaceIds=new Set(replaceable.map(item=>item.id)),preserved=sessions.filter(item=>!replaceIds.has(item.id)),preservedIds=new Set(preserved.map(item=>item.id));
    if(incoming.some(item=>preservedIds.has(item.id)))error('SESSION_ID_CONFLICT','Il piano contiene un identificativo già usato da una seduta protetta.');
    const record={
      id:planId,version:1,goalId:goal.id,goalName:goal.name,revision:Number(value.plan.revision),status:'active',author:value.plan.author||'Re Carlo V — Elite Coach',source:'codex',generatedAt:value.plan.generatedAt,importedAt,validFrom:value.plan.validFrom,validTo:value.plan.validTo,
      methodology:clone(value.plan.methodology),adaptationPolicy:clone(value.plan.adaptationPolicy),sessionIds:incoming.map(item=>item.id),supersedesPlanId:plans.filter(item=>item.goalId===goal.id&&item.status==='active').sort((a,b)=>b.revision-a.revision)[0]?.id||null
    };
    const nextPlans=plans.map(item=>item.goalId===goal.id&&item.status==='active'?{...item,status:'superseded',supersededAt:importedAt}:item).concat(record).sort((a,b)=>a.importedAt.localeCompare(b.importedAt));
    const retiredMap=new Map(retired.map(item=>[`${item.coachPlan?.planId||'legacy'}|${item.id}`,item]));replaceable.forEach(item=>retiredMap.set(`${item.coachPlan?.planId||'baseline'}|${item.id}`,item));
    const categoryCounts=Object.fromEntries([...categories].map(category=>[category,incoming.filter(item=>item.category===category).length]).filter(([,count])=>count));
    return{value,record,sessions:incoming,nextSessions:[...preserved,...incoming].sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title)),nextCoachPlans:nextPlans,nextRetiredPlanSessions:[...retiredMap.values()],preview:{goalName:goal.name,revision:record.revision,validFrom:record.validFrom,validTo:record.validTo,added:incoming.length,replaced:replaceable.length,protected:sessions.filter(item=>item.date>=record.validFrom&&item.date<=record.validTo&&!replaceIds.has(item.id)).length,omittedRaceDuplicates:omitted.length,categoryCounts,methodology:record.methodology.summary,warnings:[...(omitted.length?[`${omitted.length} seduta/e gara duplicate escluse: fanno fede gli obiettivi già salvati nell’app.`]:[]),...(replaceable.some(item=>item.outcome)?['Le sedute registrate non verranno sostituite.']:[])]}};
  }

  return{APP_NAME,BRIEF_VERSION,PLAN_VERSION,createBrief,assessReviewNeed,validatePlanPackage,buildImport,activeGoal,mondayFor,hash,stable};
});
