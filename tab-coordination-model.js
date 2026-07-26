(function(root,factory){
  const model=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=model;
  if(root)root.rcTabCoordinationModel=model;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const ignoredKeys=new Set(['rc-cloud-sync-cursor-v1','rc-plan-view-v1','rc-ui-theme-v1']);

  function shouldPauseForStorageChange({key,oldValue,newValue,ownedKeys=[]}={}){
    if(key===null)return true;
    if(oldValue===newValue)return false;
    if(ignoredKeys.has(key))return false;
    return new Set(ownedKeys).has(key);
  }

  return{shouldPauseForStorageChange,IGNORED_KEYS:Object.freeze([...ignoredKeys])};
});
