/* Engineer's Desk — offline study app for civil-engineering competitive exams */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const V = $('#view');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cache = {};
let INDEX = null;

/* ---------- storage ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('ed_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ed_' + k, JSON.stringify(v)); } catch (e) { } }
};
const S = {
  read: store.get('read', {}),          // {sid: {ci:1}}
  last: store.get('last', null),        // {s, c, title}
  marks: store.get('marks', []),        // [{s,c,p,t}]
  stats: store.get('stats', {}),        // {sid: {n: [right, wrong]}}
  mocks: store.get('mocks', {}),        // {i: {score, date, per}}
  plan: store.get('plan', {}),          // {date: 1}
  theme: store.get('theme', 'dark'),
  font: store.get('font', 16)
};
const save = k => store.set(k, S[k]);

function applyPrefs() {
  document.body.classList.toggle('light', S.theme === 'light');
  document.documentElement.style.setProperty('--fs', S.font + 'px');
}

async function load(name) {
  if (cache[name]) return cache[name];
  const r = await fetch('data/' + name + '.json');
  return (cache[name] = await r.json());
}
const subj = id => INDEX.subjects.find(s => s.id === id);

/* ---------- chrome ---------- */
function setBar(title, back = true, tab = '') {
  $('#title').textContent = title;
  $('#back').style.visibility = back ? 'visible' : 'hidden';
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
}
$('#back').onclick = () => history.length > 1 ? history.back() : (location.hash = '#/');
$('#searchBtn').onclick = () => location.hash = '#/search';

function modal(html) {
  const m = $('#modal'); m.innerHTML = `<div class="box">${html}</div>`; m.hidden = false;
  m.onclick = e => { if (e.target === m || e.target.dataset.close != null) m.hidden = true; };
}

function toast(msg, undo) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button id="undoBtn">UNDO</button>' : ''}`;
  t.className = 'show'; clearTimeout(t._h); t._h = setTimeout(() => t.className = '', 6000);
  if (undo) document.getElementById('undoBtn').onclick = () => { t.className = ''; undo(); };
}

/* ---------- rendering of handbook content ---------- */
function blocks(bs) {
  let h = '', ul = false;
  for (const b of bs) {
    if (b[0] === 'li') { if (!ul) { h += '<ul>'; ul = true; } h += `<li>${b[1]}</li>`; continue; }
    if (ul) { h += '</ul>'; ul = false; }
    if (b[0] === 'p') h += `<p>${b[1]}</p>`;
    else if (b[0] === 'call') h += `<div class="call">${b[1]}</div>`;
    else if (b[0] === 'new') h += `<div class="new">➕ ${b[1]}</div>`;
    else if (b[0] === 'img') h += `<figure><img loading="lazy" src="data/${b[1]}" alt=""><figcaption>🔍 Tap to zoom · ${esc(b[2] || '')}</figcaption></figure>`;
    else if (b[0] === 'tbl') {
      const [hd, ...rows] = b[1];
      h += '<div class="tw"><table><tr>' + hd.map(c => `<th>${esc(c)}</th>`).join('') + '</tr>' +
        rows.map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') + '</table></div>';
    }
  }
  if (ul) h += '</ul>';
  return h;
}
function section(node, path, lvl, open) {
  const id = 'n' + path.join('-');
  return `<details id="${id}" ${open ? 'open' : ''}><summary>${esc(node.t)}</summary>${blocks(node.b)}${node.s.map((s, i) => section(s, path.concat(i), lvl + 1, false)).join('')}</details>`;
}

/* ---------- views ---------- */
const routes = [];
const route = (re, fn) => routes.push([re, fn]);

function todayISO() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

route(/^#?\/?$/, async () => {
  setBar("Engineer's Desk", false, 'home');
  const plan = await load('plan');
  const t = todayISO();
  const today = plan.find(r => r[0] === t) || plan.find(r => r[0] > t);
  const doneDays = Object.keys(S.plan).length;
  let h = `<div class="card hero"><div class="mut">${new Date().toDateString()}</div>
    <h2 style="margin:6px 0">${today ? (today[0] === t ? "Today's task" : 'Next task (' + today[0] + ')') : 'Plan finished — keep revising'}</h2>
    ${today ? `<div><b>${esc(today[4])}</b></div><div class="mut">${esc(today[5] || '')}</div>` : ''}
    <div class="pbar"><i style="width:${Math.round(doneDays / plan.length * 100)}%"></i></div>
    <div class="mut" style="margin-top:6px">${doneDays} of ${plan.length} plan days done</div></div>`;
  if (S.last) h += `<a class="row" href="#/c/${S.last.s}/${S.last.c}"><span style="font-size:1.4em">📖</span><span style="flex:1"><div class="mut">Continue reading</div><b>${esc(S.last.title)}</b></span>›</a>`;
  h += `<div class="seg" style="margin-top:8px"><a class="btn" href="#/practice">✅ Practice MCQs</a><a class="btn sec" href="#/calc">🧮 Calculators</a><a class="btn sec" href="#/mocks">⏱️ Mock tests</a><a class="btn sec" href="#/marks">🔖 Bookmarks</a></div>`;
  h += `<h2>Subjects (most asked first)</h2>` + tiles('core');
  h += `<h2>Exam toolkit</h2>` + tiles('tool');
  V.innerHTML = h;
});

