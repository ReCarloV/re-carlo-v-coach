(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcSessionSelectionModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function selectedSet(values){return new Set([...(values||[])].map(String));}
  function toggle(values,id){const next=selectedSet(values);const key=String(id);if(next.has(key))next.delete(key);else next.add(key);return next;}
  function addVisible(values,ids){const next=selectedSet(values);(ids||[]).forEach(id=>next.add(String(id)));return next;}
  function prune(values,sessions){const valid=new Set((sessions||[]).map(item=>String(item.id)));return new Set([...selectedSet(values)].filter(id=>valid.has(id)));}
  function removeSelected(sessions,values){
    const selected=selectedSet(values);const deleted=[],remaining=[];
    (Array.isArray(sessions)?sessions:[]).forEach(session=>(selected.has(String(session.id))?deleted:remaining).push(session));
    return {sessions:remaining,deleted,deletedIds:deleted.map(item=>item.id)};
  }

  return {selectedSet,toggle,addVisible,prune,removeSelected};
});
