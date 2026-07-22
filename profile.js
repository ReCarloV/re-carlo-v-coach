(function () {
  const PROFILE_KEY = 'rc-athlete-profile-v1';
  const metricsModel=window.rcAthleteMetricsModel;
  const defaults = {
    schemaVersion: 3,
    firstName: 'Atleta',
    lastName: '',
    nickname: 'Re Carlo V',
    birthDate: '',
    level: 'Intermedio',
    heightCm: 0,
    weightKg: 0,
    maxHr: 0,
    restingHr: 0,
    ftp: 0,
    profileSetupComplete: false,
    strengthFormula: 'epley',
    hrZoneMethod: 'hrr',
    ftpZoneMethod: 'coggan7',
    strengthMaxes: { pullup:null, bench:null, military:null, squat:null, frontsquat:null, deadlift:null, trapbar:null },
    personalBests: [],
    sports: [],
    equipment: {},
    updatedAt: new Date().toISOString()
  };

  function categorizeLegacyDevices(items) {
    const grouped = {};
    (items || []).forEach(name => {
      let category = 'Altro';
      if (/whoop|watch|oura|suunto/i.test(name)) category = 'Wearable';
      else if (/polar|fascia|sensore|stryd|power meter/i.test(name)) category = 'Sensori';
      else if (/ride|tacx|neo|erg|rullo|tapis/i.test(name)) category = 'Cardio indoor';
      else if (/strava|mywhoosh|zwift|health|connect|trainingpeaks/i.test(name)) category = 'Piattaforme';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(name);
    });
    return Object.keys(grouped).length ? grouped : structuredClone(defaults.equipment);
  }

  function timeParts(value) {
    const parts = String(value || '').split(':').map(Number);
    if (parts.length === 3) return { hours:parts[0] || 0, minutes:parts[1] || 0, seconds:parts[2] || 0 };
    return { hours:0, minutes:parts[0] || 0, seconds:parts[1] || 0 };
  }

  function migratePersonalBests(value) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return structuredClone(defaults.personalBests);
    const mapping = [
      ['fiveKm','run-5k','Corsa 5 km','running',5], ['tenKm','run-10k','Corsa 10 km','running',10],
      ['halfMarathon','run-half','Mezza maratona','running',21.0975], ['hyroxOpen','hyrox-open','HYROX Individual Open','hyrox',null]
    ];
    return mapping.filter(([key]) => value[key]).map(([key,id,label,kind,distanceKm]) => ({ id,label,kind,...(distanceKm ? {distanceKm} : {}),...timeParts(value[key]) }));
  }

  function loadProfile() {
    try {
      const stored = JSON.parse(localStorage.getItem(PROFILE_KEY));
      if (!stored || typeof stored !== 'object') {
        const freshProfile = structuredClone(defaults);
        const legacyFtp = Number(localStorage.getItem('rc-ftp'));
        if (legacyFtp) freshProfile.ftp = legacyFtp;
        return freshProfile;
      }
      const merged = {
        ...structuredClone(defaults),
        ...stored,
        personalBests: migratePersonalBests(stored.personalBests)
      };
      merged.strengthMaxes={...defaults.strengthMaxes,...(stored.strengthMaxes||{})};
      merged.equipment = stored.equipment || categorizeLegacyDevices(stored.devices);
      if(!Object.prototype.hasOwnProperty.call(stored,'profileSetupComplete'))merged.profileSetupComplete=true;
      merged.schemaVersion = 3;
      return merged;
    } catch (_) {
      return structuredClone(defaults);
    }
  }

  let athlete = loadProfile();
  const form = document.getElementById('profile-form');
  const modal = document.getElementById('profile-modal');

  function ageFromBirthDate(value) {
    const birth = new Date(`${value}T12:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
    return age;
  }

  function storedHrUpper() {
    try { const values=window.rcDataStore?.getDataset('hrZones');return window.rcTrainingZonesModel.normalizedCustomUpper(values); } catch (_) { return null; }
  }

  function renderHrZones(result) {
    const custom=result.method==='custom';
    document.getElementById('hr-zones').innerHTML=result.zones.map((zone,index)=>`<div class="zone"><b>${zone.id}</b><span class="track"><i style="--w:${45+index*12}%;--c:${zone.color}"></i></span>${custom?`<input class="hr-input" type="number" min="40" max="230" step="1" value="${zone.max}" aria-label="Limite superiore ${zone.id}">`:`<span class="zone-range">${zone.min}–${zone.max} bpm</span>`}</div>`).join('');
  }

  function renderHrSettings(method=athlete.hrZoneMethod) {
    document.getElementById('hr-zone-method').value=method;
    const result=window.rcTrainingZonesModel.hrZones({maxHr:athlete.maxHr,restingHr:athlete.restingHr,method,customUpper:storedHrUpper()});
    const meta=window.rcTrainingZonesModel.HR_METHODS[method]||window.rcTrainingZonesModel.HR_METHODS.hrr;
    if(!result.valid){document.getElementById('hr-zones').innerHTML='<p class="pb-empty">Completa FC massima e FC a riposo per calcolare le zone.</p>';document.getElementById('hr-summary').textContent='Frequenze cardiache non ancora disponibili.';document.getElementById('hr-source-strip').replaceChildren();document.getElementById('hr-method-note').textContent='Nessun valore viene stimato finché il profilo non contiene dati validi.';return;}
    renderHrZones(result);
    const maxWhoop=athlete.heartRateSources?.maxHr?.provider==='whoop',restWhoop=athlete.heartRateSources?.restingHr?.provider==='whoop';document.getElementById('hr-summary').textContent=`FC max ${athlete.maxHr}${maxWhoop?' · WHOOP':''} · FC riposo ${athlete.restingHr}${restWhoop?' · WHOOP':''} · ${meta.shortLabel}.`;
    const sourceStrip=document.getElementById('hr-source-strip');sourceStrip.replaceChildren();const maxSource=document.createElement('span');maxSource.className=maxWhoop?'whoop':'';maxSource.textContent=maxWhoop?'FC max calcolata da WHOOP':'FC max manuale';const restSource=document.createElement('span');restSource.className=restWhoop?'whoop':'';restSource.textContent=restWhoop?`FC riposo · mediana WHOOP ${athlete.heartRateSources.restingHr.sampleDays||1} gg`:'FC riposo manuale';sourceStrip.append(maxSource,restSource);
    const notes={hrr:'Considera la FC a riposo e applica le percentuali alla riserva cardiaca.',hrmax:'Applica le percentuali direttamente alla FC massima, senza usare la FC a riposo.',average:'Ogni limite è la media del valore Karvonen e del corrispondente valore %FCmax.',custom:'Modifica i cinque limiti superiori: devono essere in ordine crescente.'};
    document.getElementById('hr-method-note').textContent=notes[method];
  }

  function renderFtpSettings(method=athlete.ftpZoneMethod,ftpValue=athlete.ftp) {
    document.getElementById('ftp-zone-method').value=method;
    const result=window.rcTrainingZonesModel.ftpZones(ftpValue,method);
    if(!result.valid){document.getElementById('ftp-zones').innerHTML='<p class="pb-empty">Inserisci un FTP valido per visualizzare le zone.</p>';return;}
    document.getElementById('ftp-zones').innerHTML=result.zones.map((zone,index)=>`<div class="zone compact"><b>${zone.id}</b><span class="track"><i style="--w:${Math.min(96,42+index*9)}%;--c:${zone.color}"></i></span><span class="zone-range">${zone.notFtpDefined?'Non definita da FTP':zone.max===null?`≥ ${zone.min} W`:`${zone.min}–${zone.max} W`}<small class="zone-detail">${zone.label}</small></span></div>`).join('');
  }

  function saveProfile() {
    athlete.updatedAt = new Date().toISOString();
    localStorage.setItem(PROFILE_KEY, JSON.stringify(athlete));
  }

  function renderPersonalBests() {
    const container = document.getElementById('profile-pbs');
    container.replaceChildren();
    athlete.personalBests.forEach(pb => {
      const card = document.createElement('article'); card.className = 'pb-card';
      const label = document.createElement('small'); label.textContent = pb.label;
      const time = document.createElement('strong'); time.textContent = window.rcPbs.formatTime(pb);
      card.append(label, time);
      const pace = window.rcPbs.formatPace(pb);
      if (pace) { const paceLabel = document.createElement('em'); paceLabel.textContent = `Passo medio ${pace}`; card.append(paceLabel); }
      container.append(card);
    });
    if (!athlete.personalBests.length) { const empty = document.createElement('p'); empty.className = 'pb-empty'; empty.textContent = 'Nessun personal best selezionato.'; container.append(empty); }
  }

  function renderStrengthMaxes() {
    let sessions=[];try{sessions=window.rcDataStore?.getDataset('sessions')||[];}catch(_){}
    const formula=window.rcStrengthPerformanceModel.FORMULAS[athlete.strengthFormula]?athlete.strengthFormula:'epley';
    const estimates=window.rcStrengthPerformanceModel.deriveMaxes({sessions,manualMaxes:athlete.strengthMaxes,bodyweightKg:athlete.weightKg,formula});
    const labels=window.rcStrengthPerformanceModel.LIFTS;
    const container=document.getElementById('strength-maxes'); container.replaceChildren();
    Object.entries(labels).forEach(([key,meta])=>{
      const estimate=estimates[key];const card=document.createElement('div');card.className=`strength-max-card${estimate?` ${estimate.source}`:''}`;
      const name=document.createElement('small');name.textContent=meta.label;const value=document.createElement('strong');value.textContent=estimate?`${meta.externalLoad?'+':''}${estimate.value.toLocaleString('it-IT',{maximumFractionDigits:1})} kg`:'—';
      const source=document.createElement('em');source.className='strength-source';
      if(!estimate)source.textContent='Registra un set principale';
      else if(estimate.source==='manual')source.textContent='Riferimento manuale';
      else{const date=new Date(`${estimate.date}T12:00:00`).toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'});source.textContent=`Da ${meta.externalLoad?'+':''}${estimate.loadKg.toLocaleString('it-IT',{maximumFractionDigits:1})} kg × ${estimate.reps}${estimate.rpe!==undefined?` @ RPE ${estimate.rpe.toLocaleString('it-IT')}`:''} · ${date}`;}
      card.append(name,value,source);if(estimate?.source==='recorded'){const detail=document.createElement('em');detail.className='strength-set';detail.textContent=`${window.rcStrengthPerformanceModel.FORMULAS[formula].label}${estimate.rpe!==undefined?` · RIR ${estimate.rir.toLocaleString('it-IT')} inclusa`:' · RPE non disponibile'} · ${estimate.exercise}`;card.append(detail);}container.append(card);
    });
    document.getElementById('strength-formula').value=formula;
    document.getElementById('strength-method-summary').textContent=`${window.rcStrengthPerformanceModel.FORMULAS[formula].label} sui migliori set da 1–10 ripetizioni. Quando presente, l’RPE del set aggiunge la RIR stimata (10 − RPE) prima del calcolo; i dati storici senza RPE restano validi. Un riferimento manuale ha priorità.`;
  }

  function renderEquipmentSummary(expanded = false) {
    const container = document.getElementById('profile-devices'); container.replaceChildren();
    let hiddenCount = 0;
    Object.keys(athlete.equipment).sort((a,b) => a.localeCompare(b,'it')).forEach(category => {
      const items = [...athlete.equipment[category]].sort((a,b) => a.localeCompare(b,'it'));
      const visible = expanded ? items : items.slice(0,3); hiddenCount += items.length - visible.length;
      const group = document.createElement('div'); group.className = 'equipment-group';
      const heading = document.createElement('strong'); heading.textContent = category;
      const itemList = document.createElement('div'); itemList.className = 'equipment-items';
      visible.forEach(name => { const item = document.createElement('span'); item.className = 'equipment-item'; item.textContent = name; itemList.append(item); });
      group.append(heading,itemList); container.append(group);
    });
    const total = Object.values(athlete.equipment).reduce((sum,items) => sum + items.length,0);
    if (hiddenCount || expanded && total > 3) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'equipment-more';
      button.textContent = expanded ? 'Mostra meno' : `Visualizza tutte (+${hiddenCount})`;
      button.addEventListener('click', () => renderEquipmentSummary(!expanded)); container.append(button);
    }
  }

  function renderProfile() {
    const setup=athlete.profileSetupComplete!==false;
    const age = setup&&athlete.birthDate?ageFromBirthDate(athlete.birthDate):null;
    document.getElementById('profile-name').textContent = setup?[athlete.firstName, athlete.lastName].filter(Boolean).join(' '):'Configura il profilo';
    document.getElementById('profile-nickname').textContent = athlete.nickname.toUpperCase();
    document.getElementById('profile-summary').textContent = setup?[Number.isFinite(age)?`${age} anni`:null,Number(athlete.heightCm)>0?`${athlete.heightCm} cm`:null,Number(athlete.weightKg)>0?`${athlete.weightKg} kg`:null].filter(Boolean).join(' · ')||'Dati antropometrici non disponibili':'Dati atleta non ancora inseriti';
    document.getElementById('profile-level').textContent = setup?athlete.level:'DA CONFIGURARE';
    document.getElementById('profile-sports').textContent = athlete.sports.length?athlete.sports.join(' · '):'Nessuna disciplina configurata';
    renderStrengthMaxes(); renderPersonalBests(); renderEquipmentSummary();
    document.querySelector('.brand strong').textContent = athlete.nickname.toUpperCase();
    window.rcNavigation?.setTitle('today',setup?`Oggi, ${athlete.firstName}.`:'Oggi');
    renderHrSettings(athlete.hrZoneMethod);
    const ftp = document.getElementById('ftp');
    ftp.value = setup&&Number(athlete.ftp)>0?athlete.ftp:'';
    renderFtpSettings(athlete.ftpZoneMethod,athlete.ftp);
  }

  function fillForm() {
    const setup=athlete.profileSetupComplete!==false;
    const values = {
      firstName: setup?athlete.firstName:'', lastName: setup?athlete.lastName || '':'', nickname: athlete.nickname, birthDate: setup?athlete.birthDate:'', level: athlete.level,
      heightCm: setup?athlete.heightCm:'', weightKg: setup?athlete.weightKg:'', maxHr: setup&&Number(athlete.maxHr)>0?athlete.maxHr:'', restingHr: setup&&Number(athlete.restingHr)>0?athlete.restingHr:'', ftp: setup&&Number(athlete.ftp)>0?athlete.ftp:'',
      maxPullup:athlete.strengthMaxes?.pullup || '',maxBench:athlete.strengthMaxes?.bench || '',maxMilitary:athlete.strengthMaxes?.military || '',maxSquat:athlete.strengthMaxes?.squat || '',maxFrontSquat:athlete.strengthMaxes?.frontsquat || '',maxDeadlift:athlete.strengthMaxes?.deadlift || '',maxTrapBar:athlete.strengthMaxes?.trapbar || ''
    };
    Object.entries(values).forEach(([name, value]) => { form.elements.namedItem(name).value = value; });
    document.getElementById('profile-max-hr-source').textContent=athlete.heartRateSources?.maxHr?.provider==='whoop'?'Da WHOOP · modificando passi al valore manuale':'Valore manuale';
    document.getElementById('profile-resting-hr-source').textContent=athlete.heartRateSources?.restingHr?.provider==='whoop'?`Mediana WHOOP · ${athlete.heartRateSources.restingHr.sampleDays||1} giorni`:'Valore manuale';
    document.getElementById('profile-height-source').textContent=athlete.bodyMeasurementSources?.heightCm?.provider==='whoop'?'Ultima misurazione WHOOP · modificando passi al valore manuale':'Valore manuale';
    document.getElementById('profile-weight-source').textContent=athlete.bodyMeasurementSources?.weightKg?.provider==='whoop'?'Ultima misurazione WHOOP · modificando passi al valore manuale':'Valore manuale';
    window.rcSelectors.setValues('sports', athlete.sports);
    window.rcSelectors.setValues('equipment', athlete.equipment);
    window.rcPbs.setValues(athlete.personalBests);
  }

  function openModal() { fillForm(); modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
  function closeModal() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
  document.getElementById('edit-profile').addEventListener('click', openModal);
  document.getElementById('profile-close').addEventListener('click', closeModal);
  document.getElementById('profile-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const maxHr=Number(data.get('maxHr')),restingHr=Number(data.get('restingHr')),heightCm=Number(data.get('heightCm')),weightKg=Number(data.get('weightKg'));const heartRateSources=metricsModel?.manualOverrideSources?.(athlete,{maxHr,restingHr});const bodyMeasurementSources=metricsModel?.manualOverrideBodySources?.(athlete,{heightCm,weightKg});
    athlete = {
      ...athlete,
      firstName: data.get('firstName').trim(), lastName: data.get('lastName').trim(), nickname: data.get('nickname').trim(), birthDate: data.get('birthDate'), level: data.get('level'),
      heightCm, weightKg,
      maxHr, restingHr, ftp: Number(data.get('ftp')),
      strengthMaxes:{pullup:Number(data.get('maxPullup'))||null,bench:Number(data.get('maxBench'))||null,military:Number(data.get('maxMilitary'))||null,squat:Number(data.get('maxSquat'))||null,frontsquat:Number(data.get('maxFrontSquat'))||null,deadlift:Number(data.get('maxDeadlift'))||null,trapbar:Number(data.get('maxTrapBar'))||null},
      personalBests: JSON.parse(data.get('personalBests') || '[]'),
      sports: JSON.parse(data.get('sports') || '[]'), equipment: JSON.parse(data.get('equipment') || '{}'), schemaVersion: 3, profileSetupComplete:true
    };
    if(heartRateSources)athlete.heartRateSources=heartRateSources;else delete athlete.heartRateSources;
    if(bodyMeasurementSources)athlete.bodyMeasurementSources=bodyMeasurementSources;else delete athlete.bodyMeasurementSources;
    const zones = window.rcTrainingZonesModel.hrZones({maxHr:athlete.maxHr,restingHr:athlete.restingHr,method:athlete.hrZoneMethod,customUpper:storedHrUpper()});
    localStorage.setItem('rc-hr-zones', JSON.stringify(zones.upperBounds));
    localStorage.setItem('rc-ftp', String(athlete.ftp));
    saveProfile(); renderProfile(); closeModal(); toast();
    document.dispatchEvent(new CustomEvent('rc:profile-updated'));
  });

  document.getElementById('hr-zone-method').addEventListener('change',event=>renderHrSettings(event.target.value));
  document.getElementById('save-hr-zones').addEventListener('click',()=>{
    const method=document.getElementById('hr-zone-method').value;
    const customUpper=method==='custom'?[...document.querySelectorAll('.hr-input')].map(input=>Number(input.value)):storedHrUpper();
    const result=window.rcTrainingZonesModel.hrZones({maxHr:athlete.maxHr,restingHr:athlete.restingHr,method,customUpper});
    if(!result.valid||!result.customValid){window.alert('Inserisci cinque limiti cardiaci validi e in ordine crescente.');return;}
    athlete.hrZoneMethod=method;localStorage.setItem('rc-hr-zones',JSON.stringify(result.upperBounds));saveProfile();renderHrSettings();toast();
    document.dispatchEvent(new CustomEvent('rc:profile-updated'));
  });
  document.getElementById('ftp').addEventListener('input',event=>renderFtpSettings(document.getElementById('ftp-zone-method').value,Number(event.target.value)));
  document.getElementById('ftp-zone-method').addEventListener('change',event=>renderFtpSettings(event.target.value,Number(document.getElementById('ftp').value)));
  document.getElementById('save-ftp-settings').addEventListener('click',()=>{
    const ftp=Number(document.getElementById('ftp').value);if(!Number.isFinite(ftp)||ftp<=0){window.alert('Inserisci un FTP valido in watt.');return;}
    athlete.ftp=ftp;athlete.ftpZoneMethod=document.getElementById('ftp-zone-method').value;localStorage.setItem('rc-ftp',String(ftp));saveProfile();renderFtpSettings();toast();
    document.dispatchEvent(new CustomEvent('rc:profile-updated'));
  });
  document.getElementById('strength-formula').addEventListener('change',event=>{
    athlete.strengthFormula=event.target.value;saveProfile();renderStrengthMaxes();toast();
    document.dispatchEvent(new CustomEvent('rc:profile-updated'));
  });

  document.getElementById('export-profile').addEventListener('click', () => {
    try {
      window.rcDataStore.downloadBackup();
      document.getElementById('backup-status').textContent = `Ultimo backup esportato: ${new Date().toLocaleString('it-IT',{dateStyle:'medium',timeStyle:'short'})}`;
      toast();
    } catch (error) {
      window.alert(error.message || 'Non è stato possibile creare il backup completo.');
    }
  });

  document.getElementById('import-profile').addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const info = window.rcDataStore.inspectBackup(reader.result);
        const exported = info.exportedAt ? new Date(info.exportedAt).toLocaleString('it-IT',{dateStyle:'medium',timeStyle:'short'}) : 'data non disponibile';
        const details = info.mode === 'full'
          ? `${info.sessions} sedute, ${info.weeklyAvailabilityWeeks} disponibilità settimanali, ${info.preSessionCheckins} check-in pre sessione, ${info.bodyIssues} fastidi, ${info.importedActivities} attività Strava, ${info.whoopCycles} cicli WHOOP, ${info.reconciliationDecisions} abbinamenti e ${info.goals} obiettivi. Il ripristino sostituirà i dati attuali dell’app.`
          : 'È un vecchio backup del profilo: piano, check-in e fastidi attuali resteranno invariati.';
        if (!window.confirm(`Ripristinare il backup di ${info.athleteName || 'Re Carlo V'}?\n\nEsportato: ${exported}\n${details}`)) { event.target.value=''; return; }
        window.rcDataStore.restoreBackup(reader.result);
        window.alert('Backup ripristinato correttamente. L’app verrà ricaricata per mostrare tutti i dati.');
        window.location.reload();
      } catch (error) {
        window.alert(error.message || 'Il file selezionato non è un backup valido di Re Carlo V.');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  });

  function syncWhoopMetrics(detail={}){
    if(!metricsModel?.applyWhoopMetrics)return false;let cycles=[],batches=[];try{cycles=window.rcDataStore?.getDataset('whoopCycles')||[];batches=window.rcDataStore?.getDataset('whoopImportBatches')||[];}catch(_){return false;}const syncedAt=detail.syncedAt||detail.fetchedAt||batches.filter(item=>item.provider==='whoop').sort((a,b)=>String(b.importedAt).localeCompare(String(a.importedAt)))[0]?.importedAt||null;const result=metricsModel.applyWhoopMetrics(athlete,{cycles,bodyMeasurement:detail.bodyMeasurement||null,syncedAt});if(!result.changed)return false;athlete={...result.profile,updatedAt:new Date().toISOString()};saveProfile();renderProfile();document.dispatchEvent(new CustomEvent('rc:profile-updated',{detail:{reason:'whoop-athlete-metrics',observed:result.observed}}));return true;
  }

  document.addEventListener('rc:sessions-updated',renderStrengthMaxes);
  document.addEventListener('rc:whoop-updated',event=>syncWhoopMetrics(event.detail||{}));
  window.addEventListener('rc:data-restored',()=>{athlete=loadProfile();renderProfile();syncWhoopMetrics();});

  if(!(window.rcDataStore?.health?.().warnings||[]).includes('profile')){
    let storedProfile=null;
    try{storedProfile=JSON.parse(localStorage.getItem(PROFILE_KEY));}catch(_){}
    const sameData=window.rcCloudSyncModel?.sameData;
    const profileChanged=sameData
      ? !sameData(storedProfile,athlete)
      : JSON.stringify(storedProfile)!==JSON.stringify(athlete);
    if(profileChanged)saveProfile();
  }
  renderProfile();
  syncWhoopMetrics();
})();
