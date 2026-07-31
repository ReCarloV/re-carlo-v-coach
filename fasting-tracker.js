(function(){
  const panel=document.getElementById('fasting-tracker-panel'),modal=document.getElementById('fasting-manual-modal'),form=document.getElementById('fasting-manual-form');
  if(!panel||!modal||!form||!window.rcDataStore||!window.rcFastingTrackerModel)return;
  const model=window.rcFastingTrackerModel;
  let expanded=false,timer=null;

  function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function records(){try{return window.rcDataStore.getDataset('fastingRecords')||[];}catch(_){return[];}}
  function notify(reason){document.dispatchEvent(new CustomEvent('rc:fasting-updated',{detail:{reason,updatedAt:new Date().toISOString()}}));}
  function save(next,reason){window.rcDataStore.setDataset('fastingRecords',next);notify(reason);render();}
  function localInputValue(date){const offset=date.getTimezoneOffset()*60000;return new Date(date-offset).toISOString().slice(0,16);}
  function displayDate(value){return new Date(value).toLocaleString('it-IT',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}
  function openManual(){
    const end=new Date(),start=new Date(end.getTime()-16*60*60*1000);form.elements.startedAt.value=localInputValue(start);form.elements.endedAt.value=localInputValue(end);form.querySelector('[role="alert"]').textContent='';modal.classList.add('open');modal.setAttribute('aria-hidden','false');form.elements.startedAt.focus();
  }
  function closeManual(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');}
  function action(label,className,handler){const button=element('button',className,label);button.type='button';button.addEventListener('click',handler);return button;}
  function removeRecord(record){
    const label=record.endedAt?`${displayDate(record.startedAt)} · ${model.formatDuration(model.durationMinutes(record))}`:`iniziato ${displayDate(record.startedAt)}`;
    if(window.confirm(`Eliminare il fasting ${label}?`))save(model.remove(records(),record.id),'fasting-removed');
  }
  function renderHistory(values){
    const completed=values.filter(item=>item.endedAt),wrap=element('div','fasting-history');
    const head=element('div','fasting-history-head');head.append(element('strong','',completed.length?'Storico personale':'Nessun fasting registrato'));
    if(completed.length>3)head.append(action(expanded?'Mostra meno':`Mostra tutti (${completed.length})`,'ghost small',()=>{expanded=!expanded;render();}));wrap.append(head);
    const shown=expanded?completed:completed.slice(0,3);
    shown.forEach(record=>{const row=element('div','fasting-history-row'),copy=element('div');copy.append(element('strong','',model.formatDuration(model.durationMinutes(record))),element('span','',`${displayDate(record.startedAt)} → ${displayDate(record.endedAt)}`));row.append(copy,action('Elimina','ghost small',()=>removeRecord(record)));wrap.append(row);});
    return wrap;
  }
  function render(){
    const values=model.sorted(records()),active=model.activeRecord(values);panel.replaceChildren();panel.className=`panel fasting-tracker-panel${active?' is-active':''}`;
    const head=element('div','panel-head'),copy=element('div');copy.append(element('small','','TRACKER PERSONALE'),element('h2','','Fasting'));
    const badge=element('span',`fasting-status${active?' active':''}`,active?'IN CORSO':'NON ATTIVO');head.append(copy,badge);panel.append(head);
    const body=element('div','fasting-body'),summary=element('div','fasting-summary');
    if(active){summary.append(element('strong','fasting-elapsed',model.formatDuration(model.durationMinutes(active))),element('span','',`Iniziato ${displayDate(active.startedAt)}`));const actions=element('div','fasting-actions');actions.append(action('Termina ora','primary',()=>{try{save(model.finish(values,new Date()).records,'fasting-finished');}catch(error){window.alert(error.message);}}),action('Annulla','ghost',()=>removeRecord(active)));body.append(summary,actions);}
    else{summary.append(element('strong','','Registro indipendente'),element('span','','Solo storico personale: non modifica Coach, piano o carico.'));const actions=element('div','fasting-actions');actions.append(action('Inizia ora','primary',()=>{try{save(model.start(values,new Date()).records,'fasting-started');}catch(error){window.alert(error.message);}}),action('Inserisci manualmente','ghost',openManual));body.append(summary,actions);}
    body.append(renderHistory(values));panel.append(body);
    if(timer)clearInterval(timer);timer=active?setInterval(()=>{const elapsed=panel.querySelector('.fasting-elapsed');if(elapsed)elapsed.textContent=model.formatDuration(model.durationMinutes(active));},60000):null;
  }

  form.addEventListener('submit',event=>{event.preventDefault();const feedback=form.querySelector('[role="alert"]');try{const data=new FormData(form),result=model.addManual(records(),{startedAt:data.get('startedAt'),endedAt:data.get('endedAt')},new Date());save(result.records,'fasting-added');closeManual();}catch(error){feedback.textContent=error.message;}});
  document.getElementById('fasting-manual-close').addEventListener('click',closeManual);document.getElementById('fasting-manual-cancel').addEventListener('click',closeManual);
  modal.addEventListener('click',event=>{if(event.target===modal)closeManual();});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modal.classList.contains('open'))closeManual();});
  ['rc:fasting-updated','rc:data-restored'].forEach(name=>document.addEventListener(name,render));
  render();
})();