function tiles(group) {
  return '<div class="grid">' + INDEX.subjects.filter(s => s.group === group).map(s => {
    const r = Object.keys(S.read[s.id] || {}).length, p = Math.round(r / Math.max(1, s.nch) * 100);
    return `<a class="tile" href="#/s/${s.id}"><div class="ic">${s.icon}</div><b>${esc(s.title)}</b><div class="mut">${s.nch} topics${s.nmcq ? ' · ' + s.nmcq + ' MCQs' : ''}</div><div class="bar"><i style="width:${p}%"></i></div></a>`;
  }).join('') + '</div>';
}

route(/^#\/subjects$/, () => {
  setBar('Subjects', false, 'subjects');
  V.innerHTML = `<h2>Core subjects</h2>${tiles('core')}<h2>Exam toolkit</h2>${tiles('tool')}`;
});

route(/^#\/s\/(\w+)$/, async (id) => {
  const s = subj(id); setBar(s.title, true, 'subjects');
  const d = await load(id);
  const read = S.read[id] || {};
  let h = `<div class="card"><div style="font-size:1.8em">${s.icon}</div><b>${esc(s.title)}</b>
    <div class="mut">${s.nch} topics · about ${s.mins} min reading${s.nmcq ? ' · ' + s.nmcq + ' MCQs' : ''}</div>
    <div class="seg" style="margin-top:10px">${s.nmcq ? `<a class="btn" href="#/quiz/${id}">✅ Practice MCQs</a>` : ''}
    <a class="btn sec" href="#/rev/${id}">⚡ Quick revision</a></div></div><div class="list">`;
  let n = 0;
  d.chapters.forEach((c, i) => {
    if (/^PART [IVX]+/.test(c.t) && !c.b.length && !c.s.length) { h += `<div class="part">${esc(c.t)}</div>`; return; }
    n++;
    h += `<a href="#/c/${id}/${i}" class="${read[i] ? 'done' : ''}"><span class="n" ${read[i] ? `data-unread="${i}" title="Tap to mark as unread"` : ''}>${read[i] ? '✓' : n}</span><span class="t">${esc(c.t)}</span>${c.k === 'rev' ? '<span class="tag rev">revision</span>' : c.k === 'res' ? '<span class="tag">links</span>' : ''}</a>`;
  });
  V.innerHTML = h + '<div class="mut" style="margin:10px 4px">Tip: tap a green ✓ to mark that topic as unread.</div></div>';
  V.querySelectorAll('[data-unread]').forEach(el => el.onclick = e => {
    e.preventDefault(); e.stopPropagation(); const i = +el.dataset.unread;
    delete S.read[id][i]; save('read'); render();
    toast('Marked as unread', () => { S.read[id][i] = 1; save('read'); render(); });
  });
});

route(/^#\/c\/(\w+)\/(\d+)(?:\/([\d-]+))?$/, async (id, ci, path) => {
  const d = await load(id); ci = +ci; const c = d.chapters[ci];
  setBar(c.t, true, 'subjects');
  S.last = { s: id, c: ci, title: c.t }; save('last');
  const marked = S.marks.some(m => m.s === id && m.c === ci);
  let h = `<div class="reader"><h2>${esc(c.t)}</h2><div class="mut">${esc(subj(id).title)}</div>${blocks(c.b)}`;
  h += c.s.map((s, i) => section(s, [i], 2, c.s.length <= 3)).join('');
  const prev = ci > 0 ? ci - 1 : null, next = ci < d.chapters.length - 1 ? ci + 1 : null;
  const read = (S.read[id] || {})[ci];
  h += `</div><div class="card"><button class="btn wide ${read ? 'sec' : ''}" id="mark">${read ? '✓ Read — tap to mark as unread' : 'Mark as read'}</button>
    <div class="seg"><button class="btn sec" id="bm">${marked ? '🔖 Bookmarked' : '🔖 Bookmark'}</button>
    <button class="btn sec" id="expand">Open all</button></div>
    <div class="seg">${prev != null ? `<a class="btn sec" href="#/c/${id}/${prev}">‹ Previous</a>` : ''}${next != null ? `<a class="btn sec" href="#/c/${id}/${next}">Next ›</a>` : ''}</div></div>`;
  V.innerHTML = h;
  window.scrollTo(0, 0);
  if (path) { // open the searched section
    const parts = path.split('-'); let sel = 'n';
    parts.forEach((p, k) => { sel += (k ? '-' : '') + p; const el = document.getElementById(sel); if (el) el.open = true; });
    const el = document.getElementById(sel); if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 60);
  }
  $('#mark').onclick = () => {
    S.read[id] = S.read[id] || {};
    if (S.read[id][ci]) { delete S.read[id][ci]; save('read'); const m = $('#mark'); m.textContent = 'Mark as read'; m.classList.remove('sec'); toast('Marked as unread'); return; }
    S.read[id][ci] = 1; save('read');
    const undo = () => { delete S.read[id][ci]; save('read'); location.hash = `#/c/${id}/${ci}`; };
    if (next != null) { location.hash = `#/c/${id}/${next}`; setTimeout(() => toast(`“${c.t}” marked as read`, undo), 150); }
    else { const m = $('#mark'); m.textContent = '✓ Read — tap to mark as unread'; m.classList.add('sec'); toast('Marked as read', undo); }
  };
  $('#bm').onclick = () => {
    const i = S.marks.findIndex(m => m.s === id && m.c === ci);
    if (i >= 0) S.marks.splice(i, 1); else S.marks.unshift({ s: id, c: ci, t: c.t });
    save('marks'); $('#bm').textContent = i >= 0 ? '🔖 Bookmark' : '🔖 Bookmarked';
  };
  $('#expand').onclick = e => { const all = [...V.querySelectorAll('details')]; const o = !all.every(x => x.open); all.forEach(x => x.open = o); e.target.textContent = o ? 'Close all' : 'Open all'; };
});

