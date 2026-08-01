(function(root,factory){
  const methodology=typeof module!=='undefined'&&module.exports?require('./coach-methodology-model.js'):root?.rcCoachMethodologyModel;
  const programming=typeof module!=='undefined'&&module.exports?require('./event-programming-model.js'):root?.rcEventProgrammingModel;
  const api=factory(methodology,programming);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcRaceCoachModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(methodology,programming){
  'use strict';

  const DAY_MS=86400000;
  const phaseProfiles={
    marathon:[
      {min:99,key:'base',label:'Base generale',focus:'Consolidare continuità, frequenza sostenibile e tolleranza al volume prima del lavoro più specifico.'},
      {min:70,key:'build',label:'Costruzione',focus:'Aumentare gradualmente la capacità di assorbire lungo e qualità mantenendo la forza con costo controllato.'},
      {min:42,key:'specific-build',label:'Sviluppo specifico',focus:'Avvicinare lunghi e qualità alle richieste della maratona senza concentrare troppo carico nella stessa settimana.'},
      {min:22,key:'specific',label:'Specifico maratona',focus:'Rendere stabili ritmo gara, lunghi specifici e strategia di alimentazione, proteggendo il recupero.'},
      {min:15,key:'peak',label:'Picco specifico',focus:'Completare gli ultimi stimoli chiave senza cercare adattamenti tardivi o carico aggiuntivo non necessario.'},
      {min:8,key:'taper',label:'Taper',focus:'Ridurre la fatica mantenendo richiami di intensità, routine e fiducia nel lavoro svolto.'},
      {min:0,key:'race-week',label:'Race week',focus:'Arrivare fresco alla gara: nessun recupero perso può essere compensato con lavoro dell’ultimo momento.'}
    ],
    hyrox:[
      {min:70,key:'base',label:'Base ibrida',focus:'Consolidare forza, corsa e tolleranza alle transizioni senza accumulare fatica specifica prematura.'},
      {min:35,key:'build',label:'Costruzione HYROX',focus:'Sviluppare forza resistente e qualità di corsa mantenendo separati gli stimoli più costosi.'},
      {min:15,key:'specific',label:'Specifico HYROX',focus:'Integrare stazioni, corsa compromessa e ritmo gara con recuperi e volumi controllati.'},
      {min:8,key:'taper',label:'Taper',focus:'Ridurre il volume conservando ritmo, tecnica di stazione e confidenza nelle transizioni.'},
      {min:0,key:'race-week',label:'Race week',focus:'Proteggere freschezza e qualità neuromuscolare senza aggiungere fatica residua.'}
    ],
    generic:[
      {min:70,key:'base',label:'Base generale',focus:'Costruire continuità e capacità di assorbire il lavoro previsto.'},
      {min:35,key:'build',label:'Costruzione',focus:'Sviluppare progressivamente le qualità richieste dall’obiettivo.'},
      {min:15,key:'specific',label:'Fase specifica',focus:'Avvicinare la preparazione alle richieste reali dell’evento.'},
      {min:8,key:'taper',label:'Taper',focus:'Ridurre la fatica mantenendo gli stimoli essenziali.'},
      {min:0,key:'race-week',label:'Settimana obiettivo',focus:'Proteggere freschezza, routine e qualità dell’esecuzione.'}
    ]
  };

  function iso(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function dateAtNoon(value){return new Date(`${value}T12:00:00`);}
  function addDays(value,days){const date=dateAtNoon(value);date.setDate(date.getDate()+days);return iso(date);}
  function mondayFor(value){const date=dateAtNoon(value),day=date.getDay()||7;date.setDate(date.getDate()-day+1);return iso(date);}
  function daysBetween(from,to){return Math.round((dateAtNoon(to)-dateAtNoon(from))/DAY_MS);}
  function round(value,digits=1){const factor=10**digits;return Math.round((Number(value)||0)*factor)/factor;}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function active(session){return session&&!session.demoDataset&&session.adaptiveAdjustment?.status!=='paused';}
  function performed(session){return['completed','partial'].includes(session?.outcome?.status);}
  function isRun(session){return session?.category==='running';}
  function isLong(session){return isRun(session)&&(session.details?.runType==='Long run'||/\b(long|lungo)\b/i.test(session.title||''));}
  function isQuality(session){if(!isRun(session)||isLong(session)||session.details?.runType==='Race')return false;const text=`${session.details?.runType||''} ${session.title||''}`;return /interval|tempo|threshold|progress|quality|marathon pace|ripetut|soglia/i.test(text)||session.priority==='essential';}
  function targetMinutes(goal,distance=null){const text=String(goal?.target||'');const clock=text.match(/(?:^|\D)(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?(?:\D|$)/);if(clock){const major=Number(clock[1]),minor=Number(clock[2]),seconds=Number(clock[3]||0);return distance&&distance<=10&&major>12?major+(minor/60):(major*60)+minor+(seconds/60);}const short=text.match(/(\d{1,2})\s*['′]\s*(\d{1,2})/);if(short)return Number(short[1])+Number(short[2])/60;const hours=text.match(/(\d+(?:[.,]\d+)?)\s*h/i);return hours?Number(hours[1].replace(',','.'))*60:null;}
  function targetPace(goal){const distance=programming?.distanceFor?.(goal)||{marathon:42.195,'half-marathon':21.0975}[goal?.type],minutes=targetMinutes(goal,distance);if(!distance||!minutes)return null;const seconds=Math.round(minutes*60/distance);return{secondsPerKm:seconds,label:`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}/km`,distanceKm:distance};}
  function phaseFor(goal,today){if(!goal?.date)return null;const reviewed=programming?.phaseFor?.(goal,today);if(reviewed)return reviewed;const days=Math.max(0,daysBetween(today,goal.date)),profile=phaseProfiles[goal.type]||phaseProfiles.generic;const phase=profile.find(item=>days>=item.min)||profile.at(-1);return{...phase,days,pack:{key:'generic',version:null,status:'pending',confidence:'low'}};}
  function range(value,start,end){return value>=start&&value<=end;}
  function dailyTotals(){return new Map();}
  function addDaily(map,date,value){map.set(date,(map.get(date)||0)+value);}
  function observedRunningWindow(input={},days=28){
    const today=input.today,windowDays=Math.max(1,Math.round(Number(days)||28)),start=addDays(today,-windowDays+1),activities=(Array.isArray(input.activities)?input.activities:[]).filter(item=>!item.demoDataset&&item.category==='running'&&range(item.date,start,today)),sessions=(Array.isArray(input.sessions)?input.sessions:[]).filter(item=>active(item)&&isRun(item)&&performed(item)&&range(item.date,start,today));
    const activityKm=dailyTotals(),sessionKm=dailyTotals(),activityCounts=dailyTotals(),sessionCounts=dailyTotals(),longCandidates=[];
    activities.forEach(item=>{const km=Math.max(0,(Number(item.distanceM)||0)/1000);addDaily(activityCounts,item.date,1);if(km){addDaily(activityKm,item.date,km);longCandidates.push(km);}});
    sessions.forEach(item=>{const km=Math.max(0,Number(item.outcome?.actualDistanceKm)||0);addDaily(sessionCounts,item.date,1);if(km){addDaily(sessionKm,item.date,km);longCandidates.push(km);}});
    const dates=[...new Set([...activityCounts.keys(),...sessionCounts.keys()])].sort(),distanceDates=[...new Set([...activityKm.keys(),...sessionKm.keys()])];
    const totalKm=distanceDates.reduce((sum,date)=>sum+Math.max(activityKm.get(date)||0,sessionKm.get(date)||0),0),runs=dates.reduce((sum,date)=>sum+Math.max(activityCounts.get(date)||0,sessionCounts.get(date)||0),0),latestDate=dates.at(-1)||null;
    const weeks=windowDays/7;return{start,end:today,days:windowDays,weeks,runs,runFrequency:round(runs/weeks,1),totalKm:round(totalKm,1),kmPerWeek:totalKm?round(totalKm/weeks,1):null,longestKm:longCandidates.length?round(Math.max(...longCandidates),1):null,latestDate,latestAgeDays:latestDate===null?null:daysBetween(latestDate,today),distanceKnown:distanceDates.length>0,source:{strava:activities.length>0,outcomes:sessions.length>0}};
  }
  function observedRunning(input={}){return observedRunningWindow(input,28);}
  function executionCredit(session){const outcome=session?.outcome;if(!outcome||outcome.status==='skipped')return 0;if(outcome.status==='completed')return 1;const ratio=Number(outcome.actualDurationMin)/(Number(session.durationMin)||1);return clamp(ratio||.5,.25,.9);}
  function historyQuality(input={}){
    const today=input.today,start=addDays(today,-27),sessions=(Array.isArray(input.sessions)?input.sessions:[]).filter(item=>active(item)&&item.category!=='recovery'&&range(item.date,start,today)&&(item.date<today||item.outcome));const recorded=sessions.filter(item=>item.outcome),key=sessions.filter(item=>item.priority==='essential'),keyRecorded=key.filter(item=>item.outcome);
    const adherence=recorded.length?recorded.reduce((sum,item)=>sum+executionCredit(item),0)/recorded.length:null,keyAdherence=keyRecorded.length?keyRecorded.reduce((sum,item)=>sum+executionCredit(item),0)/keyRecorded.length:null;
    return{start,end:today,due:sessions.length,recorded:recorded.length,missing:sessions.length-recorded.length,coverage:sessions.length?recorded.length/sessions.length:null,adherence,keyDue:key.length,keyRecorded:keyRecorded.length,keyAdherence};
  }
  function mean(values){const valid=values.map(Number).filter(Number.isFinite);return valid.length?valid.reduce((sum,value)=>sum+value,0)/valid.length:null;}
  function trendDirection(recent,previous,threshold){
    if(recent===null||previous===null)return{key:'unknown',label:'Non confrontabile',delta:null};
    const delta=recent-previous;if(Math.abs(delta)<threshold)return{key:'stable',label:'Stabile',delta};
    return delta>0?{key:'up',label:'In aumento',delta}:{key:'down',label:'In calo',delta};
  }
  function readinessWeek(start,sessions=[]){
    const end=addDays(start,6),due=sessions.filter(item=>active(item)&&item.category!=='recovery'&&item.priority!=='optional'&&range(item.date,start,end)&&!(item.outcome?.status==='skipped'&&item.outcome?.skipReason==='program-change'));
    const recorded=due.filter(item=>item.outcome),performedSessions=recorded.filter(performed),loads=performedSessions.map(item=>Number(item.outcome?.sessionLoad)).filter(value=>Number.isFinite(value)&&value>0),minutes=performedSessions.map(item=>Number(item.outcome?.actualDurationMin)).filter(value=>Number.isFinite(value)&&value>0),runs=performedSessions.filter(isRun),runKm=runs.map(item=>Number(item.outcome?.actualDistanceKm)).filter(value=>Number.isFinite(value)&&value>0),plannedLongs=due.filter(isLong),completedLongs=performedSessions.filter(isLong),longKm=completedLongs.map(item=>Number(item.outcome?.actualDistanceKm)).filter(value=>Number.isFinite(value)&&value>0);
    return{start,end,due:due.length,recorded:recorded.length,coverage:due.length?recorded.length/due.length:null,adherence:due.length?due.reduce((sum,item)=>sum+executionCredit(item),0)/due.length:null,performed:performedSessions.length,load:loads.length?round(loads.reduce((sum,value)=>sum+value,0),0):null,loadCoverage:performedSessions.length?loads.length/performedSessions.length:0,minutes:minutes.length?round(minutes.reduce((sum,value)=>sum+value,0),0):null,runs:runs.length,runKm:round(runKm.reduce((sum,value)=>sum+value,0),1),plannedLongs:plannedLongs.length,completedLongs:completedLongs.length,longestKm:longKm.length?round(Math.max(...longKm),1):null,hybrid:performedSessions.filter(item=>['hyrox','metcon'].includes(item.category)).length,strength:performedSessions.filter(item=>item.category==='strength').length,swims:performedSessions.filter(item=>item.category==='swimming').length,rides:performedSessions.filter(item=>item.category==='cycling').length,qualifies:due.length>=2&&recorded.length/due.length>=.75};
  }
  function specificReadiness(goal,weeks){
    const total=field=>weeks.reduce((sum,item)=>sum+(Number(item[field])||0),0),longest=weeks.map(item=>item.longestKm).filter(Number.isFinite).sort((a,b)=>b-a)[0]||null;
    if(['marathon','half-marathon','running'].includes(goal?.type)){
      const planned=total('plannedLongs'),done=total('completedLongs'),km=round(total('runKm'),1),runs=total('runs');
      return{label:'SPECIFICITÀ CORSA',value:planned?`${done}/${planned} lunghi`:`${runs} corse`,note:`${km} km registrati${longest?` · lungo max ${longest} km`:''}`};
    }
    if(goal?.type==='triathlon')return{label:'COPERTURA MULTISPORT',value:`${total('swims')} · ${total('rides')} · ${total('runs')}`,note:'nuoto · bici · corsa realmente svolti'};
    if(['hyrox','obstacle','athx'].includes(goal?.type))return{label:'SPECIFICITÀ IBRIDA',value:`${total('hybrid')} hybrid · ${total('runs')} run`,note:`${total('strength')} sedute di forza registrate`};
    if(goal?.type==='cycling')return{label:'SPECIFICITÀ BICI',value:`${total('rides')} sedute`,note:`${total('minutes')} minuti complessivi registrati`};
    if(goal?.type==='strength-test')return{label:'SPECIFICITÀ FORZA',value:`${total('strength')} sedute`,note:`${total('minutes')} minuti complessivi registrati`};
    return{label:'LAVORO SPECIFICO',value:`${total('performed')} sedute`,note:'esecuzioni registrate nelle quattro settimane'};
  }
  function raceReadinessTrend(input={}){
    const today=input.today||iso(new Date()),goal=input.goal||null,currentWeek=mondayFor(today),allSessions=Array.isArray(input.sessions)?input.sessions:[],observed=[];
    for(let offset=8;offset>=1;offset-=1){const week=readinessWeek(addDays(currentWeek,-offset*7),allSessions);if(week.due)observed.push(week);}
    const qualifying=observed.filter(item=>item.qualifies),selected=qualifying.slice(-4),latest=selected.at(-1)||null,recentEnough=Boolean(latest&&latest.end>=addDays(currentWeek,-14)),available=selected.length===4&&recentEnough;
    const calibration={requiredWeeks:4,observedWeeks:observed.length,qualifyingWeeks:qualifying.length,recentEnough,progress:Math.min(4,qualifying.length),requirements:[]};
    if(qualifying.length<4)calibration.requirements.push(`Servono ancora ${4-qualifying.length} settiman${4-qualifying.length===1?'a':'e'} chius${4-qualifying.length===1?'a':'e'} con almeno 2 sedute dovute e il 75% degli esiti registrati.`);
    if(qualifying.length>=4&&!recentEnough)calibration.requirements.push('Le settimane complete disponibili sono troppo lontane: registra una settimana recente per riattivare il confronto.');
    const incomplete=observed.filter(item=>!item.qualifies);if(incomplete.length)calibration.requirements.push(`${incomplete.length} settiman${incomplete.length===1?'a recente non raggiunge':'e recenti non raggiungono'} la copertura minima.`);
    if(!available)return{available:false,label:'Calibrazione in corso',calibration,weeks:observed.slice(-4),guardrail:'Nessun punteggio di readiness viene stimato finché la base reale non è sufficiente.'};
    const previous=selected.slice(0,2),recent=selected.slice(2),previousAdherence=mean(previous.map(item=>item.adherence)),recentAdherence=mean(recent.map(item=>item.adherence)),loadCoverage=mean(selected.map(item=>item.loadCoverage)),previousLoad=loadCoverage!==null&&loadCoverage>=.75?mean(previous.map(item=>item.load)):null,recentLoad=loadCoverage!==null&&loadCoverage>=.75?mean(recent.map(item=>item.load)):null;
    const adherenceTrend=trendDirection(recentAdherence,previousAdherence,.05),loadTrend=trendDirection(recentLoad,previousLoad,Math.max(20,(previousLoad||0)*.1));
    return{available:true,label:'Trend disponibili',calibration,weeks:selected,adherence:{recent:recentAdherence,previous:previousAdherence,...adherenceTrend},load:{recent:recentLoad,previous:previousLoad,coverage:loadCoverage,...loadTrend},specific:specificReadiness(goal,selected),guardrail:'Sono trend descrittivi delle registrazioni, non un voto di forma né un’autorizzazione automatica a progredire.'};
  }
  function futurePlan(input={}){
    const today=input.today,goalDate=input.goal?.date||addDays(today,27),days=Math.max(1,Math.min(28,daysBetween(today,goalDate)+1)),end=addDays(today,days-1),sessions=(Array.isArray(input.sessions)?input.sessions:[]).filter(item=>active(item)&&!item.outcome&&range(item.date,today,end)&&item.date<=goalDate),raceRuns=sessions.filter(item=>isRun(item)&&item.details?.runType==='Race'),runs=sessions.filter(item=>isRun(item)&&item.details?.runType!=='Race'),knownRuns=runs.filter(item=>Number(item.details?.distanceKm)>0),longs=runs.filter(isLong),quality=runs.filter(isQuality),strength=sessions.filter(item=>item.category==='strength'),hyrox=sessions.filter(item=>['hyrox','metcon'].includes(item.category)),weeks=days/7;
    const totalKm=knownRuns.reduce((sum,item)=>sum+Number(item.details.distanceKm),0),futureToGoal=(Array.isArray(input.sessions)?input.sessions:[]).filter(item=>active(item)&&!item.outcome&&item.date>=today&&item.date<=goalDate),weekKeys=new Set(futureToGoal.map(item=>{const date=dateAtNoon(item.date),day=date.getDay()||7;date.setDate(date.getDate()-day+1);return iso(date);})),remainingWeeks=Math.max(1,Math.ceil((daysBetween(today,goalDate)+1)/7));
    return{start:today,end,days,total:sessions.length,runs:runs.length,raceRuns:raceRuns.length,runFrequency:round(runs.length/weeks,1),knownRunDistances:knownRuns.length,totalKm:round(totalKm,1),kmPerWeek:knownRuns.length?round(totalKm/weeks,1):null,distancePartial:knownRuns.length<runs.length,longRuns:longs.length,longestKm:longs.map(item=>Number(item.details?.distanceKm)||0).filter(Boolean).sort((a,b)=>b-a)[0]||null,quality:quality.length,strength:strength.length,hyrox:hyrox.length,coveredWeeks:weekKeys.size,remainingWeeks,continuity:clamp(weekKeys.size/remainingWeeks,0,1)};
  }
  function confidenceFor({observed,history,plan,readiness}){
    let score=0;if(observed.runs>=6)score+=2;else if(observed.runs>=3)score+=1;if(history.due>=4&&(history.coverage??0)>=.75)score+=1;if(observed.latestAgeDays!==null&&observed.latestAgeDays<=7)score+=1;if(plan.total>=6&&plan.continuity>=.6)score+=1;if(readiness&&['medium','high'].includes(readiness.confidence))score+=1;
    const level=score>=5?'high':score>=3?'medium':'low';return{level,score,label:{low:'Bassa',medium:'Media',high:'Alta'}[level]};
  }
  function assessmentFor(context){
    const{observed,history,plan,readiness}=context,loadRatio=observed.kmPerWeek&&plan.kmPerWeek?plan.kmPerWeek/observed.kmPerWeek:null,longRatio=observed.longestKm&&plan.longestKm?plan.longestKm/observed.longestKm:null;let key='coherent';
    if(readiness?.level==='protect')key='protect';else if(readiness?.level==='reduce')key='caution';else if(!observed.runs||!observed.distanceKnown)key='baseline';else if(history.due>=3&&(history.coverage??0)<.6)key='incomplete';else if(plan.continuity<.5)key='plan-gap';else if(loadRatio!==null&&loadRatio>1.3)key='progression';else if(history.keyDue>=2&&(history.keyAdherence??1)<.7)key='continuity';
    const meta={
      protect:{tone:'danger',title:'Carico da proteggere',summary:'I segnali recenti non autorizzano una progressione verso la gara. Il piano resta visibile, ma ogni riduzione richiede una proposta separata e confermata.',decision:'Proteggi recupero e sedute chiave; non recuperare il lavoro perso aggiungendo volume.'},
      caution:{tone:'warn',title:'Preparazione da assorbire',summary:'La struttura può restare invariata, ma i segnali recenti richiedono di consolidare il carico prima di progredire.',decision:'Mantieni gli stimoli essenziali e rivaluta il carico dopo i prossimi esiti.'},
      baseline:{tone:'neutral',title:'Baseline da consolidare',summary:'Il piano gara è presente, ma non ci sono ancora abbastanza distanze osservate per giudicare la progressione con affidabilità.',decision:'Usa il piano come base e registra gli esiti; nessun aumento viene dedotto dai dati mancanti.'},
      incomplete:{tone:'warn',title:'Storico da completare',summary:'Troppe sedute dovute sono ancora senza esito: il coach non può distinguere lavoro non svolto da dati non registrati.',decision:'Completa le registrazioni arretrate prima di autorizzare modifiche al volume.'},
      'plan-gap':{tone:'warn',title:'Copertura del piano incompleta',summary:'La gara è definita, ma il calendario non copre ancora abbastanza settimane per valutarne la progressione complessiva.',decision:'Mantieni le sedute presenti e completa la programmazione prima di applicare adattamenti longitudinali.'},
      progression:{tone:'warn',title:'Progressione da controllare',summary:'Il volume programmato nelle prossime quattro settimane è sensibilmente superiore alla base osservata recente.',decision:'Conserva la struttura, ma autorizza l’aumento solo se lunghi, aderenza e recupero confermano la tolleranza.'},
      continuity:{tone:'warn',title:'Continuità prioritaria',summary:'La priorità attuale non è aggiungere carico, ma rendere regolare l’esecuzione delle sedute essenziali.',decision:'Proteggi lungo e qualità; gli stimoli opzionali non devono compensare sedute chiave mancate.'},
      coherent:{tone:'good',title:'Preparazione coerente',summary:'Piano, lavoro osservato e aderenza non mostrano al momento uno scarto che richieda una correzione longitudinale.',decision:'Prosegui con il piano e rivaluta dopo ogni lungo, qualità o nuovo segnale rilevante.'}
    }[key];
    return{key,...meta,loadRatio,longRatio};
  }
  function audit(input={}){
    const today=input.today||iso(new Date()),goal=input.goal||null;if(!goal)return null;const sessions=Array.isArray(input.sessions)?input.sessions:[],windowInput={today,sessions,activities:input.activities},observed=observedRunning(windowInput),windows={acute:observedRunningWindow(windowInput,7),mesocycle:observed,chronic:observedRunningWindow(windowInput,84)},history=historyQuality({today,sessions}),plan=futurePlan({today,goal,sessions}),phase=phaseFor(goal,today),readiness=input.readiness||null,confidence=confidenceFor({observed,history,plan,readiness}),assessment=assessmentFor({observed,history,plan,readiness}),pace=targetPace(goal),programmingPack=programming?.packFor?.(goal)||null,focus=[phase.focus];
    if(assessment.loadRatio!==null&&assessment.loadRatio>1.15)focus.push(`Progressione prevista: ${Math.round((assessment.loadRatio-1)*100)}% sopra la media osservata; confermarla con tolleranza reale, non con una percentuale automatica.`);
    if(assessment.longRatio!==null&&assessment.longRatio>1.25)focus.push(`Il lungo massimo programmato supera del ${Math.round((assessment.longRatio-1)*100)}% quello osservato negli ultimi 28 giorni.`);
    if(goal.type==='marathon'&&observed.runs>=3&&observed.runFrequency<2.5)focus.push('Prima del volume specifico va consolidata una frequenza di corsa sostenibile.');
    if(!plan.strength&&!plan.hyrox)focus.push('Nelle prossime quattro settimane non risultano sedute di forza o HYROX attive nel piano.');
    const reasons=[];
    reasons.push(observed.distanceKnown?`Base osservata 28 giorni: ${observed.kmPerWeek} km/settimana, ${observed.runFrequency} corse/settimana${observed.longestKm?` e lungo massimo ${observed.longestKm} km`:''}.`:`Base osservata 28 giorni: ${observed.runs?`${observed.runs} ${observed.runs===1?'corsa':'corse'}, ma distanza incompleta`:'nessuna corsa con distanza disponibile'}.`);
    reasons.push(plan.kmPerWeek!==null?`Prossimi ${plan.days} giorni: ${plan.kmPerWeek} km/settimana${plan.distancePartial?' sui soli lavori con distanza esplicita':''}, ${plan.runFrequency} corse/settimana e ${plan.longRuns} lungh${plan.longRuns===1?'o':'i'}.`:`Prossimi ${plan.days} giorni: ${plan.runs} ${plan.runs===1?'corsa programmata':'corse programmate'}, ma nessuna stima chilometrica completa.`);
    reasons.push(history.due?`Registrazioni recenti: ${history.recorded}/${history.due}; aderenza osservabile ${history.adherence===null?'non disponibile':`${Math.round(history.adherence*100)}%`}.`:'Nessuna seduta recente dovuta da valutare.');
    if(readiness?.recovery?.usable)reasons.push(`WHOOP: ${readiness.recovery.label}; viene usato come segnale di recupero e non decide da solo la periodizzazione.`);
    if(plan.continuity<.75)reasons.push(`Il calendario copre ${plan.coveredWeeks}/${plan.remainingWeeks} settimane rimanenti verso la gara.`);
    if(programmingPack?.status==='pending')focus.push('Il formato è registrato, ma il pack prescrittivo non è ancora revisionato: il Coach non applica regole specialistiche non verificate.');
    const result={today,goal,phase,pace,programming:programmingPack,observed,windows,history,plan,readiness,readinessTrend:raceReadinessTrend({today,goal,sessions}),confidence,assessment,focus:[...new Set(focus)].slice(0,3),reasons};
    result.methodology=methodology?.contextForAudit({...result,sessions})||null;return result;
  }

  return{audit,phaseFor,observedRunning,observedRunningWindow,historyQuality,raceReadinessTrend,futurePlan,targetPace,isLong,isQuality,addDays,daysBetween,mondayFor};
});
