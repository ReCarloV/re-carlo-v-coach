(function(){
  'use strict';
  const panel=document.getElementById('calendar-integration-panel');if(!panel)return;
  const title=document.getElementById('calendar-integration-title'),detail=document.getElementById('calendar-integration-detail'),meta=document.getElementById('calendar-integration-meta');
  const primary=document.getElementById('calendar-integration-primary'),copy=document.getElementById('calendar-integration-copy'),rotate=document.getElementById('calendar-integration-rotate'),disable=document.getElementById('calendar-integration-disable');
  let feedUrl=null,enabled=false,busy=false,statusLoaded=false,lastUser=false;

  function cloud(){return window.rcCloudSync;}
  function cloudState(){return cloud()?.state?.()||{user:false,mode:'signed-out'};}
  function render(message=''){
    const state=cloudState();lastUser=Boolean(state.user);panel.classList.toggle('active',enabled);panel.classList.remove('error');primary.disabled=busy;copy.disabled=busy;rotate.disabled=busy;disable.disabled=busy;
    if(!state.user){title.textContent='Piano nel calendario';detail.textContent='Accedi al cloud personale per creare un calendario privato aggiornato su Mac, iPhone e iPad.';meta.textContent='Nessun dato viene pubblicato senza attivazione';primary.textContent='Accedi al cloud';primary.hidden=false;copy.hidden=true;rotate.hidden=true;disable.hidden=true;return;}
    if(busy){title.textContent='Calendario in aggiornamento…';detail.textContent=message||'Sto preparando il collegamento privato.';meta.textContent='Attendi qualche secondo';primary.textContent='Attendi…';primary.hidden=false;copy.hidden=true;rotate.hidden=true;disable.hidden=true;return;}
    if(enabled&&feedUrl){title.textContent='Calendario Apple attivo';detail.textContent=message||'Ogni modifica sincronizzata al cloud aggiorna automaticamente gli eventi del Piano.';meta.textContent='Orario standard 09:00 · scegli iCloud e il colore giallo in Calendar';primary.textContent='Aggiungi ad Apple Calendar';primary.hidden=false;copy.hidden=false;rotate.hidden=false;disable.hidden=false;return;}
    title.textContent='Piano nel calendario';detail.textContent=message||'Crea un abbonamento privato e in sola lettura alle sedute del Piano.';meta.textContent=statusLoaded?'Non attivo · nessun allenamento esposto':'Controllo disponibilità…';primary.textContent='Attiva calendario';primary.hidden=false;copy.hidden=true;rotate.hidden=true;disable.hidden=true;
  }
  async function request(action,method='GET'){const api=cloud();if(!api?.requestEdgeFunction)throw new Error('Il collegamento cloud non è ancora pronto.');return api.requestEdgeFunction('training-calendar',action,{method});}
  async function refreshStatus(){
    if(!cloudState().user){enabled=false;feedUrl=null;statusLoaded=false;render();return;}
    try{const result=await request('status');enabled=Boolean(result.enabled);feedUrl=result.feedUrl||null;statusLoaded=true;render();}
    catch(error){statusLoaded=true;enabled=false;feedUrl=null;render(error?.message||'Calendario non disponibile.');panel.classList.add('error');}
  }
  function subscribe(){if(!feedUrl)return;const target=feedUrl.replace(/^https:/i,'webcal:');const link=document.createElement('a');link.href=target;link.rel='noopener';document.body.append(link);link.click();link.remove();meta.textContent='In Calendar scegli iCloud e il colore giallo';}
  async function enableFeed(){busy=true;render('Creo un indirizzo personale e revocabile.');let feedback='',failed=false;try{const result=await request('enable','POST');enabled=true;feedUrl=result.feedUrl;statusLoaded=true;feedback='Calendario pronto. Ora aggiungilo a Calendar e seleziona il colore giallo.';}catch(error){enabled=false;feedUrl=null;failed=true;feedback=error?.message||'Non è stato possibile attivare il calendario.';}finally{busy=false;render(feedback);if(failed)panel.classList.add('error');}}
  async function copyUrl(){if(!feedUrl)return;try{await navigator.clipboard.writeText(feedUrl);meta.textContent='Link copiato · trattalo come una password';}catch(_){window.prompt('Copia questo link privato:',feedUrl);}}
  async function rotateFeed(){if(!window.confirm('Rigenerare il link? Il calendario già aggiunto smetterà di aggiornarsi e dovrai iscriverti di nuovo.'))return;busy=true;render('Revoco il vecchio indirizzo e ne creo uno nuovo.');let feedback='',failed=false;try{const result=await request('rotate','POST');enabled=true;feedUrl=result.feedUrl;feedback='Nuovo link creato. Iscriviti nuovamente in Apple Calendar.';}catch(error){failed=true;feedback=error?.message||'Non è stato possibile rigenerare il link.';}finally{busy=false;render(feedback);if(failed)panel.classList.add('error');}}
  async function disableFeed(){if(!window.confirm('Disattivare il calendario? Gli eventi già scaricati possono restare visibili finché non annulli l’iscrizione in Calendar.'))return;busy=true;render('Disattivo l’accesso al feed.');let feedback='',failed=false;try{await request('disable','POST');enabled=false;feedUrl=null;statusLoaded=true;feedback='Calendario disattivato. Puoi anche annullare l’iscrizione nell’app Calendar.';}catch(error){failed=true;feedback=error?.message||'Non è stato possibile disattivare il calendario.';}finally{busy=false;render(feedback);if(failed)panel.classList.add('error');}}

  primary.addEventListener('click',()=>{if(!cloudState().user){cloud()?.show?.();return;}if(enabled&&feedUrl)subscribe();else enableFeed();});
  copy.addEventListener('click',copyUrl);rotate.addEventListener('click',rotateFeed);disable.addEventListener('click',disableFeed);
  document.addEventListener('rc:cloud-sync-state',event=>{const hasUser=Boolean(event.detail?.user);if(hasUser&&!lastUser)refreshStatus();else if(!hasUser){enabled=false;feedUrl=null;statusLoaded=false;render();}lastUser=hasUser;});
  render();setTimeout(()=>{if(cloudState().user)refreshStatus();},700);
})();
