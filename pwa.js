
(function(){
  const VERSION='20260310-safe-2';
  let deferredPrompt=null;
  function addInstallBtn(){
    if(document.getElementById('installPwaBtn')) return;
    const b=document.createElement('button');
    b.id='installPwaBtn';
    b.textContent='تثبيت التطبيق';
    b.onclick=async()=>{ if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt=null; b.style.display='none'; } };
    document.body.appendChild(b);
  }
  window.addEventListener('beforeinstallprompt',(e)=>{ e.preventDefault(); deferredPrompt=e; addInstallBtn(); document.getElementById('installPwaBtn').style.display='block'; });
  window.addEventListener('appinstalled',()=>{ const b=document.getElementById('installPwaBtn'); if(b) b.remove(); });
  function updateOnlineState(){ document.body.classList.toggle('offline', !navigator.onLine); }
  window.addEventListener('online', updateOnlineState);
  window.addEventListener('offline', updateOnlineState);
  updateOnlineState();
  async function resetIfAsked(){
    const url=new URL(location.href);
    if(url.searchParams.get('reset-pwa')!=='1') return false;
    if('serviceWorker' in navigator){ const regs=await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r=>r.unregister())); }
    if(window.caches){ const names=await caches.keys(); await Promise.all(names.map(n=>caches.delete(n))); }
    url.searchParams.delete('reset-pwa');
    location.replace(url.toString());
    return true;
  }
  window.addEventListener('load', async()=>{
    if(await resetIfAsked()) return;
    if(!('serviceWorker' in navigator)) return;
    setTimeout(async()=>{
      try{
        const regs=await navigator.serviceWorker.getRegistrations();
        for(const reg of regs){ const active=(reg.active&&reg.active.scriptURL)||''; if(!active.includes('sw.js')) await reg.unregister(); }
        await navigator.serviceWorker.register('./sw.js?v='+VERSION, {scope:'./'});
      }catch(e){ console.warn('SW register failed', e); }
    }, 1200);
  });
})();