route(/^#\/rev\/(\w+)$/, async id => {
  const s = subj(id); setBar('Quick revision · ' + s.title, true, 'subjects');
  const d = await load(id);
  let calls = [];
  const walk = (n, where) => { n.b.forEach(b => { if (b[0] === 'call') calls.push([where, b[1]]); }); n.s.forEach(x => walk(x, where)); };
  d.chapters.forEach((c, i) => walk(c, i));
  let h = `<div class="mut">Every exam point from the notes, then the formula, number, trap and code-difference chapters.</div><h2>Exam points (${calls.length})</h2>`;
  h += calls.map(([i, t]) => `<div class="call">${t} <a class="mut" href="#/c/${id}/${i}">› ${esc(d.chapters[i].t)}</a></div>`).join('');
  const revs = d.chapters.map((c, i) => [c, i]).filter(([c]) => c.k === 'rev');
  if (revs.length) h += '<h2>Revision chapters</h2><div class="list">' + revs.map(([c, i]) => `<a href="#/c/${id}/${i}"><span class="n">⚡</span><span class="t">${esc(c.t)}</span></a>`).join('') + '</div>';
  V.innerHTML = '<div class="reader">' + h + '</div>';
});

/* ---------- search ---------- */
let SEARCH = null;
route(/^#\/search$/, async () => {
  setBar('Search', true, '');
  V.innerHTML = `<input type="search" id="q" placeholder="Search all notes, e.g. slump, Lacey, NEQS" autofocus><div id="res" class="mut" style="margin-top:8px">Type at least 2 letters.</div>`;
  if (!SEARCH) SEARCH = await load('search');
  const q = $('#q'); q.value = sessionStorage.getItem('lastq') || ''; q.focus();
  const run = () => {
    const v = q.value.trim().toLowerCase(); sessionStorage.setItem('lastq', q.value);
    if (v.length < 2) { $('#res').innerHTML = 'Type at least 2 letters.'; return; }
    const words = v.split(/\s+/);
    const hits = [];
    for (const [sid, ci, path, t, txt] of SEARCH) {
      const tl = t.toLowerCase(), xl = txt.toLowerCase();
      if (!words.every(w => tl.includes(w) || xl.includes(w))) continue;
      const score = words.reduce((a, w) => a + (tl.includes(w) ? 5 : 0) + (xl.split(w).length - 1), 0);
      hits.push([score, sid, ci, path, t, txt]);
      if (hits.length > 400) break;
    }
    hits.sort((a, b) => b[0] - a[0]);
    const re = new RegExp('(' + words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig');
    $('#res').innerHTML = `<div class="mut">${hits.length} results</div>` + hits.slice(0, 80).map(([, sid, ci, path, t, txt]) => {
      const xl = txt.toLowerCase(); let k = Math.max(0, xl.indexOf(words[0]) - 60);
      const snip = esc(txt.slice(k, k + 180)).replace(re, '<mark>$1</mark>');
      return `<a class="hit" href="#/c/${sid}/${ci}${path.length ? '/' + path.join('-') : ''}"><b>${esc(t).replace(re, '<mark>$1</mark>')}</b><small>${subj(sid).icon} ${esc(subj(sid).title)}</small><div class="mut">${k ? '…' : ''}${snip}…</div></a>`;
    }).join('');
  };
  q.oninput = run; if (q.value) run();
});

/* ---------- practice ---------- */
route(/^#\/practice$/, () => {
  setBar('Practice', false, 'practice');
  let h = `<a class="row" href="#/mocks"><span style="font-size:1.4em">⏱️</span><span style="flex:1"><b>Mock tests (5 × 100 MCQs)</b><div class="mut">90-minute timed papers, marked by subject</div></span>›</a>
    <a class="row" href="#/quiz/all"><span style="font-size:1.4em">🎲</span><span style="flex:1"><b>Mixed quick quiz</b><div class="mut">20 random MCQs from all subjects</div></span>›</a>
    <a class="row" href="#/quiz/wrong"><span style="font-size:1.4em">🔁</span><span style="flex:1"><b>My mistakes</b><div class="mut">Questions you answered wrong last time</div></span>›</a><h2>By subject</h2><div class="list">`;
  INDEX.subjects.filter(s => s.nmcq).forEach(s => {
    const st = S.stats[s.id] || {}; const done = Object.keys(st).length; const right = Object.values(st).filter(x => x[2] === 1).length;
    h += `<a href="#/quiz/${s.id}"><span class="n">${s.icon}</span><span class="t">${esc(s.title)}<div class="mut">${done}/${s.nmcq} tried${done ? ' · ' + Math.round(right / done * 100) + '% right' : ''}</div></span>›</a>`;
  });
  V.innerHTML = h + '</div>';
});

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

