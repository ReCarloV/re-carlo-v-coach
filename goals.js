(function(){
  'use strict';

  const model=window.rcGoalsModel,eventModel=window.rcEventDemandModel,store=window.rcDataStore;
  if(!model||!store)return;
  const form=document.getElementById('goal-form'),modal=document.getElementById('goal-modal'),goalKey=window.rcDataStoreCore?.DATASETS?.goals?.key||'rc-goals-v1';
  let goals=[];

  function localDate(){return model.iso(new Date());}
  function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function safeDataset(name,fallback){try{return store.getDataset(name)??fallback;}catch(_){return fallback;}}
  function read(){try{return store.getDataset('goals')||[];}catch(_){return[];}}
  function sessions(){return window.rcSessions?.getAll?.()||[];}
  function formatDate(key,options={day:'numeric',month:'long',year:'numeric'}){return new Date(`${key}T12:00:00`).toLocaleDateString('it-IT',options);}
  function dateBox(key){const date=new Date(`${key}T12:00:00`);return`<div class="goal-list-item-date"><small>${date.toLocaleDateString('it-IT',{month:'short'}).replace('.','')}</small><strong>${String(date.getDate()).padStart(2,'0')}</strong></div>`;}
  function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
  function goalId(){return`goal-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}
  function toast(message='Obiettivo salvato'){const node=document.getElementById('toast');node.textContent=message;node.classList.add('show');setTimeout(()=>node.classList.remove('show'),1900);}
  function save(next,reason){store.setDataset('goals',next);goals=read();document.dispatchEvent(new CustomEvent('rc:goals-updated',{detail:{reason}}));render();}
  function ensureInferredGoal(){if(localStorage.getItem(goalKey)!==null)return;const inferred=model.inferGoalFromPlan(sessions(),{today:localDate()});if(inferred)save([inferred],'goal-inferred-from-plan');}
  function synchronizeGoalDates(){const current=read(),result=model.syncGoalDates(current,sessions());if(!result.changed)return false;store.setDataset('goals',result.goals);goals=result.goals;document.dispatchEvent(new CustomEvent('rc:goals-updated',{detail:{reason:'goal-date-synced-to-race'}}));return true;}
  function synchronizeGoalSessions(){read().filter(goal=>goal.status==='planned').forEach(goal=>window.rcSessions?.syncGoalSession?.(goal));}
  function defaultTrainingAvailability(){
    const history=safeDataset('weeklyAvailabilityHistory',[]),latest=[...history].filter(Boolean).sort((a,b)=>String(b.weekStart||'').localeCompare(String(a.weekStart||'')))[0]||{};
    const allowedDays=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'],days=Array.isArray(latest.days)?latest.days.filter(day=>allowedDays.includes(day)):[],selectedDays=days.length?days:['Lun','Mer','Gio','Sab','Dom'];
    return{sessions:Math.max(1,Math.min(6,Number(latest.sessions)||5,selectedDays.length)),sessionMinutes:Math.max(30,Math.min(180,Number(latest.sessionMinutes)||60)),longRunMinutes:Math.max(30,Math.min(360,Number(latest.longRunMinutes)||150)),days:selectedDays,weekendLong:['yes','no','maybe'].includes(latest.weekendLong)?latest.weekendLong:'yes',constraints:String(latest.constraints||'')};
  }
  function close(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');}
  function toggleResult(){form.querySelector('.goal-result-field').hidden=form.elements.status.value!=='completed';form.querySelector('.goal-plan-availability').hidden=form.elements.status.value!=='planned';}
  function eventLabel(goal){return eventModel?.variantFor?.(goal)?.label||model.typeLabels[goal?.type]||goal?.type||'Obiettivo';}
  function syncVariantOptions(selected=''){
    const field=document.getElementById('goal-variant-field'),select=form.elements.variant,hint=document.getElementById('goal-variant-hint'),items=eventModel?.variantsFor?.(form.elements.type.value)||[];
    field.hidden=!items.length;select.replaceChildren();hint.textContent='';if(!items.length)return;
    const blank=element('option','','Formato non ancora specificato');blank.value='';select.append(blank);
    items.forEach(item=>{const option=element('option','',item.label);option.value=item.key;select.append(option);});
    const desired=selected||eventModel?.defaultVariantForType?.(form.elements.type.value)||'';
    if(desired&&!items.some(item=>item.key===desired)){const legacy=element('option','',`Formato salvato · ${desired}`);legacy.value=desired;select.append(legacy);}
    select.value=desired;const item=items.find(candidate=>candidate.key===select.value);hint.textContent=item?.formatSummary||'Senza formato il dossier mantiene un profilo generico e a confidenza più bassa.';
  }
  function open(goal=null,registerResult=false){
    form.reset();form.elements.id.value=goal?.id||'';form.elements.name.value=goal?.name||'';form.elements.type.value=goal?.type||'marathon';syncVariantOptions(goal?.variant||'');form.elements.date.value=goal?.date||'';form.elements.priority.value=goal?.priority||'A';form.elements.status.value=registerResult?'completed':goal?.status||'planned';form.elements.target.value=goal?.target||'';form.elements.result.value=goal?.result||'';form.elements.notes.value=goal?.notes||'';
    const availability=goal?.trainingAvailability||defaultTrainingAvailability();form.elements.planSessions.value=availability.sessions;form.elements.planSessionMinutes.value=availability.sessionMinutes;form.elements.planLongMinutes.value=availability.longRunMinutes;form.elements.planWeekendLong.value=availability.weekendLong;form.elements.planConstraints.value=availability.constraints||'';form.querySelectorAll('[name="planDays"]').forEach(input=>input.checked=availability.days.includes(input.value));
    document.getElementById('goal-form-title').textContent=registerResult?'Registra il risultato':goal?'Modifica obiettivo':'Nuovo obiettivo';document.getElementById('goal-delete').hidden=!goal;toggleResult();modal.classList.add('open');modal.setAttribute('aria-hidden','false');setTimeout(()=>form.elements.name.focus(),0);
  }
  function renderSidebar(current){
    const name=document.getElementById('sidebar-goal-name'),summary=document.getElementById('sidebar-goal-summary');if(!current){name.textContent='Nessun obiettivo';summary.textContent='Aggiungi la prossima gara';return;}
    const days=Math.max(0,model.daysBetween(localDate(),current.date));name.textContent=current.name;summary.textContent=[current.target||null,days===0?'oggi':days===1?'domani':`${days} giorni`].filter(Boolean).join(' · ');
  }
  function renderKeySessions(items){
    const holder=document.getElementById('goal-key-sessions');if(!items.length){holder.innerHTML='<div class="goal-empty-list">Nessuna seduta essenziale futura collegata al piano.</div>';return;}
    holder.innerHTML=items.map(item=>`<div class="goal-list-item">${dateBox(item.date)}<div class="goal-list-item-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.coachPlan?.phaseLabel||item.planImport?.phase||model.typeLabels[item.category]||item.category)} · ${item.durationMin} min${Number(item.details?.distanceKm)>0?` · ${Number(item.details.distanceKm)} km`:''}</span></div><span class="goal-priority ${item.priority==='essential'?'A':'B'}">${item.priority==='essential'?'KEY':'IMP'}</span></div>`).join('');
  }
  function renderUpcoming(items){
    const holder=document.getElementById('goal-upcoming-list');if(!items.length){holder.innerHTML='<div class="goal-empty-list">Nessun altro appuntamento inserito.</div>';return;}
    const priorityLabel={B:'Gara importante',C:'Gara preparatoria'};
    holder.innerHTML=items.map(item=>`<div class="goal-list-item">${dateBox(item.date)}<div class="goal-list-item-copy"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(priorityLabel[item.priority]||model.typeLabels[item.type]||'Obiettivo')} · ${escapeHtml(eventLabel(item))}${item.target?` · ${escapeHtml(item.target)}`:''}</span></div><div class="goal-list-actions"><span class="goal-priority ${escapeHtml(item.priority)}">PRIORITÀ ${escapeHtml(item.priority)}</span><button class="goal-list-action" type="button" data-edit-goal="${escapeHtml(item.id)}">Modifica</button></div></div>`).join('');
  }
  function renderAttention(items){
    const panel=document.getElementById('goal-attention-panel'),holder=document.getElementById('goal-attention-list');panel.hidden=!items.length;if(!items.length){holder.replaceChildren();return;}
    holder.innerHTML=items.map(item=>`<div class="goal-list-item">${dateBox(item.date)}<div class="goal-list-item-copy"><strong>${escapeHtml(item.name)}</strong><span>La gara non viene archiviata finché non registri esplicitamente il risultato.</span></div><button class="primary small" type="button" data-result-goal="${escapeHtml(item.id)}">Registra risultato</button></div>`).join('');
  }
  function renderHistory(items){
    const holder=document.getElementById('goal-history-list');if(!items.length){holder.innerHTML='<div class="goal-empty-list">Lo storico si costruirà dopo la prima gara conclusa.</div>';return;}
    holder.innerHTML=items.map(item=>`<button class="goal-history-card" type="button" data-edit-goal="${escapeHtml(item.id)}"><span><small>${escapeHtml(formatDate(item.date))} · ${item.status==='cancelled'?'ANNULLATA':'COMPLETATA'}</small><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.target||eventLabel(item))}</span></span><span class="goal-history-result">${escapeHtml(item.result||'Nessun risultato inserito')}</span></button>`).join('');
  }
  function render(){
    goals=read();const allSessions=sessions(),classified=model.classifyGoals(goals,localDate()),current=classified.current,dashboard=model.goalDashboard(current,allSessions,localDate());renderSidebar(current);renderAttention(classified.awaitingResult);renderHistory(classified.history);
    document.getElementById('goal-empty').hidden=Boolean(current);document.getElementById('goal-content').hidden=!current;if(!current)return;
    document.getElementById('goal-current-priority').textContent=`PRIORITÀ ${current.priority}`;document.getElementById('goal-current-type').textContent=eventLabel(current).toUpperCase();document.getElementById('goal-current-name').textContent=current.name;document.getElementById('goal-current-target').textContent=current.target||'Nessun target specifico';document.getElementById('goal-countdown-days').textContent=dashboard.days;document.getElementById('goal-countdown-label').textContent=dashboard.days===0?'GARA OGGI':dashboard.days===1?'GIORNO ALLA GARA':'GIORNI ALLA GARA';document.getElementById('goal-current-date').textContent=formatDate(current.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'});document.getElementById('goal-weeks').textContent=dashboard.weeks;
    document.getElementById('goal-phase').textContent=dashboard.phase?.label||'—';document.getElementById('goal-phase-note').textContent=dashboard.phase?(dashboard.phase.source==='coach'?`${dashboard.phase.weekLabel} · Piano importato`:`Settimana ${dashboard.phase.week} · ${dashboard.phase.weekLabel}`):'Nessuna fase collegata';document.getElementById('goal-week-sessions').textContent=`${dashboard.week.completed}/${dashboard.week.sessions}`;document.getElementById('goal-week-note').textContent=dashboard.week.sessions?'sedute svolte nella settimana':'Nessuna seduta attiva';document.getElementById('goal-week-km').textContent=dashboard.week.plannedKm?`${dashboard.week.plannedKm} km`:'—';document.getElementById('goal-week-km-note').textContent=dashboard.week.distanceKnown?`${dashboard.week.actualKm} km registrati finora`:'distanza prevista dal piano';renderKeySessions(dashboard.keySessions);renderUpcoming(classified.upcoming);
  }

  form.elements.type.addEventListener('change',()=>syncVariantOptions(''));
  form.elements.variant.addEventListener('change',()=>{const item=eventModel?.variantsFor?.(form.elements.type.value)?.find(candidate=>candidate.key===form.elements.variant.value);document.getElementById('goal-variant-hint').textContent=item?.formatSummary||'Senza formato il dossier mantiene un profilo generico e a confidenza più bassa.';});
  form.elements.status.addEventListener('change',toggleResult);
  form.addEventListener('submit',event=>{
    event.preventDefault();if(!form.reportValidity())return;const days=[...form.querySelectorAll('[name="planDays"]:checked')].map(input=>input.value);if(!days.length){window.alert('Seleziona almeno un giorno abitualmente disponibile: verrà incluso nel dossier del Coach.');return;}
    const existing=goals.find(item=>item.id===form.elements.id.value),stamp=new Date().toISOString(),trainingAvailability={sessions:Math.min(Number(form.elements.planSessions.value),days.length),sessionMinutes:Number(form.elements.planSessionMinutes.value),longRunMinutes:Number(form.elements.planLongMinutes.value),days,weekendLong:form.elements.planWeekendLong.value,constraints:form.elements.planConstraints.value.trim()};
    const goal={id:existing?.id||goalId(),name:form.elements.name.value.trim(),type:form.elements.type.value,...(form.elements.variant.value?{variant:form.elements.variant.value}:{}),date:form.elements.date.value,dateAuthority:'manual',priority:form.elements.priority.value,status:form.elements.status.value,target:form.elements.target.value.trim(),result:form.elements.status.value==='completed'?form.elements.result.value.trim():'',notes:form.elements.notes.value.trim(),trainingAvailability,createdAt:existing?.createdAt||stamp,updatedAt:stamp,...(existing?.inferredFromSessionId?{inferredFromSessionId:existing.inferredFromSessionId}:{})};
    const next=existing?goals.map(item=>item.id===goal.id?goal:item):[...goals,goal];save(next,existing?'goal-updated':'goal-created');if(goal.status==='planned')window.rcSessions?.syncGoalSession?.(goal,{authoritativeDate:true});else window.rcSessions?.removeGoalSession?.(goal.id);close();const activePlan=safeDataset('coachPlans',[]).some(item=>item.goalId===goal.id&&item.status==='active');toast(activePlan?'Obiettivo salvato · revisione del piano da valutare':'Obiettivo salvato · dossier iniziale da preparare');
  });
  document.getElementById('goal-delete').addEventListener('click',()=>{const id=form.elements.id.value,goal=goals.find(item=>item.id===id);if(!goal||!window.confirm(`Eliminare “${goal.name}”? L’eventuale seduta calendario creata automaticamente verrà rimossa; una registrazione già compilata resterà nello storico.`))return;window.rcSessions?.removeGoalSession?.(id);save(goals.filter(item=>item.id!==id),'goal-deleted');close();toast('Obiettivo eliminato');});
  document.getElementById('add-goal').addEventListener('click',()=>open());document.getElementById('goal-empty-add').addEventListener('click',()=>open());document.getElementById('edit-current-goal').addEventListener('click',()=>{const current=model.classifyGoals(goals,localDate()).current;if(current)open(current);});document.getElementById('goal-close').addEventListener('click',close);document.getElementById('goal-cancel').addEventListener('click',close);document.getElementById('sidebar-goal').addEventListener('click',()=>window.rcNavigation?.show('goals'));
  document.getElementById('goals').addEventListener('click',event=>{const edit=event.target.closest('[data-edit-goal]'),result=event.target.closest('[data-result-goal]');if(edit){const goal=goals.find(item=>item.id===edit.dataset.editGoal);if(goal)open(goal);}else if(result){const goal=goals.find(item=>item.id===result.dataset.resultGoal);if(goal)open(goal,true);}});
  document.addEventListener('rc:sessions-updated',()=>{synchronizeGoalDates();render();});document.addEventListener('rc:data-restored',()=>{ensureInferredGoal();synchronizeGoalDates();synchronizeGoalSessions();render();});document.addEventListener('rc:view-changed',event=>{if(event.detail?.view==='goals')render();});['rc:whoop-updated','rc:pre-checkin-updated','rc:body-issues-updated'].forEach(name=>document.addEventListener(name,render));
  window.rcGoals={getAll:()=>structuredClone(goals),open,render};ensureInferredGoal();synchronizeGoalDates();synchronizeGoalSessions();render();setTimeout(render,0);
})();
