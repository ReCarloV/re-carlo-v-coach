(function(){
  'use strict';
  const model=window.rcTabCoordinationModel,core=window.rcDataStoreCore;
  const guard=document.getElementById('tab-stale-guard'),refresh=document.getElementById('tab-stale-refresh'),shell=document.querySelector('.shell');
  if(!model||!core?.ALL_KEYS||!guard||!refresh)return;
  let stale=false,focusTimer=null;

  function markStale(detail={}){
    if(stale)return;
    stale=true;
    shell?.setAttribute('inert','');
    document.body.classList.add('dialog-open','tab-data-stale');
    guard.classList.add('open');
    guard.setAttribute('aria-hidden','false');
    window.dispatchEvent(new CustomEvent('rc:tab-stale',{detail}));
    focusTimer=setTimeout(()=>refresh.focus(),0);
  }

  function reload(){
    refresh.disabled=true;
    refresh.textContent='Aggiornamento…';
    window.location.reload();
  }

  window.addEventListener('storage',event=>{
    if(model.shouldPauseForStorageChange({key:event.key,oldValue:event.oldValue,newValue:event.newValue,ownedKeys:core.ALL_KEYS}))markStale({key:event.key,source:'storage'});
  });
  window.addEventListener('pageshow',event=>{if(event.persisted)window.location.reload();});
  refresh.addEventListener('click',reload);
  window.addEventListener('beforeunload',()=>clearTimeout(focusTimer));
  window.rcTabCoordination={isStale:()=>stale,markStale,reload};
})();
