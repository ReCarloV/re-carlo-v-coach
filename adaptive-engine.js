(function(root){
  const DAY_MS=86400000;
  const symptomModel=root.rcSymptomRecencyModel;
  const skipReasonModel=root.rcSkipReasonModel;
  const recoveryModel=typeof module!=='undefined'&&module.exports?require('./recovery-trend-model.js'):root.rcRecoveryTrendModel;
  const toleranceModel=typeof module!=='undefined'&&module.exports?require('./progression-tolerance-model.js'):root.rcProgressionToleranceModel;
  const levelMeta={
    protect:{label:'Protezione del recupero',summary:'I segnali recenti richiedono una settimana conservativa: volume ridotto e niente qualità aggressiva.'},
    reduce:{label:'Carico ridotto',summary:'Mantengo gli stimoli principali, ma riduco volume e densità per assorbire fatica o fastidi.'},
    steady:{label:'Carico mantenuto',summary:'I dati non richiedono correzioni: il piano resta stabile e continua a raccogliere informazioni.'},
    progress:{label:'Progressione controllata',summary:'I controlli di tolleranza autorizzano una piccola progressione selettiva, senza aumentare automaticamente l’intensità.'}
  };

  function localDate(){const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
  function dateAtNoon(value){return new Date(`${value}T12:00:00`);}
  function addDays(value,days){const date=dateAtNoon(value);date.setDate(date.getDate()+days);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function sum(values){return values.reduce((total,value)=>total+(Number(value)||0),0);}
  function average(values){const valid=values.map(Number).filter(Number.isFinite);return valid.length?sum(valid)/valid.length:null;}
  function timestampDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?null:localIso(date);}
  function localIso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function activeTraining(session){return session.adaptiveAdjustment?.status!=='paused'&&session.category!=='recovery'&&!isNeutralSkip(session);}
  function relevant(session){return activeTraining(session)&&session.priority!=='optional';}
  function isNeutralSkip(session){return session.outcome?.status==='skipped'&&session.outcome?.skipReason==='program-change';}
  function skipGroup(reason){if(skipReasonModel)return skipReasonModel.group(reason);return {time:'organization',logistics:'organization',fatigue:'recovery',pain:'symptom',motivation:'planning','program-change':'planning'}[reason]||'unknown';}
  function executionCredit(session){
    const outcome=session.outcome;if(!outcome||outcome.status==='skipped')return 0;if(outcome.status==='completed')return 1;
    const ratio=Number(outcome.actualDurationMin)/(Number(session.durationMin)||1);return Math.max(.25,Math.min(.9,ratio||.5));
  }
  function periodStats(sessions,start,end,options={}){
    const openDate=options.openDate||null;
    const inWindow=sessions.filter(session=>session.date>=start&&session.date<=end);
    const due=inWindow.filter(session=>relevant(session)&&!(session.date===openDate&&!session.outcome));
    const recorded=due.filter(session=>session.outcome);
    const optionalPerformed=inWindow.filter(session=>activeTraining(session)&&session.priority==='optional'&&['completed','partial'].includes(session.outcome?.status));
    const performed=[...recorded.filter(session=>['completed','partial'].includes(session.outcome.status)),...optionalPerformed];
    const skipped=recorded.filter(session=>session.outcome.status==='skipped');
    const rpes=performed.map(session=>session.outcome.rpe).filter(value=>Number(value)>0);
    const knownPain=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
    const pains=performed.map(session=>session.outcome.pain).filter(knownPain);
    const runningPains=performed.filter(session=>session.category==='running').map(session=>session.outcome.pain).filter(knownPain);
    const eligibleAdherence=recorded.length;
    return {
      due:due.length,recorded:recorded.length,unrecorded:Math.max(0,due.length-recorded.length),
      completed:recorded.filter(session=>session.outcome.status==='completed').length,
      partial:recorded.filter(session=>session.outcome.status==='partial').length,
      skipped:skipped.length,
      coverage:due.length?recorded.length/due.length:null,
      adherence:eligibleAdherence?sum(recorded.map(executionCredit))/eligibleAdherence:null,
      load:sum(performed.map(session=>session.outcome.sessionLoad)),
      meanRpe:average(rpes),painKnown:pains.length>0,runningPainKnown:runningPains.length>0,maxPain:pains.length?Math.max(...pains):0,maxRunningPain:runningPains.length?Math.max(...runningPains):0,
      harder:performed.filter(session=>session.outcome.execution==='harder').length,
      highRpe:performed.filter(session=>Number(session.outcome.rpe)>=8).length,
      hardSessions:performed.filter(session=>Number(session.outcome.rpe)>=8||session.outcome.execution==='harder').length,
      optionalPerformed:optionalPerformed.length,
      fatigueSkips:skipped.filter(session=>session.outcome.skipReason==='fatigue').length,
      painSkips:skipped.filter(session=>session.outcome.skipReason==='pain').length,
      timeSkips:skipped.filter(session=>session.outcome.skipReason==='time').length,
      organizationSkips:skipped.filter(session=>skipGroup(session.outcome.skipReason)==='organization').length,
      planningSkips:skipped.filter(session=>skipGroup(session.outcome.skipReason)==='planning').length,
      unknownSkips:skipped.filter(session=>skipGroup(session.outcome.skipReason)==='unknown').length
    };
  }
  function organizationSignals(recent,previous){
    const recentSkips=recent.organizationSkips||0,previousSkips=previous.organizationSkips||0,total14=recentSkips+previousSkips;
    const repeated=recentSkips>=2||(recentSkips>=1&&previousSkips>=1);
    return {level:repeated?'adapt':recentSkips?'monitor':'stable',recentSkips,previousSkips,total14,repeated,sessionDelta:repeated?-1:0};
  }
  function summarizeRecentPreCheckins(preCheckins,today){
    const start=addDays(today,-6);const seen=new Set();const episodes=[];
    const recent=(Array.isArray(preCheckins)?preCheckins:[]).map(item=>({...item,_date:item.sessionDate||timestampDate(item.createdAt)})).filter(item=>item._date&&item._date>=start&&item._date<=today).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    recent.forEach(item=>{
      const key=item.sessionId?`session:${item.sessionId}`:`day:${item._date}`;if(seen.has(key))return;seen.add(key);
      const level=item.recommendation?.level,reason=item.recommendation?.reason;
      if(reason==='time'||!['reduce','replace'].includes(level))return;
      episodes.push({sessionId:item.sessionId||null,date:item._date,level});
    });
    const replaceCount=episodes.filter(item=>item.level==='replace').length;const reduceCount=episodes.filter(item=>item.level==='reduce').length;
    return {negativeCount:episodes.length,replaceCount,reduceCount,episodes,weeklyLevel:null,contextOnly:episodes.length===1};
  }
  function corroboratingOutcomes(sessions,start,end,preSummary){
    const candidates=(Array.isArray(sessions)?sessions:[]).filter(session=>session.date>=start&&session.date<=end&&relevant(session)&&(
      (['completed','partial'].includes(session.outcome?.status)&&(Number(session.outcome.rpe)>=8||session.outcome.execution==='harder'))||
      (session.outcome?.status==='skipped'&&session.outcome.skipReason==='fatigue')
    ));
    const distinct=candidates.filter(session=>!preSummary.episodes.some(episode=>episode.sessionId?episode.sessionId===session.id:episode.date===session.date));
    return {
      hard:distinct.some(session=>['completed','partial'].includes(session.outcome?.status)),
      fatigueSkip:distinct.some(session=>session.outcome?.status==='skipped'&&session.outcome.skipReason==='fatigue')
    };
  }
  function bodySignals(bodyIssues,today){
    const lowerPattern=/(hip|quad|knee|ankle|glute|hamstring|calf)/;
    const issues=(Array.isArray(bodyIssues)?bodyIssues:[]).map(issue=>{
      if(symptomModel)return symptomModel.decorate(issue,today);
      const latestPain=Number(issue.latestPain)||0;return {...issue,latestPain,isFresh:true,requiresUpdate:false,confidence:'high',ageDays:0,ageLabel:'oggi'};
    });
    const fresh=issues.filter(issue=>issue.isFresh&&Number.isFinite(Number(issue.latestPain)));
    const stale=issues.filter(issue=>issue.requiresUpdate);
    const confidence=stale.length?'low':issues.some(issue=>issue.confidence==='medium')?'medium':issues.length?'high':'none';
    return {issues,fresh,stale,staleCount:stale.length,confidence,max:fresh.reduce((max,issue)=>Math.max(max,Number(issue.latestPain)||0),0),lowerMax:fresh.filter(issue=>lowerPattern.test(issue.zone||'')).reduce((max,issue)=>Math.max(max,Number(issue.latestPain)||0),0),worst:fresh.sort((a,b)=>b.latestPain-a.latestPain)[0]||null,stalest:stale.sort((a,b)=>(b.ageDays??Infinity)-(a.ageDays??Infinity))[0]||null};
  }
  function metric(label,value,tone='neutral'){return {label,value,tone};}
  function analyze(input={}){
    const today=input.today||localDate();const sessions=Array.isArray(input.sessions)?input.sessions:[];
    const recentStart=addDays(today,-6);const recent=periodStats(sessions,recentStart,today,{openDate:input.closedThrough?null:today});const previous=periodStats(sessions,addDays(today,-13),addDays(today,-7));
    const organization=organizationSignals(recent,previous);const body=bodySignals(input.bodyIssues,today);const preSummary=summarizeRecentPreCheckins(input.preCheckins,today);const corroboration=corroboratingOutcomes(sessions,recentStart,today,preSummary);
    const recovery=recoveryModel?recoveryModel.analyzeRecoveryTrend({today,cycles:input.whoopCycles,sleeps:input.whoopSleeps}):{level:'unavailable',label:'Non disponibile',tone:'neutral',usable:false,confidence:'low',reasons:[]};
    if(preSummary.replaceCount>=2||(preSummary.replaceCount>=1&&corroboration.fatigueSkip))preSummary.weeklyLevel='protect';
    else if(preSummary.negativeCount>=2||(preSummary.negativeCount>=1&&(corroboration.hard||corroboration.fatigueSkip)))preSummary.weeklyLevel='reduce';
    preSummary.contextOnly=preSummary.negativeCount>0&&!preSummary.weeklyLevel;
    const baselineValid=recent.recorded>=3&&previous.recorded>=3&&(recent.coverage??0)>=.6&&(previous.coverage??0)>=.6&&previous.load>=150;
    const loadRatio=baselineValid?recent.load/previous.load:null;
    const fatigueSignals=recent.hardSessions+recent.fatigueSkips;
    const combinedPain=Math.max(recent.maxPain,body.max);
    const tolerance=toleranceModel?toleranceModel.assess({today,sessions,recent,previous,loadRatio,body,recovery,preSummary}):{status:'blocked',summary:'Controlli di tolleranza non disponibili.',checks:[],volume:{allowed:false,factor:1},long:{allowed:false,factor:1}};
    let level='steady';
    if(combinedPain>=5||recent.painSkips>0||recent.fatigueSkips>=2||preSummary.weeklyLevel==='protect'||(loadRatio!==null&&loadRatio>1.5))level='protect';
    else if(combinedPain>=3||fatigueSignals>=2||(loadRatio!==null&&loadRatio>1.2)||preSummary.weeklyLevel==='reduce')level='reduce';
    else if(tolerance.volume.allowed||tolerance.long.allowed)level='progress';
    if(recovery.usable&&recovery.level==='protect')level=(fatigueSignals||preSummary.weeklyLevel||combinedPain>=3)?'protect':level==='protect'?'protect':'reduce';
    else if(recovery.usable&&recovery.level==='caution'){
      if(level==='progress')level='steady';
      else if(level==='steady'&&fatigueSignals)level='reduce';
    }

    const reasons=[];
    if(body.worst&&body.worst.latestPain>=3)reasons.push(`${body.worst.zoneLabel||'Fastidio monitorato'} a ${body.worst.latestPain}/10.`);
    if(body.stalest)reasons.push(`${body.stalest.zoneLabel||'Fastidio monitorato'}: ultima valutazione ${body.stalest.ageLabel}. Aggiornala prima di aumentare il carico.`);
    if(recent.maxPain>=3)reasons.push(`Dolore massimo registrato negli ultimi 7 giorni: ${recent.maxPain}/10.`);
    if(recent.painSkips)reasons.push(`${recent.painSkips} sedut${recent.painSkips===1?'a':'e'} non svolt${recent.painSkips===1?'a':'e'} per dolore.`);
    if(recent.fatigueSkips)reasons.push(`${recent.fatigueSkips} sedut${recent.fatigueSkips===1?'a':'e'} non svolt${recent.fatigueSkips===1?'a':'e'} per fatica o recupero insufficiente.`);
    if(recent.hardSessions)reasons.push(`${recent.hardSessions} sedut${recent.hardSessions===1?'a':'e'} con sforzo superiore al previsto.`);
    if(loadRatio!==null&&Math.abs(loadRatio-1)>.15)reasons.push(`Carico degli ultimi 7 giorni ${loadRatio>1?'superiore':'inferiore'} del ${Math.round(Math.abs(loadRatio-1)*100)}% rispetto ai 7 precedenti.`);
    if(preSummary.weeklyLevel==='reduce')reasons.push('Check-in contestuali distinti, o corroborati dagli esiti, suggeriscono una riduzione del carico.');
    if(preSummary.weeklyLevel==='protect')reasons.push('Segnali contestuali ripetuti e corroborati suggeriscono recupero e protezione del carico.');
    if(preSummary.contextOnly)reasons.push('Un segnale contestuale isolato resta limitato alla seduta collegata e non modifica l’intera settimana.');
    if(organization.level==='adapt')reasons.push(`${organization.total14} sedute non svolte per vincoli organizzativi negli ultimi 14 giorni: propongo una seduta in meno, senza ridurre intensità o recupero come se fosse fatica.`);
    else if(organization.level==='monitor')reasons.push('Un vincolo organizzativo recente viene registrato, ma un singolo episodio non modifica ancora il numero di sedute.');
    if(recent.planningSkips)reasons.push('Un cambio di programma o una difficoltà di sostenibilità viene trattato come informazione di pianificazione, non come fatica fisica.');
    if(recent.unrecorded)reasons.push(`${recent.unrecorded} sedut${recent.unrecorded===1?'a passata è ancora da registrare':'e passate sono ancora da registrare'}: nessuna progressione viene dedotta da questi dati mancanti.`);
    if(recovery.usable&&['caution','protect'].includes(recovery.level))reasons.push(...recovery.reasons.map(reason=>`WHOOP: ${reason}`));
    if(level==='progress'){
      const targets=[tolerance.volume.allowed?'volume aerobico facile':null,tolerance.long.allowed?'lungo':null].filter(Boolean);
      reasons.push(`I controlli di tolleranza autorizzano un piccolo aumento del ${targets.join(' e del ')}; intensità e forza non aumentano automaticamente.`);
    }else if(level==='steady'&&recent.recorded){
      tolerance.checks.filter(item=>item.required&&!item.passed).slice(0,2).forEach(item=>reasons.push(`${item.label}: ${item.detail}`));
    }
    if(!reasons.length)reasons.push(recent.recorded?'Nessun segnale recente richiede una modifica del carico.':'Dati recenti ancora limitati: mantengo una proposta prudente e stabile.');

    const settings={
      protect:{volumeFactor:.75,aerobicVolumeFactor:.75,longFactor:.75,qualityMode:'controlled',strengthRir:4,strengthSetReduction:1,sessionDelta:-1},
      reduce:{volumeFactor:.9,aerobicVolumeFactor:.9,longFactor:.85,qualityMode:'controlled',strengthRir:3,strengthSetReduction:1,sessionDelta:0},
      steady:{volumeFactor:1,aerobicVolumeFactor:1,longFactor:1,qualityMode:'normal',strengthRir:2,strengthSetReduction:0,sessionDelta:0},
      progress:{volumeFactor:1,aerobicVolumeFactor:tolerance.volume.factor,longFactor:tolerance.long.factor,qualityMode:'normal',strengthRir:2,strengthSetReduction:0,sessionDelta:0}
    }[level];
    settings.physiologySessionDelta=settings.sessionDelta;settings.organizationSessionDelta=organization.sessionDelta;settings.sessionDelta=Math.min(settings.physiologySessionDelta,settings.organizationSessionDelta);
    const runningRelevantPain=Math.max(body.lowerMax,recent.maxRunningPain);
    settings.lowerBodyCaution=runningRelevantPain>=3;settings.lowerBodyProtection=runningRelevantPain>=5;settings.suspendRunning=runningRelevantPain>=7;
    const meta={...levelMeta[level]};
    if(level==='progress')meta.summary=tolerance.volume.allowed&&tolerance.long.allowed?'La risposta recente consente un piccolo aumento del volume facile e del lungo.':tolerance.volume.allowed?'La risposta recente consente un piccolo aumento del volume facile; il lungo resta stabile.':'La risposta recente consente un piccolo aumento del lungo; il restante volume resta stabile.';
    const metrics=[
      metric('Dati',recent.due?`${recent.recorded}/${recent.due}`:'—',recent.coverage!==null&&recent.coverage<.6?'warn':'neutral'),
      metric('Aderenza',recent.adherence!==null?`${Math.round(recent.adherence*100)}%`:'—',recent.adherence!==null&&recent.adherence<.65?'warn':'neutral'),
      metric('Carico 7 gg',recent.recorded?`${Math.round(recent.load)} AU`:'—'),
      metric('Dolore max',body.staleCount&&combinedPain===0?'Da aggiornare':recent.painKnown||body.fresh.length?`${combinedPain}/10`:'—',combinedPain>=5?'danger':combinedPain>=3||body.staleCount?'warn':'neutral'),
      metric('Vincoli 14 gg',organization.total14?String(organization.total14):'0',organization.level==='adapt'?'warn':'neutral'),
      metric('WHOOP',recovery.label,recovery.tone)
    ];
    const confidence=baselineValid?'high':recent.recorded>=3||recovery.usable?'medium':'low';
    return {level,label:meta.label,summary:meta.summary,reasons,metrics,settings,recent,previous,loadRatio,preSummary,body,organization,recovery,tolerance,confidence};
  }

  root.rcAdaptiveEngine={analyze,periodStats,summarizeRecentPreCheckins,organizationSignals};
})(typeof window!=='undefined'?window:globalThis);