route(/^#\/quiz\/(\w+)$/, async id => {
  let pool = [], title;
  if (id === 'all' || id === 'wrong') {
    const subs = INDEX.subjects.filter(s => s.nmcq);
    for (const s of subs) { const d = await load(s.id); d.mcq.forEach(q => pool.push({ ...q, sid: s.id })); }
    if (id === 'wrong') pool = pool.filter(q => (S.stats[q.sid] || {})[q.n] && S.stats[q.sid][q.n][2] === 0);
    title = id === 'all' ? 'Mixed quick quiz' : 'My mistakes';
    pool = shuffle(pool).slice(0, id === 'all' ? 20 : 50);
  } else {
    const d = await load(id); pool = d.mcq.map(q => ({ ...q, sid: id })); title = subj(id).title;
  }
  setBar(title, true, 'practice');
  if (!pool.length) { V.innerHTML = `<div class="card">Nothing here yet. ${id === 'wrong' ? 'Questions you get wrong will appear here.' : ''}</div>`; return; }
  if (id !== 'all' && id !== 'wrong') {
    V.innerHTML = `<div class="card"><b>${esc(title)}</b><div class="mut">${pool.length} questions</div><h2>How many?</h2>
      <div class="seg"><button class="btn sec" data-n="10">10</button><button class="btn sec" data-n="25">25</button><button class="btn sec" data-n="50">50</button><button class="btn sec" data-n="0">All (in order)</button></div>
      <div class="seg"><button class="btn sec" data-n="-1">Only untried</button><button class="btn sec" data-n="-2">Only wrong ones</button></div></div>`;
    V.querySelectorAll('[data-n]').forEach(b => b.onclick = () => {
      const n = +b.dataset.n; let p = pool;
      const st = S.stats[id] || {};
      if (n === -1) p = pool.filter(q => !st[q.n]); else if (n === -2) p = pool.filter(q => st[q.n] && st[q.n][2] === 0);
      else if (n > 0) p = shuffle(pool.slice()).slice(0, n);
      if (!p.length) { b.textContent = 'none left'; return; }
      runQuiz(p, title);
    });
  } else runQuiz(pool, title);
});

function runQuiz(qs, title) {
  let i = 0, right = 0;
  const show = () => {
    if (i >= qs.length) {
      V.innerHTML = `<div class="card" style="text-align:center"><div class="mut">${esc(title)}</div><div class="score">${right} / ${qs.length}</div><div>${Math.round(right / qs.length * 100)}%</div>
      <a class="btn" href="#/practice">Back to practice</a><a class="btn sec" href="#/quiz/wrong">Review mistakes</a></div>`; return;
    }
    const q = qs[i];
    V.innerHTML = `<div class="top"><span class="mut">Question ${i + 1} of ${qs.length}</span><span class="mut">${right} right</span></div>
      <div class="pbar"><i style="width:${i / qs.length * 100}%"></i></div>
      <div class="card"><div class="mut">${subj(q.sid).icon} ${esc(subj(q.sid).title)}</div><div class="q">${esc(q.q)}</div>
      ${q.o.map((o, k) => `<button class="opt" data-k="${k}">(${'abcd'[k]}) ${esc(o)}</button>`).join('')}<div id="after"></div></div>`;
    V.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (V.querySelector('.opt.ok')) return;
      const k = +b.dataset.k, ok = k === q.a;
      V.querySelectorAll('.opt')[q.a].classList.add('ok'); if (!ok) b.classList.add('bad');
      if (ok) right++;
      const st = S.stats[q.sid] = S.stats[q.sid] || {}; const r = st[q.n] || [0, 0, 0];
      st[q.n] = [r[0] + (ok ? 1 : 0), r[1] + (ok ? 0 : 1), ok ? 1 : 0]; save('stats');
      $('#after').innerHTML = (q.w ? `<div class="why">${esc(q.w)}</div>` : '') + `<button class="btn wide" id="nx">${i + 1 < qs.length ? 'Next ›' : 'See score'}</button>`;
      $('#nx').onclick = () => { i++; show(); window.scrollTo(0, 0); };
    });
  };
  show();
}

/* ---------- mock tests ---------- */
route(/^#\/mocks$/, async () => {
  setBar('Mock tests', true, 'practice');
  const m = await load('mocks');
  let h = `<div class="card mut">100 engineering MCQs each, mixed like PPSC/FPSC papers. 90 minutes, no going back to check notes. Space the tests a few days apart.</div><div class="list">`;
  m.tests.forEach((t, i) => { const r = S.mocks[i]; h += `<a href="#/mock/${i}"><span class="n">${i + 1}</span><span class="t">${esc(t.t)}<div class="mut">${r ? 'Last score ' + r.score + '/100 · ' + r.date : 'Not attempted'}</div></span>›</a>`; });
  V.innerHTML = h + '</div>';
});

