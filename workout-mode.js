(function(){
  const root=document.getElementById('workout-page');if(!root||!window.rcWorkoutModeModel)return;
  const modelApi=window.rcWorkoutModeModel;
  let selectedId=null,timerSeconds=90,timerRemaining=90,timerEndAt=null,timerInterval=null;

  function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function localDate(){const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
  function current(){return modelApi.buildWorkoutDay({today:localDate(),sessions:window.rcSessions?.getAll?.()||[],selectedId});}
  function formatDate(value){return new Date(`${value}T12:00:00`).toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'});}
  function button(label,className,handler){const node=element('button',className,label);node.type='button';node.addEventListener('click',handler);return node;}
  function sessionSwitcher(model){
    if(model.sessions.length<2)return null;const wrap=element('div','workout-switcher');wrap.append(element('small','','SEDUTE DI OGGI'));
    const choices=element('div','workout-switcher-choices');model.sessions.forEach(item=>{const choice=button(item.title,`workout-switch${item.id===model.selected.id?' active':''}`,()=>{selectedId=item.id;resetTimerFor(item);render();});choice.setAttribute('aria-pressed',String(item.id===model.selected.id));const dot=element('i',item.meta.css);choice.prepend(dot);choices.append(choice);});wrap.append(choices);return wrap;
  }
  function renderBlock(block,index){
    const card=element('article',`workout-block ${block.kind||'segment'}${block.intensity?` intensity-${block.intensity}`:''}${block.actual?' actual':''}`);const top=element('div','workout-block-top');const count=element('span','workout-block-number',String(index+1).padStart(2,'0'));const copy=element('div');copy.append(element('small','',block.actual?'ESEGUITO':block.eyebrow||'BLOCCO'),element('h3','',block.title||'Blocco'));top.append(count,copy);card.append(top);
    if(block.kind==='exercise'){const metrics=element('div','workout-exercise-metrics');(block.metrics||[]).forEach(value=>metrics.append(element('span','',value)));card.append(metrics);}
    else if(block.kind==='repeat'){const steps=element('div','workout-repeat-steps');(block.steps||[]).forEach((step,stepIndex)=>{const row=element('div',`workout-step intensity-${step.intensity||'easy'}`);row.append(element('b','',String(stepIndex+1)),element('span','',step.title),element('strong','',step.value));steps.append(row);});card.append(steps);}
    else card.append(element('p','',block.value||'Indicazioni da definire'));
    if(block.rest){const rest=element('button','workout-rest-shortcut',`⏱ ${block.rest}`);rest.type='button';rest.addEventListener('click',()=>{const seconds=modelApi.parseRestSeconds(block.rest);if(seconds){setTimer(seconds);startTimer();document.getElementById('workout-timer')?.scrollIntoView({behavior:'smooth',block:'center'});}});card.append(rest);}
    return card;
  }
  function timerLabel(){const value=document.getElementById('workout-timer-value');if(value)value.textContent=modelApi.formatTimer(timerRemaining);const toggle=document.getElementById('workout-timer-toggle');if(toggle)toggle.textContent=timerEndAt?'Pausa':'Avvia';}
  function stopTicker(){if(timerInterval){clearInterval(timerInterval);timerInterval=null;}}
  function tick(){
    if(!timerEndAt)return;timerRemaining=Math.max(0,Math.ceil((timerEndAt-Date.now())/1000));timerLabel();
    if(timerRemaining===0){timerEndAt=null;stopTicker();timerLabel();document.getElementById('workout-timer')?.classList.add('finished');setTimeout(()=>document.getElementById('workout-timer')?.classList.remove('finished'),900);if(navigator.vibrate)navigator.vibrate([120,80,120]);}
  }
  function setTimer(seconds){timerEndAt=null;stopTicker();timerSeconds=seconds;timerRemaining=seconds;document.querySelectorAll('.workout-timer-preset').forEach(item=>item.classList.toggle('active',Number(item.dataset.seconds)===seconds));timerLabel();}
  function startTimer(){if(timerEndAt){timerRemaining=Math.max(0,Math.ceil((timerEndAt-Date.now())/1000));timerEndAt=null;stopTicker();timerLabel();return;}if(timerRemaining<=0)timerRemaining=timerSeconds;timerEndAt=Date.now()+timerRemaining*1000;timerInterval=setInterval(tick,250);timerLabel();}
  function resetTimer(){setTimer(timerSeconds);}
  function resetTimerFor(session){const presets=modelApi.timerPresets(session);setTimer(presets.includes(90)?90:presets[0]||90);}
  function renderTimer(session){
    const card=element('aside','workout-timer-card');card.id='workout-timer';card.append(element('small','','TIMER RECUPERO'),element('strong','workout-timer-value',modelApi.formatTimer(timerRemaining)));card.querySelector('strong').id='workout-timer-value';
    const presets=element('div','workout-timer-presets');modelApi.timerPresets(session).forEach(seconds=>{const preset=button(modelApi.formatTimer(seconds),'workout-timer-preset',()=>setTimer(seconds));preset.dataset.seconds=seconds;preset.classList.toggle('active',seconds===timerSeconds);presets.append(preset);});
    const controls=element('div','workout-timer-controls');const toggle=button(timerEndAt?'Pausa':'Avvia','primary',startTimer);toggle.id='workout-timer-toggle';controls.append(toggle,button('Reset','ghost',resetTimer));card.append(presets,controls,element('p','','Tocca il recupero di un esercizio per avviarlo direttamente. Se l’app viene sospesa, il tempo si riallinea quando la riapri.'));return card;
  }
  function renderRest(model){
    timerEndAt=null;stopTicker();root.className='workout-page rest-day';const card=element('article','workout-rest-card');const mark=element('div','workout-rest-mark','REST');const copy=element('div');copy.append(element('small','','OGGI'),element('h2','','Rest day'),element('p','',model.next?`Prossima seduta: ${model.next.title} · ${formatDate(model.next.date)}.`:'Nessuna seduta programmata. Puoi aggiornare il piano quando vuoi.'));card.append(mark,copy,button(model.next?'Apri il piano':'Programma la settimana','primary',()=>window.rcNavigation?.show('plan')));root.replaceChildren(card);
  }
  function renderSession(model){
    const session=model.selected;root.className=`workout-page category-${session.meta.css}`;const switcher=sessionSwitcher(model);const hero=element('article','workout-hero');const copy=element('div','workout-hero-copy');const eyebrow=element('div','workout-hero-eyebrow');eyebrow.append(element('span',`workout-category ${session.meta.css}`,session.meta.kicker),element('span',`workout-status ${session.state.css}`,session.state.label));copy.append(eyebrow,element('h2','',session.title),element('p','',session.notes||`${session.meta.label} · ${session.priorityLabel}`));const metrics=element('div','workout-hero-metrics');[[session.timeRange,'ORARIO'],[session.displayDuration,'DURATA'],[session.priorityLabel.toUpperCase(),'PRIORITÀ']].forEach(([value,label])=>{const item=element('span');item.append(element('small','',label),element('strong','',value));metrics.append(item);});hero.append(copy,metrics);
    const layout=element('div','workout-layout');const main=element('section','workout-main');const head=element('div','workout-section-head');head.append(element('div','',''),element('span','',''));head.firstChild.append(element('small','','SESSIONE'),element('h2','',session.performed?'Quello che hai svolto':'Cosa fare oggi'));head.lastChild.textContent=`${session.blocks.length} ${session.blocks.length===1?'blocco':'blocchi'}`;main.append(head);const list=element('div','workout-blocks');session.blocks.forEach((block,index)=>list.append(renderBlock(block,index)));main.append(list);
    if(session.details?.accessoryNotes||session.details?.complementaryNotes||session.notes){const notes=element('article','workout-notes');notes.append(element('small','','NOTE'),element('p','',session.details?.accessoryNotes||session.details?.complementaryNotes||session.notes));main.append(notes);}
    const rail=element('div','workout-rail');rail.append(renderTimer(session));const actions=element('article','workout-actions-card');actions.append(element('small','','CHECK-IN'),element('h3','',session.performed?'Seduta registrata':'Quando sei pronto'));
    if(session.performed||session.outcome)actions.append(button('Apri registrazione','primary',()=>window.rcSessions?.openOutcome?.(session.id)));
    else actions.append(button('Check-in pre sessione','primary',()=>window.rcCheckins?.openPre?.(session.id)),button('Registra seduta','ghost',()=>window.rcSessions?.openOutcome?.(session.id)));
    actions.append(button('Modifica programmazione','workout-link',()=>window.rcSessions?.openEditor?.(session.id)));rail.append(actions);layout.append(main,rail);root.replaceChildren(...(switcher?[switcher]:[]),hero,layout);timerLabel();
  }
  function render(){const model=current();if(!model.selected){selectedId=null;renderRest(model);return;}selectedId=model.selected.id;renderSession(model);}

  ['rc:sessions-updated','rc:data-restored','rc:pre-checkin-updated'].forEach(name=>document.addEventListener(name,render));
  document.addEventListener('rc:view-changed',event=>{if(event.detail?.view==='workout')render();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
  render();
})();
