/* RadarCom-idara service worker. Caches only the application files (never your data, which stays in IndexedDB).
   Bump VERSION on each deployment: the app then shows "update available" and reloads only when you accept. */
const VERSION='rc-idara-2.0.0';
const SHELL=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)))});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==VERSION)await caches.delete(k);await self.clients.claim()})())});
self.addEventListener('message',e=>{if(e.data==='skipWaiting')self.skipWaiting()});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==location.origin)return;
  if(req.mode==='navigate'){e.respondWith(caches.match('./index.html').then(r=>r||fetch(req)).catch(()=>caches.match('./index.html')));return}
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(r=>r||fetch(req)));
});
/* Notification actions. Closing a notification does nothing: it never completes a task. */
self.addEventListener('notificationclick',e=>{
  const id=e.notification.data&&e.notification.data.id;const action=e.action||'open';e.notification.close();
  e.waitUntil((async()=>{const cs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    if(cs.length){const c=cs[0];await c.focus();c.postMessage({type:'notif',action,id});return}
    await self.clients.openWindow('./?nact='+encodeURIComponent(action)+'&id='+encodeURIComponent(id||''))})());
});
self.addEventListener('notificationclose',()=>{/* intentionally nothing */});
/* Best effort: Chrome on Android may wake an installed app periodically (the browser decides when; can be hours).
   We read IndexedDB and show due reminders. This is NOT a precise alarm. */
const casaNow=()=>{const p={};new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).forEach(x=>p[x.type]=x.value);return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`};
function idbRead(){return new Promise(res=>{const r=indexedDB.open('RadarComIdara');r.onupgradeneeded=()=>{r.transaction.abort();res(null)};r.onerror=()=>res(null);
  r.onsuccess=()=>{const db=r.result;try{const tx=db.transaction(['tasks','meta'],'readonly');const a=tx.objectStore('tasks').getAll();const m=tx.objectStore('meta').getAll();tx.oncomplete=()=>{db.close();res({tasks:a.result,meta:Object.fromEntries(m.result.map(x=>[x.key,x.value]))})};tx.onerror=()=>{db.close();res(null)}}catch(e){db.close();res(null)}}})}
self.addEventListener('periodicsync',e=>{if(e.tag!=='rc-reminders')return;e.waitUntil((async()=>{
  const d=await idbRead();if(!d)return;const now=casaNow();const hide=d.meta.settings&&d.meta.settings.hideDetails;
  const shown=await self.registration.getNotifications();const tags=new Set(shown.map(n=>n.tag));
  for(const x of d.tasks){if(x.deleted||!x.reminder||!x.reminder.on||!x.reminder.at||!['pending','progress','postponed'].includes(x.status))continue;
    const eff=x.reminder.snoozeUntil||x.reminder.at;if(eff>now||x.reminder.ackAt===eff||tags.has('rc-'+x.id))continue;
    await self.registration.showNotification(hide?'RadarCom-idara':x.title,{body:hide?'تذكير / Rappel':eff.replace('T',' '),tag:'rc-'+x.id,data:{id:x.id},requireInteraction:true,icon:'icons/icon-192.png',
      actions:[{action:'open',title:'فتح / Ouvrir'},{action:'snooze',title:'تأجيل / Reporter'},{action:'done',title:'تم / Terminé'}]})}
})())});