let mockTimer = null;
route(/^#\/mock\/(\d+)$/, async n => {
  const m = await load('mocks'); const t = m.tests[+n]; setBar(t.t, true, 'practice');
  V.innerHTML = `<div class="card"><b>${esc(t.t)}</b><p>${t.q.length} questions · 90 minutes. Answers are shown only at the end, with marks per subject.</p><button class="btn wide" id="go">Start the clock</button></div>`;
  $('#go').onclick = () => {
    const ans = new Array(t.q.length).fill(null); let i = 0; const end = Date.now() + 90 * 60000;
    clearInterval(mockTimer);
    const finish = () => {
      clearInterval(mockTimer);
      const per = {}; let sc = 0;
      t.q.forEach((q, k) => { const s = q.subj || 'Other'; per[s] = per[s] || [0, 0]; per[s][1]++; if (ans[k] === q.a) { per[s][0]++; sc++; } });
      S.mocks[n] = { score: sc, date: todayISO(), per }; save('mocks');
      let h = `<div class="card" style="text-align:center"><div class="score">${sc} / ${t.q.length}</div><div>${sc >= 70 ? 'Ready — keep it up' : sc >= 55 ? 'Revise the weak subjects below' : 'Go back to the handbooks first'}</div></div><h2>By subject</h2>`;
      h += Object.entries(per).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]).map(([s, [r, tot]]) => `<div class="row"><span style="flex:1">${esc(s)}</span><b>${r}/${tot}</b></div>`).join('');
      h += '<h2>Answers</h2>' + t.q.map((q, k) => `<div class="card"><div class="q">Q${k + 1}. ${esc(q.q)}</div><div style="color:${ans[k] === q.a ? 'var(--ok)' : 'var(--bad)'}">${ans[k] == null ? 'Not answered' : 'Your answer: (' + 'abcd'[ans[k]] + ') ' + esc(q.o[ans[k]])}</div><div>Correct: (${'abcd'[q.a]}) ${esc(q.o[q.a])}</div>${q.w ? `<div class="why">${esc(q.w)}</div>` : ''}</div>`).join('');
      V.innerHTML = h; window.scrollTo(0, 0);
    };
    const show = () => {
      const q = t.q[i];
      V.innerHTML = `<div class="top"><span class="mut">Q ${i + 1}/${t.q.length} · answered ${ans.filter(a => a != null).length}</span><span class="timer" id="tm"></span></div>
        <div class="card"><div class="q">${esc(q.q)}</div>${q.o.map((o, k) => `<button class="opt ${ans[i] === k ? 'pick' : ''}" data-k="${k}">(${'abcd'[k]}) ${esc(o)}</button>`).join('')}</div>
        <div class="seg"><button class="btn sec" id="pv">‹ Prev</button><button class="btn sec" id="nx">Next ›</button><button class="btn" id="fin">Finish</button></div>
        <div class="grid" style="grid-template-columns:repeat(10,1fr);gap:4px;margin-top:10px">${t.q.map((_, k) => `<button class="opt" style="padding:6px 0;margin:0;text-align:center;font-size:.75em;${ans[k] != null ? 'border-color:var(--acc2)' : ''}${k === i ? ';background:var(--acc);color:#1d1400' : ''}" data-j="${k}">${k + 1}</button>`).join('')}</div>`;
      tick();
      V.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { ans[i] = +b.dataset.k; if (i < t.q.length - 1) i++; show(); });
      V.querySelectorAll('[data-j]').forEach(b => b.onclick = () => { i = +b.dataset.j; show(); });
      $('#pv').onclick = () => { if (i > 0) i--; show(); };
      $('#nx').onclick = () => { if (i < t.q.length - 1) i++; show(); };
      $('#fin').onclick = () => modal(`<b>Finish the test?</b><p>${ans.filter(a => a == null).length} questions not answered.</p><button class="btn" id="yes">Finish</button><button class="btn sec" data-close>Keep going</button>`) || ($('#yes').onclick = () => { $('#modal').hidden = true; finish(); });
    };
    const tick = () => {
      const left = Math.max(0, end - Date.now()); const el = $('#tm');
      if (el) el.textContent = '⏱ ' + Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0');
      if (!left) finish();
    };
    mockTimer = setInterval(tick, 1000); show();
  };
});

/* ---------- study plan ---------- */
route(/^#\/plan$/, async () => {
  setBar('Study plan', false, 'plan');
  const plan = await load('plan'); const t = todayISO();
  let h = `<div class="card mut">12-week plan, about 3 hours a day after you wake, before the night shift. Fridays are review or mock-test days. Tick each day when it is done.</div>`;
  let wk = 0;
  plan.forEach(r => {
    if (r[2] !== wk) { wk = r[2]; h += `<div class="part">Week ${wk} · ${esc(r[3])}</div>`; }
    const done = S.plan[r[0]];
    h += `<label class="chk ${r[0] === t ? 'today' : ''} ${done ? 'donep' : ''}" ${r[0] === t ? 'id="today"' : ''}><input type="checkbox" data-d="${r[0]}" ${done ? 'checked' : ''}><span><span class="t"><b>${esc(r[4])}</b></span><div class="mut">${r[1]} ${r[0]}${r[5] ? ' · ' + esc(r[5]) : ''}</div></span></label>`;
  });
  V.innerHTML = h;
  V.querySelectorAll('input[data-d]').forEach(c => c.onchange = () => { if (c.checked) S.plan[c.dataset.d] = 1; else delete S.plan[c.dataset.d]; save('plan'); c.closest('.chk').classList.toggle('donep', c.checked); });
  const td = $('#today'); if (td) setTimeout(() => td.scrollIntoView({ block: 'center' }), 50);
});

