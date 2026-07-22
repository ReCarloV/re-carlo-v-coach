(function(root,factory){
  const eventDemand=typeof module!=='undefined'&&module.exports?require('./event-demand-model.js'):root?.rcEventDemandModel;
  const api=factory(eventDemand);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcGoalTransitionModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(eventDemand){
  'use strict';

  const VERSION='1.1.0';
  const DAY_MS=86400000;
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const dateAtNoon=value=>new Date(`${value}T12:00:00`);
  const daysBetween=(from,to)=>Math.round((dateAtNoon(to)-dateAtNoon(from))/DAY_MS);
  const profile=goal=>eventDemand?.profileFor?.(goal)||null;
  const isMarathon=goal=>profile(goal)?.key==='road-marathon';
  const familyFor=goal=>profile(goal)?.variant?.family||profile(goal)?.key||goal?.type||'other';
  const sourceRefs=[
    {label:'Settimana post-maratona · attività leggera e recupero neuromuscolare',url:'https://pubmed.ncbi.nlm.nih.gov/33251988/'},
    {label:'Maratona · capacità aerobica e prestazione a sette giorni',url:'https://pubmed.ncbi.nlm.nih.gov/29138757/'},
    {label:'Maratona · variabilità individuale dei marker di danno muscolare',url:'https://pubmed.ncbi.nlm.nih.gov/39730312/'},
    {label:'Concurrent training · forza ed endurance',url:'https://pubmed.ncbi.nlm.nih.gov/34757594/'}
  ];
  const stages=[
    {
      key:'restore',label:'Recupero e osservazione',fromDay:0,toDay:7,maxSessions:3,maxDurationMin:45,specificMode:'off',strengthMode:'upper-only',
      summary:'Nessun nuovo blocco intenso: mobilità, recupero e cardio facile a basso impatto precedono la conversione.',
      exitCriteria:['Esito o risultato della maratona registrato','Fastidio lower ≤2/10 e aggiornato','Nessuno skip per fatica o segnale di protezione corroborato']
    },
    {
      key:'rebuild',label:'Rientro controllato',fromDay:8,toDay:14,maxSessions:4,maxDurationMin:60,specificMode:'technical',strengthMode:'upper-first',
      summary:'Rientrano corsa facile e forza a basso costo; la specificità del nuovo obiettivo resta tecnica e non densa.',
      exitCriteria:['Settimana di rientro registrata','Risposta soggettiva stabile','Nessun peggioramento di dolore o fatica']
    },
    {
      key:'convert',label:'Conversione specifica',fromDay:15,toDay:21,maxSessions:5,maxDurationMin:65,specificMode:'foundation',strengthMode:'controlled',
      summary:'Le qualità condivise vengono mantenute e le richieste divergenti del nuovo obiettivo rientrano una alla volta.',
      exitCriteria:['Tolleranza confermata sugli esiti reali','Forza senza cedimento e running controllato','Nessun recupero del lavoro perso dopo la maratona']
    }
  ];

  function previousPrimary(activeGoal,goals=[],weekStart){
    if(!activeGoal?.date||!weekStart)return null;
    return(Array.isArray(goals)?goals:[]).filter(goal=>goal?.id!==activeGoal.id&&goal?.priority==='A'&&goal?.status!=='cancelled'&&goal?.date<=weekStart&&goal.date<activeGoal.date).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
  }
  function raceOutcome(goal,sessions=[]){
    if(!goal?.id)return null;
    return(Array.isArray(sessions)?sessions:[]).filter(item=>(item.goalId===goal.id||item.id===`goal-session:${goal.id}`)&&item.outcome).sort((a,b)=>String(b.updatedAt||b.date).localeCompare(String(a.updatedAt||a.date)))[0]||null;
  }
  function signalsFor(previous,sessions=[],analysis={}){
    analysis=analysis||{};const race=raceOutcome(previous,sessions),body=analysis.body||{},recent=analysis.recent||{},recovery=analysis.recovery||{};
    const lowerPain=Math.max(Number(body.lowerMax)||0,Number(recent.maxPain)||0,Number(race?.outcome?.pain)||0);
    const resultRecorded=Boolean(race?.outcome)||previous?.status==='completed';
    const symptomsCurrent=!(Number(body.staleCount)||0);
    const fatigueClear=!(Number(recent.fatigueSkips)||0)&&!(Number(recent.hardSessions)||0);
    const recoveryCaution=['caution','protect'].includes(recovery.level);
    const painClear=lowerPain<=2&&!(Number(recent.painSkips)||0);
    const ready=resultRecorded&&symptomsCurrent&&fatigueClear&&painClear;
    const missing=[];
    if(!resultRecorded)missing.push('registra l’esito della maratona');
    if(!symptomsCurrent)missing.push('aggiorna i fastidi attivi');
    if(!painClear)missing.push(`fastidio lower non ancora stabile (${lowerPain}/10)`);
    if(!fatigueClear)missing.push('i segnali recenti richiedono ancora cautela');
    return{raceSessionId:race?.id||null,resultRecorded,symptomsCurrent,fatigueClear,painClear,recoveryCaution,lowerPain,ready,missing};
  }
  function previewFor(primary,secondary){
    if(!primary||!secondary||!isMarathon(primary)||familyFor(secondary)!=='hyrox'||secondary.date<=primary.date)return null;
    const gapDays=daysBetween(primary.date,secondary.date);
    return{
      version:VERSION,primary:clone(primary),secondary:clone(secondary),gapDays,
      feasible:gapDays>=22,
      summary:gapDays>=22?`Dopo la maratona sono previsti 21 giorni di recupero, rientro e conversione prima del normale pack ${profile(secondary)?.label||'del nuovo obiettivo'}.`:'La finestra è più corta del blocco prudente di 21 giorni: il secondo obiettivo non può essere trattato come un nuovo picco automatico.',
      stages:clone(stages),sources:clone(sourceRefs)
    };
  }
  function assess(input={}){
    const activeGoal=input.activeGoal||input.goal||null,weekStart=input.weekStart||input.today||null;
    const previous=previousPrimary(activeGoal,input.goals,weekStart);
    if(!previous||!isMarathon(previous)||familyFor(activeGoal)!=='hyrox')return null;
    const daysAfter=daysBetween(previous.date,weekStart),gapDays=daysBetween(previous.date,activeGoal.date);
    if(daysAfter<0||gapDays<=0)return null;
    const signals=signalsFor(previous,input.sessions,input.analysis);
    if(daysAfter>21&&signals.ready)return null;
    const prolonged=daysAfter>21;
    const planned=prolonged?stages[2]:stages.find(item=>daysAfter>=item.fromDay&&daysAfter<=item.toDay)||null;
    if(!planned)return null;
    const hold=prolonged||planned.key!=='restore'&&!signals.ready;
    const effective=hold?stages[0]:planned;
    const relation=eventDemand?.relationFor?.(previous,activeGoal,weekStart)||null;
    const status=hold?'hold':planned.key;
    return{
      version:VERSION,status,plannedStage:prolonged?'ordinary':planned.key,stage:effective.key,label:hold?'Transizione in attesa':effective.label,
      summary:hold?(prolonged?`I 21 giorni operativi sono conclusi, ma il normale pack resta in attesa: ${signals.missing.join('; ')}.`:`Il calendario sarebbe nella fase “${planned.label}”, ma il Coach mantiene il recupero: ${signals.missing.join('; ')}.`):effective.summary,
      previousGoal:clone(previous),activeGoal:clone(activeGoal),daysAfter,gapDays,relation:clone(relation),signals,
      maxSessions:effective.maxSessions,maxDurationMin:effective.maxDurationMin,specificMode:effective.specificMode,strengthMode:effective.strengthMode,
      exitCriteria:clone(effective.exitCriteria),sources:clone(sourceRefs),
      guardrail:'La fase è una protezione operativa, non una diagnosi né una data universale di recupero. Gli esiti reali possono mantenerla più a lungo; non la anticipano automaticamente.'
    };
  }

  return{VERSION,stages:clone(stages),sources:clone(sourceRefs),previousPrimary,raceOutcome,signalsFor,previewFor,assess,daysBetween,familyFor};
});
