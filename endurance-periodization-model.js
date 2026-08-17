(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcEndurancePeriodizationModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='1.0.0';
  const DAY_MS=86400000;
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const roundFive=value=>Math.max(5,Math.round(number(value)/5)*5);
  const atNoon=value=>new Date(`${value}T12:00:00`);
  const daysBetween=(from,to)=>Math.round((atNoon(to)-atNoon(from))/DAY_MS);
  const addDays=(value,days)=>{const date=atNoon(value);date.setDate(date.getDate()+days);return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};
  const segment=(phase,amount,targetType,target,intensity,extra={})=>({type:'segment',phase,unit:'min',amount:+number(amount).toFixed(2),targetType,target,intensity,...extra});
  const repeat=(repeats,work,recovery,target,intensity)=>({type:'repeat',repeats,intensity,steps:[segment('work',work,'pace',target,intensity),segment('recovery',recovery,'hr','Z1','recovery')]});

  function structuredMinutes(blocks=[]){
    return +(blocks||[]).reduce((total,item)=>total+(item?.type==='repeat'
      ?number(item.repeats)*(item.steps||[]).reduce((sum,step)=>sum+number(step.amount),0)
      :number(item?.amount)),0).toFixed(2);
  }

  function marathonQuality(weeksToRace,phaseKey,context={}){
    const preparatory=context.preparatoryRaceThisWeek;
    const afterPreparatory=context.preparatoryRacePreviousWeek;
    let spec;
    if(weeksToRace<=0)spec={code:'M-RACE-PRIMER',title:'Attivazione ritmo maratona',repeats:4,work:2,recovery:2,intensity:'race',target:'Ritmo maratona',warm:10,cool:6,rpe:5,load:'taper'};
    else if(weeksToRace===1)spec={code:'M-TAPER-1',title:'Richiamo ritmo maratona · 3 × 6′',repeats:3,work:6,recovery:3,intensity:'race',target:'Ritmo maratona',warm:12,cool:8,rpe:6,load:'taper'};
    else if(afterPreparatory)spec={code:'M-POST-RACE',title:'Riattivazione aerobica · 4 × 4′',repeats:4,work:4,recovery:2,intensity:'steady',target:'Ritmo steady controllato',warm:12,cool:8,rpe:5,load:'absorption'};
    else if(weeksToRace===2)spec={code:'M-TAPER-2',title:'Ritmo maratona · 3 × 8′',repeats:3,work:8,recovery:3,intensity:'race',target:'Ritmo maratona',warm:12,cool:8,rpe:6,load:'taper'};
    else if(preparatory)spec={code:'M-TUNEUP',title:'Richiamo pre-30 km · 3 × 6′',repeats:3,work:6,recovery:3,intensity:'race',target:'Ritmo maratona',warm:12,cool:8,rpe:6,load:'absorption'};
    else if(weeksToRace===3)spec={code:'M-SPEC-3',title:'Ritmo maratona esteso · 2 × 20′',repeats:2,work:20,recovery:4,intensity:'race',target:'Ritmo maratona',warm:12,cool:8,rpe:7,load:'specific'};
    else if(weeksToRace===4)spec={code:'M-SPEC-4',title:'Ritmo maratona · 2 × 18′',repeats:2,work:18,recovery:4,intensity:'race',target:'Ritmo maratona',warm:12,cool:8,rpe:7,load:'specific'};
    else if(weeksToRace===5)spec={code:'M-SPEC-5',title:'Ritmo maratona · 3 × 12′',repeats:3,work:12,recovery:3,intensity:'race',target:'Ritmo maratona',warm:12,cool:8,rpe:7,load:'specific'};
    else if(weeksToRace===6)spec={code:'M-BUILD-6',title:'Soglia estensiva · 4 × 7′',repeats:4,work:7,recovery:2,intensity:'threshold',target:'Ritmo soglia controllato',warm:12,cool:8,rpe:8,load:'build'};
    else if(weeksToRace===7)spec={code:'M-BUILD-7',title:'Ritmo maratona · 3 × 10′',repeats:3,work:10,recovery:3,intensity:'race',target:'Ritmo maratona',warm:12,cool:9,rpe:7,load:'build'};
    else if(weeksToRace===8)spec={code:'M-BUILD-8',title:'Soglia estensiva · 5 × 5′',repeats:5,work:5,recovery:2,intensity:'threshold',target:'Ritmo soglia controllato',warm:12,cool:8,rpe:8,load:'build'};
    else if(weeksToRace===9)spec={code:'M-BUILD-9',title:'Cruise intervals · 4 × 6′',repeats:4,work:6,recovery:2,intensity:'threshold',target:'Ritmo soglia controllato',warm:12,cool:8,rpe:7,load:'build'};
    else if(phaseKey==='base')spec=weeksToRace%2
      ?{code:'M-BASE-HILLS',title:'Salite aerobiche · 8 × 90″',repeats:8,work:1.5,recovery:1.5,intensity:'steady',target:'RPE 6–7 · tecnica e spinta',warm:15,cool:10,rpe:7,load:'base'}
      :{code:'M-BASE-CRUISE',title:'Cruise intervals · 6 × 3′',repeats:6,work:3,recovery:2,intensity:'threshold',target:'Ritmo soglia controllato',warm:12,cool:8,rpe:7,load:'base'};
    else spec={code:`M-${String(phaseKey||'BUILD').toUpperCase()}-${weeksToRace}`,title:'Soglia estensiva · 4 × 6′',repeats:4,work:6,recovery:2,intensity:'threshold',target:'Ritmo soglia controllato',warm:12,cool:8,rpe:7,load:'build'};
    const blocks=[segment('warmup',spec.warm,'hr','Z1','recovery'),repeat(spec.repeats,spec.work,spec.recovery,spec.target,spec.intensity),segment('cooldown',spec.cool,'hr','Z1','recovery')];
    return{...spec,durationMin:structuredMinutes(blocks),workMinutes:+(spec.repeats*spec.work).toFixed(1),blocks,rationale:`${spec.title}: ${spec.repeats} blocchi per ${spec.work}′, recupero ${spec.recovery}′. La dose ${spec.load==='taper'?'mantiene il ritmo riducendo nettamente il volume':spec.load==='absorption'?'favorisce l’assorbimento del carico gara':'progredisce per durata e specificità senza aggiungere una seconda qualità running'}.`};
  }

  function fitQuality(spec,sessionMinutes){
    const cap=clamp(roundFive(sessionMinutes||60),35,70);
    if(spec.durationMin<=cap)return spec;
    const next=clone(spec),over=next.durationMin-cap;
    next.blocks[0].amount=Math.max(8,next.blocks[0].amount-Math.ceil(over/2));
    next.blocks.at(-1).amount=Math.max(5,next.blocks.at(-1).amount-Math.floor(over/2));
    next.durationMin=structuredMinutes(next.blocks);
    if(next.durationMin>cap){
      const repeated=next.blocks.find(item=>item.type==='repeat'),excess=next.durationMin-cap;
      repeated.steps[0].amount=+Math.max(2,repeated.steps[0].amount-excess/repeated.repeats).toFixed(2);
      next.work=number(repeated.steps[0].amount);next.workMinutes=+(next.repeats*next.work).toFixed(1);next.durationMin=structuredMinutes(next.blocks);
    }
    return next;
  }

  function controlQuality(spec){
    if(!spec)return null;const next=clone(spec),repeated=next.blocks.find(item=>item.type==='repeat');
    if(!repeated)return next;
    const originalRepeats=number(repeated.repeats);repeated.repeats=Math.max(2,Math.floor(originalRepeats*.75));
    if(repeated.repeats===originalRepeats)repeated.steps[0].amount=+Math.max(3,number(repeated.steps[0].amount)*.75).toFixed(2);
    if(repeated.intensity==='threshold'){
      repeated.intensity='steady';
      repeated.steps[0]={...repeated.steps[0],targetType:'hr',target:'Z3',intensity:'steady'};
    }
    next.repeats=repeated.repeats;next.intensity=repeated.intensity;next.workMinutes=+(repeated.repeats*number(repeated.steps[0].amount)).toFixed(1);next.durationMin=structuredMinutes(next.blocks);next.code=`${next.code}-CONTROLLED`;next.title=`${next.title} · dose ridotta`;next.load='absorption';next.rpe=Math.min(6,number(next.rpe,6));next.rationale=`${next.title}: il Coach conserva lo scopo della settimana ma riduce numero di blocchi e carico interno; il lavoro perso non viene compensato.`;
    return next;
  }

  function easyPrescription(minutes,index=1,phaseKey='build'){
    const duration=clamp(roundFive(minutes||60),30,70),withStrides=index>1&&!['peak','taper','race-week'].includes(phaseKey);
    if(!withStrides){
      const blocks=[segment('warmup',10,'hr','Z1','recovery'),segment('work',Math.max(15,duration-15),'hr','Z2','easy'),segment('cooldown',5,'hr','Z1','recovery')];
      return{code:index>1?'EASY-RECOVERY':'EASY-AEROBIC',title:index>1?'Corsa facile di recupero':'Corsa facile aerobica',durationMin:structuredMinutes(blocks),runType:'Easy run',rpe:index>1?3:4,blocks,rationale:'Il volume facile resta prevalente e chiaramente separato dallo stimolo di qualità.'};
    }
    const strides=repeat(6,.33,1,'RPE 7 · rapido ma rilassato','steady'),fixed=10+5+structuredMinutes([strides]),easy=Math.max(12,duration-fixed),blocks=[segment('warmup',10,'hr','Z1','recovery'),segment('work',easy,'hr','Z2','easy'),strides,segment('cooldown',5,'hr','Z1','recovery')];
    return{code:'EASY-STRIDES',title:'Corsa facile + 6 allunghi',durationMin:structuredMinutes(blocks),runType:'Easy run + strides',rpe:4,blocks,rationale:'Gli allunghi mantengono economia e brillantezza senza trasformare la corsa facile in una seconda seduta intensa.'};
  }

  function marathonLong(weeksToRace,phaseKey,requestedMinutes,context={}){
    if(weeksToRace<=0||context.preparatoryRaceThisWeek)return null;
    let duration=clamp(roundFive(requestedMinutes||120),60,210),code='M-LONG-EASY',title='Lungo aerobico',specificMinutes=0,specificIntensity='easy',specificTarget='Z2',repeatCount=0,recovery=0,load='load';
    if(context.preparatoryRacePreviousWeek){duration=Math.min(duration,90);code='M-LONG-POST-RACE';title='Lungo breve di assorbimento';load='absorption';}
    else if(weeksToRace===1){duration=Math.min(duration,75);code='M-LONG-TAPER-1';title='Lungo ridotto + ritmo maratona';specificMinutes=20;repeatCount=2;recovery=4;specificIntensity='race';specificTarget='Ritmo maratona';load='taper';}
    else if(weeksToRace===2){duration=Math.min(duration,100);code='M-LONG-TAPER-2';title='Lungo controllato di taper';specificMinutes=20;repeatCount=1;specificIntensity='race';specificTarget='Ritmo maratona';load='taper';}
    else if(weeksToRace===3){code='M-LONG-SPEC-3';title='Lungo specifico · 3 × 15′ ritmo maratona';specificMinutes=45;repeatCount=3;recovery=5;specificIntensity='race';specificTarget='Ritmo maratona';load='specific';}
    else if(weeksToRace===4){code='M-LONG-SPEC-4';title='Lungo specifico · 2 × 20′ ritmo maratona';specificMinutes=40;repeatCount=2;recovery=5;specificIntensity='race';specificTarget='Ritmo maratona';load='specific';}
    else if(weeksToRace===5){code='M-LONG-STEADY-5';title='Lungo con finale steady';specificMinutes=30;repeatCount=1;specificIntensity='steady';specificTarget='Z3';load='specific-build';}
    else if(weeksToRace===6){duration=Math.min(duration,roundFive(number(requestedMinutes)*.85));code='M-LONG-DELOAD-6';title='Lungo aerobico di scarico';load='absorption';}
    else if(weeksToRace===7){code='M-LONG-SPEC-7';title='Lungo · 2 × 15′ ritmo maratona';specificMinutes=30;repeatCount=2;recovery=5;specificIntensity='race';specificTarget='Ritmo maratona';load='build';}
    else if(weeksToRace===8){code='M-LONG-STEADY-8';title='Lungo con finale steady';specificMinutes=20;repeatCount=1;specificIntensity='steady';specificTarget='Z3';load='build';}
    if(['reduce','protect'].includes(context.adaptiveLevel)&&specificMinutes>0){
      specificMinutes=context.adaptiveLevel==='protect'?0:roundFive(specificMinutes*.65);repeatCount=specificMinutes?Math.min(repeatCount,2):0;recovery=repeatCount>1?recovery:0;code=`${code}-CONTROLLED`;title=`${title} · dose ridotta`;load='absorption';
    }
    const warm=10,cool=5,specificWork=repeatCount?specificMinutes:0,recoveryTotal=repeatCount>1?repeatCount*recovery:0,fixed=warm+cool+specificWork+recoveryTotal;
    if(fixed>duration-15){specificMinutes=Math.max(0,duration-30-recoveryTotal);}
    const blocks=[segment('warmup',warm,'hr','Z1','recovery')];
    const easyMinutes=Math.max(15,duration-warm-cool-specificMinutes-recoveryTotal);
    blocks.push(segment('work',easyMinutes,'hr','Z2','easy'));
    if(specificMinutes>0){
      if(repeatCount>1)blocks.push(repeat(repeatCount,specificMinutes/repeatCount,recovery,specificTarget,specificIntensity));
      else blocks.push(segment('work',specificMinutes,specificIntensity==='race'?'pace':'hr',specificTarget,specificIntensity));
    }
    blocks.push(segment('cooldown',cool,'hr','Z1','recovery'));
    return{code,title,durationMin:structuredMinutes(blocks),runType:'Long run',rpe:load==='taper'||load==='absorption'?5:specificMinutes?6:5,blocks,specificMinutes:+specificMinutes.toFixed(1),load,rationale:specificMinutes?`${specificMinutes}′ complessivi di lavoro ${specificIntensity==='race'?'a ritmo maratona':'steady'} dentro un lungo da ${structuredMinutes(blocks)}′; volume e specificità sono dichiarati separatamente.`:`Lungo da ${structuredMinutes(blocks)}′ interamente aerobico per consolidare tolleranza e assorbire il carico prima della progressione successiva.`};
  }

  function preparatoryContext(goals=[],weekStart,goalId){
    const weekEnd=addDays(weekStart,6),previousStart=addDays(weekStart,-2);
    const preparatory=(Array.isArray(goals)?goals:[]).filter(goal=>goal?.id!==goalId&&goal?.status==='planned'&&['B','C'].includes(goal.priority));
    return{
      preparatoryRaceThisWeek:preparatory.some(goal=>goal.date>=weekStart&&goal.date<=weekEnd),
      preparatoryRacePreviousWeek:preparatory.some(goal=>goal.date>=previousStart&&goal.date<weekStart)
    };
  }

  function forWeek(input={}){
    if(input.packKey!=='road-marathon'||!input.weekStart||!input.goalDate)return null;
    const daysToRace=Math.max(0,daysBetween(input.weekStart,input.goalDate)),weeksToRace=Math.floor(daysToRace/7),context={...preparatoryContext(input.goals,input.weekStart,input.goalId),...(input.context||{})};
    const quality=fitQuality(marathonQuality(weeksToRace,input.phaseKey,context),input.sessionMinutes||60),long=marathonLong(weeksToRace,input.phaseKey,input.longMinutes||120,context);
    return{version:VERSION,packKey:input.packKey,weekStart:input.weekStart,goalDate:input.goalDate,daysToRace,weeksToRace,phaseKey:input.phaseKey||null,context,quality,long,easy:easyPrescription(input.sessionMinutes,1,input.phaseKey),easy2:easyPrescription(input.sessionMinutes,2,input.phaseKey),signature:`${quality.code}|${long?.code||'RACE'}|${long?roundFive(long.durationMin):0}`};
  }

  function audit(plan=[]){
    const weeks=(Array.isArray(plan)?plan:[]).filter(Boolean),qualityCodes=weeks.map(item=>item.quality?.code).filter(Boolean),longDurations=weeks.map(item=>number(item.long?.durationMin)).filter(Boolean),warnings=[];
    for(let index=2;index<qualityCodes.length;index++)if(qualityCodes[index]===qualityCodes[index-1]&&qualityCodes[index]===qualityCodes[index-2])warnings.push(`Stimolo qualità ripetuto per tre settimane: ${qualityCodes[index]}.`);
    if(qualityCodes.length>=4&&new Set(qualityCodes).size<Math.ceil(qualityCodes.length*.6))warnings.push('Variabilità della qualità insufficiente rispetto alla lunghezza del blocco.');
    if(longDurations.length>=4&&new Set(longDurations).size<3)warnings.push('Il lungo non mostra abbastanza variazione di carico o scarico.');
    return{valid:warnings.length===0,warnings,qualityVariety:new Set(qualityCodes).size,longVariety:new Set(longDurations).size};
  }

  return{VERSION,daysBetween,structuredMinutes,marathonQuality,marathonLong,controlQuality,easyPrescription,preparatoryContext,forWeek,audit};
});
