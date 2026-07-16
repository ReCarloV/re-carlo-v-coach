(function () {
  const sportsCatalog = [
    'Arrampicata', 'Atletica leggera', 'Badminton', 'Basket', 'Bodybuilding', 'Calcio', 'Calisthenics',
    'Ciclismo', 'Ciclismo indoor', 'Corsa', 'CrossFit', 'Escursionismo', 'Fitness funzionale', 'Forza / Powerlifting',
    'HYROX', 'Nuoto', 'OCR / Spartan Race', 'Padel', 'Pallavolo', 'Pilates', 'Rowing',
    'Rugby', 'Sci', 'Snowboard', 'Tennis', 'Trail running', 'Triathlon', 'Yoga'
  ].sort((a, b) => a.localeCompare(b, 'it'));

  const equipmentCatalog = {
    'Wearable': ['Apple Watch', 'Garmin Watch', 'Oura Ring', 'Polar Watch', 'Suunto Watch', 'WHOOP'],
    'Sensori': ['Fascia cardio Garmin', 'Polar H10', 'Power meter bici', 'Sensore cadenza', 'Stryd'],
    'Cardio indoor': ['Assault Bike', 'BikeErg', 'Garmin Tacx', 'Neo Bike', 'RowErg', 'SkiErg', 'Technogym Ride', 'Tapis roulant'],
    'Palestra': ['Bilanciere e rack', 'Cavi', 'Dumbbell', 'Kettlebell', 'Medicine ball', 'Sandbag', 'Sled'],
    'Piattaforme': ['Apple Health', 'Garmin Connect', 'MyWhoosh', 'Strava', 'Technogym', 'TrainingPeaks', 'Zwift']
  };

  const modal = document.getElementById('selector-modal');
  const list = document.getElementById('selector-list');
  const search = document.getElementById('selector-search');
  const categoryInput = document.getElementById('custom-category');
  const customInput = document.getElementById('custom-value');
  let mode = 'sports';
  let selectedSports = new Set();
  let selectedEquipment = new Map();

  function parseField(name, fallback) {
    try { return JSON.parse(document.querySelector(`[name="${name}"]`).value || JSON.stringify(fallback)); }
    catch (_) { return fallback; }
  }

  function equipmentKey(category, name) { return `${category}::${name}`; }

  function loadSelection() {
    if (mode === 'sports') selectedSports = new Set(parseField('sports', []));
    else {
      selectedEquipment = new Map();
      const grouped = parseField('equipment', {});
      Object.entries(grouped).forEach(([category, items]) => items.forEach(name => selectedEquipment.set(equipmentKey(category, name), { category, name })));
    }
  }

  function optionButton(category, name, selected) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `selector-option${selected ? ' selected' : ''}`;
    const label = document.createElement('span'); label.textContent = name;
    const check = document.createElement('i'); check.textContent = selected ? '✓' : '';
    button.append(label, check);
    button.addEventListener('click', () => {
      if (mode === 'sports') selectedSports.has(name) ? selectedSports.delete(name) : selectedSports.add(name);
      else {
        const key = equipmentKey(category, name);
        selectedEquipment.has(key) ? selectedEquipment.delete(key) : selectedEquipment.set(key, { category, name });
      }
      renderList();
    });
    return button;
  }

  function groupElement(title, items) {
    const group = document.createElement('section'); group.className = 'selector-group';
    if (title) { const heading = document.createElement('h3'); heading.textContent = title; group.append(heading); }
    const options = document.createElement('div'); options.className = 'selector-options';
    items.forEach(name => {
      const selected = mode === 'sports' ? selectedSports.has(name) : selectedEquipment.has(equipmentKey(title, name));
      options.append(optionButton(title, name, selected));
    });
    group.append(options); return group;
  }

  function renderList() {
    const query = search.value.trim().toLocaleLowerCase('it');
    list.replaceChildren();
    if (mode === 'sports') {
      const all = [...new Set([...sportsCatalog, ...selectedSports])].sort((a,b) => a.localeCompare(b, 'it'));
      const filtered = all.filter(name => name.toLocaleLowerCase('it').includes(query));
      list.append(groupElement('', filtered));
    } else {
      const merged = structuredClone(equipmentCatalog);
      selectedEquipment.forEach(({ category, name }) => {
        if (!merged[category]) merged[category] = [];
        if (!merged[category].includes(name)) merged[category].push(name);
      });
      Object.keys(merged).sort((a,b) => a.localeCompare(b, 'it')).forEach(category => {
        const items = merged[category].sort((a,b) => a.localeCompare(b, 'it')).filter(name => name.toLocaleLowerCase('it').includes(query));
        if (items.length) list.append(groupElement(category, items));
      });
    }
  }

  function renderPreview(modeName) {
    const target = document.getElementById(modeName === 'sports' ? 'sports-selection' : 'equipment-selection');
    target.replaceChildren();
    if (modeName === 'sports') {
      parseField('sports', []).forEach(name => { const chip = document.createElement('span'); chip.className = 'selection-chip'; chip.textContent = name; target.append(chip); });
    } else {
      const grouped = parseField('equipment', {});
      Object.entries(grouped).forEach(([category, items]) => items.forEach(name => {
        const chip = document.createElement('span'); chip.className = 'selection-chip';
        const label = document.createElement('small'); label.textContent = category;
        chip.append(label, document.createTextNode(name)); target.append(chip);
      }));
    }
  }

  function setValues(modeName, data) {
    document.querySelector(`[name="${modeName}"]`).value = JSON.stringify(data);
    renderPreview(modeName);
  }

  function openSelector(nextMode) {
    mode = nextMode; loadSelection(); search.value = ''; customInput.value = '';
    const sportsMode = mode === 'sports';
    document.getElementById('selector-kicker').textContent = sportsMode ? 'DISCIPLINE' : 'SETUP ATLETA';
    document.getElementById('selector-title').textContent = sportsMode ? 'Scegli gli sport praticati' : 'Gestisci attrezzatura e servizi';
    categoryInput.classList.toggle('sports-mode', sportsMode);
    categoryInput.replaceChildren();
    Object.keys(equipmentCatalog).sort((a,b) => a.localeCompare(b, 'it')).forEach(category => {
      const option = document.createElement('option'); option.value = category; option.textContent = category; categoryInput.append(option);
    });
    renderList(); modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); search.focus();
  }

  function closeSelector() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
  document.querySelectorAll('.selector-open').forEach(button => button.addEventListener('click', () => openSelector(button.dataset.selector)));
  document.getElementById('selector-close').addEventListener('click', closeSelector);
  document.getElementById('selector-cancel').addEventListener('click', closeSelector);
  modal.addEventListener('click', event => { if (event.target === modal) closeSelector(); });
  search.addEventListener('input', renderList);
  document.getElementById('custom-add').addEventListener('click', () => {
    const name = customInput.value.trim(); if (!name) return;
    if (mode === 'sports') selectedSports.add(name);
    else { const category = categoryInput.value; selectedEquipment.set(equipmentKey(category, name), { category, name }); }
    customInput.value = ''; renderList();
  });
  customInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); document.getElementById('custom-add').click(); } });
  document.getElementById('selector-confirm').addEventListener('click', () => {
    if (mode === 'sports') setValues('sports', [...selectedSports].sort((a,b) => a.localeCompare(b, 'it')));
    else {
      const grouped = {};
      [...selectedEquipment.values()].sort((a,b) => a.category.localeCompare(b.category, 'it') || a.name.localeCompare(b.name, 'it')).forEach(({ category, name }) => {
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(name);
      });
      setValues('equipment', grouped);
    }
    closeSelector();
  });

  window.rcSelectors = { setValues, renderPreview };
})();
