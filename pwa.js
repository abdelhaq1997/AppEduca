(function(){
  const VERSION='20260326-core-1';
  let deferredPrompt=null;

  function addInstallBtn(){
    if(document.getElementById('installPwaBtn')) return;
    const b=document.createElement('button');
    b.id='installPwaBtn';
    b.textContent='تثبيت التطبيق';
    b.onclick=async()=>{
      if(deferredPrompt){
        deferredPrompt.prompt();
        try{ await deferredPrompt.userChoice; }catch(_){}
        deferredPrompt=null;
        b.style.display='none';
      }
    };
    document.body.appendChild(b);
  }

  function updateOnlineState(){
    document.body.classList.toggle('offline', !navigator.onLine);
    document.documentElement.setAttribute('data-online', navigator.onLine ? '1' : '0');
  }

  async function resetIfAsked(){
    const url=new URL(location.href);
    if(url.searchParams.get('reset-pwa')!=='1') return false;
    if('serviceWorker' in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
    }
    if(window.caches){
      const names=await caches.keys();
      await Promise.all(names.map(n=>caches.delete(n)));
    }
    localStorage.removeItem('pwa:lastVersion');
    url.searchParams.delete('reset-pwa');
    location.replace(url.toString());
    return true;
  }

  async function registerSW(){
    if(!('serviceWorker' in navigator)) return;
    try{
      const regs=await navigator.serviceWorker.getRegistrations();
      for(const reg of regs){
        const active=(reg.active&&reg.active.scriptURL)||'';
        if(!active.includes('sw.js')) await reg.unregister();
      }
      const reg = await navigator.serviceWorker.register('./sw.js?v='+VERSION, {scope:'./'});
      const announceUpdate = ()=>{
        const current = localStorage.getItem('pwa:lastVersion');
        if(current && current !== VERSION && window.UI && UI.toast) UI.toast('تم تحديث التطبيق محلياً', 'success');
        localStorage.setItem('pwa:lastVersion', VERSION);
      };
      announceUpdate();
      if(reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});
      reg.addEventListener('updatefound', ()=>{
        const worker = reg.installing;
        if(!worker) return;
        worker.addEventListener('statechange', ()=>{
          if(worker.state==='installed' && navigator.serviceWorker.controller){
            worker.postMessage({type:'SKIP_WAITING'});
          }
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', ()=>{
        if(!window.__pwaReloaded){
          window.__pwaReloaded=true;
          setTimeout(()=>location.reload(), 250);
        }
      });
    }catch(e){
      console.warn('SW register failed', e);
    }
  }

  window.addEventListener('beforeinstallprompt',(e)=>{
    e.preventDefault();
    deferredPrompt=e;
    addInstallBtn();
    document.getElementById('installPwaBtn').style.display='block';
  });
  window.addEventListener('appinstalled',()=>{
    const b=document.getElementById('installPwaBtn');
    if(b) b.remove();
  });
  window.addEventListener('online', updateOnlineState);
  window.addEventListener('offline', updateOnlineState);
  updateOnlineState();

  window.addEventListener('load', async()=>{
    if(await resetIfAsked()) return;
    setTimeout(registerSW, 700);
  });
})();