/* ---------- bookmarks & more ---------- */
route(/^#\/marks$/, () => {
  setBar('Bookmarks', true, '');
  V.innerHTML = S.marks.length ? '<div class="list">' + S.marks.map(m => `<a href="#/c/${m.s}/${m.c}"><span class="n">${subj(m.s).icon}</span><span class="t">${esc(m.t)}<div class="mut">${esc(subj(m.s).title)}</div></span>›</a>`).join('') + '</div>'
    : '<div class="card mut">No bookmarks yet. Open a topic and tap 🔖 Bookmark.</div>';
});

const FEATURES = ['14 subject handbooks + 6 exam-toolkit books, fully offline', 'Subject → topic → section navigation with diagrams and tables', 'Search across all notes', 'MCQ practice by subject with explanations, saved scores and a "My mistakes" list',
  '5 timed mock tests (100 MCQs, 90 minutes) with marks per subject', 'Quick revision mode: every exam point plus formula, number and trap chapters', 'Bookmarks and "continue reading"', '12-week study plan with daily tick-off', '20 structural calculators (mix design, BBS, beams, slabs, columns, footings, steel, beam analysis, retaining walls) with step-by-step working', 'Dark and light theme, adjustable text size', 'Check for updates, with a notification that says what is new'];

route(/^#\/more$/, () => {
  setBar('More', false, 'more');
  const ver = window.Android && Android.version ? Android.version() : 'web';
  V.innerHTML = `<div class="card"><b>Appearance</b><div class="seg" style="margin-top:8px"><button class="btn sec" id="th">${S.theme === 'dark' ? '☀️ Light theme' : '🌙 Dark theme'}</button></div>
    <div class="mut" style="margin-top:8px">Text size</div><div class="seg"><button class="btn sec" data-f="-1">A−</button><button class="btn sec" data-f="1">A+</button></div></div>
    <div class="card"><b>Updates</b><div class="mut">Installed version ${esc(ver)}</div><button class="btn wide" id="upd">Check for updates</button><div id="updres" class="mut"></div></div>
    <a class="row" href="#/marks">🔖 <span style="flex:1">Bookmarks</span>›</a>
    <a class="row" href="#/search">⌕ <span style="flex:1">Search notes</span>›</a>
    <div class="card"><b>About Engineer's Desk</b><ul>${FEATURES.map(f => `<li>${f}</li>`).join('')}</ul></div>
    <div class="card"><b>Progress</b><div class="mut">Reset reading, MCQ and mock-test progress (bookmarks and plan stay).</div><button class="btn sec" id="reset">Reset progress</button></div>`;
  $('#th').onclick = () => { S.theme = S.theme === 'dark' ? 'light' : 'dark'; save('theme'); applyPrefs(); render(); };
  V.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { S.font = Math.min(22, Math.max(13, S.font + +b.dataset.f)); save('font'); applyPrefs(); });
  $('#upd').onclick = () => { $('#updres').textContent = 'Checking…'; checkUpdate(true); };
  $('#reset').onclick = () => modal(`<b>Reset progress?</b><p>This clears topics read, MCQ scores and mock results.</p><button class="btn" id="yes">Reset</button><button class="btn sec" data-close>Cancel</button>`) || ($('#yes').onclick = () => { S.read = {}; S.stats = {}; S.mocks = {}; save('read'); save('stats'); save('mocks'); $('#modal').hidden = true; });
});

/* ---------- updates (native bridge) ---------- */
function checkUpdate(manual) {
  if (!(window.Android && Android.checkUpdate)) { const r = $('#updres'); if (r) r.textContent = 'Updates are checked by the Android app.'; return; }
  window._manualUpd = manual; Android.checkUpdate();
}
window.onUpdateResult = (res) => {
  const r = $('#updres');
  if (res.error) { if (r) r.textContent = 'Could not check (no internet?).'; return; }
  if (!res.available) { if (r) r.textContent = `You have the latest version (${res.current}).`; return; }
  if (r) r.textContent = '';
  modal(`<b>Update available — version ${esc(res.latest)}</b><div class="mut">You have ${esc(res.current)}</div><h2>What's new</h2><div style="white-space:pre-wrap">${esc(res.notes || '')}</div>
    <button class="btn" id="dl">Download update</button><button class="btn sec" data-close>Later</button>`);
  $('#dl').onclick = () => { Android.openUrl(res.url); $('#modal').hidden = true; };
};


