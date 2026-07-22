(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcAdaptiveApplicationModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const settingFields=['volumeFactor','longFactor','sessionDelta','qualityMode','strengthRir','strengthSetReduction','lowerBodyProtection','lowerBodyCaution','suspendRunning'];
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  function dateAtNoon(value){return new Date(`${value}T12:00:00`);}
  function dateKey(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function addDays(value,days){const date=dateAtNoon(value);date.setDate(date.getDate()+days);return dateKey(date);}
  function isKeySession(session){
    if(!session)return false;if(session.priority==='essential'||session.category==='test'||session.goalGenerated||session.details?.runType==='Race')return true;
    const text=`${session.title||''} ${session.details?.runType||''} ${session.details?.rideType||''} ${session.details?.strengthFocus||''}`.toLowerCase();
    if(session.category==='running'&&/long|lungo|interval|tempo|threshold|progress|quality|marathon|ripetut|soglia|medio/.test(text))return true;
    if(session.category==='cycling'&&/threshold|vo2|tempo|interval|brick|test|soglia/.test(text))return true;
    if(session.category==='strength'&&session.priority!=='optional'&&/lower|full|hyrox/.test(text))return true;
    return['hyrox','metcon'].includes(session.category)&&session.priority!=='optional';
  }
  function isKeyOutcome(session){return Boolean(session?.outcome&&isKeySession(session));}
  function outcomeObservedAt(session){const value=session?.outcome?.updatedAt||session?.outcome?.recordedAt||session?.updatedAt||null;if(!value)return null;const stamp=new Date(value);return Number.isNaN(stamp.getTime())?null:stamp.toISOString();}
  function pendingOutcomeReview(sessions,weekStart,options={}){
    const today=options.today||dateKey(new Date()),weekEnd=addDays(weekStart,6),items=Array.isArray(sessions)?sessions:[];
    const remaining=items.filter(item=>item.date>=weekStart&&item.date<=weekEnd&&item.date>=today&&!item.outcome&&item.adaptiveAdjustment?.status!=='paused');
    if(!remaining.length)return{required:false,trigger:null,remainingCount:0};
    const trigger=items.filter(item=>item.date>=weekStart&&item.date<=today&&isKeyOutcome(item)).map(item=>({sessionId:item.id,title:item.title||'Seduta chiave',date:item.date,status:item.outcome.status,rpe:item.outcome.rpe??null,pain:item.outcome.pain??null,execution:item.outcome.execution||null,observedAt:outcomeObservedAt(item)})).filter(item=>item.observedAt).sort((a,b)=>String(b.observedAt).localeCompare(String(a.observedAt)))[0]||null;
    return{required:Boolean(trigger),trigger:clone(trigger),remainingCount:remaining.length};
  }
  function stableAnalysis(analysis={}){
    const settings={};settingFields.forEach(field=>{const value=analysis?.settings?.[field];if(value!==undefined)settings[field]=value;});
    const phase=analysis?.phaseConstraints?{version:analysis.phaseConstraints.version||null,goalId:analysis.phaseConstraints.goal?.id||null,phaseKey:analysis.phaseConstraints.phase?.key||null}:null;return{level:analysis.level||'steady',settings,phase};
  }
  function hash(value){let result=2166136261;for(let index=0;index<value.length;index+=1){result^=value.charCodeAt(index);result=Math.imul(result,16777619);}return(result>>>0).toString(16).padStart(8,'0');}
  function signatureFor(analysis={}){return`adaptive-v1-${hash(JSON.stringify(stableAnalysis(analysis)))}`;}
  function markSessions(sessions,analysis,weekStart,now=new Date()){
    const appliedAt=now instanceof Date?now.toISOString():new Date(now).toISOString();const phase=analysis?.phaseConstraints?{version:analysis.phaseConstraints.version||null,goalId:analysis.phaseConstraints.goal?.id||null,phaseKey:analysis.phaseConstraints.phase?.key||null,label:analysis.phaseConstraints.phase?.label||null}:null;const application={version:2,weekStart,appliedAt,signature:signatureFor(analysis),level:analysis?.level||'steady',confidence:analysis?.confidence||'low',phase};
    return(Array.isArray(sessions)?sessions:[]).map(session=>({...clone(session),coachApplication:{...application}}));
  }
  function applicationState(sessions,analysis,weekStart,options={}){
    const applications=(Array.isArray(sessions)?sessions:[]).map(item=>item?.coachApplication).filter(item=>item?.weekStart===weekStart).sort((a,b)=>String(b.appliedAt).localeCompare(String(a.appliedAt)));const latest=applications[0]||null,review=pendingOutcomeReview(sessions,weekStart,options);const reviewRequired=Boolean(review.required&&(!latest||String(review.trigger.observedAt)>String(latest.appliedAt)));
    const signature=signatureFor(analysis);if(!latest)return{applied:false,stale:false,application:null,signature,reviewRequired,reviewTrigger:reviewRequired?review.trigger:null,remainingCount:review.remainingCount,staleReason:reviewRequired?'key-outcome':null};
    const analysisChanged=latest.signature!==signature;return{applied:!analysisChanged&&!reviewRequired,stale:analysisChanged||reviewRequired,application:clone(latest),signature,reviewRequired,reviewTrigger:reviewRequired?review.trigger:null,remainingCount:review.remainingCount,staleReason:reviewRequired?'key-outcome':analysisChanged?'analysis-changed':null};
  }

  return{signatureFor,markSessions,applicationState,stableAnalysis,isKeySession,isKeyOutcome,pendingOutcomeReview};
});
