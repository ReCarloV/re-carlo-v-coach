(function(){
  const anatomyMarkup={
    front:`<svg class="body-anatomy" viewBox="0 0 240 560" role="img" aria-labelledby="body-front-title"><title id="body-front-title">Corpo umano, vista anteriore. Seleziona una regione.</title>
      <g class="body-base" aria-hidden="true">
        <ellipse cx="120" cy="42" rx="28" ry="34"/><path d="M104 70h32l4 31-20 15-20-15z"/>
        <path d="M78 95q42-20 84 0c13 18 16 66 10 113-3 23-13 43-25 58H93c-12-15-22-35-25-58-6-47-3-95 10-113z"/>
        <path d="M78 98C58 99 45 112 39 135L19 239c-2 12 4 20 13 20 8 0 12-6 15-17l29-105zM162 98c20 1 33 14 39 37l20 104c2 12-4 20-13 20-8 0-12-6-15-17l-29-105z"/>
        <path d="M91 250h58l12 38-13 33H92l-13-33z"/>
        <path d="M94 310c-9 35-13 80-10 118l5 80h25l5-86 1-112zM146 310c9 35 13 80 10 118l-5 80h-25l-5-86-1-112z"/>
        <path d="M89 500c-9 12-15 24-17 34 9 7 27 7 42 2v-36zM151 500c9 12 15 24 17 34-9 7-27 7-42 2v-36z"/>
      </g>
      <g class="body-landmarks" aria-hidden="true"><path d="M120 116v137M94 157q26 13 52 0M101 204h38M93 279q27 13 54 0M120 321v181"/></g>
      <g class="body-regions">
        <g class="body-point other" role="button" tabindex="0" data-zone="head" data-label="Testa" aria-label="Testa"><ellipse cx="120" cy="42" rx="24" ry="30"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="neck" data-label="Collo" aria-label="Collo"><path d="M105 75h30l2 25-17 12-17-12z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="shoulder-right" data-label="Spalla destra" aria-label="Spalla destra"><path d="M76 99q-21 3-29 22l25 13 17-31z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="shoulder-left" data-label="Spalla sinistra" aria-label="Spalla sinistra"><path d="M164 99q21 3 29 22l-25 13-17-31z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="upper-arm-right" data-label="Braccio destro" aria-label="Braccio destro"><path d="M47 125l24 12-12 57-24-6z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="upper-arm-left" data-label="Braccio sinistro" aria-label="Braccio sinistro"><path d="M193 125l-24 12 12 57 24-6z"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="elbow-right" data-label="Gomito destro" aria-label="Gomito destro"><circle cx="47" cy="199" r="9"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="elbow-left" data-label="Gomito sinistro" aria-label="Gomito sinistro"><circle cx="193" cy="199" r="9"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="forearm-right" data-label="Avambraccio destro" aria-label="Avambraccio destro"><path d="M36 207l21 2-12 42-21-3z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="forearm-left" data-label="Avambraccio sinistro" aria-label="Avambraccio sinistro"><path d="M204 207l-21 2 12 42 21-3z"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="wrist-right" data-label="Polso destro" aria-label="Polso destro"><circle cx="32" cy="250" r="7"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="wrist-left" data-label="Polso sinistro" aria-label="Polso sinistro"><circle cx="208" cy="250" r="7"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="chest" data-label="Petto" aria-label="Petto"><path d="M84 111q17-8 34 3v48q-23 8-38-8zM156 111q-17-8-34 3v48q23 8 38-8z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="abdomen" data-label="Addome" aria-label="Addome"><path d="M94 169q26 9 52 0l5 70q-31 22-62 0z"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="hip-right" data-label="Anca destra" aria-label="Anca destra"><circle cx="96" cy="275" r="10"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="hip-left" data-label="Anca sinistra" aria-label="Anca sinistra"><circle cx="144" cy="275" r="10"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="adductor-right" data-label="Adduttori destri" aria-label="Adduttori destri"><path d="M105 303l14 8-8 100-15-13z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="adductor-left" data-label="Adduttori sinistri" aria-label="Adduttori sinistri"><path d="M135 303l-14 8 8 100 15-13z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="quad-right" data-label="Quadricipite destro" aria-label="Quadricipite destro"><path d="M91 305l15 4 4 102-23-4c-5-32-3-70 4-102z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="quad-left" data-label="Quadricipite sinistro" aria-label="Quadricipite sinistro"><path d="M149 305l-15 4-4 102 23-4c5-32 3-70-4-102z"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="knee-right" data-label="Ginocchio destro" aria-label="Ginocchio destro"><circle cx="99" cy="421" r="11"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="knee-left" data-label="Ginocchio sinistro" aria-label="Ginocchio sinistro"><circle cx="141" cy="421" r="11"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="shin-right" data-label="Tibia destra" aria-label="Tibia destra"><path d="M90 435h19l3 65H90z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="shin-left" data-label="Tibia sinistra" aria-label="Tibia sinistra"><path d="M150 435h-19l-3 65h22z"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="ankle-right" data-label="Caviglia destra" aria-label="Caviglia destra"><circle cx="100" cy="504" r="8"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="ankle-left" data-label="Caviglia sinistra" aria-label="Caviglia sinistra"><circle cx="140" cy="504" r="8"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="foot-right" data-label="Piede destro" aria-label="Piede destro"><path d="M89 513h23l1 22q-23 7-38-1z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="foot-left" data-label="Piede sinistro" aria-label="Piede sinistro"><path d="M151 513h-23l-1 22q23 7 38-1z"/></g>
      </g></svg>`,
    back:`<svg class="body-anatomy" viewBox="0 0 240 560" role="img" aria-labelledby="body-back-title"><title id="body-back-title">Corpo umano, vista posteriore. Seleziona una regione.</title>
      <g class="body-base" aria-hidden="true">
        <ellipse cx="120" cy="42" rx="28" ry="34"/><path d="M104 70h32l4 31-20 15-20-15z"/>
        <path d="M78 95q42-20 84 0c13 18 16 66 10 113-3 23-13 43-25 58H93c-12-15-22-35-25-58-6-47-3-95 10-113z"/>
        <path d="M78 98C58 99 45 112 39 135L19 239c-2 12 4 20 13 20 8 0 12-6 15-17l29-105zM162 98c20 1 33 14 39 37l20 104c2 12-4 20-13 20-8 0-12-6-15-17l-29-105z"/>
        <path d="M91 250h58l12 38-13 33H92l-13-33z"/>
        <path d="M94 310c-9 35-13 80-10 118l5 80h25l5-86 1-112zM146 310c9 35 13 80 10 118l-5 80h-25l-5-86-1-112z"/>
        <path d="M89 500c-9 12-15 24-17 34 9 7 27 7 42 2v-36zM151 500c9 12 15 24 17 34-9 7-27 7-42 2v-36z"/>
      </g>
      <g class="body-landmarks" aria-hidden="true"><path d="M120 112v154M86 162q34-14 68 0M89 279q31-12 62 0M120 321v181"/></g>
      <g class="body-regions">
        <g class="body-point other" role="button" tabindex="0" data-zone="head" data-label="Testa" aria-label="Testa"><ellipse cx="120" cy="42" rx="24" ry="30"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="neck" data-label="Collo" aria-label="Collo"><path d="M105 75h30l2 27-17 10-17-10z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="shoulder-left" data-label="Spalla sinistra" aria-label="Spalla sinistra"><path d="M76 99q-21 3-29 22l25 13 17-31z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="shoulder-right" data-label="Spalla destra" aria-label="Spalla destra"><path d="M164 99q21 3 29 22l-25 13-17-31z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="triceps-left" data-label="Tricipite sinistro" aria-label="Tricipite sinistro"><path d="M47 125l24 12-12 57-24-6z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="triceps-right" data-label="Tricipite destro" aria-label="Tricipite destro"><path d="M193 125l-24 12 12 57 24-6z"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="elbow-left" data-label="Gomito sinistro" aria-label="Gomito sinistro"><circle cx="47" cy="199" r="9"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="elbow-right" data-label="Gomito destro" aria-label="Gomito destro"><circle cx="193" cy="199" r="9"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="forearm-left" data-label="Avambraccio sinistro" aria-label="Avambraccio sinistro"><path d="M36 207l21 2-12 42-21-3z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="forearm-right" data-label="Avambraccio destro" aria-label="Avambraccio destro"><path d="M204 207l-21 2 12 42 21-3z"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="wrist-left" data-label="Polso sinistro" aria-label="Polso sinistro"><circle cx="32" cy="250" r="7"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="wrist-right" data-label="Polso destro" aria-label="Polso destro"><circle cx="208" cy="250" r="7"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="upper-back" data-label="Dorso" aria-label="Dorso"><path d="M83 108q37-18 74 0l8 68q-45 22-90 0z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="lower-back" data-label="Zona lombare" aria-label="Zona lombare"><path d="M88 181q32 13 64 0l-5 70q-27 16-54 0z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="glute-left" data-label="Gluteo sinistro" aria-label="Gluteo sinistro"><path d="M87 258q30-12 31 18l-5 39q-23 10-31-17z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="glute-right" data-label="Gluteo destro" aria-label="Gluteo destro"><path d="M153 258q-30-12-31 18l5 39q23 10 31-17z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="hamstring-left" data-label="Femorale sinistro" aria-label="Femorale sinistro"><path d="M88 311l28 5-6 96-24-4c-5-33-3-69 2-97z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="hamstring-right" data-label="Femorale destro" aria-label="Femorale destro"><path d="M152 311l-28 5 6 96 24-4c5-33 3-69-2-97z"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="knee-left" data-label="Ginocchio sinistro" aria-label="Ginocchio sinistro"><circle cx="99" cy="421" r="11"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="knee-right" data-label="Ginocchio destro" aria-label="Ginocchio destro"><circle cx="141" cy="421" r="11"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="calf-left" data-label="Polpaccio sinistro" aria-label="Polpaccio sinistro"><path d="M88 434q14-9 23 2l1 58q-14 14-23 1z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="calf-right" data-label="Polpaccio destro" aria-label="Polpaccio destro"><path d="M152 434q-14-9-23 2l-1 58q14 14 23 1z"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="ankle-left" data-label="Caviglia sinistra" aria-label="Caviglia sinistra"><circle cx="100" cy="504" r="8"/></g>
        <g class="body-point joint" role="button" tabindex="0" data-zone="ankle-right" data-label="Caviglia destra" aria-label="Caviglia destra"><circle cx="140" cy="504" r="8"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="foot-left" data-label="Piede sinistro" aria-label="Piede sinistro"><path d="M89 513h23l1 22q-23 7-38-1z"/></g>
        <g class="body-point muscle" role="button" tabindex="0" data-zone="foot-right" data-label="Piede destro" aria-label="Piede destro"><path d="M151 513h-23l-1 22q23 7 38-1z"/></g>
      </g></svg>`
  };
  function mountAnatomy(){document.querySelectorAll('.body-figure').forEach(figure=>{figure.innerHTML=anatomyMarkup[figure.classList.contains('front')?'front':'back'];});}
  mountAnatomy();
  const KEY='rc-body-issues-v1';
  let issues=load();
  const form=document.getElementById('body-issue-form');
  const empty=document.getElementById('body-empty');
  const recencyModel=window.rcSymptomRecencyModel;
  const jointZones=new Set(['shoulder-left','shoulder-right','elbow-left','elbow-right','wrist-left','wrist-right','hip-left','hip-right','knee-left','knee-right','ankle-left','ankle-right']);
  const muscleZones=new Set(['neck','chest','abdomen','upper-arm-left','upper-arm-right','forearm-left','forearm-right','triceps-left','triceps-right','adductor-left','adductor-right','quad-left','quad-right','shin-left','shin-right','foot-left','foot-right','upper-back','lower-back','glute-left','glute-right','hamstring-left','hamstring-right','calf-left','calf-right']);

  function load(){try{const value=JSON.parse(localStorage.getItem(KEY));return Array.isArray(value)?value:[];}catch(_){return [];}}
  function save(){localStorage.setItem(KEY,JSON.stringify(issues));render();document.dispatchEvent(new CustomEvent('rc:body-issues-updated'));}
  function readingStatus(issue,asOf){return recencyModel.readingStatus(issue,asOf);}
  function latest(issue){return readingStatus(issue).latestPain??(Number(issue.initialPain)||0);}
  function active(){return issues.filter(issue=>issue.status==='active');}
  function formatDate(value){return new Date(value).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'});}
  function pointsFor(issue){return document.querySelectorAll(`.body-point[data-zone="${issue.zone}"]`);}
  function historyBars(issue){const bars=document.createElement('div');bars.className='pain-history';(issue.history||[]).slice(-10).forEach(entry=>{const bar=document.createElement('i');bar.style.setProperty('--pain',entry.pain);bar.dataset.high=entry.pain>=5?'true':'false';bar.title=`${formatDate(entry.date)} · ${entry.pain}/10`;bars.append(bar);});return bars;}
  function issueCard(issue,isArchived){const status=readingStatus(issue);const card=document.createElement('article');card.className=`body-issue-card freshness-${status.freshness}`;const head=document.createElement('div');head.className='body-issue-card-head';const name=document.createElement('div');const type=document.createElement('small');type.textContent=`${issue.type} · ${issue.zoneLabel}`;const description=document.createElement('strong');description.textContent=issue.description;const freshness=document.createElement('span');freshness.className=`body-freshness ${status.tone}`;freshness.textContent=status.label;name.append(type,description,freshness);const pain=document.createElement('span');pain.className=`body-pain${status.requiresUpdate?' stale':''}`;pain.textContent=status.latestPain===null?'—':`${status.requiresUpdate?'ultimo ':''}${status.latestPain}/10`;head.append(name,pain);const detail=document.createElement('p');detail.className='body-issue-description';detail.textContent=issue.notes||'Nessuna nota aggiuntiva.';const meta=document.createElement('div');meta.className='body-issue-meta';const dates=document.createElement('span');dates.textContent=isArchived?`${formatDate(issue.startedAt)} → ${formatDate(issue.resolvedAt)}`:`Ultima valutazione ${status.ageLabel} · affidabilità ${status.confidence==='high'?'alta':status.confidence==='medium'?'media':'bassa'}`;const action=document.createElement('button');action.type='button';action.className='body-issue-action';action.textContent=isArchived?'Riattiva':'Segna risolto';action.addEventListener('click',()=>{issue.status=isArchived?'active':'resolved';if(isArchived)delete issue.resolvedAt;else issue.resolvedAt=new Date().toISOString();save();toast();});meta.append(dates,action);card.append(head,detail,historyBars(issue),meta);return card;}
  function render(){document.querySelectorAll('.body-point').forEach(point=>point.classList.remove('active','high','stale'));const current=active();current.forEach(issue=>{const status=readingStatus(issue);pointsFor(issue).forEach(point=>point.classList.add('active',...(status.requiresUpdate?['stale']:status.latestPain>=5?['high']:[])));});const activeList=document.getElementById('active-body-issues');activeList.replaceChildren();current.forEach(issue=>activeList.append(issueCard(issue,false)));const archived=issues.filter(issue=>issue.status==='resolved');const archivedList=document.getElementById('archived-body-issues');archivedList.replaceChildren();archived.slice().reverse().forEach(issue=>archivedList.append(issueCard(issue,true)));document.getElementById('archived-issues-count').textContent=String(archived.length);const stale=current.filter(issue=>readingStatus(issue).requiresUpdate).length;document.getElementById('body-active-count').textContent=stale?`${current.length} attivi · ${stale} da aggiornare`:`${current.length} attivi`;}
  function selectZone(region){document.querySelectorAll('.body-point').forEach(point=>point.classList.toggle('selected',point.dataset.zone===region.dataset.zone));form.reset();form.elements.zone.value=region.dataset.zone;form.elements.type.value=jointZones.has(region.dataset.zone)?'Articolare':muscleZones.has(region.dataset.zone)?'Muscolare':'Altro';document.getElementById('body-selected-label').textContent=region.dataset.label;form.hidden=false;empty.hidden=true;form.scrollIntoView({behavior:'smooth',block:'nearest'});}
  document.querySelectorAll('.body-point').forEach(region=>{region.classList.add(jointZones.has(region.dataset.zone)?'joint':muscleZones.has(region.dataset.zone)?'muscle':'other');region.addEventListener('click',()=>selectZone(region));region.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectZone(region);}});});
  const legend=document.createElement('div');legend.className='body-map-legend';legend.innerHTML='<span><i class="region"></i> Regione anatomica</span><span><i></i> Articolazione</span>';document.querySelector('.body-maps').append(legend);
  document.getElementById('cancel-body-issue').addEventListener('click',()=>{document.querySelectorAll('.body-point').forEach(point=>point.classList.remove('selected'));form.hidden=true;empty.hidden=false;});
  form.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(form);const zone=data.get('zone');const button=document.querySelector(`.body-point[data-zone="${zone}"]`);const duplicate=active().find(issue=>issue.zone===zone);if(duplicate){window.alert('Questa zona è già monitorata. Aggiornala dal check-in giornaliero.');return;}const pain=Number(data.get('pain'));issues.push({id:crypto.randomUUID?crypto.randomUUID():`issue-${Date.now()}`,zone,zoneLabel:button?.dataset.label||zone,type:data.get('type'),description:data.get('description').trim(),notes:data.get('notes').trim(),status:'active',startedAt:new Date().toISOString(),initialPain:pain,history:[{date:new Date().toISOString(),pain,source:'profilo'}]});document.querySelectorAll('.body-point').forEach(point=>point.classList.remove('selected'));form.hidden=true;empty.hidden=false;save();toast();});
  function recordReadings(readings){const now=new Date().toISOString();readings.forEach(reading=>{const issue=issues.find(item=>item.id===reading.id&&item.status==='active');if(issue){if(!Array.isArray(issue.history))issue.history=[];issue.history.push({date:now,pain:Number(reading.pain),source:'check-in'});}});save();}
  window.rcBodyIssues={active:()=>structuredClone(active()),latest,status:readingStatus,recordReadings,all:()=>structuredClone(issues)};
  window.addEventListener('rc:data-restored',()=>{issues=load();render();});
  render();
})();
