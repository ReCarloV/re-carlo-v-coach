(function(){
  'use strict';
  const model=window.rcCloudSyncModel,store=window.rcDataStore,config=window.rcCloudConfig||{};
  const panel=document.getElementById('cloud-sync-panel'),title=document.getElementById('cloud-sync-title'),detail=document.getElementById('cloud-sync-detail'),meta=document.getElementById('cloud-sync-meta');
  const primary=document.getElementById('cloud-sync-primary'),syncNow=document.getElementById('cloud-sync-now'),signout=document.getElementById('cloud-sync-signout'),locationBadge=document.getElementById('data-location-badge'),headerStatus=document.getElementById('local-data-status');
  const modal=document.getElementById('cloud-sync-modal'),authView=document.getElementById('cloud-auth-view'),choiceView=document.getElementById('cloud-choice-view'),authForm=document.getElementById('cloud-auth-form'),authStatus=document.getElementById('cloud-auth-status');
  const configured=/^https:\/\/[^/]+\.supabase\.co\/?$/.test(String(config.supabaseUrl||''))&&String(config.supabasePublishableKey||'').length>20;
  const deviceName=model.safeDeviceName(/iphone|ipad|ipod/i.test(navigator.userAgent)?'iPhone personale':/macintosh/i.test(navigator.userAgent)?'Mac personale':'Dispositivo personale');
  let client=null,user=null,remote=null,baseRevision=null,baseFingerprint=null,mode=configured?'signed-out':'not-configured',busy=false,lastSyncAt=null,timer=null,localSyncTimer=null,pendingLocalChange=false;

  function snapshot(){return store.createCloudSnapshot();}
  function fingerprint(value=snapshot()){return model.fingerprintSnapshot(value);}
  function loadCursor(){const cursor=model.cursorForUser(store.getDataset('cloudSyncCursor'),user?.id);baseRevision=cursor?.revision??null;baseFingerprint=cursor?.fingerprint??null;lastSyncAt=cursor?.updatedAt??null;return cursor;}
  function rememberBase(revision,valueFingerprint,updatedAt){baseRevision=Number(revision);baseFingerprint=String(valueFingerprint||'');lastSyncAt=updatedAt||new Date().toISOString();if(user?.id&&Number.isInteger(baseRevision)&&baseRevision>=1&&baseFingerprint){try{store.setDataset('cloudSyncCursor',model.createCursor(user.id,baseRevision,baseFingerprint,lastSyncAt));}catch(_){}}}
  function formatTime(value){return value?new Date(value).toLocaleString('it-IT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—';}
  function setHeader(className,text){headerStatus.classList.remove('synced','pending','error','conflict');if(className)headerStatus.classList.add(className);headerStatus.querySelector('span').textContent=text;}
  function setMode(next,message){mode=next;if(message)detail.textContent=message;render();document.dispatchEvent(new CustomEvent('rc:cloud-sync-state',{detail:publicState()}));}
  function publicState(){return{configured,user:Boolean(user),mode,busy,pendingLocalChange,revision:baseRevision,lastSyncAt,deviceName};}
  function render(){
    panel.classList.remove('synced','pending','error','conflict');primary.hidden=false;primary.disabled=busy;syncNow.hidden=true;syncNow.disabled=busy;signout.hidden=!user;
    if(!configured){panel.classList.add('pending');title.textContent='iPhone · struttura pronta';detail.textContent='Manca soltanto il progetto cloud gratuito. I dati attuali restano esclusivamente sul Mac.';meta.textContent='Nessun dato trasferito';primary.textContent='Configurazione cloud richiesta';setHeader('', 'Dati locali');locationBadge.textContent='Solo su questo dispositivo';return;}
    if(!user){title.textContent='Sincronizzazione dispositivi';detail.textContent='Accedi con il tuo account personale per collegare Mac e iPhone.';meta.textContent='Disconnesso';primary.textContent='Accedi e collega';setHeader('', 'Dati locali');locationBadge.textContent='Solo su questo dispositivo';return;}
    locationBadge.textContent='Locale + cloud protetto';
    if(mode==='first-upload'){panel.classList.add('pending');title.textContent='Pronto per il primo caricamento';detail.textContent='La copia cloud è vuota. Porta nel cloud tutti i dati attuali di questo dispositivo.';meta.textContent=`${user.email||'Account collegato'} · ${deviceName}`;primary.textContent='Porta i dati nel cloud';setHeader('pending','Da sincronizzare');return;}
    if(mode==='choose'||mode==='conflict'){panel.classList.add('conflict');title.textContent=mode==='conflict'?'Modifiche da confrontare':'Scegli la copia iniziale';detail.textContent=mode==='conflict'?'Mac e cloud sono cambiati separatamente. Nessun dato verrà sovrascritto automaticamente.':'Su questo dispositivo e nel cloud sono presenti copie diverse.';meta.textContent=`Revisione cloud ${remote?.revision||'—'} · controllo richiesto`;primary.textContent='Confronta le copie';setHeader('conflict','Scelta richiesta');return;}
    if(mode==='error'){panel.classList.add('error');title.textContent='Sincronizzazione non disponibile';meta.textContent=navigator.onLine?'Controlla configurazione e account':'Questo dispositivo è offline';primary.textContent='Riprova';syncNow.hidden=false;setHeader('error','Sync non disponibile');return;}
    if(mode==='offline'){panel.classList.add('pending');title.textContent='Offline · dati salvati sul dispositivo';detail.textContent='Puoi continuare a usare l’app. Le modifiche verranno sincronizzate quando torna la connessione.';meta.textContent=`Ultima sincronizzazione ${formatTime(lastSyncAt)}`;primary.hidden=true;syncNow.hidden=false;setHeader('pending','Offline');return;}
    if(mode==='local-pending'){panel.classList.add('pending');title.textContent='Salvataggio nel cloud…';detail.textContent='La modifica è già salvata su questo dispositivo e sta raggiungendo la copia condivisa.';meta.textContent=`${deviceName} · sincronizzazione automatica`;primary.hidden=true;syncNow.hidden=true;setHeader('pending','Salvo nel cloud…');return;}
    panel.classList.add('synced');title.textContent=busy?'Sincronizzazione in corso…':'Mac e iPhone sincronizzati';detail.textContent='Piano, check-in, profilo e dati osservati usano una sola copia condivisa, mantenendo il funzionamento offline.';meta.textContent=`${user.email||'Account personale'} · rev. ${baseRevision||'—'} · ${formatTime(lastSyncAt||remote?.updated_at)}`;primary.hidden=true;syncNow.hidden=false;setHeader('synced',busy?'Sincronizzo…':'Cloud sincronizzato');
  }

  function openModal(view='auth'){
    authView.hidden=view!=='auth';choiceView.hidden=view!=='choice';modal.classList.add('open');modal.setAttribute('aria-hidden','false');
    if(view==='auth')setTimeout(()=>authForm.elements.email.focus(),0);
  }
  function closeModal(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');authStatus.textContent='';}
  function summaryText(item){const summary=model.snapshotSummary(item);return`${summary.sessions} sedute · ${summary.checkins} check-in · ${summary.whoopDays} giorni WHOOP · ${summary.goals} obiettivi${summary.exportedAt?` · ${formatTime(summary.exportedAt)}`:''}`;}
  function showChoice(){
    if(!remote?.payload)return;
    const local=snapshot(),localInfo=model.snapshotSummary(local),remoteInfo=model.snapshotSummary(remote.payload);
    document.getElementById('cloud-choice-alert').textContent=mode==='conflict'?'Sono state rilevate modifiche su entrambi i dispositivi. Scegli quale copia conservare come principale.':'Questo è il primo collegamento da questo dispositivo. Controlla le due copie prima di continuare.';
    document.getElementById('cloud-local-name').textContent=localInfo.athleteName||deviceName;document.getElementById('cloud-local-summary').textContent=summaryText(local);
    document.getElementById('cloud-remote-name').textContent=remoteInfo.athleteName||'Copia condivisa';document.getElementById('cloud-remote-summary').textContent=summaryText(remote.payload);
    openModal('choice');
  }

  async function fetchRemote(){
    const{data,error}=await client.from('athlete_snapshots').select('revision,payload,device_name,updated_at').maybeSingle();if(error)throw error;
    if(data?.payload)store.inspectBackup(data.payload);
    remote=data||null;return remote;
  }
  async function fetchRemoteResilient(){try{return await fetchRemote();}catch(error){if(!navigator.onLine)throw error;await new Promise(resolve=>setTimeout(resolve,450));return fetchRemote();}}

  async function persistSnapshot(current,expectedRevision){
      const currentFingerprint=fingerprint(current);const{data,error}=await client.rpc('push_athlete_snapshot',{expected_revision:Number(expectedRevision)||0,snapshot:current,source_device:deviceName});if(error)throw error;
      const result=Array.isArray(data)?data[0]:data;if(!result||result.status!=='saved'){await fetchRemote();setMode('conflict');return false;}
      remote={revision:Number(result.revision),payload:current,device_name:deviceName,updated_at:result.updated_at};rememberBase(remote.revision,currentFingerprint,result.updated_at);return true;
  }

  async function pushCurrent(expectedRevision){
    if(busy)return false;busy=true;render();
    try{
      const saved=await persistSnapshot(snapshot(),expectedRevision);if(saved)setMode('synced');return saved;
    }catch(error){detail.textContent=error?.message||'Non è stato possibile salvare la copia cloud.';setMode(navigator.onLine?'error':'offline');return false;}
    finally{busy=false;render();}
  }

  async function applyRemote(){
    if(!remote?.payload)return false;
    const accepted={...remote};store.inspectBackup(accepted.payload);store.restoreCloudSnapshot(accepted.payload);
    const restored=snapshot(),plan=model.planRemoteAcceptance({remoteSnapshot:accepted.payload,restoredSnapshot:restored,remoteRevision:accepted.revision});
    if(plan.requiresCloudRewrite){
      const saved=await persistSnapshot(restored,accepted.revision);if(!saved)return false;
    }else{
      remote={...accepted,payload:restored};rememberBase(plan.revision,plan.restoredFingerprint,accepted.updated_at);
    }
    setMode('synced');return true;
  }

  async function reconcile(){
    if(!user||busy)return;
    if(!navigator.onLine){setMode('offline');return;}
    busy=true;render();
    try{
      await fetchRemoteResilient();const localFingerprint=fingerprint();const remoteFingerprint=remote?fingerprint(remote.payload):null;
      const decision=model.decideSync({localFingerprint,remoteFingerprint,remoteRevision:remote?.revision??null,baseRevision,baseFingerprint});
      if(decision.action==='in-sync'){rememberBase(remote.revision,localFingerprint,remote.updated_at);setMode('synced');}
      else if(decision.action==='upload'&&decision.reason==='cloud-empty')setMode('first-upload');
      else if(decision.action==='upload'){busy=false;await pushCurrent(decision.expectedRevision);return;}
      else if(decision.action==='download'){await applyRemote();return;}
      else if(decision.action==='choose')setMode('choose');
      else setMode('conflict');
    }catch(error){detail.textContent=error?.message||'Non è stato possibile verificare la copia cloud.';setMode(navigator.onLine?'error':'offline');}
    finally{busy=false;render();}
  }

  function scheduleLocalSync(event){
    if(!model.shouldQueueLocalSync(event?.type,event?.detail)||!user||['choose','conflict','first-upload','signed-out'].includes(mode))return;
    pendingLocalChange=true;clearTimeout(localSyncTimer);
    if(!navigator.onLine){setMode('offline');return;}
    setMode('local-pending');localSyncTimer=setTimeout(flushLocalSync,180);
  }
  async function flushLocalSync(){
    clearTimeout(localSyncTimer);localSyncTimer=null;if(!pendingLocalChange||!user)return;
    if(busy){localSyncTimer=setTimeout(flushLocalSync,250);return;}
    pendingLocalChange=false;await reconcile();
  }

  async function connectSession(){
    const{data,error}=await client.auth.getSession();if(error)throw error;user=data.session?.user||null;
    if(user){loadCursor();setMode('pending');await reconcile();}else setMode('signed-out');
  }

  primary.addEventListener('click',async()=>{
    if(!configured){window.alert('La struttura iPhone è pronta. Ora devo collegarla al progetto cloud gratuito: nessun dato è ancora uscito dal Mac.');return;}
    if(!user){openModal('auth');return;}
    if(mode==='first-upload'){
      if(!window.confirm('Creare ora la prima copia condivisa? I dati locali resteranno disponibili su questo dispositivo.'))return;
      await pushCurrent(0);return;
    }
    if(mode==='choose'||mode==='conflict'){showChoice();return;}
    await reconcile();
  });
  syncNow.addEventListener('click',reconcile);
  signout.addEventListener('click',async()=>{if(!window.confirm('Disconnettere questo dispositivo? I dati locali e la copia cloud resteranno intatti.'))return;await client.auth.signOut();user=null;remote=null;baseRevision=null;baseFingerprint=null;lastSyncAt=null;setMode('signed-out');});
  document.getElementById('cloud-sync-close').addEventListener('click',closeModal);modal.addEventListener('click',event=>{if(event.target===modal)closeModal();});
  authForm.addEventListener('submit',async event=>{
    event.preventDefault();authStatus.textContent='Accesso in corso…';const values=new FormData(authForm);
    const{data,error}=await client.auth.signInWithPassword({email:String(values.get('email')||'').trim(),password:String(values.get('password')||'')});if(error){authStatus.textContent=error.message;return;}user=data.user;loadCursor();closeModal();await reconcile();
  });
  document.getElementById('cloud-create-account').addEventListener('click',async()=>{
    if(!authForm.reportValidity())return;authStatus.textContent='Creo l’account personale…';const values=new FormData(authForm);
    const{data,error}=await client.auth.signUp({email:String(values.get('email')||'').trim(),password:String(values.get('password')||''),options:{data:{display_name:'Atleta'}}});if(error){authStatus.textContent=error.message;return;}
    if(data.session){user=data.user;loadCursor();closeModal();await reconcile();}else authStatus.textContent='Account creato. Controlla l’email di conferma, poi torna qui e premi Accedi.';
  });
  document.getElementById('cloud-use-remote').addEventListener('click',async()=>{
    if(!remote||!window.confirm('Usare la copia cloud su questo dispositivo? La copia locale attuale verrà sostituita.'))return;
    closeModal();busy=true;render();
    try{await applyRemote();}
    catch(error){detail.textContent=error?.message||'Non è stato possibile applicare la copia cloud.';setMode(navigator.onLine?'error':'offline');}
    finally{busy=false;render();}
  });
  document.getElementById('cloud-use-local').addEventListener('click',async()=>{
    if(!remote||!window.confirm('Usare la copia di questo dispositivo come principale? La copia cloud attuale verrà sostituita.'))return;
    closeModal();await pushCurrent(remote.revision);
  });

  ['rc:sessions-updated','rc:goals-updated','rc:profile-updated','rc:body-issues-updated','rc:pre-checkin-updated','rc:weekly-checkin-updated','rc:weekly-availability-history-updated','rc:whoop-updated','rc:reconciliation-updated'].forEach(name=>document.addEventListener(name,scheduleLocalSync));window.addEventListener('rc:data-restored',scheduleLocalSync);
  window.addEventListener('online',()=>pendingLocalChange?flushLocalSync():reconcile());window.addEventListener('offline',()=>{if(user)setMode('offline');});document.addEventListener('visibilitychange',()=>{if(!user)return;if(document.hidden&&pendingLocalChange)flushLocalSync();else if(!document.hidden)pendingLocalChange?flushLocalSync():reconcile();});
  window.rcCloudSync={state:publicState,reconcile,flush:flushLocalSync,show:()=>user&&(mode==='choose'||mode==='conflict')?showChoice():openModal('auth')};

  if(configured&&window.supabase?.createClient){
    client=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    client.auth.onAuthStateChange((_event,session)=>{const next=session?.user||null;if((next?.id||null)!==(user?.id||null)){user=next;setTimeout(()=>{if(user){loadCursor();reconcile();}else setMode('signed-out');},0);}});
    connectSession().catch(error=>{detail.textContent=error?.message||'Accesso cloud non disponibile.';setMode('error');});
    timer=setInterval(()=>{if(user&&!document.hidden)reconcile();},30000);
  }else if(configured){detail.textContent='La libreria di sincronizzazione non è disponibile. L’app locale continua a funzionare.';setMode('error');}
  render();
})();
