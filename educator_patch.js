(function(){
  function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  function el(tag, attrs={}, html=''){ const x=document.createElement(tag); Object.entries(attrs).forEach(([k,v])=>{ if(k==='class') x.className=v; else if(k==='id') x.id=v; else x.setAttribute(k,v); }); if(html) x.innerHTML=html; return x; }
  function safeToast(msg, type='info'){ try{ window.UI && UI.toast ? UI.toast(msg,type) : alert(msg); }catch(_){ alert(msg); } }
  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  const SETTINGS_KEY = 'class_profile_settings_v1';
  const PATCH_STATE = { quickFilter:'all', quickSearch:'', topFilter:'all' };

  async function storeGet(k, d){ try{ return await Store.get(k, d); }catch(_){ return d; } }
  async function storeSet(k, v){ try{ return await Store.set(k, v); }catch(_){ localStorage.setItem(k, JSON.stringify(v)); } }

  async function getClassSettings(){
    const teacher = await storeGet('setting_teacher', '');
    const school = await storeGet('setting_school', '');
    const data = await storeGet(SETTINGS_KEY, null);
    return Object.assign({
      school: school || '',
      teacher: teacher || '',
      level: (window.State && State.level) || '',
      group: '',
      grading: '0-10',
      subjects: 'اللغة العربية، الفرنسية، الرياضيات، التربية الإسلامية، النشاط العلمي',
      accent: '#4f46e5'
    }, data || {});
  }

  async function saveClassSettings(){
    const box = document.getElementById('classProfileSettingsCard');
    if(!box) return;
    const data = {
      school: box.querySelector('[data-setting="school"]')?.value.trim() || '',
      teacher: box.querySelector('[data-setting="teacher"]')?.value.trim() || '',
      level: box.querySelector('[data-setting="level"]')?.value.trim() || '',
      group: box.querySelector('[data-setting="group"]')?.value.trim() || '',
      grading: box.querySelector('[data-setting="grading"]')?.value.trim() || '0-10',
      subjects: box.querySelector('[data-setting="subjects"]')?.value.trim() || '',
      accent: box.querySelector('[data-setting="accent"]')?.value || '#4f46e5'
    };
    await storeSet(SETTINGS_KEY, data);
    if(data.teacher){ await storeSet('setting_teacher', data.teacher); const x=document.getElementById('setting-teacher'); if(x) x.value=data.teacher; }
    if(data.school){ await storeSet('setting_school', data.school); const x=document.getElementById('setting-school'); if(x) x.value=data.school; }
    if(window.State && data.level) State.level = data.level;
    applyAccentColor(data.accent);
    safeToast('تم حفظ إعدادات القسم', 'success');
  }

  function applyAccentColor(color){
    if(!color) return;
    document.documentElement.style.setProperty('--brand-500', color);
    document.documentElement.style.setProperty('--brand-600', color);
    document.documentElement.style.setProperty('--brand-700', color);
    document.documentElement.style.setProperty('--brand-400', color);
  }

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

  async function getWeakestSubject(){
    const grades = await DB.get('grades');
    const map = { arabic:'العربية', islamic:'الإسلامية', social:'الاجتماعيات', art:'الفنية', pe:'البدنية' };
    let weakest = { key:'', avg: 11 };
    for(const [k,label] of Object.entries(map)){
      const entries = Object.values(grades[k] || {});
      const vals = [];
      entries.forEach(g => ['t1','t2','t3','t4'].forEach(t => { const v = Number(g?.[t]); if(!isNaN(v) && g?.[t] !== '' && g?.[t] != null) vals.push(v); }));
      if(vals.length){
        const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
        if(avg < weakest.avg) weakest = { key: label, avg };
      }
    }
    return weakest.key ? weakest : null;
  }

  async function pupilSnapshot(name){
    const perf = await Engine.calculatePI(name, State.level);
    const notes = (await DB.get('notes')).filter(n => n.student === name).slice(0, 3);
    const positiveCount = notes.filter(n => n.type === 'positive').length;
    const hasReadingStruggle = notes.some(n => /تعثر|قراءة|طلاقة/i.test(n.text || ''));
    const supportStatus = perf.pi < 5 || perf.raw.absCount >= 3 || perf.raw.hwMisses >= 3;
    const excellent = perf.pi >= 8;
    return { name, perf, notes, positiveCount, hasReadingStruggle, supportStatus, excellent };
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
      <div class="focus-note" id="dailyPedagogicalNote"></div>
      <div id="dailyPedagogicalActions" class="decision-list"></div>`;
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
        const read = [], follow = [], motivate = [], mathSupport = [];
        for(const name of pupils){
          const av = attToday[name];
          const st = typeof av === 'object' ? av?.status : av;
          if(st==='absent') { absent++; follow.push(name); }
          if(st==='late') late++;
          if(hwToday[name]==='not_done') notDone++;
          try{
            const snap = await pupilSnapshot(name);
            if(snap.perf.pi < 5 || snap.perf.raw.absCount >= 3 || snap.perf.raw.hwMisses >= 3) priority++;
            if(snap.hasReadingStruggle || snap.perf.raw.fluAvg < 5) read.push(name);
            if(snap.excellent || snap.positiveCount >= 1) motivate.push(name);
            const grades = await DB.get('grades');
            const math = Number((grades.math || {})?.[name]?.t1);
            if(!isNaN(math) && math < 5) mathSupport.push(name);
          }catch(_){ }
        }
        const kpis = [ ['المتعلمون', pupils.length], ['غائبون اليوم', absent], ['تأخرات', late], ['أولوية للدعم', priority] ];
        const kpiEl = document.getElementById('dailyPedagogicalKpis');
        if(kpiEl) kpiEl.innerHTML = kpis.map(([k,v])=>`<div class="focus-kpi"><b>${v}</b><span>${k}</span></div>`).join('');
        const noteEl = document.getElementById('dailyPedagogicalNote');
        if(noteEl) noteEl.innerHTML = priority > 0
          ? `لديك اليوم <b>${priority}</b> حالات تحتاج تدخلاً واضحاً. ابدأ بالقراءة والدعم القصير، ثم مرّ للواجب والغياب.`
          : `الوضعية العامة مستقرة اليوم. ركّز على التثبيت، التقويم السريع، والتحفيز.`;
        const actionEl = document.getElementById('dailyPedagogicalActions');
        if(actionEl){
          const rows = [
            ['📖 راجع القراءة مع', read.slice(0,3)],
            ['📅 تابع الغياب مع', follow.slice(0,3)],
            ['⭐ حفّز وابرز', motivate.slice(0,3)],
            ['🔢 دعم الرياضيات لـ', mathSupport.slice(0,3)]
          ].filter(([,arr]) => arr.length);
          actionEl.innerHTML = rows.length ? rows.map(([title,arr]) => `<div class="decision-item"><strong>${title}</strong><span>${arr.join('، ')}</span></div>`).join('') : '<div class="decision-item"><strong>جاهز</strong><span>لا توجد حالات مستعجلة اليوم.</span></div>';
        }
      }catch(e){ console.warn('daily card render failed', e); }
    }
    render();
    if(typeof window.registerDataChangeHook === 'function' && !window.__educatorDataRefreshHook){
      window.__educatorDataRefreshHook = true;
      window.registerDataChangeHook((type)=>{
        if(['attendance','homework','notes','grades','fluency'].includes(type)){
          setTimeout(render, 60);
          setTimeout(()=>renderQuickMode(), 90);
          setTimeout(()=>renderAnalyticsLite(), 120);
          setTimeout(()=>renderTopUtilityResults(), 140);
        }
      });
    }
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
      sel.innerHTML = names.length ? names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('') : '<option value="">لا يوجد متعلمون</option>';
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
        renderQuickMode();
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

  async function buildSettingsEnhancer(){
    const tab = document.getElementById('tab-settings');
    if(!tab || document.getElementById('classProfileSettingsCard')) return;
    const data = await getClassSettings();
    const accountCard = tab.querySelector('.card:last-of-type');
    const card = el('div',{id:'classProfileSettingsCard', class:'card educator-section-card'});
    card.innerHTML = `
      <div class="card-header"><div class="card-title"><div class="icon">🏫</div>إعدادات القسم والطباعة</div></div>
      <div class="card-body educator-settings-grid">
        <div class="form-group"><label class="form-label">اسم المؤسسة</label><input class="form-control" data-setting="school" value="${esc(data.school)}" placeholder="اسم المؤسسة"></div>
        <div class="form-group"><label class="form-label">اسم الأستاذ</label><input class="form-control" data-setting="teacher" value="${esc(data.teacher)}" placeholder="اسم الأستاذ"></div>
        <div class="form-group"><label class="form-label">المستوى</label><input class="form-control" data-setting="level" value="${esc(data.level)}" placeholder="مثال: 6"></div>
        <div class="form-group"><label class="form-label">الفوج</label><input class="form-control" data-setting="group" value="${esc(data.group)}" placeholder="فوج أ"></div>
        <div class="form-group"><label class="form-label">سلم التنقيط</label><input class="form-control" data-setting="grading" value="${esc(data.grading)}" placeholder="0-10"></div>
        <div class="form-group"><label class="form-label">لون الواجهة</label><input class="form-control educator-color-input" type="color" data-setting="accent" value="${esc(data.accent)}"></div>
        <div class="form-group full"><label class="form-label">المواد المعتمدة</label><textarea class="form-control" data-setting="subjects" placeholder="المواد مفصولة بفواصل">${esc(data.subjects)}</textarea></div>
        <div class="educator-inline-actions full">
          <button class="btn btn-primary" type="button" id="saveClassProfileSettingsBtn">💾 حفظ إعدادات القسم</button>
          <div class="educator-soft-note">تُستخدم هذه المعطيات في الطباعة، القرارات اليومية، والتقارير.</div>
        </div>
      </div>`;
    if(accountCard) tab.insertBefore(card, accountCard);
    else tab.prepend(card);
    card.querySelector('#saveClassProfileSettingsBtn').onclick = saveClassSettings;
    applyAccentColor(data.accent);
  }

  async function getQuickRows(){
    const pupils = PupilMgr.getPupilNames();
    const today = (window.State && State.today) || new Date().toISOString().split('T')[0];
    const attendance = await DB.get('attendance');
    const homework = await DB.get('homework');
    const notes = await DB.get('notes');
    const att = attendance[today] || {};
    const hw = homework[today] || {};
    const rows = [];
    for(const name of pupils){
      const snap = await pupilSnapshot(name);
      const av = att[name];
      const status = typeof av === 'object' ? av?.status : av;
      rows.push({
        name,
        status: status || 'present',
        homework: hw[name] || '',
        note: (notes.find(n => n.student === name)?.text || ''),
        support: snap.supportStatus,
        excellent: snap.excellent
      });
    }
    return rows;
  }

  async function renderQuickMode(){
    const tab = document.getElementById('tab-today-class');
    if(!tab || !window.PupilMgr) return;
    let host = document.getElementById('educatorQuickModeCard');
    if(!host){
      host = el('div',{id:'educatorQuickModeCard', class:'card educator-section-card'});
      tab.prepend(host);
      host.addEventListener('click', async (e)=>{
        const btn = e.target.closest('[data-qaction]');
        const row = e.target.closest('[data-student]');
        if(!btn || !row) return;
        const name = row.getAttribute('data-student');
        const action = btn.getAttribute('data-qaction');
        if(action==='present') await ensureAttendance(name,'present');
        else if(action==='absent') await ensureAttendance(name,'absent');
        else if(action==='done') await ensureHomework(name,'done');
        else if(action==='not_done') await ensureHomework(name,'not_done');
        else if(action==='reading_ok') await addNote(name,'قرأ جيداً أثناء الحصة','pedagogical');
        else if(action==='reading_struggle') await addNote(name,'تعثر في القراءة أثناء الحصة','pedagogical');
        else if(action==='star') await addNote(name,'استحق نجمة تحفيزية اليوم','positive');
        safeToast('تم الحفظ', action==='absent' || action==='reading_struggle' || action==='not_done' ? 'warning' : 'success');
        renderQuickMode();
      });
      host.addEventListener('input', (e)=>{
        if(e.target.id==='quickModeSearch'){ PATCH_STATE.quickSearch = e.target.value.trim(); renderQuickMode(); }
      });
      host.addEventListener('click', (e)=>{
        const chip = e.target.closest('[data-qfilter]');
        if(!chip) return;
        PATCH_STATE.quickFilter = chip.getAttribute('data-qfilter');
        renderQuickMode();
      });
    }
    const rows = await getQuickRows();
    const filtered = rows.filter(r => {
      const matchesText = !PATCH_STATE.quickSearch || r.name.includes(PATCH_STATE.quickSearch);
      const f = PATCH_STATE.quickFilter;
      const matchesFilter = f==='all' || (f==='absent' && r.status==='absent') || (f==='support' && r.support) || (f==='excellent' && r.excellent);
      return matchesText && matchesFilter;
    });
    host.innerHTML = `
      <div class="card-header">
        <div class="card-title"><div class="icon">⚡</div>وضع العمل السريع داخل الحصة</div>
      </div>
      <div class="card-body">
        <div class="educator-toolbar">
          <input id="quickModeSearch" class="form-control" placeholder="بحث سريع عن متعلم..." value="${esc(PATCH_STATE.quickSearch)}">
          <div class="educator-chips">
            <button class="educator-chip ${PATCH_STATE.quickFilter==='all'?'active':''}" data-qfilter="all">الكل</button>
            <button class="educator-chip ${PATCH_STATE.quickFilter==='absent'?'active':''}" data-qfilter="absent">الغياب</button>
            <button class="educator-chip ${PATCH_STATE.quickFilter==='support'?'active':''}" data-qfilter="support">الدعم</button>
            <button class="educator-chip ${PATCH_STATE.quickFilter==='excellent'?'active':''}" data-qfilter="excellent">التميز</button>
          </div>
        </div>
        <div class="educator-quick-list">
          ${filtered.length ? filtered.map(r => `
            <div class="educator-quick-row ${r.support ? 'is-support':''} ${r.excellent ? 'is-excellent':''}" data-student="${esc(r.name)}">
              <div class="educator-quick-meta" onclick="UI.openProfile('${esc(r.name).replace(/&#39;/g,"\\'")}')">
                <strong>${esc(r.name)}</strong>
                <span>${r.status==='absent'?'غائب اليوم':'حاضر'}${r.homework==='not_done'?' · لم ينجز الواجب':''}${r.note?` · ${esc(r.note.slice(0,40))}`:''}</span>
              </div>
              <div class="educator-quick-actions">
                <button class="btn btn-xs btn-success" data-qaction="present">حاضر</button>
                <button class="btn btn-xs btn-danger" data-qaction="absent">غائب</button>
                <button class="btn btn-xs btn-info" data-qaction="done">أنجز</button>
                <button class="btn btn-xs btn-warning" data-qaction="not_done">لم ينجز</button>
                <button class="btn btn-xs btn-ghost" data-qaction="reading_ok">قرأ</button>
                <button class="btn btn-xs btn-ghost" data-qaction="reading_struggle">تعثر</button>
                <button class="btn btn-xs btn-primary" data-qaction="star">⭐</button>
              </div>
            </div>`).join('') : '<div class="empty-state"><div class="empty-icon">🎯</div><p>لا توجد نتائج مطابقة.</p></div>'}
        </div>
      </div>`;
  }

  async function renderAnalyticsLite(){
    const tab = document.getElementById('tab-class-analysis');
    if(!tab || !window.PupilMgr) return;
    let host = document.getElementById('educatorAnalyticsLite');
    if(!host){
      host = el('div',{id:'educatorAnalyticsLite', class:'card educator-section-card'});
      tab.prepend(host);
    }
    const pupils = PupilMgr.getPupilNames();
    let absent = 0, support = 0, excellent = 0;
    for(const name of pupils){
      const snap = await pupilSnapshot(name);
      if(snap.perf.raw.absCount > 0) absent += 1;
      if(snap.supportStatus) support += 1;
      if(snap.excellent) excellent += 1;
    }
    const weakest = await getWeakestSubject();
    host.innerHTML = `
      <div class="card-header"><div class="card-title"><div class="icon">🧭</div>تحليل مفيد لاتخاذ القرار</div></div>
      <div class="card-body">
        <div class="educator-stat-grid">
          <div class="educator-stat"><b>${pupils.length}</b><span>عدد المتعلمين</span></div>
          <div class="educator-stat"><b>${support}</b><span>أولوية دعم</span></div>
          <div class="educator-stat"><b>${excellent}</b><span>في مستوى التميز</span></div>
          <div class="educator-stat"><b>${absent}</b><span>لهم غياب مسجل</span></div>
        </div>
        <div class="decision-list" style="margin-top:12px">
          <div class="decision-item"><strong>المادة الأضعف</strong><span>${weakest ? `${weakest.key} — ${weakest.avg.toFixed(2)}/10` : 'لا توجد معطيات كافية بعد'}</span></div>
          <div class="decision-item"><strong>المطلوب الآن</strong><span>ركز على الغياب، الدعم الفردي، وتتبع القراءة قبل أي رسوم أو مؤشرات شكلية.</span></div>
        </div>
      </div>`;
  }

  async function buildTopUtilityBar(){
    const cont = document.getElementById('tabContainer');
    if(!cont || document.getElementById('educatorTopUtilityBar')) return;
    const bar = el('div',{id:'educatorTopUtilityBar'}, `
      <input id="educatorGlobalSearch" class="form-control" placeholder="ابحث عن متعلم وافتح بطاقته مباشرة...">
      <div class="educator-chips">
        <button class="educator-chip active" data-topfilter="all">الكل</button>
        <button class="educator-chip" data-topfilter="absent">غياب</button>
        <button class="educator-chip" data-topfilter="support">دعم</button>
        <button class="educator-chip" data-topfilter="excellent">تميز</button>
      </div>
      <div id="educatorTopResults" class="educator-top-results"></div>`);
    cont.parentNode.insertBefore(bar, cont);
    bar.addEventListener('input', ()=> renderTopUtilityResults());
    bar.addEventListener('click', (e)=>{
      const chip = e.target.closest('[data-topfilter]');
      const item = e.target.closest('[data-open-student]');
      if(item){ UI.openProfile(item.getAttribute('data-open-student')); return; }
      if(!chip) return;
      PATCH_STATE.topFilter = chip.getAttribute('data-topfilter');
      bar.querySelectorAll('.educator-chip').forEach(c => c.classList.toggle('active', c===chip));
      renderTopUtilityResults();
    });
    renderTopUtilityResults();
  }

  async function renderTopUtilityResults(){
    const search = document.getElementById('educatorGlobalSearch');
    const box = document.getElementById('educatorTopResults');
    if(!search || !box || !window.PupilMgr) return;
    const q = search.value.trim();
    const rows = await getQuickRows();
    const filtered = rows.filter(r => {
      const tq = !q || r.name.includes(q);
      const f = PATCH_STATE.topFilter;
      const tf = f==='all' || (f==='absent' && r.status==='absent') || (f==='support' && r.support) || (f==='excellent' && r.excellent);
      return tq && tf;
    }).slice(0,6);
    box.innerHTML = filtered.length ? filtered.map(r => `<button type="button" class="educator-result-item" data-open-student="${esc(r.name)}">${esc(r.name)}<span>${r.status==='absent'?'غياب':'متابعة'}</span></button>`).join('') : '<span class="educator-soft-note">لا توجد نتائج حالياً.</span>';
  }

  function registerTabHooks(){
    if(typeof window.registerAfterTabChangeHook!=='function' || window.__educatorTabHooksReady) return;
    window.__educatorTabHooksReady = true;
    window.registerAfterTabChangeHook((tabId)=>{
      try{
        if(tabId==='settings') buildSettingsEnhancer();
        if(tabId==='today-class') renderQuickMode();
        if(tabId==='class-analysis') renderAnalyticsLite();
        if(tabId==='dashboard') renderTopUtilityResults();
      }catch(e){ console.warn(e); }
    });
  }

  ready(async function(){
    try{
      const s = await getClassSettings();
      applyAccentColor(s.accent);
      buildDailyCard();
      buildFocusPanel();
      patchProfileActions();
      buildSettingsEnhancer();
      renderQuickMode();
      renderAnalyticsLite();
      buildTopUtilityBar();
      registerTabHooks();
    }catch(e){ console.warn('educator patch init failed', e); }
  });
})();
