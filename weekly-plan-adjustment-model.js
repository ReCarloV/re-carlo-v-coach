(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcWeeklyPlanAdjustmentModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const prescriptionFields=['date','category','title','durationMin','priority','details','notes','titleMode'];
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const roundFive=value=>Math.max(5,Math.round(Number(value||0)/5)*5);
  function snapshotPrescription(session){return Object.fromEntries(prescriptionFields.map(field=>[field,clone(session[field])]).filter(([,value])=>value!==undefined));}
  function sourceSession(session){const source=session?.adaptiveAdjustment?.source,restored=source?{...clone(session),...clone(source)}:clone(session);if(restored)delete restored.adaptiveAdjustment;return restored;}
  function isRace(session){return session?.details?.runType==='Race'||Boolean(session?.goalGenerated);}
  function isLong(session){return session.category==='running'&&(session.details?.runType==='Long run'||/long|lungo/i.test(session.title||''));}
  function isQuality(session){if(session.category!=='running'||isRace(session))return false;const type=String(session.details?.runType||'').toLowerCase();return !isLong(session)&&(/interval|tempo|threshold|progress|quality|marathon/.test(type)||session.priority==='essential');}
  function isLowerStrength(session){if(session.category!=='strength')return false;return /lower|full/i.test(String(session.details?.strengthFocus||''));}
  function phaseRole(session){if(isRace(session))return'race';if(isLong(session))return'long';if(isQuality(session))return'quality';if(session.category==='running')return'easy';if(session.category==='strength')return isLowerStrength(session)?'strength-lower':'strength-upper';return['hyrox','metcon','cycling','recovery'].includes(session.category)?session.category:'other';}
  function pauseRank(session,phaseConstraints){const priorities=phaseConstraints?.priorities;if(priorities){let score=Number(priorities[phaseRole(session)]??priorities.other??30);if(session.priority==='optional')score-=40;if(session.priority==='essential')score+=10;return score;}if(isRace(session))return 20;if(session.priority==='optional')return 0;if(session.category==='recovery')return 1;if(session.category==='cycling')return 2;if(session.category==='strength'&&!isLowerStrength(session))return 3;if(session.category==='running'&&!isQuality(session)&&!isLong(session))return 4;if(isLowerStrength(session))return 5;if(isQuality(session))return 8;if(isLong(session))return 10;return 6;}
  function samePrescription(a,b){return JSON.stringify(snapshotPrescription(a))===JSON.stringify(snapshotPrescription(b));}
  function strengthDetails(details,settings,instructions){
    const reduction=Math.max(0,Number(settings.strengthSetReduction)||0),targetRir=Math.max(Number(details?.targetRir)||0,Number(settings.strengthRir)||0);const next={...(details||{}),targetRir};
    if(Array.isArray(details?.strengthBlocks))next.strengthBlocks=details.strengthBlocks.map(block=>{const sets=Number(block.sets);return{...block,...(Number.isFinite(sets)&&sets>0?{sets:String(Math.max(1,sets-reduction))}:{}),target:`RIR ${targetRir}`};});
    if(reduction)instructions.push(`Forza: ${reduction} serie in meno sui fondamentali e margine almeno RIR ${targetRir}.`);else if(targetRir>Number(details?.targetRir||0))instructions.push(`Forza con margine almeno RIR ${targetRir}.`);return next;
  }
  function adaptedPrescription(session,analysis){
    const base=sourceSession(session),settings=analysis?.settings||{},instructions=[];let next=clone(base);if(isRace(base))return{base,next,instructions};const factor=isLong(base)?Number(settings.longFactor||1):Number(settings.volumeFactor||1);const adaptedDuration=roundFive(Number(base.durationMin||0)*factor);
    if(adaptedDuration!==Number(base.durationMin)){next.durationMin=adaptedDuration;instructions.push(`${isLong(base)?'Lungo':'Durata'} adattat${isLong(base)?'o':'a'} da ${base.durationMin} a ${adaptedDuration} min.`);}
    if(base.category==='strength')next.details=strengthDetails(base.details,settings,instructions);
    if(isQuality(base)&&settings.qualityMode==='controlled'){
      next.details={...(next.details||{}),runRpe:Math.min(Number(next.details?.runRpe)||6,6),adaptiveIntensity:'controlled'};instructions.push('Qualità mantenuta, ma con densità controllata e senza incremento di intensità.');
    }
    if(isQuality(base)&&settings.lowerBodyProtection){
      next={...next,category:'cycling',title:`${base.title} · alternativa low impact`,details:{rideType:'Endurance low impact',powerSource:'',ftpMin:55,ftpMax:65,cadence:85}};instructions.push('Qualità di corsa sostituita con lavoro aerobico low impact per i segnali agli arti inferiori.');
    }
    if(base.category==='running'&&settings.suspendRunning){instructions.push('Corsa sospesa nella proposta automatica fino a nuova valutazione del fastidio.');}
    return{base,next,instructions};
  }
  function buildAdjustment(input={}){
    const analysis=input.analysis||{level:'steady',confidence:'low',settings:{}};const now=input.now instanceof Date?input.now.toISOString():new Date(input.now||Date.now()).toISOString();const sourceSessions=(Array.isArray(input.sessions)?input.sessions:[]).map(sourceSession);const raceCount=sourceSessions.filter(isRace).length;const target=Math.max(raceCount,Math.max(0,Math.min(sourceSessions.length,Number.isFinite(Number(input.targetCount))?Number(input.targetCount):sourceSessions.length)));const phaseConstraints=input.phaseConstraints||analysis.phaseConstraints||null;
    const forcedPause=new Set();if(analysis.settings?.suspendRunning)sourceSessions.filter(item=>item.category==='running').forEach(item=>forcedPause.add(item.id));
    sourceSessions.filter(isRace).forEach(item=>forcedPause.delete(item.id));const remaining=sourceSessions.filter(item=>!forcedPause.has(item.id));const extraPause=Math.max(0,remaining.length-target);[...remaining].sort((a,b)=>pauseRank(a,phaseConstraints)-pauseRank(b,phaseConstraints)||String(a.date).localeCompare(String(b.date))).slice(0,extraPause).forEach(item=>forcedPause.add(item.id));
    const sessions=sourceSessions.map(source=>{
      const original=(Array.isArray(input.sessions)?input.sessions:[]).find(item=>item.id===source.id)||source;const {base,next,instructions}=adaptedPrescription(original,analysis);const paused=forcedPause.has(source.id);if(paused)instructions.unshift(source.category==='running'&&analysis.settings?.suspendRunning?'Seduta sospesa in attesa di una nuova valutazione del fastidio.':'Seduta sospesa per rispettare la frequenza sostenibile proposta.');
      const status=paused?'paused':'active';const changed=paused||!samePrescription(base,next);if(!changed){delete next.adaptiveAdjustment;return next;}
      return{...next,adaptiveAdjustment:{version:1,status,level:analysis.level||'steady',confidence:analysis.confidence||'low',preparedAt:now,instructions,source:snapshotPrescription(base)}};
    });
    return{sessions,active:sessions.filter(item=>item.adaptiveAdjustment?.status!=='paused'),paused:sessions.filter(item=>item.adaptiveAdjustment?.status==='paused'),changed:sessions.filter(item=>item.adaptiveAdjustment).length,targetCount:target};
  }
  function withScheduledDate(session,date,analysis,input={}){
    if(session.date===date)return session;const now=input.now instanceof Date?input.now.toISOString():new Date(input.now||Date.now()).toISOString();const base=sourceSession(session),existing=session.adaptiveAdjustment;const instructions=[...(existing?.instructions||[]),`Seduta spostata dal ${base.date} al ${date} in base ai giorni disponibili.`];return{...session,date,adaptiveAdjustment:{version:1,status:existing?.status||'active',level:existing?.level||analysis?.level||'steady',confidence:existing?.confidence||analysis?.confidence||'low',preparedAt:existing?.preparedAt||now,instructions,source:existing?.source||snapshotPrescription(base)}};
  }
  function withInstruction(session,instruction,analysis,input={}){
    if(!instruction)return session;const now=input.now instanceof Date?input.now.toISOString():new Date(input.now||Date.now()).toISOString();const base=sourceSession(session),existing=session.adaptiveAdjustment;return{...session,adaptiveAdjustment:{version:1,status:existing?.status||'active',level:existing?.level||analysis?.level||'steady',confidence:existing?.confidence||analysis?.confidence||'low',preparedAt:existing?.preparedAt||now,instructions:[...(existing?.instructions||[]),instruction],source:existing?.source||snapshotPrescription(base)}};
  }
  function restoreSession(session){if(!session?.adaptiveAdjustment?.source)return clone(session);const restored={...clone(session),...clone(session.adaptiveAdjustment.source)};delete restored.adaptiveAdjustment;delete restored.coachApplication;restored.updatedAt=new Date().toISOString();return restored;}

  return{buildAdjustment,withScheduledDate,withInstruction,restoreSession,snapshotPrescription,sourceSession,isRace,isLong,isQuality,isLowerStrength,pauseRank,samePrescription};
});
