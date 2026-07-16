(function(){
  const model=window.rcDemoDataModel;const store=window.rcDataStore;
  const loadButton=document.getElementById('load-demo-data');const removeButton=document.getElementById('remove-demo-data');const status=document.getElementById('demo-data-status');
  const datasetNames=['sessions','preSessionCheckins','weeklyAvailabilityHistory'];

  function current(){return Object.fromEntries(datasetNames.map(name=>[name,store.getDataset(name)]));}
  function showSaved(){const element=document.getElementById('toast');if(!element)return;element.classList.add('show');setTimeout(()=>element.classList.remove('show'),1800);}
  function writeAtomically(values){
    const before=current(),written=[];
    try{datasetNames.forEach(name=>{store.setDataset(name,values[name]);written.push(name);});}
    catch(error){let rollbackFailed=false;[...written].reverse().forEach(name=>{try{store.setDataset(name,before[name]);}catch(_){rollbackFailed=true;}});if(rollbackFailed)throw new Error('Scrittura interrotta e ripristino incompleto: usa il backup prima di continuare.');throw error;}
  }
  function counts(){const values=current();return {sessions:model.countDemo(values.sessions),checkins:model.countDemo(values.preSessionCheckins),weeks:model.countDemo(values.weeklyAvailabilityHistory)};}
  function render(){
    try{const value=counts(),active=value.sessions+value.checkins+value.weeks>0;status.classList.toggle('active',active);status.textContent=active?`${value.sessions} sedute, ${value.checkins} check-in e ${value.weeks} settimane demo presenti.`:'Nessun dato dimostrativo caricato.';loadButton.textContent=active?'Ripristina mese demo':'Carica giugno demo';removeButton.disabled=!active;}
    catch(_){status.classList.remove('active');status.textContent='I dati locali non sono leggibili: usa un backup valido prima di modificarli.';loadButton.disabled=true;removeButton.disabled=true;}
  }
  function refresh(reason){
    window.rcSessions?.reload?.();document.dispatchEvent(new CustomEvent('rc:pre-checkin-updated',{detail:{reason}}));document.dispatchEvent(new CustomEvent('rc:weekly-availability-history-updated',{detail:{reason}}));document.dispatchEvent(new CustomEvent('rc:sessions-updated',{detail:{reason}}));render();
  }
  function install(){
    const warnings=store.health().warnings||[];if(datasetNames.some(name=>warnings.includes(name))){window.alert('Uno degli storici necessari non è leggibile. Ripristina prima un backup valido.');return;}
    try{const merged=model.mergeDemoData(current());writeAtomically(merged);refresh('demo-installed');window.rcSessions?.showMonth?.(model.DEMO_MONTH);window.rcNavigation?.show?.('plan');showSaved();}
    catch(error){console.error('Caricamento dati demo non riuscito',error);window.alert(error.message||'Non è stato possibile aggiungere i dati dimostrativi.');}
  }
  function remove(){
    const value=counts();if(!value.sessions&&!value.checkins&&!value.weeks)return;
    if(!window.confirm(`Rimuovere tutti i dati dimostrativi?\n\nSaranno eliminati ${value.sessions} sedute, ${value.checkins} check-in e ${value.weeks} disponibilità demo. I dati personali resteranno invariati.`))return;
    try{writeAtomically(model.removeDemoData(current()));refresh('demo-removed');showSaved();}
    catch(error){console.error('Rimozione dati demo non riuscita',error);window.alert(error.message||'Non è stato possibile rimuovere i dati dimostrativi.');}
  }

  loadButton.addEventListener('click',install);removeButton.addEventListener('click',remove);
  ['rc:sessions-updated','rc:pre-checkin-updated','rc:weekly-checkin-updated','rc:weekly-availability-history-updated'].forEach(name=>document.addEventListener(name,render));
  window.rcDemoData={install,remove,render,counts};render();
})();
