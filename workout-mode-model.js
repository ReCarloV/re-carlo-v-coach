(function(root,factory){
  const todayModel=typeof module!=='undefined'&&module.exports?require('./today-model.js'):root.rcTodayModel;
  const exerciseCatalog=typeof module!=='undefined'&&module.exports?require('./exercise-catalog-model.js'):root.rcExerciseCatalogModel;
  const strengthModel=typeof module!=='undefined'&&module.exports?require('./strength-performance-model.js'):root.rcStrengthPerformanceModel;
  const checkinModel=typeof module!=='undefined'&&module.exports?require('./checkin-model.js'):root.rcCheckinModel;
  const api=factory(todayModel,exerciseCatalog,strengthModel,checkinModel);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcWorkoutModeModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(todayModel,exerciseCatalog,strengthModel,checkinModel){
  'use strict';

  const VERSION='1.0.0';
  const categoryMeta={
    running:{label:'Corsa',kicker:'RUNNING SESSION',css:'running'},
    swimming:{label:'Nuoto',kicker:'SWIM SESSION',css:'swimming'},
    cycling:{label:'Ciclismo',kicker:'RIDE SESSION',css:'cycling'},
    strength:{label:'Forza',kicker:'STRENGTH SESSION',css:'strength'},
    hyrox:{label:'HYROX Spec',kicker:'HYBRID SESSION',css:'hyrox'},
    metcon:{label:'MetCon',kicker:'CONDITIONING SESSION',css:'metcon'},
    test:{label:'Test',kicker:'PERFORMANCE TEST',css:'test'},
    recovery:{label:'Recupero',kicker:'RECOVERY SESSION',css:'recovery'}
  };
  const priorityRank={essential:0,important:1,optional:2};
  const priorityLabel={essential:'Essenziale',important:'Importante',optional:'Bonus'};
  const phaseLabels={warmup:'Riscaldamento',work:'Lavoro',recovery:'Recupero',cooldown:'Defaticamento',free:'Libero'};

  function number(value){const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;}
  function iso(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function paused(session){return session?.adaptiveAdjustment?.status==='paused'&&!session?.outcome;}
  function performed(session){return ['completed','partial'].includes(session?.outcome?.status);}
  function category(session){return categoryMeta[session?.category]||{label:'Allenamento',kicker:'TODAY SESSION',css:'recovery'};}
  function startTime(value){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value||''))?String(value):'09:00';}
  function timeRange(session){
    const start=startTime(session?.startTime),[hours,minutes]=start.split(':').map(Number),date=new Date(2000,0,1,hours,minutes+number(session?.durationMin));
    return `${start}–${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  }
  function status(session){
    const value=session?.outcome?.status;
    if(value==='completed')return{label:'Svolta',css:'completed'};
    if(value==='partial')return{label:'Parziale',css:'partial'};
    if(value==='skipped')return{label:'Non svolta',css:'skipped'};
    return{label:'Da svolgere',css:'planned'};
  }
  function targetText(item={}){
    const amount=number(item.amount),unit={min:' min',km:' km',m:' m'}[item.unit]||` ${item.unit||''}`;
    return [amount?`${amount}${unit}`:'Durata libera',item.target||'Libero',item.paceHint].filter(Boolean).join(' · ');
  }
  function targetLabel(value){
    const text=String(value||'');
    if(/\/km|passo|pace/i.test(text))return'PASSO';
    if(/(^|\s)z[1-5](\s|$)|bpm|frequenza|heart\s*rate/i.test(text))return'FREQUENZA';
    if(/watt|\bftp\b|(^|\s)\d+\s*w($|\s)|%\s*ftp/i.test(text))return'POTENZA';
    if(/\brpe\b|\brir\b/i.test(text))return'INTENSITÀ';
    return'TARGET';
  }
  function targetMetrics(item={}){
    const amount=number(item.amount),unit={min:' min',km:' km',m:' m'}[item.unit]||` ${item.unit||''}`;
    const duration=amount?`${amount}${unit}`:'Durata libera';
    const values=[item.target||'Libero',item.paceHint].map(value=>String(value||'').trim()).filter(Boolean);
    const inferredZone={recovery:'Z1',easy:'Z2',steady:'Z3',tempo:'Z3',threshold:'Z4',vo2:'Z5'}[item.intensity];
    const unique=[...new Set(values)],zone=values.join(' ').match(/\bZ([1-5])\b/i)?.[0]?.toUpperCase()||inferredZone||null;
    return{duration,targets:unique.map(value=>({label:targetLabel(value),value,...(zone?{zone}:{})}))};
  }
  function restText(value){const text=String(value||'').trim();return text?`Recupero ${text}`:'';}
  function actualStrengthBlocks(session){
    const rows=Array.isArray(session?.outcome?.strengthPerformance)?session.outcome.strengthPerformance:[],volumeKnown=session?.outcome?.strengthPerformanceVersion===2;
    return (strengthModel?.groupedEntries?.(rows)||[]).map(group=>({kind:'exercise',eyebrow:volumeKnown?`${group.entries.length} ${group.entries.length===1?'serie registrata':'serie registrate'}`:'Miglior serie storica · volume n.d.',title:group.label,metrics:group.entries.map((item,index)=>`${volumeKnown?`S${index+1} · `:''}${group.externalLoad?'+':''}${item.loadKg.toLocaleString('it-IT',{maximumFractionDigits:1})} kg × ${item.reps}${item.rpe!==undefined?` · RPE ${item.rpe.toLocaleString('it-IT')}`:''}`),exerciseMeta:exerciseCatalog?.describeExercise?.(group.label),actual:true,volumeKnown}));
  }
  function strengthBlocks(session){
    if(performed(session))return actualStrengthBlocks(session);
    const items=Array.isArray(session?.details?.strengthBlocks)?session.details.strengthBlocks:[];
    if(items.length)return items.map((item,index)=>({kind:'exercise',eyebrow:`Esercizio ${index+1}`,title:item.name||'Esercizio principale',metrics:[item.sets&&item.reps?`${item.sets} × ${item.reps}`:'Serie da definire',item.loadKg!==''&&item.loadKg!==null&&item.loadKg!==undefined?`${item.loadKg} kg`:'',item.target||'',restText(item.rest)].filter(Boolean),exerciseMeta:exerciseCatalog?.describeExercise?.(item.name),rest:item.rest||''}));
    return [];
  }
  function enduranceBlocks(items=[]){
    return items.map((item,index)=>{
      if(item.type==='repeat')return{kind:'repeat',phase:'repeat',eyebrow:'SEQUENZA',title:`${number(item.repeats)||1} ripetizioni`,intensity:item.intensity||item.steps?.[0]?.intensity||'tempo',steps:(item.steps||[]).map((step,stepIndex)=>({phase:step.phase||'free',title:phaseLabels[step.phase]||`Fase ${stepIndex+1}`,value:targetText(step),...targetMetrics(step),intensity:step.intensity||item.intensity||'tempo'}))};
      return{kind:'segment',phase:item.phase||'free',eyebrow:'FASE',title:phaseLabels[item.phase]||'Blocco',value:targetText(item),...targetMetrics(item),intensity:item.intensity||'easy'};
    });
  }
  function structuredBlocks(items=[]){
    return items.map((item,index)=>({kind:'segment',eyebrow:`Blocco ${index+1}`,title:item.name||'Blocco',value:[item.volume,item.target,restText(item.rest)].filter(Boolean).join(' · '),rest:item.rest||'',intensity:/rpe\s*(7|8|9|10)|soglia|threshold|race/i.test(`${item.target||''} ${item.name||''}`)?'threshold':'easy'}));
  }
  function sessionBlocks(session){
    const details=session?.details||{};
    if(session.category==='strength'){
      const blocks=strengthBlocks(session);if(blocks.length)return blocks;
    }
    if(session.category==='running'&&Array.isArray(details.runBlocks)&&details.runBlocks.length)return enduranceBlocks(details.runBlocks);
    if(session.category==='cycling'&&Array.isArray(details.rideBlocks)&&details.rideBlocks.length){
      const blocks=enduranceBlocks(details.rideBlocks);if(details.brickRun)blocks.push({kind:'segment',eyebrow:'Transizione T2',title:'Corsa brick',value:[`${details.brickRun.durationMin} min`,details.brickRun.target,details.brickRun.transition].filter(Boolean).join(' · '),intensity:'tempo'});return blocks;
    }
    if(session.category==='swimming'&&Array.isArray(details.swimStructuredBlocks)&&details.swimStructuredBlocks.length)return structuredBlocks(details.swimStructuredBlocks);
    if(session.category==='hyrox'&&Array.isArray(details.hyroxStructuredBlocks)&&details.hyroxStructuredBlocks.length)return structuredBlocks(details.hyroxStructuredBlocks);
    if(session.category==='metcon'&&Array.isArray(details.metconStructuredBlocks)&&details.metconStructuredBlocks.length)return structuredBlocks(details.metconStructuredBlocks);
    return (todayModel?.prescriptionFor?.(session)||[]).map((item,index)=>({kind:'segment',eyebrow:`Blocco ${index+1}`,title:item.label||'Indicazione',value:item.value||'Da definire',intensity:item.intensity||'easy',actual:item.actual===true}));
  }
  function nextSession(sessions,today){return sessions.filter(item=>!paused(item)&&item.date>today).sort((a,b)=>a.date.localeCompare(b.date)||(priorityRank[a.priority]??1)-(priorityRank[b.priority]??1))[0]||null;}
  function sortSessions(items){return [...items].sort((a,b)=>Number(Boolean(a.outcome))-Number(Boolean(b.outcome))||(priorityRank[a.priority]??1)-(priorityRank[b.priority]??1)||String(a.startTime||'09:00').localeCompare(String(b.startTime||'09:00')));}
  function buildSession(session,options={}){
    const meta=category(session),state=status(session),outcome=session.outcome||null;
    const wasPerformed=performed(session),strength=session.category==='strength';
    return{...session,meta,state,timeRange:timeRange(session),priorityLabel:priorityLabel[session.priority]||'Importante',performed:wasPerformed,preCheckin:options.preCheckin||null,blocks:sessionBlocks(session),...(strength?{strengthStimulus:exerciseCatalog?.sessionStimulus?.(session,{actual:wasPerformed})||null,strengthReview:wasPerformed?exerciseCatalog?.compareStrengthSession?.(session)||null:null}:{}),displayDuration:outcome?.actualDurationMin?`${outcome.actualDurationMin} min reali`:`${number(session.durationMin)} min previsti`,displayLoad:outcome?.sessionLoad?`${outcome.sessionLoad} AU`:null};
  }
  function buildWorkoutDay(input={}){
    const today=input.today||iso(),all=Array.isArray(input.sessions)?input.sessions:[],preCheckins=Array.isArray(input.preCheckins)?input.preCheckins:[],todaySessions=sortSessions(all.filter(item=>item.date===today&&!paused(item))),selected=todaySessions.find(item=>item.id===input.selectedId)||todaySessions[0]||null;
    const build=item=>buildSession(item,{preCheckin:checkinModel?.findCheckin?.(preCheckins,item.id,item.date,{fallbackGeneric:true})||null});
    return{version:VERSION,today,sessions:todaySessions.map(build),selected:selected?build(selected):null,next:nextSession(all,today)};
  }
  function parseRestSeconds(value){
    const text=String(value||'').trim().toLowerCase();if(!text)return null;
    const clock=text.match(/(\d+)\s*[:']\s*(\d{1,2})/);if(clock)return Number(clock[1])*60+Number(clock[2]);
    const minutes=text.match(/(\d+(?:[.,]\d+)?)\s*(?:min|')/);if(minutes)return Math.round(Number(minutes[1].replace(',','.'))*60);
    const seconds=text.match(/(\d+)\s*(?:sec|s|\")/);if(seconds)return Number(seconds[1]);
    return null;
  }
  function durationMinutes(value){
    const text=String(value||'').toLowerCase(),clock=text.match(/\b(\d{1,2})\s*:\s*(\d{2})\b/);if(clock)return(Number(clock[1])*60+Number(clock[2]))/60;
    const minutes=[...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:min(?:uti?)?|['’])/g)].map(match=>Number(match[1].replace(',','.'))).filter(value=>value>0);
    return minutes.length?minutes[minutes.length-1]:null;
  }
  function protocolDuration(session,protocol){
    const details=session?.details||{},blocks=Array.isArray(details.metconStructuredBlocks)?details.metconStructuredBlocks:[],sources=[session?.title,session?.notes,...blocks.flatMap(item=>[item.name,item.volume,item.target])].filter(Boolean);
    const name=protocol==='amrap'?'amrap':protocol==='emom'?'e(?:very\s+minute\s+on\s+the\s+minute|mom)':'(?:time\s*cap|cap)';
    for(const source of sources){
      const text=String(source),after=text.match(new RegExp(`\\b${name}\\b(?:\\s*(?:da|di|for|of)?\\s*)(\\d+(?:[.,]\\d+)?)\\s*(?:min(?:uti?)?|['’])`,'i')),before=text.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:min(?:uti?)?|['’])\\s*(?:di\\s*)?\\b${name}\\b`,'i'));
      const minutes=Number((after?.[1]||before?.[1]||'').replace(',','.'));if(minutes>0)return Math.round(minutes*60);
    }
    if(['amrap','emom'].includes(protocol)){
      const matching=blocks.find(item=>new RegExp(name,'i').test(`${item.name||''} ${item.volume||''} ${item.target||''}`))||blocks[0],minutes=durationMinutes(`${matching?.name||''} ${matching?.volume||''}`);
      if(minutes>0)return Math.round(minutes*60);
    }
    return null;
  }
  function timerConfig(session){
    if(!session)return null;const details=session.details||{},category=session.category;
    const blockKey={strength:'strengthBlocks',swimming:'swimStructuredBlocks',hyrox:'hyroxStructuredBlocks',metcon:'metconStructuredBlocks'}[category],blocks=Array.isArray(details[blockKey])?details[blockKey]:[];
    const restValues=blocks.map(item=>number(item.restSec)||parseRestSeconds(item.rest)).filter(seconds=>seconds>=15&&seconds<=600);
    const uniqueRest=[...new Set(restValues)].sort((a,b)=>a-b).map(seconds=>({seconds,label:formatTimer(seconds),kind:'recovery'}));
    if(category==='metcon'){
      const format=`${details.metconType||''} ${session.title||''}`.toLowerCase(),protocol=/amrap/.test(format)?'amrap':/emom|every minute/.test(format)?'emom':/for time|time cap/.test(format)?'cap':null;
      if(protocol){const seconds=protocolDuration(session,protocol);if(seconds)return{title:protocol==='amrap'?'TIMER AMRAP':protocol==='emom'?'TIMER EMOM':'TIME CAP',note:protocol==='emom'?'Durata complessiva del blocco EMOM programmato.':'Durata del protocollo programmato.',presets:[{seconds,label:`${protocol==='amrap'?'AMRAP':protocol==='emom'?'EMOM':'CAP'} · ${formatTimer(seconds)}`,kind:'work'}]};}
      if(uniqueRest.length)return{title:'TIMER METCON',note:'Recuperi presenti nella struttura della seduta.',presets:uniqueRest};
      return null;
    }
    if(category==='strength'&&uniqueRest.length)return{title:'TIMER RECUPERO',note:'Sono mostrati soltanto i recuperi programmati negli esercizi di oggi.',presets:uniqueRest};
    if(category==='hyrox'&&uniqueRest.length)return{title:'TIMER HYROX',note:'Recuperi previsti tra blocchi e stazioni.',presets:uniqueRest};
    if(category==='swimming'&&uniqueRest.length)return{title:'TIMER NUOTO',note:'Recuperi previsti tra le serie.',presets:uniqueRest};
    if(category==='test'){
      const recovery=String(details.testProtocol||'').match(/recuper\w*\s*(?:di|da)?\s*(\d+(?:[.,]\d+)?)\s*(min(?:uti?)?|s(?:ec)?)/i);if(recovery){const seconds=/^min/i.test(recovery[2])?Math.round(Number(recovery[1].replace(',','.'))*60):Math.round(Number(recovery[1].replace(',','.')));if(seconds>=15&&seconds<=1800)return{title:'TIMER TEST',note:'Recupero indicato nel protocollo del test.',presets:[{seconds,label:formatTimer(seconds),kind:'recovery'}]};}
    }
    return null;
  }
  function timerPresets(session){
    return(timerConfig(session)?.presets||[]).map(item=>item.seconds);
  }
  function formatTimer(seconds){const safe=Math.max(0,Math.round(number(seconds)));return `${String(Math.floor(safe/60)).padStart(2,'0')}:${String(safe%60).padStart(2,'0')}`;}

  return{VERSION,buildWorkoutDay,buildSession,sessionBlocks,targetMetrics,timerConfig,timerPresets,parseRestSeconds,formatTimer,timeRange};
});
