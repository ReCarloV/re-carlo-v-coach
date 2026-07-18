(function(){
  'use strict';

  const STORAGE_KEY='rc-ui-theme-v1';
  const allowed=new Set(['auto','dark','light']);
  const system=window.matchMedia?.('(prefers-color-scheme: dark)')||null;
  let choice=readChoice();

  function readChoice(){
    try{
      const value=localStorage.getItem(STORAGE_KEY);
      return allowed.has(value)?value:'auto';
    }catch(_){
      return'auto';
    }
  }

  function resolved(value){
    if(value==='auto')return system?.matches?'dark':'light';
    return value;
  }

  function updateBrowserChrome(active){
    const color=active==='light'?'#f4f7fb':'#07101f';
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=color;
    const apple=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if(apple)apple.content=active==='light'?'default':'black-translucent';
  }

  function syncControls(){
    document.querySelectorAll('[data-theme-select]').forEach(select=>{select.value=choice;});
    document.querySelectorAll('[data-theme-choice]').forEach(button=>{
      const selected=button.dataset.themeChoice===choice;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }

  function apply(next,{persist=false,notify=false}={}){
    choice=allowed.has(next)?next:'auto';
    const active=resolved(choice);
    document.documentElement.dataset.themeChoice=choice;
    document.documentElement.dataset.theme=active;
    updateBrowserChrome(active);
    syncControls();
    if(persist){
      try{
        if(window.rcDataStore)window.rcDataStore.setDataset('uiTheme',choice);
        else localStorage.setItem(STORAGE_KEY,choice);
      }catch(_){
        try{localStorage.setItem(STORAGE_KEY,choice);}catch(__){}
      }
    }
    if(notify)document.dispatchEvent(new CustomEvent('rc:theme-updated',{detail:{choice,resolved:active}}));
  }

  function bind(){
    syncControls();
    document.querySelectorAll('[data-theme-select]').forEach(select=>select.addEventListener('change',()=>apply(select.value,{persist:true,notify:true})));
    document.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>apply(button.dataset.themeChoice,{persist:true,notify:true})));
  }

  apply(choice);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  system?.addEventListener?.('change',()=>{if(choice==='auto')apply('auto');});
  window.addEventListener('rc:data-restored',()=>apply(readChoice()));
  window.rcTheme={get:()=>({choice,resolved:resolved(choice)}),set:value=>apply(value,{persist:true,notify:true})};
})();
