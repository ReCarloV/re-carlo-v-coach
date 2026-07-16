(function(root,factory){
  const skipReasonModel=typeof module!=='undefined'&&module.exports?require('./skip-reason-model.js'):root.rcSkipReasonModel;
  const api=factory(skipReasonModel);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcWeeklyRecapModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(skipReasonModel){
  'use strict';

  const levelMeta={
    protect:{title:'Protezione del recupero',tone:'danger'},
    reduce:{title:'Carico da ridurre',tone:'warn'},
    steady:{title:'Carico da mantenere',tone:'neutral'},
    progress:{title:'Progressione controllata',tone:'good'}
  };
  const confidenceMeta={low:{label:'Bassa',tone:'warn'},medium:{label:'Media',tone:'neutral'},high:{label:'Alta',tone:'good'}};
  const categoryLabels={running:'Corsa',cycling:'Rulli',strength:'Forza',hyrox:'HYROX',metcon:'Metcon',test:'Test',recovery:'Recupero'};

  function iso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function dateAtNoon(value){return new Date(`${value}T12:00:00`);}
  function addDays(value,days){const date=dateAtNoon(value);date.setDate(date.getDate()+days);return iso(date);}
  function mondayFor(value){const date=dateAtNoon(value);const day=date.getDay()||7;date.setDate(date.getDate()-day+1);return iso(date);}
  function timestampDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?null:iso(date);}
  function number(value){const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;}
  function mean(values){const valid=values.map(Number).filter(Number.isFinite);return valid.length?valid.reduce((sum,value)=>sum+value,0)/valid.length:null;}
  function roundFive(value){return Math.max(5,Math.round(number(value)/5)*5);}
  function performed(session){return ['completed','partial'].includes(session.outcome?.status);}
  function paused(session){return session.adaptiveAdjustment?.status==='paused'&&!session.outcome;}
  function skipGroup(reason){return skipReasonModel?skipReasonModel.group(reason):({time:'organization',logistics:'organization',fatigue:'recovery',pain:'symptom',motivation:'planning','program-change':'planning'}[reason]||'unknown');}
  function relevant(session){return !paused(session)&&session.category!=='recovery'&&session.priority!=='optional'&&!(session.outcome?.status==='skipped'&&session.outcome.skipReason==='program-change');}
  function executionCredit(session){
    if(!session.outcome||session.outcome.status==='skipped')return 0;
    if(session.outcome.status==='completed')return 1;
    const ratio=number(session.outcome.actualDurationMin)/(number(session.durationMin)||1);
    return Math.max(.25,Math.min(.9,ratio||.5));
  }
  function averageField(items,field){return mean(items.map(item=>item[field]).filter(value=>value!==undefined&&value!==null&&value!==''));}
  function dateForCheckin(item){return item.sessionDate||timestampDate(item.updatedAt||item.createdAt);}
  function availabilityFor(history,weekStart,fallback=null){
    const items=(Array.isArray(history)?history:[]).filter(item=>item&&item.weekStart).sort((a,b)=>a.weekStart.localeCompare(b.weekStart));
    return items.find(item=>item.weekStart===weekStart)||[...items].reverse().find(item=>item.weekStart<weekStart)||fallback||null;
  }
  function weekClosure(sessions=[]){
    const required=(Array.isArray(sessions)?sessions:[]).filter(item=>!paused(item));const recorded=required.filter(item=>Boolean(item.outcome)),pending=required.filter(item=>!item.outcome);
    return{required:required.length,recorded:recorded.length,pending,ready:pending.length===0};
  }
  function confidenceFor({due,recorded,performedSessions,preCheckins,isPast}){
    const coverage=due.length?recorded.length/due.length:null;
    const completeOutcomes=performedSessions.filter(item=>number(item.outcome?.actualDurationMin)>0&&number(item.outcome?.rpe)>0).length;
    const outcomeCompleteness=performedSessions.length?completeOutcomes/performedSessions.length:0;
    let level='low';
    if(due.length>=3&&(coverage??0)>=.8&&outcomeCompleteness>=.8&&preCheckins.length>=Math.min(2,performedSessions.length))level='high';
    else if(due.length>=2&&(coverage??0)>=.5&&outcomeCompleteness>=.5)level='medium';
    if(!isPast&&level==='high')level='medium';
    return {level,...confidenceMeta[level],coverage,outcomeCompleteness};
  }
  function planSuggestion({weekStart,isPast,confidence,analysis,availabilityHistory,weeklyCheckin}){
    const nextWeekStart=addDays(weekStart,7);const exact=(Array.isArray(availabilityHistory)?availabilityHistory:[]).find(item=>item.weekStart===nextWeekStart)||null;
    const source=exact||availabilityFor(availabilityHistory,nextWeekStart,weeklyCheckin);const base=source||{sessions:5,sessionMinutes:60,longRunMinutes:120,days:[]};
    const rawLevel=analysis?.level||'steady';const level=!isPast&&rawLevel==='progress'?'steady':rawLevel;
    const rawSettings=analysis?.settings||{};const settings={
      volumeFactor:level==='protect'?.75:level==='reduce'?.9:1,
      longFactor:level==='protect'?.75:level==='reduce'?.85:level==='progress'?1.05:1,
      sessionDelta:level==='protect'?-1:0,
      qualityMode:level==='protect'||level==='reduce'?'controlled':'normal',
      strengthRir:level==='protect'?4:level==='reduce'?3:2,
      ...rawSettings
    };
    if(level!==rawLevel&&rawLevel==='progress')settings.longFactor=1;
    const sessions=Math.max(1,Math.min(6,number(base.sessions||5)+number(settings.sessionDelta)));
    const sessionMinutes=Math.max(30,roundFive(number(base.sessionMinutes||60)*number(settings.volumeFactor||1)));
    const longRunMinutes=Math.max(45,roundFive(number(base.longRunMinutes||120)*number(settings.longFactor||1)));
    const changes=[];
    if(sessions!==number(base.sessions))changes.push(analysis?.organization?.level==='adapt'?`${sessions} sedute suggerite invece di ${base.sessions} per i vincoli organizzativi ripetuti; non è una riduzione attribuita alla fatica.`:`${sessions} sedute suggerite invece di ${base.sessions}.`);
    if(sessionMinutes!==number(base.sessionMinutes))changes.push(`Durata abituale circa ${sessionMinutes} min invece di ${base.sessionMinutes}.`);
    if(longRunMinutes!==number(base.longRunMinutes))changes.push(`Lungo indicativo ${longRunMinutes} min invece di ${base.longRunMinutes}.`);
    if(settings.qualityMode==='controlled')changes.push('Qualità mantenuta in forma controllata, senza aumentare la densità.');
    if(number(settings.strengthRir)>2)changes.push(`Forza con margine almeno RIR ${settings.strengthRir}.`);
    if(!changes.length)changes.push(level==='progress'?'Solo il lungo può crescere del 5%; intensità e forza restano stabili.':'Struttura settimanale mantenuta senza progressioni automatiche.');
    if(!source)changes.push('Disponibilità ancora da confermare: la base 5 × 60 min è soltanto una precompilazione.');
    return {
      weekStart:nextWeekStart,level,label:levelMeta[level].title,tone:levelMeta[level].tone,
      provisional:!isPast||confidence.level==='low',availabilityConfirmed:Boolean(exact),source,
      sessions,sessionMinutes,longRunMinutes,days:Array.isArray(base.days)?base.days:[],weekendLong:base.weekendLong||'maybe',constraints:base.constraints||'',changes
    };
  }

  function buildWeeklyRecap(input={}){
    const today=input.today||iso(new Date());const weekStart=mondayFor(input.weekStart||today);const weekEnd=addDays(weekStart,6);
    const isPast=weekEnd<today,isFuture=weekStart>today,isCurrent=!isPast&&!isFuture;
    const sessions=(Array.isArray(input.sessions)?input.sessions:[]).filter(item=>item.date>=weekStart&&item.date<=weekEnd);
    const demoCount=sessions.filter(item=>Boolean(item.demoDataset)).length;
    const due=sessions.filter(item=>!paused(item)&&(isPast||item.date<today||Boolean(item.outcome)));
    const recorded=due.filter(item=>item.outcome);const performedSessions=recorded.filter(performed);const skipped=recorded.filter(item=>item.outcome?.status==='skipped');
    const keyDue=due.filter(relevant);const keyRecorded=keyDue.filter(item=>item.outcome);const adherence=keyDue.length?keyDue.reduce((sum,item)=>sum+executionCredit(item),0)/keyDue.length:null;
    const preCheckins=(Array.isArray(input.preCheckins)?input.preCheckins:[]).filter(item=>{const date=dateForCheckin(item);return date&&date>=weekStart&&date<=weekEnd;});
    const confidence=confidenceFor({due:keyDue,recorded:keyRecorded,performedSessions:performedSessions.filter(relevant),preCheckins,isPast});
    const load=performedSessions.reduce((sum,item)=>sum+number(item.outcome?.sessionLoad),0);const actualMinutes=performedSessions.reduce((sum,item)=>sum+number(item.outcome?.actualDurationMin),0);
    const plannedMinutes=due.reduce((sum,item)=>sum+number(item.durationMin),0);const runs=performedSessions.filter(item=>item.category==='running');const runsWithDistance=runs.filter(item=>number(item.outcome?.actualDistanceKm)>0);
    const runningDistance=runsWithDistance.reduce((sum,item)=>sum+number(item.outcome.actualDistanceKm),0);const rpes=performedSessions.map(item=>item.outcome?.rpe).filter(value=>number(value)>0);
    const outcomePainValues=performedSessions.map(item=>item.outcome?.pain).filter(value=>value!==undefined&&value!==null&&Number.isFinite(Number(value)));const issuePainValues=preCheckins.flatMap(item=>(Array.isArray(item.issueReadings)?item.issueReadings:[]).map(reading=>reading.pain)).filter(value=>value!==undefined&&value!==null&&Number.isFinite(Number(value)));
    const painKnown=outcomePainValues.length+issuePainValues.length>0;const maxPain=painKnown?Math.max(0,...outcomePainValues.map(Number),...issuePainValues.map(Number)):0;const pastUnrecorded=due.filter(item=>!item.outcome).length;
    const categoryCounts={};performedSessions.forEach(item=>{categoryCounts[item.category]=(categoryCounts[item.category]||0)+1;});
    const subjective={count:preCheckins.length,energy:averageField(preCheckins,'energy'),fatigue:averageField(preCheckins,'fatigue'),soreness:averageField(preCheckins,'soreness'),motivation:averageField(preCheckins,'motivation')};
    const analysis=input.analysis||{level:'steady',settings:{},reasons:[]};const meta=levelMeta[analysis.level]||levelMeta.steady;
    const reasons=[];
    if(pastUnrecorded)reasons.push(`${pastUnrecorded} sedut${pastUnrecorded===1?'a non è ancora registrata':'e non sono ancora registrate'}.`);
    const skipSignals={organization:0,recovery:0,symptom:0,planning:0,unknown:0};skipped.forEach(item=>{skipSignals[skipGroup(item.outcome.skipReason)]++;});const fatigueSkips=skipped.filter(item=>item.outcome.skipReason==='fatigue').length;const painSkips=skipped.filter(item=>item.outcome.skipReason==='pain').length;
    if(skipSignals.organization)reasons.push(`${skipSignals.organization} assenz${skipSignals.organization===1?'a':'e'} per vincoli organizzativi: impatta la fattibilità, non viene letta come fatica.`);
    if(skipSignals.planning)reasons.push(`${skipSignals.planning} sedut${skipSignals.planning===1?'a':'e'} modificat${skipSignals.planning===1?'a':'e'} per programma o sostenibilità.`);
    if(fatigueSkips)reasons.push(`${fatigueSkips} sedut${fatigueSkips===1?'a':'e'} non svolt${fatigueSkips===1?'a':'e'} per fatica o recupero.`);
    if(painSkips||maxPain>=3)reasons.push(`Dolore massimo disponibile: ${maxPain}/10.`);
    const harder=performedSessions.filter(item=>item.outcome?.execution==='harder'||number(item.outcome?.rpe)>=8).length;if(harder)reasons.push(`${harder} sedut${harder===1?'a è':'e sono'} risultat${harder===1?'a':'e'} più impegnativ${harder===1?'a':'e'} del previsto.`);
    if(analysis.recovery?.usable&&['caution','protect'].includes(analysis.recovery.level))reasons.push(`WHOOP: ${analysis.recovery.reasons.join(' ')}`);
    if(!preCheckins.length&&performedSessions.length)reasons.push('Nessun check-in soggettivo disponibile per questa settimana.');
    if(!reasons.length&&sessions.length)reasons.push(isCurrent?'La settimana è ancora in corso: il recap si aggiorna dopo ogni registrazione.':'Nessun segnale rilevante emerge dai dati disponibili.');
    if(!sessions.length)reasons.push('Non ci sono sedute programmate o registrate in questa settimana.');
    const availability=(Array.isArray(input.availabilityHistory)?input.availabilityHistory:[]).find(item=>item?.weekStart===weekStart)
      ||(input.weeklyCheckin?.weekStart===weekStart?input.weeklyCheckin:null);
    const closure=weekClosure(sessions);const nextWeek={...planSuggestion({weekStart,isPast,confidence,analysis,availabilityHistory:input.availabilityHistory,weeklyCheckin:availability||input.weeklyCheckin||null}),closure};
    const coachTitle=!sessions.length?'Settimana senza dati':!recorded.length&&due.length?'Recap ancora incompleto':meta.title;
    const coachSummary=!sessions.length?'Il coach non deduce carico o recupero senza uno storico reale.':!recorded.length&&due.length?'Registra gli esiti delle sedute passate prima di usare il recap per modificare il piano.':analysis.summary||`${meta.title}. Le decisioni restano proporzionate alla qualità dei dati.`;
    return {
      today,weekStart,weekEnd,isPast,isCurrent,isFuture,sessions,demoCount,due,recorded,performed:performedSessions,skipped,keyDue,keyRecorded,
      adherence,coverage:confidence.coverage,confidence,
      load,actualMinutes,plannedMinutes,runningDistance,distanceKnown:runsWithDistance.length>0,distancePartial:runsWithDistance.length<runs.length,
      meanRpe:mean(rpes),maxPain,painKnown,pastUnrecorded,categoryCounts,categoryLabels,subjective,availability,skipSignals,
      coach:{level:analysis.level||'steady',tone:meta.tone,title:coachTitle,summary:coachSummary,reasons},recovery:analysis.recovery||null,nextWeek
    };
  }

  return {buildWeeklyRecap,mondayFor,addDays,availabilityFor,executionCredit,weekClosure};
});
