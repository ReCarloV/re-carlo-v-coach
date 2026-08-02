(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcAdaptiveApplicationModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const settingFields=['volumeFactor','aerobicVolumeFactor','longFactor','sessionDelta','physiologySessionDelta','organizationSessionDelta','qualityMode','strengthRir','strengthSetReduction','lowerBodyProtection','lowerBodyCaution','suspendRunning','suspendAllTraining','phaseMaxActiveSessions'];
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
  function stableValue(value){
    if(value===undefined)return undefined;if(value===null||typeof value==='string'||typeof value==='boolean')return value;
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    if(Array.isArray(value))return value.map(stableValue);
    if(typeof value==='object'){const result={};Object.keys(value).sort().forEach(key=>{const normalized=stableValue(value[key]);if(normalized!==undefined)result[key]=normalized;});return result;}
    return undefined;
  }
  function settingBasis(analysis){const settings={};settingFields.forEach(field=>{const value=analysis?.settings?.[field];if(value!==undefined)settings[field]=stableValue(value);});return settings;}
  function toleranceBasis(tolerance){
    if(!tolerance)return null;
    const target=item=>item?{eligible:Boolean(item.eligible),allowed:Boolean(item.allowed),factor:Number.isFinite(Number(item.factor))?Number(item.factor):null}:null;
    const checks=(Array.isArray(tolerance.checks)?tolerance.checks:[]).map(item=>({key:item?.key||null,passed:Boolean(item?.passed),required:item?.required!==false})).sort((a,b)=>String(a.key).localeCompare(String(b.key)));
    return{version:tolerance.version||null,status:tolerance.status||null,volume:target(tolerance.volume),long:target(tolerance.long),checks};
  }
  function recoveryBasis(recovery){
    if(!recovery)return null;
    return{level:recovery.level||'unavailable',usable:Boolean(recovery.usable),confidence:recovery.confidence||'low'};
  }
  function goalBasis(context){const goal=context?.goal;if(!goal)return null;return{id:goal.id||null,type:goal.type||null,variant:goal.variant||null,priority:goal.priority||null,date:goal.date||null};}
  function phaseBasis(context){if(!context)return null;return{constraintsVersion:context.version||null,standardVersion:context.standard?.version||null,key:context.phase?.key||null};}
  function programmingBasis(context){const value=context?.programming;if(!value)return null;return{version:value.version||null,key:value.key||null,status:value.status||null,evidenceVersion:value.evidenceVersion||null,overlay:stableValue(value.overlay??null)};}
  function basisFor(analysis={}){
    const context=analysis?.phaseConstraints||null;
    return stableValue({
      level:analysis.level||'steady',confidence:analysis.confidence||'low',settings:settingBasis(analysis),
      recovery:recoveryBasis(analysis.recovery),tolerance:toleranceBasis(analysis.tolerance),
      goal:goalBasis(context),phase:phaseBasis(context),programming:programmingBasis(context),limits:context?stableValue(context.limits||{}):null
    });
  }
  function stableAnalysis(analysis={}){return basisFor(analysis);}
  function hash(value){let result=2166136261;for(let index=0;index<value.length;index+=1){result^=value.charCodeAt(index);result=Math.imul(result,16777619);}return(result>>>0).toString(16).padStart(8,'0');}
  function signatureFor(analysis={}){return`adaptive-v2-${hash(JSON.stringify(stableAnalysis(analysis)))}`;}
  function same(left,right){return JSON.stringify(stableValue(left))===JSON.stringify(stableValue(right));}
  function changedBasis(previous,current){
    if(!previous)return['legacy-receipt'];const changed=[];
    if(previous.level!==current.level||!same(previous.settings,current.settings))changed.push('decision');
    if(previous.confidence!==current.confidence)changed.push('confidence');
    if(!same(previous.recovery,current.recovery))changed.push('recovery');
    if(!same(previous.tolerance,current.tolerance))changed.push('tolerance');
    if(!same(previous.goal,current.goal))changed.push('goal');
    if(!same(previous.phase,current.phase))changed.push('phase');
    if(!same(previous.programming,current.programming))changed.push('programming');
    if(!same(previous.limits,current.limits))changed.push('pack-limits');
    return changed.length?changed:['analysis-changed'];
  }
  function phaseReceipt(analysis){const context=analysis?.phaseConstraints;return context?{version:context.version||null,goalId:context.goal?.id||null,phaseKey:context.phase?.key||null,label:context.phase?.label||null}:null;}
  function applicationFor(analysis,weekStart,now=new Date()){
    const appliedAt=now instanceof Date?now.toISOString():new Date(now).toISOString();return{version:3,weekStart,appliedAt,signature:signatureFor(analysis),level:analysis?.level||'steady',confidence:analysis?.confidence||'low',phase:phaseReceipt(analysis),basis:basisFor(analysis)};
  }
  function markSessions(sessions,analysis,weekStart,now=new Date()){
    const application=applicationFor(analysis,weekStart,now);
    return(Array.isArray(sessions)?sessions:[]).map(session=>({...clone(session),coachApplication:{...application}}));
  }
  function applicationState(sessions,analysis,weekStart,options={}){
    const applications=(Array.isArray(sessions)?sessions:[]).map(item=>item?.coachApplication).filter(item=>item?.weekStart===weekStart).sort((a,b)=>String(b.appliedAt).localeCompare(String(a.appliedAt)));const latest=applications[0]||null,review=pendingOutcomeReview(sessions,weekStart,options);const reviewRequired=Boolean(review.required&&(!latest||String(review.trigger.observedAt)>String(latest.appliedAt)));
    const signature=signatureFor(analysis);if(!latest)return{applied:false,stale:false,application:null,signature,reviewRequired,reviewTrigger:reviewRequired?review.trigger:null,remainingCount:review.remainingCount,staleReason:reviewRequired?'key-outcome':null,staleReasons:reviewRequired?['key-outcome']:[]};
    const analysisChanged=latest.signature!==signature,analysisReasons=analysisChanged?changedBasis(latest.basis,basisFor(analysis)):[],staleReasons=reviewRequired?['key-outcome',...analysisReasons]:analysisReasons;return{applied:!analysisChanged&&!reviewRequired,stale:analysisChanged||reviewRequired,application:clone(latest),signature,reviewRequired,reviewTrigger:reviewRequired?review.trigger:null,remainingCount:review.remainingCount,staleReason:staleReasons[0]||null,staleReasons};
  }

  return{signatureFor,applicationFor,markSessions,applicationState,stableAnalysis,basisFor,changedBasis,isKeySession,isKeyOutcome,pendingOutcomeReview};
});
