(function () {
  const catalog = [
    { id:'run-5k', label:'Corsa 5 km', kind:'running', distanceKm:5 },
    { id:'run-10k', label:'Corsa 10 km', kind:'running', distanceKm:10 },
    { id:'run-half', label:'Mezza maratona', kind:'running', distanceKm:21.0975 },
    { id:'run-marathon', label:'Maratona', kind:'running', distanceKm:42.195 },
    { id:'hyrox-open', label:'HYROX Individual Open', kind:'hyrox' },
    { id:'hyrox-pro', label:'HYROX Individual Pro', kind:'hyrox' },
    { id:'hyrox-doubles', label:'HYROX Doubles Open', kind:'hyrox' },
    { id:'hyrox-doubles-pro', label:'HYROX Doubles Pro', kind:'hyrox' },
    { id:'hyrox-mixed', label:'HYROX Mixed Doubles', kind:'hyrox' },
    { id:'hyrox-relay', label:'HYROX Relay', kind:'hyrox' }
  ];
  const modal = document.getElementById('pb-modal');
  const editor = document.getElementById('pb-editor');
  const typeSelect = document.getElementById('pb-type');
  let working = [];

  function totalSeconds(pb) { return Number(pb.hours || 0) * 3600 + Number(pb.minutes || 0) * 60 + Number(pb.seconds || 0); }
  function pad(value) { return String(value).padStart(2, '0'); }
  function formatTime(pb) {
    const total = totalSeconds(pb); if (!total) return 'Tempo da inserire';
    return pb.hours ? `${pb.hours}:${pad(pb.minutes)}:${pad(pb.seconds)}` : `${pb.minutes}:${pad(pb.seconds)}`;
  }
  function formatPace(pb) {
    if (pb.kind !== 'running' || !pb.distanceKm || !totalSeconds(pb)) return '';
    const paceSeconds = Math.round(totalSeconds(pb) / pb.distanceKm);
    return `${Math.floor(paceSeconds / 60)}:${pad(paceSeconds % 60)} /km`;
  }
  function stepperControl(max, value, label) {
    const wrapper = document.createElement('label'); wrapper.textContent = label;
    const stepper = document.createElement('span'); stepper.className = 'time-stepper';
    const decrease = document.createElement('button'); decrease.type = 'button'; decrease.textContent = '−'; decrease.setAttribute('aria-label', `Riduci ${label.toLowerCase()}`);
    const input = document.createElement('input'); input.type = 'number'; input.inputMode = 'numeric'; input.min = 0; input.max = max; input.step = 1; input.value = Number(value) || 0; input.setAttribute('aria-label', label);
    const increase = document.createElement('button'); increase.type = 'button'; increase.textContent = '+'; increase.setAttribute('aria-label', `Aumenta ${label.toLowerCase()}`);
    const clamp = number => Math.max(0, Math.min(max, Number(number) || 0));
    decrease.addEventListener('click', () => { input.value = clamp(Number(input.value) - 1); input.dispatchEvent(new Event('input')); });
    increase.addEventListener('click', () => { input.value = clamp(Number(input.value) + 1); input.dispatchEvent(new Event('input')); });
    input.addEventListener('change', () => { input.value = clamp(input.value); input.dispatchEvent(new Event('input')); });
    stepper.append(decrease, input, increase); wrapper.append(stepper); return { wrapper, input };
  }
  function renderTypeOptions() {
    typeSelect.replaceChildren();
    const available = catalog.filter(type => !working.some(pb => pb.id === type.id));
    available.forEach(type => { const option = document.createElement('option'); option.value = type.id; option.textContent = type.label; typeSelect.append(option); });
    document.getElementById('pb-add').disabled = !available.length;
  }
  function renderEditor() {
    editor.replaceChildren(); renderTypeOptions();
    working.forEach((pb, index) => {
      const row = document.createElement('article'); row.className = 'pb-row';
      const info = document.createElement('div');
      const title = document.createElement('h3'); title.textContent = pb.label;
      const pace = document.createElement('span'); pace.className = 'pace'; pace.textContent = formatPace(pb) || (pb.kind === 'hyrox' ? 'Tempo complessivo' : 'Inserisci il tempo');
      info.append(title, pace);
      const controls = document.createElement('div'); controls.className = 'time-selects';
      const hours = stepperControl(9, pb.hours, 'ORE');
      const minutes = stepperControl(59, pb.minutes, 'MIN');
      const seconds = stepperControl(59, pb.seconds, 'SEC');
      [hours, minutes, seconds].forEach(control => controls.append(control.wrapper));
      const update = () => {
        working[index] = { ...working[index], hours:Number(hours.input.value), minutes:Number(minutes.input.value), seconds:Number(seconds.input.value) };
        pace.textContent = formatPace(working[index]) || (pb.kind === 'hyrox' ? 'Tempo complessivo' : 'Inserisci il tempo');
      };
      [hours.input, minutes.input, seconds.input].forEach(input => input.addEventListener('input', update));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'pb-remove'; remove.textContent = '×'; remove.title = 'Rimuovi PB';
      remove.addEventListener('click', () => { working.splice(index, 1); renderEditor(); });
      row.append(info, controls, remove); editor.append(row);
    });
    if (!working.length) { const empty = document.createElement('p'); empty.className = 'pb-empty'; empty.textContent = 'Nessun personal best selezionato.'; editor.append(empty); }
  }
  function normalize(values) {
    return (values || []).map(value => {
      const type = catalog.find(item => item.id === value.id) || value;
      return { ...type, hours:Number(value.hours || 0), minutes:Number(value.minutes || 0), seconds:Number(value.seconds || 0) };
    });
  }
  function setValues(values) {
    const normalized = normalize(values);
    document.querySelector('[name="personalBests"]').value = JSON.stringify(normalized);
    const preview = document.getElementById('pb-selection'); preview.replaceChildren();
    normalized.forEach(pb => { const chip = document.createElement('span'); chip.className = 'selection-chip'; chip.textContent = `${pb.label} · ${formatTime(pb)}`; preview.append(chip); });
  }
  function open() {
    try { working = normalize(JSON.parse(document.querySelector('[name="personalBests"]').value || '[]')); } catch (_) { working = []; }
    renderEditor(); modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
  }
  function close() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
  document.getElementById('manage-pbs').addEventListener('click', open);
  document.getElementById('pb-close').addEventListener('click', close);
  document.getElementById('pb-cancel').addEventListener('click', close);
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  document.getElementById('pb-add').addEventListener('click', () => {
    const type = catalog.find(item => item.id === typeSelect.value); if (!type) return;
    working.push({ ...type, hours:0, minutes:0, seconds:0 }); renderEditor();
  });
  document.getElementById('pb-confirm').addEventListener('click', () => { setValues(working); close(); });
  window.rcPbs = { setValues, formatTime, formatPace, catalog };
})();
