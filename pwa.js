(function(){
  'use strict';
  const installButton=document.getElementById('pwa-install');let deferred=null;
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  function standalone(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;}
  function render(){
    if(!installButton)return;
    installButton.hidden=standalone();
    installButton.disabled=!deferred&&!ios;
    installButton.textContent=ios?'Come installarla su iPhone':'Installa app';
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;render();});
  installButton?.addEventListener('click',async()=>{
    if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;render();return;}
    window.alert('Su iPhone apri questa pagina in Safari, tocca Condividi, poi “Aggiungi alla schermata Home” e attiva “Apri come app web”.');
  });
  if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
  render();
})();
