(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcProgressionToleranceModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='1.0.0';
  const MAX_PROGRESS_FACTOR=1.05;
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  function dateAtNoon(value){return new Date(`${value}T12:00:00`);}
  function iso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function addDays(value,days){const date=dateAtNoon(value);date.setDate(date.getDate()+days);return iso(date);}
  function number(value){const parsed=Number(value);return Number.isFinite(parsed)?parsed:null;}
  function performed(session){return ['completed','partial'].includes(session?.outcome?.status);}
  function relevant(session){return session?.adaptiveAdjustment?.status!=='paused'&&session?.category!=='recovery'&&session?.priority!=='optional'&&!(session?.outcome?.status==='skipped'&&session?.outcome?.skipReason==='program-change');}
  function isLong(session){return session?.category==='running'&&(session?.details?.runType==='Long run'||/\b(long|lungo)\b/i.test(session?.title||''));}
  function duration(session){return number(session?.outcome?.actualDurationMin);}
  function completionRatio(session){const actual=duration(session),planned=number(session?.durationMin);if(actual===null||planned===null||planned<=0)return null;return actual/planned;}
  function check(key,label,passed,detail,tone=passed?'good':'warn',required=true){return{key,label,passed:Boolean(passed),state:passed?'Adeguato':'Da consolidare',detail,tone,required};}
  function periodRuns(sessions,start,end){
    const runs=(Array.isArray(sessions)?sessions:[]).filter(session=>session.date>=start&&session.date<=end&&session.category==='running'&&relevant(session)&&performed(session));
    const known=runs.filter(session=>duration(session)!==null);
    return{runs,known,count:runs.length,knownCount:known.length,minutes:known.reduce((sum,session)=>sum+duration(session),0),longs:runs.filter(isLong)};
  }
  function firstFailure(checks){return checks.find(item=>item.required&&!item.passed)||null;}
  function target(label,eligible,reason){return{label,eligible:Boolean(eligible),allowed:Boolean(eligible),factor:eligible?MAX_PROGRESS_FACTOR:1,reason};}

  function assess(input={}){
    const today=input.today||iso(new Date()),sessions=Array.isArray(input.sessions)?input.sessions:[];
    const recent=input.recent||{},previous=input.previous||{},body=input.body||{},recovery=input.recovery||{},preSummary=input.preSummary||{};
    const recentRuns=periodRuns(sessions,addDays(today,-6),today),previousRuns=periodRuns(sessions,addDays(today,-13),addDays(today,-7));
    const runningRatio=previousRuns.minutes>0?recentRuns.minutes/previousRuns.minutes:null;
    const combinedPain=Math.max(Number(recent.maxPain)||0,Number(body.max)||0);
    const dataPassed=(Number(recent.recorded)||0)>=3&&(Number(previous.recorded)||0)>=3&&(Number(recent.coverage)||0)>=.8&&(Number(previous.coverage)||0)>=.8&&!(Number(recent.unrecorded)||0)&&!(Number(previous.unrecorded)||0);
    const adherencePassed=(Number(recent.adherence)||0)>=.8&&(Number(previous.adherence)||0)>=.8;
    const symptomsPassed=combinedPain<=2&&!(Number(recent.painSkips)||0)&&!(Number(body.staleCount)||0);
    const responsePassed=!(Number(recent.hardSessions)||0)&&!(Number(recent.fatigueSkips)||0)&&!preSummary.weeklyLevel;
    const loadRatio=number(input.loadRatio),loadPassed=loadRatio!==null&&loadRatio>=.8&&loadRatio<=1.15;
    const runDosePassed=recentRuns.count>=2&&previousRuns.count>=2&&recentRuns.knownCount===recentRuns.count&&previousRuns.knownCount===previousRuns.count&&runningRatio!==null&&runningRatio>=.8&&runningRatio<=1.15;
    const whoopRequired=Boolean(recovery.usable),whoopPassed=!whoopRequired||!['caution','protect'].includes(recovery.level);
    const checks=[
      check('data','Completezza dati',dataPassed,dataPassed?'Almeno 3 esiti e copertura ≥80% in entrambe le settimane.':'Servono almeno 3 esiti, copertura ≥80% e nessuna seduta dovuta senza registrazione in entrambe le settimane.'),
      check('adherence','Continuità',adherencePassed,adherencePassed?'Aderenza ≥80% in entrambe le settimane.':'L’aderenza deve essere almeno dell’80% in entrambe le settimane.'),
      check('symptoms','Sintomi',symptomsPassed,symptomsPassed?'Dolore ≤2/10, nessuno skip per dolore e fastidi aggiornati.':'Dolore, skip per dolore o una valutazione non aggiornata richiedono mantenimento.'),
      check('response','Risposta al carico',responsePassed,responsePassed?'Nessuna seduta recente nettamente più dura del previsto o skip per fatica.':'RPE elevato, seduta più dura del previsto, skip per fatica o segnali soggettivi ripetuti bloccano l’aumento.'),
      check('load','Coerenza del carico',loadPassed,loadPassed?`Carico recente entro la fascia operativa di stabilità (×${loadRatio.toFixed(2)}).`:'Il rapporto di carico tra le due settimane non è disponibile o è fuori dalla fascia operativa 0,80–1,15.'),
      check('running-dose','Dose di corsa',runDosePassed,runDosePassed?`${recentRuns.count} corse e ${Math.round(recentRuns.minutes)} min recenti; andamento coerente (×${runningRatio.toFixed(2)}).`:'Servono almeno 2 corse con durata reale per settimana e un volume recente coerente con la precedente.'),
      check('whoop','Recupero WHOOP',whoopPassed,whoopRequired?(whoopPassed?'Il trend disponibile non segnala cautela o protezione.':'Il trend disponibile segnala cautela o protezione.'):'Dato non disponibile: non viene sostituito con un valore fittizio e non blocca da solo.',whoopPassed?'good':'warn',whoopRequired)
    ];
    const commonChecks=checks.filter(item=>item.key!=='running-dose'&&item.required),commonPassed=commonChecks.every(item=>item.passed);
    const volumeEligible=commonPassed&&runDosePassed;
    const recentLongs=[...recentRuns.longs].sort((a,b)=>String(b.date).localeCompare(String(a.date)));const recentLong=recentLongs[0]||null;
    const longRatio=recentLong?completionRatio(recentLong):null,longRpe=recentLong?number(recentLong.outcome?.rpe):null,longPain=recentLong?number(recentLong.outcome?.pain):null;
    const longExecutionPassed=Boolean(recentLong)&&longRatio!==null&&longRatio>=.9&&longRpe!==null&&longRpe<=7&&longPain!==null&&longPain<=2&&recentLong.outcome?.execution!=='harder';
    const longCheck=check('long-response','Lungo tollerato',longExecutionPassed,longExecutionPassed?`${Math.round((longRatio||0)*100)}% della durata, RPE ${longRpe} e dolore ${longPain}/10.`:recentLong?'Il lungo recente richiede almeno il 90% della durata, RPE registrato ≤7, dolore registrato ≤2/10 e nessun esito “più duro”.':'Nessun lungo svolto negli ultimi 7 giorni: il lungo resta stabile.');
    const longEligible=commonPassed&&longExecutionPassed;
    const failed=firstFailure([...commonChecks,checks.find(item=>item.key==='running-dose'),longCheck]);
    const volume=target('Volume aerobico facile',volumeEligible,volumeEligible?'Le ultime due settimane mostrano continuità, dati completi e una dose di corsa assorbita.':(firstFailure([...commonChecks,checks.find(item=>item.key==='running-dose')])||{}).detail||'Tolleranza non ancora sufficiente.');
    const long=target('Lungo',longEligible,longEligible?'Il lungo recente è stato completato con risposta compatibile con una piccola progressione.':(firstFailure(commonChecks)||longCheck).detail);
    const status=volumeEligible&&longEligible?'allowed':volumeEligible||longEligible?'partial':'blocked';
    const summary=status==='allowed'?'Volume facile e lungo superano i controlli di tolleranza.':status==='partial'?'Solo uno dei due obiettivi supera tutti i controlli: l’altro resta stabile.':`Nessuna progressione automatica: ${failed?.detail||'servono più dati reali e una risposta stabile.'}`;
    return{version:VERSION,status,summary,checks:[...checks,longCheck],volume,long,longSession:recentLong?{id:recentLong.id||null,date:recentLong.date,title:recentLong.title||'Lungo',completionRatio:longRatio,rpe:longRpe,pain:longPain}:null,running:{recentRuns:recentRuns.count,previousRuns:previousRuns.count,recentMinutes:recentRuns.minutes,previousMinutes:previousRuns.minutes,ratio:runningRatio},operationalCap:MAX_PROGRESS_FACTOR};
  }

  return{VERSION,MAX_PROGRESS_FACTOR,assess,isLong,completionRatio,periodRuns,clone};
});
