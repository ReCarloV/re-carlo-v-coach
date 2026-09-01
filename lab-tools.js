(function(){
  'use strict';
  const toggle=document.getElementById('lab-tools-toggle'),body=document.getElementById('lab-tools-body'),loadState=document.getElementById('lab-tools-load-state'),archiveStatus=document.getElementById('legacy-plan-archive-status');
  if(!toggle||!body)return;
  let assetsPromise=null;
  function stylesheet(src){if(document.querySelector(`link[href="${src}"]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=src;document.head.append(link);}
  function script(src){
    const existing=document.querySelector(`script[src="${src}"]`);if(existing?.dataset.loaded==='true')return Promise.resolve();
    return new Promise((resolve,reject)=>{const element=existing||document.createElement('script');element.addEventListener('load',()=>{element.dataset.loaded='true';resolve();},{once:true});element.addEventListener('error',()=>{element.remove();reject(new Error(`Impossibile caricare ${src}`));},{once:true});if(!existing){element.src=src;document.body.append(element);}});
  }
  function renderArchive(){
    if(!archiveStatus)return;
    try{const count=window.rcDataStore?.getDataset?.('retiredPlanSessions')?.length||0;archiveStatus.textContent=count?`${count} sedute del vecchio piano Excel sono conservate nell’archivio e nel backup.`:'Nessuna seduta Excel archiviata in questa copia.';}
    catch(_){archiveStatus.textContent='Archivio non leggibile: non verrà modificato.';}
  }
  function loadAssets(){
    if(assetsPromise)return assetsPromise;
    loadState.textContent='Apertura strumenti demo…';stylesheet('demo-data.css');
    assetsPromise=script('demo-data-model.js').then(()=>script('demo-data.js')).then(()=>{loadState.textContent='Ambiente demo caricato solo per questa apertura.';}).catch(error=>{assetsPromise=null;loadState.textContent='Ambiente demo non disponibile. Riprova quando sei online.';console.error('Caricamento laboratorio non riuscito',error);});
    return assetsPromise;
  }
  async function setOpen(open){body.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Chiudi laboratorio':'Apri laboratorio';if(open){renderArchive();await loadAssets();}}
  toggle.addEventListener('click',()=>setOpen(body.hidden));
  document.addEventListener('rc:data-restored',renderArchive);
})();
