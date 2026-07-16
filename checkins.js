(function(){
  const WEEKLY_KEY='rc-weekly-checkin-v1';
  const WEEKLY_HISTORY_KEY='rc-weekly-availability-history-v1';
  const PRE_KEY='rc-pre-session-checkins-v1';
  const weeklyModal=document.getElementById('weekly-checkin-modal');
  const preModal=document.getElementById('pre-checkin-modal');
  const weeklyForm=document.getElementById('weekly-checkin-form');
  const preForm=document.getElementById('pre-checkin-form');
  const checkinModel=window.rcCheckinModel;
  const returnFocus=new WeakMap();
  let activeSession=null;
  let activeCheckin=null;

  function parse(key,fallback){try{const value=JSON.parse(localStorage.getItem(key));return value??fallback;}catch(_){return fallback;}}
  function iso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function localDate(){return iso(new Date());}
  function mondayDate(){return mondayFor(localDate());}
  function mondayFor(value){const date=new Date(`${value}T12:00:00`);const day=date.getDay()||7;date.setDate(date.getDate()-day+1);return iso(date);}
  function focusable(modal){return [...modal.querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(item=>!item.disabled&&item.type!=='hidden'&&!item.closest('[hidden]'));}
  function open(modal){
    const current=document.activeElement;if(current&&current!==document.body)returnFocus.set(modal,current);
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');
    const title=document.getElementById(modal.getAttribute('aria-labelledby'));(title||focusable(modal)[0])?.focus();
  }
  function close(modal){
    modal.classList.remove('open');modal.setAttribute('aria-hidden','true');
    const target=returnFocus.get(modal);returnFocus.delete(modal);
    if(target?.isConnected)setTimeout(()=>target.focus(),0);
  }
  function handleModalKeys(event){
    const modal=event.currentTarget;
    if(event.key==='Escape'){event.preventDefault();close(modal);return;}
    if(event.key!=='Tab')return;
    const items=focusable(modal);if(!items.length){event.preventDefault();return;}
    const first=items[0],last=items[items.length-1];
    const active=document.activeElement,inSequence=items.includes(active);
    if(event.shiftKey&&(!inSequence||active===first)){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(!inSequence||active===last)){event.preventDefault();first.focus();}
  }

  function fillWeekly(options={}){
    const saved=parse(WEEKLY_KEY,null);const history=parse(WEEKLY_HISTORY_KEY,[]);const exact=options.weekStart?history.find(item=>item.weekStart===options.weekStart):null;
    const source={...(exact||saved||{}),...(options.values||{})};const weekStart=options.weekStart||source.weekStart||mondayDate();weeklyForm.reset();weeklyForm.elements.weekStart.value=weekStart;
    ['sessions','sessionMinutes','longRunMinutes','weekendLong','constraints'].forEach(name=>{if(source[name]!==undefined&&source[name]!==null)weeklyForm.elements[name].value=source[name];});
    if(Array.isArray(source.days)){const selected=new Set(source.days);weeklyForm.querySelectorAll('[name="days"]').forEach(input=>input.checked=selected.has(input.value));}
  }
  function openWeekly(options={}){fillWeekly(options);open(weeklyModal);}
  function renderWeekly(){
    const saved=parse(WEEKLY_KEY,null);const summary=document.getElementById('weekly-checkin-summary'),trigger=document.getElementById('open-weekly-checkin');summary.hidden=true;summary.replaceChildren();
    if(!saved){trigger.textContent='Check-in settimana';return;}
    trigger.textContent=`Disponibilità · ${saved.sessions} sedute`;
    document.getElementById('plan-intro').textContent=`Settimana impostata su ${saved.sessions} sedute. Il piano proteggerà lungo, qualità e forza essenziale nei giorni disponibili.`;
  }

  function todayCheckins(sessionId=null){
    return checkinModel.checkinsForDate(parse(PRE_KEY,[]),localDate()).sort((a,b)=>{
      const linkedDifference=(sessionId&&b.sessionId===sessionId?1:0)-(sessionId&&a.sessionId===sessionId?1:0);
      return linkedDifference||new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt);
    });
  }
  function renderIssueInputs(savedReadings=[]){
    const container=document.getElementById('active-issue-checkins');const current=window.rcBodyIssues?.active?.()||[];const saved=new Map((savedReadings||[]).map(item=>[item.id,item]));container.replaceChildren();
    if(!current.length){const text=document.createElement('span');text.className='no-active-issues';text.textContent='Nessun fastidio attivo nel profilo: il check-in non richiede valutazioni locali.';container.append(text);return;}
    const statuses=new Map(current.map(issue=>[issue.id,window.rcBodyIssues.status(issue)]));const staleCount=[...statuses.values()].filter(status=>status.requiresUpdate).length;
    const title=document.createElement('strong');title.textContent='Fastidi attualmente monitorati';const help=document.createElement('p');help.textContent=staleCount?'I valori non aggiornati sono vuoti: inseriscili di nuovo per confermare come stai oggi.':'Aggiorna soltanto le zone che hai scelto di seguire nel profilo.';const fields=document.createElement('div');fields.className='active-issue-inputs';
    current.forEach(issue=>{const status=statuses.get(issue.id);const label=document.createElement('label');label.className=`issue-checkin-field${status.requiresUpdate?' stale':''}`;const name=document.createElement('span');name.className='issue-checkin-name';const zone=document.createElement('b');zone.textContent=issue.zoneLabel;const recency=document.createElement('small');recency.textContent=`${status.label} · ${status.ageLabel}`;name.append(zone,recency);const input=document.createElement('input');input.type='number';input.min='0';input.max='10';input.required=true;input.name=`issue-${issue.id}`;if(saved.has(issue.id))input.value=saved.get(issue.id).pain;else if(!status.requiresUpdate)input.value=status.latestPain;else input.placeholder=status.latestPain===null?'0–10':`ultimo ${status.latestPain}/10`;input.setAttribute('aria-label',`${issue.zoneLabel} dolore attuale da 0 a 10`);label.append(name,input);fields.append(label);});container.append(title,help,fields);
  }
  function renderPreContext(){
    const context=document.getElementById('pre-session-context');
    if(!activeSession){context.hidden=true;context.replaceChildren();return;}
    context.hidden=false;const title=document.createElement('strong');title.textContent=activeSession.title;const detail=document.createElement('span');detail.textContent=`${activeSession.durationMin} min previsti · ${checkinModel.formatItalianDate(activeSession.date)}`;context.replaceChildren(title,detail);
  }
  function fillPre(){
    preForm.reset();
    const values=activeCheckin||{};
    ['energy','fatigue','soreness','motivation'].forEach(name=>{if(values[name]!==undefined&&values[name]!==null)preForm.elements[name].value=values[name];});
    const available=values.availableMinutes??activeSession?.durationMin??75;
    preForm.elements.availableMinutes.value=checkinModel.clampDuration(available);
    preForm.elements.notes.value=values.notes||'';
    renderIssueInputs(values.issueReadings||[]);renderPreContext();
    const result=document.getElementById('pre-checkin-result');result.hidden=true;result.replaceChildren();
    document.getElementById('pre-checkin-submit').textContent=activeCheckin?'Aggiorna valutazione':'Valuta la seduta';
  }
  function openPre(sessionId=null){
    activeSession=(window.rcSessions?.getAll?.()||[]).find(item=>item.id===sessionId)||null;
    const sessionDate=activeSession?.date||localDate();
    activeCheckin=checkinModel.findCheckin(parse(PRE_KEY,[]),activeSession?.id||null,sessionDate,{fallbackGeneric:Boolean(activeSession)});
    fillPre();open(preModal);
  }
  function readingsChanged(previous=[],next=[]){
    const before=new Map((previous||[]).map(item=>[item.id,Number(item.pain)]));
    return next.length!==before.size||next.some(item=>before.get(item.id)!==Number(item.pain));
  }

  document.getElementById('open-weekly-checkin').addEventListener('click',()=>openWeekly());
  document.querySelectorAll('[data-close-checkin]').forEach(button=>button.addEventListener('click',()=>close(button.dataset.closeCheckin==='weekly'?weeklyModal:preModal)));
  [weeklyModal,preModal].forEach(modal=>modal.addEventListener('keydown',handleModalKeys));
  weeklyForm.addEventListener('submit',event=>{
    event.preventDefault();const data=new FormData(weeklyForm);
    const warnings=window.rcDataStore?.health?.().warnings||[];if(warnings.includes('weeklyCheckin')||warnings.includes('weeklyAvailabilityHistory')){window.alert('Lo storico delle disponibilità non è leggibile. Ripristina prima un backup valido per evitare di sovrascriverlo.');return;}
    const now=new Date().toISOString();const weekStart=mondayFor(data.get('weekStart'));
    const draft={weekStart,sessions:Number(data.get('sessions')),sessionMinutes:Number(data.get('sessionMinutes')),longRunMinutes:Number(data.get('longRunMinutes')),days:data.getAll('days'),weekendLong:data.get('weekendLong'),constraints:data.get('constraints').trim()};
    const saved=checkinModel.upsertWeeklyAvailability(parse(WEEKLY_HISTORY_KEY,[]),draft,{now});
    localStorage.setItem(WEEKLY_KEY,JSON.stringify(saved.value));localStorage.setItem(WEEKLY_HISTORY_KEY,JSON.stringify(saved.history));renderWeekly();close(weeklyModal);toast();document.dispatchEvent(new CustomEvent('rc:weekly-checkin-updated',{detail:{weekStart:saved.value.weekStart}}));
  });
  preForm.addEventListener('submit',event=>{
    event.preventDefault();const data=new FormData(preForm);const current=window.rcBodyIssues?.active?.()||[];
    const issueReadings=current.map(issue=>({id:issue.id,zone:issue.zone,zoneLabel:issue.zoneLabel,region:checkinModel.regionForIssue(issue),pain:Number(data.get(`issue-${issue.id}`))}));const worst=issueReadings.slice().sort((a,b)=>b.pain-a.pain)[0];
    const draft={id:activeCheckin?.id,createdAt:activeCheckin?.createdAt,sessionId:activeSession?.id||null,sessionDate:activeSession?.date||localDate(),energy:Number(data.get('energy')),fatigue:Number(data.get('fatigue')),soreness:Number(data.get('soreness')),motivation:Number(data.get('motivation')),availableMinutes:Number(data.get('availableMinutes')),notes:data.get('notes').trim(),issueReadings,maxIssuePain:worst?.pain||0,worstIssue:worst?.zoneLabel||''};
    draft.recommendation=checkinModel.recommendation(draft,activeSession);
    const previous=activeCheckin;const now=new Date().toISOString();const saved=checkinModel.upsertCheckin(parse(PRE_KEY,[]),draft,{now,idFactory:()=>globalThis.crypto?.randomUUID?.()||`pre-${Date.now()}`});
    localStorage.setItem(PRE_KEY,JSON.stringify(saved.history));activeCheckin=saved.value;
    if(issueReadings.length&&(!previous||readingsChanged(previous.issueReadings,issueReadings)))window.rcBodyIssues.recordReadings(issueReadings);
    const result=document.getElementById('pre-checkin-result');result.className=`checkin-result ${activeCheckin.recommendation.level}`;result.replaceChildren();const title=document.createElement('strong');title.textContent=activeCheckin.recommendation.title;const text=document.createElement('p');text.textContent=activeCheckin.recommendation.text;result.append(title,text);result.hidden=false;
    document.getElementById('pre-checkin-submit').textContent='Aggiorna valutazione';toast();document.dispatchEvent(new CustomEvent('rc:pre-checkin-updated',{detail:{id:activeCheckin.id,sessionId:activeCheckin.sessionId,sessionDate:activeCheckin.sessionDate}}));
  });
  document.addEventListener('rc:body-issues-updated',()=>{if(preModal.classList.contains('open'))renderIssueInputs(activeCheckin?.issueReadings||[]);});
  window.addEventListener('rc:data-restored',()=>{activeSession=null;activeCheckin=null;renderWeekly();renderIssueInputs();});
  window.rcCheckins={openPre,openWeekly,getHistory:()=>structuredClone(parse(PRE_KEY,[])),getAvailabilityHistory:()=>structuredClone(parse(WEEKLY_HISTORY_KEY,[])),today:sessionId=>structuredClone(todayCheckins(sessionId))};
  renderWeekly();renderIssueInputs();
})();
