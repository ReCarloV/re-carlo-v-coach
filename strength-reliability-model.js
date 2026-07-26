(function(root,factory){
  const strengthModel=typeof module!=='undefined'&&module.exports?require('./strength-performance-model.js'):root.rcStrengthPerformanceModel;
  const roleModel=typeof module!=='undefined'&&module.exports?require('./training-role-model.js'):root.rcTrainingRoleModel;
  const api=factory(strengthModel,roleModel);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcStrengthReliabilityModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(strengthModel,roleModel){
  'use strict';

  const VERSION='1.0.0';
  const OUTLIER_RELATIVE_THRESHOLD=.125;
  const OUTLIER_MINIMUM_DELTA_KG=5;
  const MINIMUM_BASELINE_OBSERVATIONS=2;
  const keyEnduranceRoles=new Set(['quality','long','race','hyrox','athx','obstacle','tri-brick']);
  const lowerPattern=/(back squat|front squat|squat|deadlift|stacco|trap bar|romanian deadlift|rdl|split squat|bulgarian|lunge|affond|hip thrust|leg press|clean|snatch)/i;

  function number(value){const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;}
  function dateAtNoon(value){const date=new Date(`${value}T12:00:00`);return Number.isNaN(date.getTime())?null:date;}
  function dateGap(a,b){const first=dateAtNoon(a),second=dateAtNoon(b);return first&&second?Math.abs(Math.round((first-second)/86400000)):Infinity;}
  function normalizedFormula(value){return strengthModel.FORMULAS[value]?value:'epley';}
  function entrySignature(raw){
    const entry=strengthModel.normalizedEntry(raw);if(!entry)return null;
    return [entry.key,entry.loadKg,entry.reps,entry.rpe??'',entry.bodyweightKg??''].join('|');
  }
  function estimateEntry(raw,{bodyweightKg=null,formula='epley'}={}){
    const entry=strengthModel.normalizedEntry(raw);if(!entry)return null;const lift=strengthModel.LIFTS[entry.key];
    const value=strengthModel.estimateE1rm(entry.loadKg,entry.reps,{externalLoad:lift.externalLoad,bodyweightKg:entry.bodyweightKg||bodyweightKg,formula:normalizedFormula(formula),rpe:entry.rpe});
    return value===null?null:{entry,value,key:entry.key,label:lift.label};
  }
  function historicalObservations({sessions=[],excludeSessionId=null,bodyweightKg=null,formula='epley'}={}){
    const observations=[];(Array.isArray(sessions)?sessions:[]).forEach(session=>{
      if(session?.id===excludeSessionId||session?.category!=='strength'||!['completed','partial'].includes(session?.outcome?.status)||session?.demoDataset)return;
      (Array.isArray(session.outcome.strengthPerformance)?session.outcome.strengthPerformance:[]).forEach(raw=>{
        const estimated=estimateEntry(raw,{bodyweightKg,formula});if(estimated)observations.push({...estimated,date:session.date||'',sessionId:session.id||'',confirmed:raw.e1rmConfirmed===true});
      });
    });return observations;
  }
  function preserveConfirmations(entries=[],existingEntries=[]){
    const confirmed=new Set((Array.isArray(existingEntries)?existingEntries:[]).filter(item=>item?.e1rmConfirmed===true).map(entrySignature).filter(Boolean));
    return (Array.isArray(entries)?entries:[]).map(entry=>confirmed.has(entrySignature(entry))?{...entry,e1rmConfirmed:true}:{...entry});
  }
  function reviewE1rmEntries({entries=[],sessions=[],excludeSessionId=null,bodyweightKg=null,formula='epley'}={}){
    const history=historicalObservations({sessions,excludeSessionId,bodyweightKg,formula}),issues=[];
    (Array.isArray(entries)?entries:[]).forEach(raw=>{
      const candidate=estimateEntry(raw,{bodyweightKg,formula});if(!candidate)return;const baseline=history.filter(item=>item.key===candidate.key).sort((a,b)=>a.date.localeCompare(b.date));
      if(baseline.length<MINIMUM_BASELINE_OBSERVATIONS)return;const reference=Math.max(...baseline.map(item=>item.value)),delta=candidate.value-reference,relative=reference>0?delta/reference:0;
      if(delta<OUTLIER_MINIMUM_DELTA_KG||relative<OUTLIER_RELATIVE_THRESHOLD)return;
      issues.push({key:candidate.key,label:candidate.label,signature:entrySignature(raw),candidateValue:candidate.value,referenceValue:reference,deltaKg:Math.round(delta*2)/2,increasePct:Math.round(relative*100),baselineCount:baseline.length,confirmed:raw.e1rmConfirmed===true,formula:normalizedFormula(formula)});
    });
    return{version:VERSION,issues,requiresConfirmation:issues.some(item=>!item.confirmed),threshold:{relativePct:OUTLIER_RELATIVE_THRESHOLD*100,minimumDeltaKg:OUTLIER_MINIMUM_DELTA_KG,minimumBaseline:MINIMUM_BASELINE_OBSERVATIONS}};
  }
  function confirmIssue(entries=[],issue){return entries.map(entry=>entrySignature(entry)===issue.signature?{...entry,e1rmConfirmed:true}:entry);}

  function lowerStrength(session={}){
    if(session.category!=='strength')return false;const focus=String(session.details?.strengthFocus||'').toLowerCase();
    if(focus.includes('lower')||focus.includes('full')||focus.includes('hyrox'))return true;
    return (Array.isArray(session.details?.strengthBlocks)?session.details.strengthBlocks:[]).some(item=>lowerPattern.test(String(item?.name||'')));
  }
  function enduranceRole(session={}){
    const role=roleModel?.roleFor?.(session)||session.category;
    if(keyEnduranceRoles.has(role))return role;
    if(session.category==='cycling'&&/(tempo|threshold|vo2|max|race)/i.test(`${session.details?.rideType||''} ${session.title||''}`))return'cycling-quality';
    return null;
  }
  function minutesFromMidnight(value){const text=String(value||'');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(text))return null;const[hours,minutes]=text.split(':').map(Number);return hours*60+minutes;}
  function sameDaySeparationMinutes(first,second){
    const firstStart=minutesFromMidnight(first.startTime),secondStart=minutesFromMidnight(second.startTime);if(firstStart===null||secondStart===null)return null;
    const firstEnd=firstStart+Math.max(0,number(first.durationMin)),secondEnd=secondStart+Math.max(0,number(second.durationMin));
    if(firstEnd<=secondStart)return secondStart-firstEnd;if(secondEnd<=firstStart)return firstStart-secondEnd;return 0;
  }
  function roleLabel(role){return{quality:'qualità running',long:'lungo',race:'gara',hyrox:'HYROX',athx:'ATHX',obstacle:'OCR / Spartan','tri-brick':'brick','cycling-quality':'ciclismo intenso'}[role]||'endurance chiave';}
  function pairConflict(strength,endurance,role){
    const gap=dateGap(strength.date,endurance.date);if(gap>1)return null;const sameDay=gap===0,separation=sameDay?sameDaySeparationMinutes(strength,endurance):null,race=role==='race';
    const severity=race||sameDay&&(separation===null||separation<360)?'high':'caution';let timing;
    if(sameDay&&separation===null)timing='nello stesso giorno, con orari da verificare';
    else if(sameDay&&separation<360)timing=`nello stesso giorno, con ${Math.floor(separation/60)}h ${String(separation%60).padStart(2,'0')} di separazione`;
    else if(sameDay)timing=`nello stesso giorno, con circa ${Math.floor(separation/60)} ore di separazione`;
    else timing='in giorni consecutivi';
    const target=roleLabel(role),message=`${strength.title} e ${endurance.title} (${target}) sono ${timing}.`;
    const guidance=race?'Proteggi la gara: sposta o alleggerisci il lower body salvo una scelta intenzionale già verificata.':sameDay&&separation!==null&&separation<360?'Meno di 6 ore tra qualità concorrenti: valuta di separarle oppure riduci volume lower e mantieni margine tecnico.':'Valuta recupero e priorità della seduta endurance; nessuno spostamento viene applicato automaticamente.';
    return{id:[strength.id,endurance.id].sort().join('::'),severity,gapDays:gap,separationMinutes:separation,strengthSessionId:strength.id,enduranceSessionId:endurance.id,strengthTitle:strength.title,enduranceTitle:endurance.title,enduranceRole:role,message,guidance};
  }
  function auditConcurrentProximity(sessions=[],options={}){
    const active=(Array.isArray(sessions)?sessions:[]).filter(item=>item?.date&&!item.demoDataset&&item.adaptiveAdjustment?.status!=='paused'&&item.outcome?.status!=='skipped');const strength=active.filter(lowerStrength),endurance=active.map(session=>({session,role:enduranceRole(session)})).filter(item=>item.role);const conflicts=[];
    strength.forEach(lift=>endurance.forEach(({session,role})=>{if(lift.id===session.id)return;const conflict=pairConflict(lift,session,role);if(!conflict)return;const liftInRange=(!options.startDate||lift.date>=options.startDate)&&(!options.endDate||lift.date<=options.endDate);const enduranceInRange=(!options.startDate||session.date>=options.startDate)&&(!options.endDate||session.date<=options.endDate);if((liftInRange||enduranceInRange)&&!conflicts.some(item=>item.id===conflict.id))conflicts.push(conflict);}));
    conflicts.sort((a,b)=>(a.severity==='high'?0:1)-(b.severity==='high'?0:1)||a.gapDays-b.gapDays||a.id.localeCompare(b.id));
    const high=conflicts.filter(item=>item.severity==='high').length;return{version:VERSION,conflicts,highCount:high,cautionCount:conflicts.length-high,summary:!conflicts.length?'Nessuna vicinanza critica tra forza lower e sedute endurance chiave.':high?`${high} sequenz${high===1?'a':'e'} prioritaria da verificare; il piano resta invariato.`:`${conflicts.length} sequenz${conflicts.length===1?'a':'e'} ravvicinata da monitorare; il piano resta modificabile.`};
  }

  return{VERSION,OUTLIER_RELATIVE_THRESHOLD,OUTLIER_MINIMUM_DELTA_KG,MINIMUM_BASELINE_OBSERVATIONS,entrySignature,estimateEntry,historicalObservations,preserveConfirmations,reviewE1rmEntries,confirmIssue,lowerStrength,enduranceRole,sameDaySeparationMinutes,auditConcurrentProximity};
});
