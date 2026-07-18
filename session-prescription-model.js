(function(root,factory){
  const zonesModel=typeof module!=='undefined'&&module.exports?require('./training-zones-model.js'):root?.rcTrainingZonesModel;
  const api=factory(zonesModel);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcSessionPrescriptionModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(zonesModel){
  'use strict';

  const VERSION='1.0.0';
  const PHASE_LABELS={warmup:'Riscaldamento',work:'Lavoro',recovery:'Recupero',cooldown:'Defaticamento',free:'Libero'};
  const INTENSITIES=new Set(['recovery','easy','steady','tempo','threshold','vo2','race']);

  function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
  function number(value,fallback=0){const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function paceText(seconds){const safe=Math.round(clamp(number(seconds,300),150,900));return`${Math.floor(safe/60)}:${String(safe%60).padStart(2,'0')}/km`;}
  function paceRange(minSeconds,maxSeconds){return`${paceText(minSeconds).replace('/km','')}–${paceText(maxSeconds)}`;}
  function pbSeconds(pb){return number(pb?.hours)*3600+number(pb?.minutes)*60+number(pb?.seconds);}
  function pbPace(profile,id,distance){
    const pb=(profile?.personalBests||[]).find(item=>item.id===id);
    const total=pbSeconds(pb),km=number(pb?.distanceKm,distance);
    return total>0&&km>0?total/km:null;
  }
  function paceProfile(profile={},goals=[]){
    const five=pbPace(profile,'run-5k',5);
    const ten=pbPace(profile,'run-10k',10)|| (five?five+15:null);
    const half=pbPace(profile,'run-half',21.0975);
    const marathon=pbPace(profile,'run-marathon',42.195);
    const reference=ten||(half?half-18:null)||(marathon?marathon-28:null)||300;
    const threshold=Math.round(reference+15);
    const primary=(Array.isArray(goals)?goals:[]).find(goal=>goal?.priority==='A'&&goal?.status==='planned'&&['marathon','running'].includes(goal.type));
    const target=String(primary?.target||'').match(/(\d{1,2})\s*:\s*(\d{2})/);
    const goalMarathon=target?((Number(target[1])*60+Number(target[2]))*60/42.195):null;
    return{
      basis:ten?'PB 10 km':half?'PB mezza maratona':marathon?'PB maratona':'profilo prudenziale',
      confidence:ten||half||marathon?'profile-derived':'low',
      recovery:[threshold+75,threshold+120],
      easy:[threshold+45,threshold+90],
      steady:[threshold+25,threshold+50],
      marathon:[goalMarathon||threshold+35,goalMarathon||threshold+50],
      threshold:[threshold-5,threshold+8],
      vo2:[five||reference-15,(five||reference-15)+10]
    };
  }
  function hrContext(profile={},customUpper=null){
    const result=zonesModel?.hrZones?.({maxHr:profile.maxHr,restingHr:profile.restingHr,method:profile.hrZoneMethod||'hrr',customUpper});
    const zones=result?.zones||[];
    return{method:result?.method||profile.hrZoneMethod||'hrr',zones:Object.fromEntries(zones.map(zone=>[zone.id,zone]))};
  }
  function zoneTarget(context,id){
    const zone=context.zones[id];
    return zone?`${zone.id} · ${zone.min}–${zone.max} bpm`:id;
  }
  function source(profile,pace,kind){
    return{version:VERSION,kind,hrMethod:profile?.hrZoneMethod||'hrr',paceBasis:pace.basis,confidence:pace.confidence};
  }
  function segment(phase,unit,amount,targetType,target,intensity,extra={}){
    return{type:'segment',phase,unit,amount:+number(amount).toFixed(2),targetType,target,intensity,...extra};
  }
  function inferIntensity(item={}){
    if(INTENSITIES.has(item.intensity))return item.intensity;
    if(['warmup','cooldown','recovery'].includes(item.phase))return'recovery';
    const text=`${item.target||''} ${item.targetType||''}`.toLowerCase();
    if(/z1|liber|recovery/.test(text))return'recovery';
    if(/z2/.test(text))return'easy';
    if(/z3|maratona|marathon/.test(text))return'steady';
    if(/z4|soglia|threshold/.test(text))return'threshold';
    if(/z5|vo2/.test(text))return'vo2';
    return item.phase==='work'?'tempo':'recovery';
  }
  function enrichRunSegment(item,profile,pace,hr){
    const intensity=inferIntensity(item);
    const zone=/\bZ[1-5]\b/i.exec(String(item.target||''))?.[0]?.toUpperCase();
    const paceKey={recovery:'recovery',easy:'easy',steady:'steady',tempo:'steady',threshold:'threshold',vo2:'vo2',race:'marathon'}[intensity];
    return{...item,intensity,...(zone&&hr.zones[zone]?{target:zoneTarget(hr,zone)}:{}),...(paceKey&&!item.paceHint?{paceHint:paceRange(...pace[paceKey])}:{}),targetSource:item.targetSource||source(profile,pace,'athlete-profile')};
  }
  function enrichRunBlocks(blocks,profile,pace,hr){
    return(blocks||[]).map(item=>item?.type==='repeat'
      ?{...item,intensity:item.intensity||inferIntensity(item.steps?.[0]),steps:(item.steps||[]).map(step=>enrichRunSegment(step,profile,pace,hr)),targetSource:item.targetSource||source(profile,pace,'athlete-profile')}
      :enrichRunSegment(item,profile,pace,hr));
  }
  function runPrescription(session,context={}){
    const details=session?.details||{},profile=context.profile||{},pace=paceProfile(profile,context.goals),hr=hrContext(profile,context.hrZones);
    if(details.runType==='Race')return[];
    if(Array.isArray(details.runBlocks)&&details.runBlocks.length)return enrichRunBlocks(details.runBlocks,profile,pace,hr);
    const duration=clamp(number(session?.durationMin,45),20,360),distance=number(details.distanceKm),text=`${session?.title||''} ${session?.notes||''} ${session?.planImport?.originalTitle||''}`.toLowerCase();
    const z1=zoneTarget(hr,'Z1'),z2=zoneTarget(hr,'Z2'),z3=zoneTarget(hr,'Z3');
    const base={targetSource:source(profile,pace,'athlete-profile')};
    const warm=(unit='min',amount=10)=>segment('warmup',unit,amount,'hr',z1,'recovery',{paceHint:paceRange(...pace.recovery),...base});
    const cool=(unit='min',amount=5)=>segment('cooldown',unit,amount,'hr',z1,'recovery',{paceHint:paceRange(...pace.recovery),...base});
    if(/interval|ripet|vo2/.test(`${details.runType||''} ${text}`)){
      return[warm('min',12),{type:'repeat',repeats:6,intensity:'vo2',targetSource:base.targetSource,steps:[segment('work','min',3,'pace',paceText(pace.vo2[0]),'vo2',{paceHint:paceRange(...pace.vo2),...base}),segment('recovery','min',2,'hr',z1,'recovery',{paceHint:paceRange(...pace.recovery),...base})]},cool('min',10)];
    }
    if(/tempo|threshold|soglia/.test(`${details.runType||''} ${text}`)){
      return[warm('min',12),{type:'repeat',repeats:3,intensity:'threshold',targetSource:base.targetSource,steps:[segment('work','min',8,'pace',paceText(pace.threshold[0]),'threshold',{paceHint:paceRange(...pace.threshold),...base}),segment('recovery','min',3,'hr',z1,'recovery',{paceHint:paceRange(...pace.recovery),...base})]},cool('min',8)];
    }
    if(/progress/.test(`${details.runType||''} ${text}`)){
      const working=Math.max(12,duration-18),first=Math.round(working*.7);
      return[warm(),segment('work','min',first,'hr',z2,'easy',{paceHint:paceRange(...pace.easy),...base}),segment('work','min',working-first,'hr',z3,'steady',{paceHint:paceRange(...pace.steady),...base}),cool('min',8)];
    }
    const long=/long|lungo/.test(`${details.runType||''} ${text}`.toLowerCase());
    if(long&&distance>=8){
      const specific=/ritmo maratona|marathon pace|\bmp\b/.test(text),specificKm=specific?Math.min(8,Math.max(4,Math.round(distance*.22))):0,easyKm=Math.max(2,distance-4-specificKm);
      return[warm('km',2),segment('work','km',easyKm,'hr',z2,'easy',{paceHint:paceRange(...pace.easy),...base}),...(specificKm?[segment('work','km',specificKm,'pace',paceText(pace.marathon[0]),'steady',{paceHint:paceRange(...pace.marathon),...base})]:[]),cool('km',2)];
    }
    const main=Math.max(10,duration-15),recovery=/recovery|recuper/.test(`${details.runType||''} ${text}`);
    return[warm(),segment('work','min',main,'hr',recovery?z1:z2,recovery?'recovery':'easy',{paceHint:paceRange(...pace[recovery?'recovery':'easy']),...base}),cool()];
  }
  function rideRange(rideType=''){
    const text=String(rideType).toLowerCase();
    if(/vo2/.test(text))return{min:106,max:115,intensity:'vo2',cadence:95};
    if(/threshold|soglia/.test(text))return{min:95,max:100,intensity:'threshold',cadence:90};
    if(/sweet/.test(text))return{min:88,max:94,intensity:'tempo',cadence:88};
    if(/tempo/.test(text))return{min:76,max:85,intensity:'tempo',cadence:88};
    if(/recovery|recuper/.test(text))return{min:45,max:55,intensity:'recovery',cadence:90};
    return{min:56,max:70,intensity:'easy',cadence:88};
  }
  function rideTarget(min,max,ftp){
    const watts=ftp>0?` · ${Math.round(ftp*min/100)}–${Math.round(ftp*max/100)} W`:'';
    return`${min}–${max}% FTP${watts}`;
  }
  function rideSegment(phase,amount,min,max,intensity,ftp,cadence){
    return{type:'segment',phase,unit:'min',amount,targetType:'ftp',target:rideTarget(min,max,ftp),ftpMin:min,ftpMax:max,cadence,intensity,targetSource:{version:VERSION,kind:'athlete-profile',ftp}};
  }
  function ridePrescription(session,context={}){
    const details=session?.details||{},ftp=number(context.profile?.ftp),duration=clamp(number(session?.durationMin,45),20,360),range=rideRange(details.rideType);
    if(/race/i.test(details.rideType||''))return[];
    if(Array.isArray(details.rideBlocks)&&details.rideBlocks.length)return details.rideBlocks.map(item=>item.type==='repeat'?{...item,intensity:item.intensity||inferIntensity(item.steps?.[0]),steps:(item.steps||[]).map(step=>({...step,intensity:inferIntensity(step)}))}:{...item,intensity:inferIntensity(item)});
    const warm=rideSegment('warmup',10,45,60,'recovery',ftp,90),cool=rideSegment('cooldown',5,45,55,'recovery',ftp,90);
    if(range.intensity==='vo2')return[warm,{type:'repeat',repeats:5,intensity:'vo2',steps:[rideSegment('work',3,range.min,range.max,'vo2',ftp,range.cadence),rideSegment('recovery',3,50,60,'recovery',ftp,90)]},cool];
    if(range.intensity==='threshold')return[warm,{type:'repeat',repeats:4,intensity:'threshold',steps:[rideSegment('work',5,range.min,range.max,'threshold',ftp,range.cadence),rideSegment('recovery',3,50,60,'recovery',ftp,90)]},cool];
    if(range.intensity==='tempo'&&duration>=45)return[warm,{type:'repeat',repeats:3,intensity:'tempo',steps:[rideSegment('work',8,range.min,range.max,'tempo',ftp,range.cadence),rideSegment('recovery',3,50,60,'recovery',ftp,90)]},cool];
    return[warm,rideSegment('work',Math.max(10,duration-15),range.min,range.max,range.intensity,ftp,range.cadence),cool];
  }
  function enrichSession(session,context={}){
    if(!session||session.outcome||!['running','cycling'].includes(session.category))return session;
    const blocks=session.category==='running'?runPrescription(session,context):ridePrescription(session,context);
    if(!blocks.length)return session;
    const key=session.category==='running'?'runBlocks':'rideBlocks',details={...(session.details||{}),[key]:blocks,prescriptionVersion:VERSION};
    if(session.category==='cycling'){
      const main=blocks.flatMap(item=>item.type==='repeat'?item.steps||[]:[item]).find(item=>item.phase==='work');
      if(main){details.ftpMin=main.ftpMin;details.ftpMax=main.ftpMax;details.cadence=main.cadence||details.cadence;}
    }
    return{...session,details};
  }
  function enrichSessions(sessions=[],context={}){
    let changed=false;
    const next=(sessions||[]).map(session=>{
      if(context.today&&session.date<context.today)return session;
      if(context.generatedOnly&&!session.planImport&&session.generated!==true&&!session.goalGenerated)return session;
      const enriched=enrichSession(session,context);
      if(JSON.stringify(enriched)!==JSON.stringify(session))changed=true;
      return enriched;
    });
    return{sessions:next,changed};
  }
  function plannedBlocks(session){
    return clone(session?.category==='running'?session?.details?.runBlocks:session?.category==='cycling'?session?.details?.rideBlocks:[])||[];
  }
  function actualBlocks(session,outcome){
    if(Array.isArray(outcome?.actualEnduranceBlocks))return clone(outcome.actualEnduranceBlocks);
    return plannedBlocks(session).map(item=>item.type==='repeat'
      ?{...item,plannedRepeats:number(item.repeats,1),completed:true,steps:(item.steps||[]).map(step=>({...step,plannedAmount:number(step.amount),completed:true}))}
      :{...item,plannedAmount:number(item.amount),completed:true});
  }
  function blockLabel(item){return item?.type==='repeat'?`${number(item.repeats,1)}× sequenza`:PHASE_LABELS[item?.phase]||'Blocco';}
  function blockSummary(item){
    if(item?.type==='repeat')return(item.steps||[]).map(blockSummary).join(' / ');
    const unit={min:"'",km:' km',m:' m'}[item?.unit]||` ${item?.unit||''}`;
    return[`${number(item?.amount)}${unit}`.trim(),item?.target,item?.paceHint].filter(Boolean).join(' · ');
  }

  return{VERSION,PHASE_LABELS,paceText,paceRange,paceProfile,hrContext,runPrescription,ridePrescription,enrichSession,enrichSessions,plannedBlocks,actualBlocks,inferIntensity,blockLabel,blockSummary};
});
