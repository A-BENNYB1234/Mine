/*
  Circle 8 — Shared Week Runtime
  Location: assets/js/week.js

  Purpose
  -------
  One JavaScript file used by ALL week pages (m{month}w{week}.html).
  Each week page stays clean (just HTML + standard IDs); this script handles:
    • Reading/Resetting lesson progress
    • Loading a 30‑question bank from /data/m{M}w{W}-quiz.json
    • Showing 10 random questions per attempt
    • Grading, saving last/best scores (localStorage)
    • Updating page progress bar + badges

  Requirements on each week page (IDs/classes to include in HTML)
  ----------------------------------------------------------------
  Optional elements are marked (*):
    - #progressBar (div.progress-bar)
    - #bestBadge (span) — text like "Best: 0%"
    - #markReadBtn (button)
    - #resetPageBtn (button)
    - #startQuizBtn (button)
    - #retryBtn (button)
    - #submitBtn (button)
    - #quizArea (div) — container for rendered questions
    - #lastScore (span)
    - #bestScore (span)
    - .quiz-q styles for question blocks (use your CSS)
    - Toast elements (Bootstrap):
        <div id="toast" class="toast text-bg-dark"> ... <div id="toastMsg" class="toast-body"></div> ... </div>

  Data file convention
  --------------------
  For a page named  m2w1.html  → this script fetches  /data/m2w1-quiz.json
  JSON format:
    {
      "questions": [
        { "q": "Question text", "c": ["A","B","C","D"], "a": 1 },
        ... (30 items)
      ]
    }
  Where 'a' is the index (0-based) of the correct choice.

  Keys in localStorage
  --------------------
    circle8_m{M}_w{W}_read  → '1' if lesson marked read
    circle8_m{M}_w{W}_last  → last score percent
    circle8_m{M}_w{W}_best  → best score percent

  Notes
  -----
  - Relies on Bootstrap 5 (toast). Ensure the bundle script is included on the page.
  - If the JSON file is missing/offline, the script looks for a global window.QUESTION_BANK fallback.
*/

