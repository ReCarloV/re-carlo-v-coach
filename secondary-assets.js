(function(){
  'use strict';

  const bundles={
    recap:{styles:['recap.css'],scripts:['recap.js']},
    knowledge:{styles:['evidence-watch.css'],scripts:['evidence-watch.js']},
    data:{styles:['data-import.css','calendar-integration.css'],scripts:['data-import.js','whoop-import.js','reconciliation.js','calendar-integration.js','lab-tools.js']}
  };
  const loaded=new Set(),pending=new Map();

  function stylesheet(src){
    if(loaded.has(src)||document.querySelector(`link[href="${src}"]`)){loaded.add(src);return Promise.resolve();}
    return new Promise((resolve,reject)=>{const element=document.createElement('link');element.rel='stylesheet';element.href=src;element.addEventListener('load',()=>{loaded.add(src);resolve();},{once:true});element.addEventListener('error',()=>{element.remove();reject(new Error(`Impossibile caricare ${src}`));},{once:true});document.head.append(element);});
  }
  function script(src){
    if(loaded.has(src)||document.querySelector(`script[src="${src}"]`)?.dataset.loaded==='true'){loaded.add(src);return Promise.resolve();}
    return new Promise((resolve,reject)=>{const element=document.createElement('script');element.src=src;element.defer=true;element.addEventListener('load',()=>{element.dataset.loaded='true';loaded.add(src);resolve();},{once:true});element.addEventListener('error',()=>{element.remove();reject(new Error(`Impossibile caricare ${src}`));},{once:true});document.body.append(element);});
  }
  function ensure(view){
    const bundle=bundles[view];if(!bundle)return Promise.resolve();if(pending.has(view))return pending.get(view);
    const section=document.getElementById(view);section?.setAttribute('aria-busy','true');
    const task=Promise.all(bundle.styles.map(stylesheet)).then(()=>bundle.scripts.reduce((chain,src)=>chain.then(()=>script(src)),Promise.resolve())).then(()=>{section?.removeAttribute('data-load-error');document.dispatchEvent(new CustomEvent('rc:view-assets-ready',{detail:{view}}));}).catch(error=>{pending.delete(view);section?.setAttribute('data-load-error','true');console.error(`Caricamento vista ${view} non riuscito`,error);throw error;}).finally(()=>section?.removeAttribute('aria-busy'));
    pending.set(view,task);return task;
  }

  document.addEventListener('rc:view-changed',event=>ensure(event.detail?.view).catch(()=>{}));
  document.querySelectorAll('[data-view],[data-mobile-view]').forEach(control=>{const view=control.dataset.view||control.dataset.mobileView;['pointerdown','focusin'].forEach(name=>control.addEventListener(name,()=>ensure(view).catch(()=>{}),{once:true}));});
  const initial=window.location.hash.replace(/^#/,'')||document.querySelector('.view.active')?.id;queueMicrotask(()=>ensure(initial).catch(()=>{}));
  window.rcSecondaryAssets={ensure};
})();
