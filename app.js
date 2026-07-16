const views = { today: 'Oggi', goals:'Obiettivi e gare', plan: 'Piano adattivo', recap:'Recap settimanale', profile: 'Il tuo profilo atleta', data:'Dati di allenamento' };
const transientDialogIds = [
  '#weekly-checkin-modal','#pre-checkin-modal','#generator-modal','#session-modal','#outcome-modal',
  '#goal-modal','#profile-modal','#pb-modal','#selector-modal','#whoop-setup-modal','#cloud-sync-modal','#crop-modal'
];
const transientDialogSelector=transientDialogIds.join(','),openDialogSelector=transientDialogIds.map(id=>`${id}.open`).join(',');
function syncDialogLayer(){document.body.classList.toggle('dialog-open',Boolean(document.querySelector(openDialogSelector)));}
function closeTransientDialogs(){document.querySelectorAll(openDialogSelector).forEach(dialog=>{dialog.classList.remove('open');dialog.setAttribute('aria-hidden','true');});syncDialogLayer();}
document.querySelectorAll(transientDialogSelector).forEach(dialog=>new MutationObserver(syncDialogLayer).observe(dialog,{attributes:true,attributeFilter:['class']}));
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeTransientDialogs();});
function showView(name) {
  const button = document.querySelector(`.nav[data-view="${name}"]`);
  const view = document.getElementById(name);
  if (!button || !view) return;
  closeTransientDialogs();
  document.querySelectorAll('.nav, .view').forEach(el => el.classList.remove('active'));
  button.classList.add('active');
  view.classList.add('active');
  document.getElementById('page-title').textContent = views[name];
  window.scrollTo({top:0,behavior:'auto'});
  document.dispatchEvent(new CustomEvent('rc:view-changed',{detail:{view:name}}));
}
document.querySelectorAll('.nav').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
window.rcNavigation = {
  show:showView,
  closeDialogs:closeTransientDialogs,
  setTitle:(name,title)=>{views[name]=title;if(document.getElementById(name)?.classList.contains('active'))document.getElementById('page-title').textContent=title;},
  active:()=>document.querySelector('.view.active')?.id || 'today'
};
const requestedView=window.location.hash.replace(/^#/,'');if(Object.prototype.hasOwnProperty.call(views,requestedView))showView(requestedView);
function renderCurrentDate(){document.getElementById('header-date').textContent=new Date().toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'}).toUpperCase();}
renderCurrentDate();setInterval(renderCurrentDate,60000);

const dataHealth=window.rcDataStore?.health?.()||{warnings:[]};
if(dataHealth.warnings?.length){
  const warning=document.getElementById('data-health-warning');warning.hidden=false;
  const status=document.getElementById('local-data-status');status.classList.add('warning');status.querySelector('span').textContent='Dati da verificare';
}

function toast() { const el = document.getElementById('toast'); el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1800); }

function showPhoto(src) { const img = document.getElementById('avatar-image'),placeholder=document.getElementById('avatar-placeholder');if(!src){img.removeAttribute('src');img.style.display='none';placeholder.style.display='';return;}img.src=src;img.style.display='block';placeholder.style.display='none'; }
showPhoto(localStorage.getItem('rc-profile-photo'));
window.addEventListener('rc:data-restored',()=>showPhoto(localStorage.getItem('rc-profile-photo')));
const cropModal = document.getElementById('crop-modal');
const cropCanvas = document.getElementById('crop-canvas');
const cropContext = cropCanvas.getContext('2d');
const cropZoom = document.getElementById('crop-zoom');
const cropX = document.getElementById('crop-x');
const cropY = document.getElementById('crop-y');
let sourceImage = null;

function drawCrop() {
  if (!sourceImage) return;
  const size = cropCanvas.width;
  const cropInset = 80;
  const cropSize = size - cropInset * 2;
  const baseScale = Math.max(cropSize / sourceImage.width, cropSize / sourceImage.height);
  const scale = baseScale * Number(cropZoom.value);
  const width = sourceImage.width * scale;
  const height = sourceImage.height * scale;
  const availableX = Math.max(0, (width - cropSize) / 2);
  const availableY = Math.max(0, (height - cropSize) / 2);
  const x = (size - width) / 2 + Number(cropX.value) * availableX;
  const y = (size - height) / 2 + Number(cropY.value) * availableY;
  cropContext.clearRect(0, 0, size, size);
  cropContext.drawImage(sourceImage, x, y, width, height);
}

function cropMovementLimits() {
  if (!sourceImage) return { x: 0, y: 0 };
  const cropSize = cropCanvas.width - 160;
  const baseScale = Math.max(cropSize / sourceImage.width, cropSize / sourceImage.height);
  const scale = baseScale * Number(cropZoom.value);
  return {
    x: Math.max(0, (sourceImage.width * scale - cropSize) / 2),
    y: Math.max(0, (sourceImage.height * scale - cropSize) / 2)
  };
}

function closeCrop() {
  cropModal.classList.remove('open');
  cropModal.setAttribute('aria-hidden', 'true');
  document.getElementById('photo-input').value = '';
}

[cropZoom, cropX, cropY].forEach(input => input.addEventListener('input', drawCrop));
let cropDrag = null;
cropCanvas.addEventListener('pointerdown', event => {
  if (!sourceImage) return;
  cropCanvas.setPointerCapture(event.pointerId);
  cropDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    panX: Number(cropX.value),
    panY: Number(cropY.value)
  };
  cropCanvas.classList.add('dragging');
});
cropCanvas.addEventListener('pointermove', event => {
  if (!cropDrag || cropDrag.pointerId !== event.pointerId) return;
  const rect = cropCanvas.getBoundingClientRect();
  const scaleToCanvas = cropCanvas.width / rect.width;
  const limits = cropMovementLimits();
  const deltaX = (event.clientX - cropDrag.startX) * scaleToCanvas;
  const deltaY = (event.clientY - cropDrag.startY) * scaleToCanvas;
  cropX.value = limits.x ? Math.max(-1, Math.min(1, cropDrag.panX + deltaX / limits.x)) : 0;
  cropY.value = limits.y ? Math.max(-1, Math.min(1, cropDrag.panY + deltaY / limits.y)) : 0;
  drawCrop();
});
function stopCropDrag(event) {
  if (!cropDrag || cropDrag.pointerId !== event.pointerId) return;
  cropDrag = null;
  cropCanvas.classList.remove('dragging');
}
cropCanvas.addEventListener('pointerup', stopCropDrag);
cropCanvas.addEventListener('pointercancel', stopCropDrag);
document.getElementById('crop-close').addEventListener('click', closeCrop);
document.getElementById('crop-cancel').addEventListener('click', closeCrop);
cropModal.addEventListener('click', event => { if (event.target === cropModal) closeCrop(); });

document.getElementById('photo-input').addEventListener('change', event => {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    sourceImage = new Image();
    sourceImage.onload = () => {
      cropZoom.value = 1; cropX.value = 0; cropY.value = 0; drawCrop();
      cropModal.classList.add('open'); cropModal.setAttribute('aria-hidden', 'false');
    };
    sourceImage.src = reader.result;
  };
  reader.readAsDataURL(file);
});

document.getElementById('crop-save').addEventListener('click', () => {
  if (!sourceImage) return;
  const output = document.createElement('canvas');
  output.width = 512; output.height = 512;
  const cropInset = 80;
  const cropSize = cropCanvas.width - cropInset * 2;
  output.getContext('2d').drawImage(cropCanvas, cropInset, cropInset, cropSize, cropSize, 0, 0, 512, 512);
  const croppedPhoto = output.toDataURL('image/jpeg', .88);
  localStorage.setItem('rc-profile-photo', croppedPhoto);
  showPhoto(croppedPhoto); closeCrop(); toast();document.dispatchEvent(new CustomEvent('rc:profile-updated',{detail:{reason:'profile-photo-saved'}}));
});
