const CACHE='re-carlo-v-shell-v12';
const APP_SHELL=[
  './','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png',
  './styles.css','./mobile.css','./crop.css','./profile.css','./selectors.css','./pbs.css','./sessions.css','./sessions-extra.css','./post-session.css','./plan-polish.css','./plan-calendar.css','./bodymap.css','./checkins.css','./generator.css','./today.css','./recap.css','./demo-data.css','./session-selection.css','./strength-performance.css','./data-import.css','./adaptive-coaching.css','./goals.css','./refinements.css','./cloud-sync.css',
  './data-store.js','./activity-import-model.js','./plan-import-model.js','./whoop-import-model.js','./whoop-api-model.js','./reconciliation-model.js','./training-zones-model.js','./symptom-recency-model.js','./skip-reason-model.js','./recovery-trend-model.js','./device-freshness-model.js','./goals-model.js','./weekly-plan-adjustment-model.js','./adaptive-application-model.js','./athlete-metrics-model.js','./cloud-sync-model.js','./cloud-config.js','./app.js','./selectors.js','./pbs.js','./strength-performance-model.js','./profile.js','./session-selection-model.js','./plan-view-model.js','./execution-evidence-model.js','./sessions.js','./goals.js','./bodymap.js','./checkin-model.js','./checkins.js','./adaptive-engine.js','./today-model.js','./today.js','./weekly-recap-model.js','./recap.js','./generator.js','./demo-data-model.js','./demo-data.js','./data-import.js','./plan-import.js','./whoop-import.js','./whoop-live-sync.js','./reconciliation.js','./vendor/supabase-2.110.5.min.js','./cloud-sync.js','./pwa.js'
];

self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);if(url.origin!==self.location.origin||url.pathname.includes('/api/local-sync/'))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));return response;}).catch(()=>caches.match('./index.html')));return;
  }
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;}).catch(()=>caches.match(request)));
});
