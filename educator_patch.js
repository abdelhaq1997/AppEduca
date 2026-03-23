
(function(){
  function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  function el(tag, attrs={}, html=''){ const x=document.createElement(tag); Object.entries(attrs).forEach(([k,v])=>{ if(k==='class') x.className=v; else if(k==='id') x.id=v; else x.setAttribute(k,v); }); if(html) x.innerHTML=html; return x; }
  function safeToast(msg, type='info'){ try{ window.UI && UI.toast ? UI.toast(msg,type) : alert(msg); }catch(_){ alert(msg); } }

  async function ensureAttendance(name, status){
    const date = (window.State && State.today) || new Date().toISOString().split('T')[0];
    const all = await DB.get('attendance');
    if(!all[date]) all[date] = {};
    const prev = all[date][name];
    const curr = (typeof prev === 'object' && prev) ? prev : { status:'present', reason:'', note:'' };
    curr.status = status;
    all[date][name] = curr;
    await DB.set('attendance', all);
    if(window.State && State.tab==='attendance' && UI.renderAttendance) UI.renderAttendance();
  }

  async function ensureHomework(name, status){
    const date = (window.getVal && getVal('hw-date')) || ((window.State && State.today) || new Date().toISOString().split('T')[0]);
    const all = await DB.get('homework');
    if(!all[date]) all[date] = {};
    all[date][name] = status;
    await DB.set('homework', all);
    if(window.State && State.tab==='homework' && UI.renderHomework) UI.renderHomework();
  }

  async function addNote(name, text, type='pedagogical'){
    const notes = await DB.get('notes');
    notes.unshift({ id: (window.uuid ? uuid() : String(Date.now())), student:name, type, text, date: ((window.State && State.today) || new Date().toISOString().split('T')[0]) });
    await DB.set('notes', notes);
    if(window.State && State.currentProfile===name) UI.openProfile(name);
  }

  async function buildDailyCard(){
    const tab = document.getElementById('tab-dashboard');
    if(!tab || document.getElementById('dailyPedagogicalCard') || !window.PupilMgr) return;
    const host = el('div',{id:'dailyPedagogicalCard', class:'card'});
    host.innerHTML = `
      <div class="card-header">
        <div class="card-title"><div class="icon">🎯</div>لوحة قرارات اليوم</div>
      </div>
      <div class="focus-kpis" id="dailyPedagogicalKpis"></div>
      <div class="focus-note" id="dailyPedagogicalNote"></div>`;
    tab.prepend(host);

    async function render(){
      try{
        const pupils = PupilMgr.getPupilNames();
        const attendance = await DB.get('attendance');
        const homework = await DB.get('homework');
        const today = ((window.State && State.today) || new Date().toISOString().split('T')[0]);
        const attToday = attendance[today] || {};
        const hwToday = homework[today] || {};
        let absent = 0, late = 0, notDone = 0, priority = 0;
        for(const name of pupils){
          const av = attToday[name];
          const st = typeof av === 'object' ? av?.status : av;
          if(st==='absent') absent++;
          if(st==='late') late++;
          if(hwToday[name]==='not_done') notDone++;
          try{
            const perf = await Engine.calculatePI(name, State.level);
            if(perf.pi < 5 || perf.raw.absCount >= 3 || perf.raw.hwMisses >= 3) priority++;
          }catch(_){ }
        }
        const kpis = [
          ['المتعلمون', pupils.length],
          ['غائبون اليوم', absent],
          ['تأخرات', late],
          ['أولوية للدعم', priority]
        ];
        document.getElementById('dailyPedagogicalKpis').innerHTML = kpis.map(([k,v])=>`<div class="focus-kpi"><b>${v}</b><span>${k}</span></div>`).join('');
        const note = priority > 0
          ? `يوجد <b>${priority}</b> من المتعلمين يحتاجون تدخلاً سريعاً اليوم. ابدأ بهم في القراءة أو المراجعة القصيرة قبل الانتقال إلى بقية المجموعة.`
          : `الوضعية العامة مستقرة اليوم. ركّز على التثبيت، التقويم السريع، وتسجيل الملاحظات اللحظية بدل التراكم في آخر الأسبوع.`;
        document.getElementById('dailyPedagogicalNote').innerHTML = note + (notDone ? ` كما أن <b>${notDone}</b> لم ينجزوا الواجب المنزلي.` : '');
      }catch(e){ console.warn('daily card render failed', e); }
    }
    render();
    const oldSet = DB.set.bind(DB);
    DB.set = async function(type, data){ const r = await oldSet(type, data); setTimeout(render, 60); return r; };
  }

  async function buildFocusPanel(){
    if(document.getElementById('teacherFocusFab') || !window.PupilMgr) return;
    const fab = el('button',{id:'teacherFocusFab', title:'روتين 90 ثانية'},'⚡');
    const panel = el('div',{id:'teacherFocusPanel'});
    panel.innerHTML = `
      <div class="focus-head"><h3>روتين 90 ثانية</h3><button type="button" id="teacherFocusClose">✕</button></div>
      <div class="focus-mini" style="margin-bottom:8px">تسجيل لحظي سريع دون الدخول لكل تبويب.</div>
      <div class="focus-grid single" style="margin-bottom:10px">
        <select id="teacherFocusStudent"></select>
      </div>
      <div class="focus-grid" style="margin-bottom:8px">
        <button class="focus-chip" data-action="present">✅ حاضر</button>
        <button class="focus-chip" data-action="absent">🚫 غائب</button>
        <button class="focus-chip" data-action="done">📝 أنجز الواجب</button>
        <button class="focus-chip" data-action="not_done">❗ لم ينجز</button>
        <button class="focus-chip" data-action="reading_ok">📖 قرأ جيداً</button>
        <button class="focus-chip" data-action="reading_struggle">🟠 تعثر في القراءة</button>
      </div>
      <div class="focus-grid single">
        <textarea id="teacherFocusNote" placeholder="ملاحظة سريعة تحفظ مباشرة في بطاقة المتعلم..."></textarea>
        <button class="focus-chip" data-action="save_note">💾 حفظ الملاحظة</button>
      </div>`;
    document.body.appendChild(fab);
    document.body.appendChild(panel);
    const sel = panel.querySelector('#teacherFocusStudent');
    const refreshStudents = ()=>{
      const names = PupilMgr.getPupilNames();
      sel.innerHTML = names.length ? names.map(n=>`<option value="${n}">${n}</option>`).join('') : '<option value="">لا يوجد متعلمون</option>';
      if(window.State && State.currentProfile && names.includes(State.currentProfile)) sel.value = State.currentProfile;
    };
    refreshStudents();
    fab.onclick = ()=>{ refreshStudents(); panel.classList.toggle('open'); };
    panel.querySelector('#teacherFocusClose').onclick = ()=> panel.classList.remove('open');
    panel.addEventListener('click', async (e)=>{
      const btn = e.target.closest('[data-action]');
      if(!btn) return;
      const name = sel.value;
      if(!name){ safeToast('أضف المتعلمين أولاً','error'); return; }
      const action = btn.getAttribute('data-action');
      try{
        if(action==='present'){ await ensureAttendance(name,'present'); safeToast('تم تسجيل الحضور','success'); }
        else if(action==='absent'){ await ensureAttendance(name,'absent'); await addNote(name,'تسجيل غياب سريع من روتين 90 ثانية','behavior'); safeToast('تم تسجيل الغياب','warning'); }
        else if(action==='done'){ await ensureHomework(name,'done'); safeToast('تم حفظ إنجاز الواجب','success'); }
        else if(action==='not_done'){ await ensureHomework(name,'not_done'); await addNote(name,'لم ينجز الواجب المنزلي','pedagogical'); safeToast('تم حفظ عدم الإنجاز','warning'); }
        else if(action==='reading_ok'){ await addNote(name,'قرأ بشكل جيد أثناء الحصة','pedagogical'); safeToast('تم حفظ الملاحظة','success'); }
        else if(action==='reading_struggle'){ await addNote(name,'تعثر في القراءة ويحتاج دعماً مركزاً','pedagogical'); safeToast('تم تسجيل التعثر','warning'); }
        else if(action==='save_note'){
          const text = panel.querySelector('#teacherFocusNote').value.trim();
          if(!text) return safeToast('اكتب الملاحظة أولاً','error');
          await addNote(name, text, 'pedagogical');
          panel.querySelector('#teacherFocusNote').value='';
          safeToast('تم حفظ الملاحظة','success');
        }
        if(window.State && State.currentProfile===name && window.UI && UI.openProfile) UI.openProfile(name);
      }catch(err){ console.warn(err); safeToast('وقع خطأ أثناء الحفظ','error'); }
    });
  }

  function patchProfileActions(){
    if(!window.UI || !UI.openProfile || UI.openProfile.__educatorPatched) return;
    const old = UI.openProfile.bind(UI);
    UI.openProfile = async function(name){
      const res = await old(name);
      try{
        const side = document.querySelector('#profileModal .profile-sidebar');
        if(side && !side.querySelector('.profile-fast-actions')){
          const box = el('div',{class:'profile-fast-actions'}, `
            <button class="btn btn-warning btn-sm" type="button" data-fast="absent">غياب اليوم</button>
            <button class="btn btn-success btn-sm" type="button" data-fast="done">الواجب منجز</button>
            <button class="btn btn-info btn-sm" type="button" data-fast="support">فتح الدعم</button>`);
          box.addEventListener('click', async (e)=>{
            const btn = e.target.closest('[data-fast]'); if(!btn) return;
            const action = btn.getAttribute('data-fast');
            const current = (window.State && State.currentProfile) || name;
            if(action==='absent'){ await ensureAttendance(current,'absent'); safeToast('تم تسجيل الغياب','warning'); UI.openProfile(current); }
            else if(action==='done'){ await ensureHomework(current,'done'); safeToast('تم تسجيل إنجاز الواجب','success'); UI.openProfile(current); }
            else if(action==='support'){
              const remStudent = document.getElementById('rem-student');
              if(remStudent) remStudent.value = current;
              if(window.switchTab) switchTab('remediation');
              const modal = document.getElementById('profileModal'); if(modal) modal.classList.remove('active');
            }
          });
          side.appendChild(box);
        }
      }catch(e){ console.warn('profile fast actions failed', e); }
      return res;
    };
    UI.openProfile.__educatorPatched = true;
  }

  ready(function(){
    buildDailyCard();
    buildFocusPanel();
    patchProfileActions();
  });
})();