/* ---------- calculators ---------- */
route(/^#\/calc$/, () => {
  setBar('Structural calculators', false, 'calc');
  let h = '<div class="card mut">SI units · ACI 318-19 · AISC 360-16. Every result shows its working. Check results before using them in a final design.</div>', g = '';
  CALCS.forEach(c => { if (c.g !== g) { g = c.g; h += `<div class="part">${esc(g)}</div>`; } h += `<a class="row" href="#/calc/${c.id}"><span style="flex:1"><b>${esc(c.t)}</b><div class="mut">${esc(c.d)}</div></span>›</a>`; });
  V.innerHTML = h;
});
route(/^#\/calc\/(\w+)$/, id => {
  const c = CALCS.find(x => x.id === id); setBar(c.t, true, 'calc');
  const saved = store.get('calc_' + id, {}), v = {};
  c.inputs.forEach(i => v[i.k] = saved[i.k] != null ? saved[i.k] : i.v);
  const field = i => {
    const val = v[i.k];
    const inp = i.o ? `<select data-k="${i.k}">${i.o.map(([a, b]) => `<option value="${esc(a)}" ${String(val) === String(a) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`
      : `<input data-k="${i.k}" ${i.t === 'text' ? 'type="text"' : 'type="number" inputmode="decimal" step="any"'} value="${esc(val)}" style="width:100%;padding:11px;border-radius:10px;border:1px solid var(--line);background:var(--card2);color:var(--ink);font-size:1em">`;
    return `<label class="fld" data-f="${i.k}" style="display:block;margin:9px 0"><div class="mut">${esc(i.l)}${i.u ? ' (' + esc(i.u) + ')' : ''}</div>${inp}${i.h ? `<div class="mut" style="font-size:.78em">${esc(i.h)}</div>` : ''}</label>`;
  };
  V.innerHTML = `<div class="mut">${esc(c.d)}</div><div class="card">${c.inputs.map(field).join('')}<button class="btn wide" id="go">Calculate</button></div><div id="out"></div>${c.addable ? '<div id="sched"></div>' : ''}`;
  const read = () => { V.querySelectorAll('[data-k]').forEach(e => { const i = c.inputs.find(x => x.k === e.dataset.k); v[i.k] = i.o || i.t === 'text' ? e.value : parseFloat(e.value) || 0; }); };
  const vis = () => { read(); c.inputs.forEach(i => { const f = V.querySelector(`[data-f="${i.k}"]`); if (f) f.style.display = !i.show || i.show(v) ? 'block' : 'none'; }); };
  V.querySelectorAll('select').forEach(e => e.onchange = vis); vis();
  let last = null;
  const go = () => {
    read(); store.set('calc_' + id, v);
    let r; try { r = c.run(Object.assign({}, v)); } catch (e) { $('#out').innerHTML = `<div class="card">Error: ${esc(e.message)}</div>`; return; }
    last = r;
    $('#out').innerHTML = `<div class="card"><b>Result</b><div class="tw" style="margin-top:8px"><table>${r.res.map(x => `<tr><td>${esc(x[0])}</td><td><b>${esc(x[1])}</b>${x[2] ? `<div class="mut">${esc(x[2])}</div>` : ''}</td></tr>`).join('')}</table></div>
      ${(r.warn || []).map(w => `<div class="call" style="border-color:var(--bad)">⚠ ${esc(w)}</div>`).join('')}${r.svg || ''}
      <div class="seg"><button class="btn sec" id="cp">📋 Copy result</button>${c.addable && r.row ? '<button class="btn" id="add">➕ Add to schedule</button>' : ''}</div></div>
      <details open><summary>Working (step by step)</summary><ol style="padding-left:18px">${r.steps.map(s => `<li style="margin:6px 0">${s}</li>`).join('')}</ol></details>`;
    $('#cp').onclick = () => {
      const txt = c.t + '\n' + r.res.map(x => `${x[0]}: ${x[1]}${x[2] ? ' (' + x[2] + ')' : ''}`).join('\n') + '\n\nWorking:\n' + r.steps.map((s, k) => (k + 1) + '. ' + s.replace(/<[^>]+>/g, '')).join('\n');
      if (window.Android && Android.copy) Android.copy(txt); else if (navigator.clipboard) navigator.clipboard.writeText(txt);
      $('#cp').textContent = '✓ Copied';
    };
    const add = $('#add'); if (add) add.onclick = () => { const s = store.get('bbs', []); s.push(r.row); store.set('bbs', s); sched(); add.textContent = '✓ Added'; };
    $('#out').scrollIntoView({ block: 'start' });
  };
  $('#go').onclick = go;
  const sched = () => {
    const el = $('#sched'); if (!el) return; const s = store.get('bbs', []);
    if (!s.length) { el.innerHTML = ''; return; }
    const tot = {}; s.forEach(r => tot[r.bar] = (tot[r.bar] || 0) + r.kg);
    el.innerHTML = `<div class="card"><b>Bar bending schedule</b><div class="tw"><table><tr><th>Mark</th><th>Bar</th><th>No.</th><th>Cut length (mm)</th><th>kg</th><th></th></tr>${s.map((r, i) => `<tr><td>${esc(r.mark)}</td><td>${esc(r.bar)}</td><td>${r.n}</td><td>${r.cl}</td><td>${fx(r.kg, 1)}</td><td><button class="btn sec" style="padding:2px 8px;margin:0" data-del="${i}">✕</button></td></tr>`).join('')}</table></div>
      <b>Totals</b>${Object.entries(tot).map(([b, k]) => `<div class="row" style="margin:4px 0;padding:8px"><span style="flex:1">${esc(b)}</span><b>${fx(k, 1)} kg</b></div>`).join('')}
      <div class="row" style="padding:8px"><span style="flex:1"><b>Grand total</b></span><b>${fx(Object.values(tot).reduce((a, b) => a + b, 0), 1)} kg = ${fx(Object.values(tot).reduce((a, b) => a + b, 0) / 1000, 3)} t</b></div>
      <div class="seg"><button class="btn sec" id="cps">📋 Copy schedule</button><button class="btn sec" id="clr">Clear schedule</button></div></div>`;
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { s.splice(+b.dataset.del, 1); store.set('bbs', s); sched(); });
    $('#clr').onclick = () => { store.set('bbs', []); sched(); };
    $('#cps').onclick = () => { const t = 'BBS\n' + s.map(r => `${r.mark}\t${r.bar}\t${r.n} nos\t${r.cl} mm\t${fx(r.kg, 1)} kg`).join('\n') + '\n' + Object.entries(tot).map(([b, k]) => `${b}: ${fx(k, 1)} kg`).join('\n'); if (window.Android && Android.copy) Android.copy(t); else if (navigator.clipboard) navigator.clipboard.writeText(t); $('#cps').textContent = '✓ Copied'; };
  };
  sched();
});


/* ---------- full-screen image viewer: pinch, drag, double-tap, buttons ---------- */
function openImage(src, cap) {
  let ov = document.getElementById('imgv');
  if (!ov) { ov = document.createElement('div'); ov.id = 'imgv'; document.body.appendChild(ov); }
  ov.innerHTML = `<div class="iv-stage"><img src="${src}" alt=""></div>
    <div class="iv-bar"><button data-z="-1">−</button><button data-z="0">Fit</button><button data-z="1">+</button><button data-x>✕</button></div>
    ${cap ? `<div class="iv-cap">${esc(cap)}</div>` : ''}`;
  ov.hidden = false; history.pushState({ iv: 1 }, '');
  const img = ov.querySelector('img'), stage = ov.querySelector('.iv-stage');
  let s = 1, x = 0, y = 0;
  const apply = (anim) => { img.style.transition = anim ? 'transform .2s' : 'none'; img.style.transform = `translate(${x}px,${y}px) scale(${s})`; };
  const clamp = () => { s = Math.min(8, Math.max(1, s)); if (s === 1) { x = 0; y = 0; } };
  const zoomAt = (ns, cx, cy) => { const r = stage.getBoundingClientRect(); const px = cx - r.left - r.width / 2, py = cy - r.top - r.height / 2; x = px - (px - x) * ns / s; y = py - (py - y) * ns / s; s = ns; clamp(); };
  const pts = new Map(); let start = null, lastTap = 0;
  stage.addEventListener('pointerdown', e => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); start = null;
    if (pts.size === 1) { const now = Date.now(); if (now - lastTap < 300) { zoomAt(s > 1.2 ? 1 : 2.5, e.clientX, e.clientY); apply(true); } lastTap = now; } });
  stage.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (!start) start = { d, s }; else zoomAt(start.s * d / start.d, mx, my);
      apply(false);
    } else if (pts.size === 1 && s > 1) { x += e.clientX - prev[0]; y += e.clientY - prev[1]; apply(false); }
  });
  const up = e => { pts.delete(e.pointerId); start = null; };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', e => { e.preventDefault(); zoomAt(s * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY); apply(true); }, { passive: false });
  ov.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { const r = stage.getBoundingClientRect(), z = +b.dataset.z; zoomAt(z ? s * (z > 0 ? 1.5 : 1 / 1.5) : 1, r.left + r.width / 2, r.top + r.height / 2); apply(true); });
  ov.querySelector('[data-x]').onclick = () => history.back();
  apply(false);
}
window.addEventListener('popstate', () => { const ov = document.getElementById('imgv'); if (ov && !ov.hidden) ov.hidden = true; });
document.addEventListener('click', e => {
  const im = e.target.closest('figure img');
  if (im) { const cap = im.parentElement.querySelector('figcaption'); openImage(im.getAttribute('src'), cap ? cap.textContent : ''); }
});

/* ---------- router ---------- */
async function render() {
  const h = location.hash || '#/';
  for (const [re, fn] of routes) { const m = h.match(re); if (m) { try { await fn(...m.slice(1)); } catch (e) { V.innerHTML = '<div class="card">Something went wrong: ' + esc(e.message) + '</div>'; } return; } }
  location.hash = '#/';
}
window.addEventListener('hashchange', () => { clearInterval(mockTimer); render(); });
(async () => {
  applyPrefs();
  INDEX = await load('index');
  render();
  if (window.Android && Android.checkUpdate) setTimeout(() => checkUpdate(false), 2500);
})();
