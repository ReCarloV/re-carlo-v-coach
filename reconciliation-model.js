(function(root,factory){
  const core=factory();if(typeof module!=='undefined'&&module.exports)module.exports=core;if(root)root.rcReconciliationModel=core;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const clamp=value=>Math.max(0,Math.min(1,value));
  const round=value=>+clamp(value).toFixed(2);
  const dateKey=value=>String(value||'').slice(0,10);
  const timestampMinutes=(value,offsetMinutes=0)=>{
    const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(String(value||''));if(!match)return null;
    return Date.UTC(+match[1],+match[2]-1,+match[3],+match[4],+match[5],+match[6])/60000-offsetMinutes;
  };
  const timezoneMinutes=value=>{const match=/^UTC([+-])(\d{2}):(\d{2})$/.exec(String(value||''));if(!match)return 0;const minutes=Number(match[2])*60+Number(match[3]);return match[1]==='-'?-minutes:minutes;};
  const durationStrava=item=>{const seconds=Number(item?.movingSec)||Number(item?.elapsedSec);return Number.isFinite(seconds)&&seconds>0?seconds/60:null;};
  const durationWhoop=item=>Number.isFinite(Number(item?.durationMin))&&Number(item.durationMin)>0?Number(item.durationMin):null;
  const durationSession=item=>{const actual=['completed','partial'].includes(item?.outcome?.status)?Number(item?.outcome?.actualDurationMin):null;if(Number.isFinite(actual)&&actual>0)return actual;return Number.isFinite(Number(item?.durationMin))&&Number(item.durationMin)>0?Number(item.durationMin):null;};
  const normalizeCategory=value=>{
    const category=String(value||'other').toLowerCase();
    if(category==='hyrox')return'metcon';if(category==='test')return'other';return category;
  };
  function categoryAffinity(a,b){
    const first=normalizeCategory(a),second=normalizeCategory(b);if(first===second)return 1;
    if(first==='other'||second==='other')return .3;
    const compatible=[['metcon','strength'],['metcon','running'],['outdoor','running'],['recovery','running']];
    return compatible.some(pair=>pair.includes(first)&&pair.includes(second)) ? .6 : 0;
  }
  function durationAffinity(a,b){
    if(!a||!b)return{score:0,reason:null};const difference=Math.abs(a-b);const ratio=difference/Math.max(a,b);
    if(difference<=5||ratio<=.1)return{score:1,reason:`durata molto simile (${Math.round(difference)} min di differenza)`};
    if(ratio<=.25)return{score:.65,reason:`durata compatibile (${Math.round(difference)} min di differenza)`};
    if(ratio<=.5)return{score:.3,reason:`durata parzialmente compatibile (${Math.round(difference)} min di differenza)`};
    return{score:0,reason:null};
  }
  const stopWords=new Set(['allenamento','attivita','attività','sessione','workout','run','corsa','easy','forza','strength','training','del','della','con','per','the','and']);
  function tokens(value){return new Set(String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').split(' ').filter(token=>token.length>2&&!stopWords.has(token)));}
  function titleAffinity(a,b){const left=tokens(a),right=tokens(b);if(!left.size||!right.size)return 0;const shared=[...left].filter(token=>right.has(token)).length;return shared/Math.min(left.size,right.size);}
  function scoreSourcePair(strava,whoop){
    if(!strava||!whoop)return null;const first=timestampMinutes(strava.localStart),secondDirect=timestampMinutes(whoop.start),secondUtc=timestampMinutes(whoop.start,timezoneMinutes(whoop.timezone));if(first===null||secondDirect===null||secondUtc===null)return null;const directDelta=Math.abs(first-secondDirect),normalizedDelta=Math.abs(first-secondUtc),delta=Math.min(directDelta,normalizedDelta);const timezoneNormalized=normalizedDelta<directDelta;if(delta>30)return null;
    let score=0;const reasons=[];
    if(delta<=2){score+=.55;reasons.push(delta<.5?(timezoneNormalized?'stesso orario dopo la correzione del fuso':'stesso orario di inizio'):`inizio a ${Math.round(delta)} min di distanza`);}
    else if(delta<=5){score+=.48;reasons.push(`inizio a ${Math.round(delta)} min di distanza`);}
    else if(delta<=15){score+=.35;reasons.push(`inizio a ${Math.round(delta)} min di distanza`);}
    else{score+=.22;reasons.push(`inizio a ${Math.round(delta)} min di distanza`);}
    const category=categoryAffinity(strava.category,whoop.category);if(category===1){score+=.2;reasons.push('stessa disciplina');}else if(category>.5){score+=.12;reasons.push('discipline compatibili');}
    const duration=durationAffinity(durationStrava(strava),durationWhoop(whoop));score+=duration.score*.23;if(duration.reason)reasons.push(duration.reason);
    if(score<.6)return null;return{score:round(score),reasons,deltaMinutes:+delta.toFixed(1),timezoneNormalized};
  }
  function scorePlan(unit,session){
    if(!unit||!session||unit.date!==session.date||session.demoDataset)return null;let score=0;const reasons=[];const category=categoryAffinity(unit.category,session.category);
    if(category===1){score+=.45;reasons.push('stessa categoria del piano');}else if(category>.5){score+=.34;reasons.push('categoria compatibile con il piano');}else if(category>.2){score+=.12;}else return null;
    const duration=durationAffinity(unit.durationMin,durationSession(session));score+=duration.score*.3;if(duration.reason)reasons.push(duration.reason);
    if(['completed','partial'].includes(session.outcome?.status)){score+=.18;reasons.push('esito manuale già registrato nello stesso giorno');}
    const title=titleAffinity(unit.name,session.title);if(title>=.5){score+=.18;reasons.push('titolo coerente con la seduta');}else if(title>0){score+=.08;}
    if(score<.5)return null;return{score:round(score),reasons};
  }
  function candidateKey(stravaId,whoopId,sessionId){return`strava:${stravaId||'-'}|whoop:${whoopId||'-'}|plan:${sessionId||'-'}`;}
  function hash(value){let result=2166136261;for(let index=0;index<value.length;index+=1){result^=value.charCodeAt(index);result=Math.imul(result,16777619);}return(result>>>0).toString(36);}
  function confidenceLabel(score){if(score>=.85)return'high';if(score>=.68)return'medium';return'low';}
  function buildReconciliationState(input={}){
    const decisions=Array.isArray(input.decisions)?input.decisions:[];const confirmed=decisions.filter(item=>item.status==='confirmed');const dismissedKeys=new Set(decisions.filter(item=>item.status==='dismissed').map(item=>item.key));
    const claimedStrava=new Set(confirmed.map(item=>item.stravaActivityId).filter(Boolean));const claimedWhoop=new Set(confirmed.map(item=>item.whoopWorkoutId).filter(Boolean));const claimedSessions=new Set(confirmed.map(item=>item.sessionId).filter(Boolean));const allStrava=Array.isArray(input.stravaActivities)?input.stravaActivities:[];const allWhoop=Array.isArray(input.whoopWorkouts)?input.whoopWorkouts:[];const allSessions=Array.isArray(input.sessions)?input.sessions:[];const stravaById=new Map(allStrava.map(item=>[item.id,item]));const whoopById=new Map(allWhoop.map(item=>[item.id,item]));const sessionById=new Map(allSessions.map(item=>[item.id,item]));
    const strava=allStrava.filter(item=>item?.id&&!claimedStrava.has(item.id));const whoop=allWhoop.filter(item=>item?.id&&!claimedWhoop.has(item.id));const sessions=allSessions.filter(item=>item?.id&&!claimedSessions.has(item.id)&&!item.demoDataset);
    const pairOptions=[];strava.forEach(activity=>whoop.forEach(workout=>{const match=scoreSourcePair(activity,workout);if(match)pairOptions.push({strava:activity,whoop:workout,...match});}));pairOptions.sort((a,b)=>b.score-a.score||a.deltaMinutes-b.deltaMinutes);
    const pairedStrava=new Set(),pairedWhoop=new Set(),pairs=[];pairOptions.forEach(option=>{if(pairedStrava.has(option.strava.id)||pairedWhoop.has(option.whoop.id))return;pairedStrava.add(option.strava.id);pairedWhoop.add(option.whoop.id);pairs.push(option);});
    const units=pairs.map(pair=>({strava:pair.strava,whoop:pair.whoop,date:pair.whoop.date||pair.strava.date,category:normalizeCategory(pair.strava.category!=='other'?pair.strava.category:pair.whoop.category),durationMin:durationWhoop(pair.whoop)||durationStrava(pair.strava),name:pair.strava.name||pair.whoop.name,pairScore:pair.score,pairReasons:pair.reasons}));
    strava.filter(item=>!pairedStrava.has(item.id)).forEach(item=>units.push({strava:item,whoop:null,date:item.date,category:normalizeCategory(item.category),durationMin:durationStrava(item),name:item.name,pairScore:null,pairReasons:[]}));
    whoop.filter(item=>!pairedWhoop.has(item.id)).forEach(item=>units.push({strava:null,whoop:item,date:item.date,category:normalizeCategory(item.category),durationMin:durationWhoop(item),name:item.name,pairScore:null,pairReasons:[]}));
    confirmed.filter(item=>!item.sessionId).forEach(decision=>{const sourceStrava=decision.stravaActivityId?stravaById.get(decision.stravaActivityId):null;const sourceWhoop=decision.whoopWorkoutId?whoopById.get(decision.whoopWorkoutId):null;if(!sourceStrava&&!sourceWhoop)return;units.push({strava:sourceStrava||null,whoop:sourceWhoop||null,date:sourceWhoop?.date||sourceStrava?.date||decision.date,category:normalizeCategory(sourceStrava?.category!=='other'&&sourceStrava?.category?sourceStrava.category:sourceWhoop?.category),durationMin:durationWhoop(sourceWhoop)||durationStrava(sourceStrava),name:sourceStrava?.name||sourceWhoop?.name,pairScore:null,pairReasons:['fonti già abbinate'],existingDecisionId:decision.id});});
    const extensionOptions=[];confirmed.filter(item=>item.sessionId&&Boolean(item.stravaActivityId)!==Boolean(item.whoopWorkoutId)).forEach(decision=>{const session=sessionById.get(decision.sessionId);if(!session)return;const existingStrava=decision.stravaActivityId?stravaById.get(decision.stravaActivityId):null,existingWhoop=decision.whoopWorkoutId?whoopById.get(decision.whoopWorkoutId):null;const alternatives=existingStrava?whoop.map(workout=>({strava:existingStrava,whoop:workout})):strava.map(activity=>({strava:activity,whoop:existingWhoop}));alternatives.forEach(option=>{const match=scoreSourcePair(option.strava,option.whoop);if(!match)return;const key=candidateKey(option.strava.id,option.whoop.id,session.id),score=round(match.score*.8+(Number(decision.confidence)||.5)*.2);extensionOptions.push({id:`reconciliation-${hash(key)}`,key,date:session.date,stravaActivityId:option.strava.id,whoopWorkoutId:option.whoop.id,sessionId:session.id,strava:option.strava,whoop:option.whoop,session,replacesDecisionId:decision.id,confidence:score,confidenceLabel:confidenceLabel(score),reasons:[...new Set(['nuova fonte compatibile con l’abbinamento già confermato',...match.reasons])]});});});
    const planOptions=[];units.forEach((unit,unitIndex)=>sessions.forEach(session=>{const match=scorePlan(unit,session);if(match)planOptions.push({unitIndex,session,...match});}));planOptions.sort((a,b)=>b.score-a.score);const usedUnits=new Set(),usedSessions=new Set(),planByUnit=new Map();planOptions.forEach(option=>{if(usedUnits.has(option.unitIndex)||usedSessions.has(option.session.id))return;usedUnits.add(option.unitIndex);usedSessions.add(option.session.id);planByUnit.set(option.unitIndex,option);});
    const allCandidates=[];units.forEach((unit,index)=>{
      const plan=planByUnit.get(index)||null;if(unit.existingDecisionId&&!plan)return;if(!unit.pairScore&&!plan)return;const key=candidateKey(unit.strava?.id,unit.whoop?.id,plan?.session.id);const score=unit.pairScore&&plan?round(unit.pairScore*.62+plan.score*.38):(unit.pairScore||plan.score);const reasons=[...new Set([...unit.pairReasons,...(plan?.reasons||[])])];
      allCandidates.push({id:`reconciliation-${hash(key)}`,key,date:unit.date,stravaActivityId:unit.strava?.id||null,whoopWorkoutId:unit.whoop?.id||null,sessionId:plan?.session.id||null,strava:unit.strava,whoop:unit.whoop,session:plan?.session||null,replacesDecisionId:unit.existingDecisionId||null,confidence:score,confidenceLabel:confidenceLabel(score),reasons});
    });
    const pool=[...extensionOptions,...allCandidates].filter(candidate=>!dismissedKeys.has(candidate.key)).sort((a,b)=>b.confidence-a.confidence||b.date.localeCompare(a.date));const suggestions=[],usedSuggestionStrava=new Set(),usedSuggestionWhoop=new Set(),usedSuggestionSessions=new Set();pool.forEach(candidate=>{if(candidate.stravaActivityId&&usedSuggestionStrava.has(candidate.stravaActivityId)||candidate.whoopWorkoutId&&usedSuggestionWhoop.has(candidate.whoopWorkoutId)||candidate.sessionId&&usedSuggestionSessions.has(candidate.sessionId))return;suggestions.push(candidate);if(candidate.stravaActivityId)usedSuggestionStrava.add(candidate.stravaActivityId);if(candidate.whoopWorkoutId)usedSuggestionWhoop.add(candidate.whoopWorkoutId);if(candidate.sessionId)usedSuggestionSessions.add(candidate.sessionId);});suggestions.sort((a,b)=>b.date.localeCompare(a.date)||b.confidence-a.confidence);const suggestedStrava=new Set(suggestions.map(item=>item.stravaActivityId).filter(Boolean));const suggestedWhoop=new Set(suggestions.map(item=>item.whoopWorkoutId).filter(Boolean));
    return{suggestions,confirmed,dismissed:decisions.filter(item=>item.status==='dismissed'),stats:{suggestions:suggestions.length,confirmed:confirmed.length,dismissed:dismissedKeys.size,unmatchedStrava:strava.filter(item=>!suggestedStrava.has(item.id)).length,unmatchedWhoop:whoop.filter(item=>!suggestedWhoop.has(item.id)).length,totalStrava:(input.stravaActivities||[]).length,totalWhoop:(input.whoopWorkouts||[]).length}};
  }
  function createReconciliationDecision(candidate,status,now=new Date()){
    if(!candidate||!['confirmed','dismissed'].includes(status))throw new TypeError('Decisione di riconciliazione non valida.');const timestamp=now instanceof Date?now.toISOString():new Date(now).toISOString();
    return{id:`reconciliation-${hash(candidate.key)}`,key:candidate.key,status,date:candidate.date,stravaActivityId:candidate.stravaActivityId||null,whoopWorkoutId:candidate.whoopWorkoutId||null,sessionId:candidate.sessionId||null,replacesDecisionId:candidate.replacesDecisionId||null,confidence:candidate.confidence,reasons:[...candidate.reasons],createdAt:timestamp,updatedAt:timestamp};
  }
  return{buildReconciliationState,createReconciliationDecision,scoreSourcePair,scorePlan,candidateKey,confidenceLabel};
});
