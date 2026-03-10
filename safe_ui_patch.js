
(function(){
  function onReady(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fn); else fn(); }
  function hideById(id){ const el=document.getElementById(id); if(el) el.style.display='none'; }
  function removeUnwanted(){ ['btn-sessions','btn-equity','btn-biography','btn-parent-report','btn-hypothesis','tab-sessions','tab-equity','tab-biography','tab-parent-report','tab-hypothesis'].forEach(hideById); }
  function patchSocialAverages(){
    if(!window.GradeCalc) return;
    const oldSocialAvg=window.GradeCalc.socialAvg;
    const oldSubjectAvg=window.GradeCalc.subjectAvg;
    const aliasMap={history1:'h1',history2:'h2',geo1:'g1',geo2:'g2',civic1:'c1',civic2:'c2',tarikh1:'h1',tarikh2:'h2',jughrafia1:'g1',jughrafia2:'g2',madania1:'c1',madania2:'c2'};
    function normalize(g){
      if(!g || typeof g!=='object') return {};
      const x={...g};
      Object.keys(aliasMap).forEach(k=>{ if((x[aliasMap[k]]==null || x[aliasMap[k]]==='') && x[k]!=null && x[k]!=='') x[aliasMap[k]]=x[k]; });
      if(x.history && typeof x.history==='object'){ if(x.h1==null) x.h1=x.history.t1 ?? x.history[1]; if(x.h2==null) x.h2=x.history.t2 ?? x.history[2]; }
      if(x.geography && typeof x.geography==='object'){ if(x.g1==null) x.g1=x.geography.t1 ?? x.geography[1]; if(x.g2==null) x.g2=x.geography.t2 ?? x.geography[2]; }
      if(x.civics && typeof x.civics==='object'){ if(x.c1==null) x.c1=x.civics.t1 ?? x.civics[1]; if(x.c2==null) x.c2=x.civics.t2 ?? x.civics[2]; }
      return x;
    }
    window.GradeCalc.subjectAvg=function(g, cols){ return oldSubjectAvg.call(this, normalize(g), cols); };
    window.GradeCalc.socialAvg=function(g){ return oldSocialAvg.call(this, normalize(g)); };
  }
  function patchWheel(){
    const canvas=document.getElementById('wheelCanvas');
    if(!canvas) return;
    const host=canvas.closest('.card') || canvas.parentElement;
    if(!host || document.getElementById('wheelExitFullscreenBtn')) return;
    const controls=Array.from(host.querySelectorAll('button')).find(b=>/اختر/.test(b.textContent||''))?.parentElement || host;
    const fullBtn=document.createElement('button');
    fullBtn.className='btn btn-warning btn-sm wheel-full-btn';
    fullBtn.textContent='ملء الشاشة';
    const exitBtn=document.createElement('button');
    exitBtn.id='wheelExitFullscreenBtn';
    exitBtn.textContent='خروج';
    function enterFs(){ document.body.classList.add('wheel-is-fullscreen'); host.classList.add('wheel-fullscreen'); if(window.UI&&typeof UI.resetWheel==='function') setTimeout(()=>UI.resetWheel(),120); }
    function exitFs(){ document.body.classList.remove('wheel-is-fullscreen'); host.classList.remove('wheel-fullscreen'); if(window.UI&&typeof UI.resetWheel==='function') setTimeout(()=>UI.resetWheel(),120); }
    fullBtn.addEventListener('click', enterFs);
    exitBtn.addEventListener('click', exitFs);
    document.addEventListener('keydown', e=>{ if(e.key==='Escape') exitFs(); });
    controls.appendChild(fullBtn);
    document.body.appendChild(exitBtn);
  }
  function addQuickClassSummary(){
    const tab=document.getElementById('tab-class-analysis');
    if(!tab || document.getElementById('quickClassSummary')) return;
    const box=document.createElement('div');
    box.id='quickClassSummary';
    box.className='card';
    box.style.marginBottom='12px';
    box.innerHTML='<div class="card-header"><div class="card-title"><div class="icon">📌</div>ملخص سريع</div></div><div id="quickClassSummaryBody" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px"></div>';
    tab.prepend(box);
    const body=box.querySelector('#quickClassSummaryBody');
    function render(){
      if(!window.ClassAnalysis || !ClassAnalysis._data || !Array.isArray(ClassAnalysis._data.rows)) return;
      const rows=ClassAnalysis._data.rows;
      const valid=rows.filter(r=>r.general!=null && !isNaN(r.general));
      const avg=valid.length ? (valid.reduce((a,b)=>a+b.general,0)/valid.length).toFixed(2) : '—';
      const strong=valid.filter(r=>r.general>=8).length;
      const weak=valid.filter(r=>r.general<5).length;
      body.innerHTML=[['المعدل العام',avg],['عدد المتعلمين',rows.length],['مستوى جيد فأعلى',strong],['يحتاجون دعماً مكثفاً',weak]].map(([k,v])=>`<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:12px"><div style="color:var(--text-3);font-size:12px;margin-bottom:6px">${k}</div><div style="font-weight:900;font-size:24px">${v}</div></div>`).join('');
    }
    const oldPrepare=window.ClassAnalysis && ClassAnalysis.prepareData;
    if(typeof oldPrepare==='function'){
      ClassAnalysis.prepareData=async function(){ const res=await oldPrepare.apply(this, arguments); setTimeout(render,0); return res; };
      setTimeout(render,800);
    }
  }
  function patchSwitchTab(){
    if(typeof window.switchTab!=='function') return;
    const old=window.switchTab;
    window.switchTab=function(name){
      if(['sessions','equity','biography','parent-report','hypothesis'].includes(name)) name='dashboard';
      return old.apply(this, arguments=[name]);
    };
  }
  onReady(function(){
    removeUnwanted();
    patchSocialAverages();
    patchSwitchTab();
    setTimeout(()=>{ removeUnwanted(); patchWheel(); addQuickClassSummary(); }, 1200);
  });
})();
