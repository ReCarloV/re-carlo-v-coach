(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcTrainingRoleModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='1.0.0';
  const qualityPattern=/(interval|tempo|threshold|progress|quality|marathon pace|ripetut|soglia|medio)/i;

  function roleFor(session={}){
    const details=session.details||{},title=String(session.title||''),category=session.category||'other';
    if(details.runType==='Race'||session.goalGenerated)return'race';
    if(details.triathlonRole)return details.triathlonRole;
    if(category==='swimming')return'tri-swim';
    if(category==='running'){
      if(details.runType==='Long run'||/\b(long|lungo)\b/i.test(title))return'long';
      return qualityPattern.test(`${details.runType||''} ${title}`)?'quality':'easy';
    }
    if(category==='strength'){
      const focus=String(details.strengthFocus||'').toLowerCase();
      if(focus==='upper body'||/^upper\b/.test(focus))return'strength-upper';
      if(focus==='lower body'||/^lower\b/.test(focus))return'strength-lower';
      return'strength';
    }
    if(details.athxRole||/\bathx\b/i.test(`${title} ${details.metconType||''}`))return'athx';
    if(category==='metcon'&&/\b(ocr|spartan|obstacle)\b/i.test(`${title} ${details.metconType||''}`))return'obstacle';
    if(category==='hyrox'||details.hyroxFormat||details.hyroxStructuredBlocks||/\bhyrox\b/i.test(`${title} ${details.metconType||''}`))return'hyrox';
    if(['metcon','cycling','recovery'].includes(category))return category;
    return category||'other';
  }

  return{VERSION,roleFor};
});