(function(){
  'use strict';

  // ---------- Utilities ----------
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => Array.from(document.querySelectorAll(q));

  function showToast(msg){
    const t = document.getElementById('toast');
    const m = document.getElementById('toastMsg');
    if(!t || !m){ console.log('[Toast]', msg); return; }
    m.textContent = msg;
    try{ new bootstrap.Toast(t).show(); }catch{ /* bootstrap not loaded */ }
  }

  function clamp01(v){ return Math.max(0, Math.min(100, Number(v||0))); }

  // Parse identifiers from filename: m{M}w{W}.html
  function parseWeekFromPath(){
    const fname = (location.pathname.split('/').pop() || '').toLowerCase();
    const m = fname.match(/^m(\d+)w(\d+)\.html$/);
    if(!m) return null;
    return { M: Number(m[1]), W: Number(m[2]), base: `m${m[1]}w${m[2]}` };
  }

  // LocalStorage helpers (namespaced)
  function LS(key){ return `circle8_${key}`; }
  function lsGet(key, def){
    try{ const v = localStorage.getItem(LS(key)); return v==null? def : v; }catch{ return def; }
  }
  function lsSet(key, val){ try{ localStorage.setItem(LS(key), String(val)); }catch{} }
  function lsDel(key){ try{ localStorage.removeItem(LS(key)); }catch{} }

  // ---------- Progress UI ----------
  function refreshProgressUI(keys){
    const last = clamp01(lsGet(keys.last, 0));
    const best = clamp01(lsGet(keys.best, 0));
    const read = lsGet(keys.read, '0') === '1';

    const bar = $('#progressBar');
    if(bar){
      const p = Math.max(read?50:0, best); // marking read sets baseline 50%
      bar.style.width = `${p}%`;
      bar.setAttribute('aria-valuenow', String(p));
    }
    const bestBadge = $('#bestBadge');
    if(bestBadge){ bestBadge.textContent = `Best: ${best}%`; }

    const lastEl = $('#lastScore');
    if(lastEl){ lastEl.textContent = `${last}%`; }
    const bestEl = $('#bestScore');
    if(bestEl){ bestEl.textContent = `${best}%`; }
  }

  // ---------- Quiz rendering & grading ----------
  function pickRandomTen(qs){
    const idx = [...qs.keys()];
    for(let i=idx.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [idx[i],idx[j]]=[idx[j],idx[i]]; }
    return idx.slice(0,10).map(i=>({ ...qs[i], i }));
  }

  function renderQuiz(set){
    const area = $('#quizArea');
    if(!area) return;
    area.innerHTML = '';
    set.forEach((q, n)=>{
      const id = `q_${n}`;
      const wrap = document.createElement('div');
      wrap.className = 'quiz-q';
      wrap.innerHTML = `
        <div class="fw-semibold mb-2">${n+1}. ${q.q}</div>
        <div class="d-grid gap-2">
          ${q.c.map((opt, i)=>`
            <label class="d-flex align-items-center gap-2">
              <input class="form-check-input" type="radio" name="${id}" value="${i}" />
              <span>${opt}</span>
            </label>
          `).join('')}
        </div>
      `;
      area.appendChild(wrap);
    });
  }

  function gradeCurrent(set){
    const area = $('#quizArea');
    if(!area) return 0;
    let correct = 0;
    set.forEach((q, n)=>{
      const chosen = area.querySelector(`input[name="q_${n}"]:checked`);
      const pick = chosen ? Number(chosen.value) : -1;
      const block = area.children[n];
      block.classList.remove('correct','incorrect');
      if(pick === q.a){ correct++; block.classList.add('correct'); }
      else { block.classList.add('incorrect'); }
    });
    return Math.round((correct/10)*100);
  }

  // ---------- Load question bank ----------
  async function loadQuestionsFor(base){
    // Try JSON in /data first
    const url = `data/${base}-quiz.json`;
    try{
      const res = await fetch(url, { cache: 'no-store' });
      if(res.ok){
        const data = await res.json();
        if(Array.isArray(data.questions) && data.questions.length >= 10) return data.questions;
      }
    }catch(_){}
    // Fallback to global if present
    if(Array.isArray(window.QUESTION_BANK)) return window.QUESTION_BANK;
    console.warn(`[Circle8] No question bank found for ${base}`);
    return [];
  }

  // ---------- Initialize per-page ----------
  document.addEventListener('DOMContentLoaded', async ()=>{
    const id = parseWeekFromPath();
    if(!id){ console.warn('[Circle8] Filename not in m{M}w{W}.html format.'); return; }

    // Keys
    const keys = {
      read: `m${id.M}_w${id.W}_read`,
      last: `m${id.M}_w${id.W}_last`,
      best: `m${id.M}_w${id.W}_best`
    };

    // Wire buttons
    const markBtn = $('#markReadBtn');
    if(markBtn){ markBtn.addEventListener('click', ()=>{ lsSet(keys.read, '1'); refreshProgressUI(keys); showToast('Lesson marked as read'); }); }

    const resetBtn = $('#resetPageBtn');
    if(resetBtn){ resetBtn.addEventListener('click', ()=>{ lsDel(keys.read); lsDel(keys.last); lsDel(keys.best); refreshProgressUI(keys); showToast('Progress reset'); }); }

    const startBtn = $('#startQuizBtn');
    const retryBtn = $('#retryBtn');
    const submitBtn = $('#submitBtn');

    // Load question bank for this week
    const all = await loadQuestionsFor(id.base);
    let currentSet = [];

    function newSet(){
      if(all.length < 10){ showToast('No questions available yet.'); return; }
      currentSet = pickRandomTen(all);
      renderQuiz(currentSet);
      if(submitBtn) submitBtn.disabled = false;
      if(retryBtn) retryBtn.disabled = false;
      showToast('Quiz loaded — answer all 10 and Submit');
    }

    if(startBtn) startBtn.addEventListener('click', newSet);
    if(retryBtn) retryBtn.addEventListener('click', newSet);

    if(submitBtn) submitBtn.addEventListener('click', ()=>{
      if(!currentSet.length){ showToast('Start the quiz first.'); return; }
      const percent = gradeCurrent(currentSet);
      lsSet(keys.last, String(percent));
      const best = clamp01(lsGet(keys.best, 0));
      if(percent > best) lsSet(keys.best, String(percent));
      refreshProgressUI(keys);
      showToast(`You scored ${percent}%`);
    });

    // First paint of progress
    refreshProgressUI(keys);
  });
})();
