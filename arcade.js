// Аркады вместо задачи на бесплатных действиях (захват в понедельник, укрепление в среду).
// Всё считается в телефоне игрока, сервер получает только «прошёл / не прошёл».
// ARCADE[kind](onEnd) → { el, title, text, stop() }; onEnd(win) вызывается один раз.
(function () {
  'use strict';
  const INK = '#2b2a22', LCD = '#86f29a', LCD_BG = '#0e1d13', RED = '#e03131';
  const mk = (tag, attrs, ...kids) => { const e = document.createElement(tag); Object.entries(attrs || {}).forEach(([k, v]) => { if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v); }); kids.forEach((k) => k != null && e.append(k)); return e; };
  const INFO = {
    lock: { title: 'Взлом замка', text: 'Остановите бегунок в зелёной зоне три раза подряд — кнопкой «Стоп» или касанием шкалы. Зона с каждым разом уже.' },
    pipes: { title: 'Соедини кабели', text: 'Нажимайте на плитки, чтобы повернуть их, и проведите кабель от роутера слева до узла справа за 30 секунд.' },
    packet: { title: 'Пакет до сервера', text: 'Касайтесь поля игры (или жмите пробел), чтобы пакет подпрыгивал, и проведите его между стенами файрвола 10 секунд.' },
  };
  const once = (fn) => { let done = false; return (v) => { if (!done) { done = true; fn(v); } }; };
  const keyHook = (fn) => { const t0 = performance.now(); const h = (e) => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (performance.now() - t0 > 300) fn(); } }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); };

  // ---------- Взлом замка: остановить бегунок в зелёной зоне три раза подряд ----------
  function lock(onEnd) {
    onEnd = once(onEnd);
    const ROUNDS = [{ w: 0.24, v: 0.75 }, { w: 0.18, v: 1.0 }, { w: 0.13, v: 1.25 }];
    let round = 0, pos = 0, dir = 1, zone = 0.5, raf = 0, last = 0, pause = 0, over = false;
    const pins = ROUNDS.map(() => mk('i', { class: 'ar-pin' }));
    const zoneEl = mk('div', { class: 'ar-zone' }), cur = mk('div', { class: 'ar-cur' });
    const bar = mk('div', { class: 'ar-bar' }, zoneEl, cur);
    const btn = mk('button', { class: 'btn', type: 'button' }, 'Стоп');
    const el = mk('div', { class: 'arcade ar-lock' }, mk('div', { class: 'ar-pins' }, ...pins), bar, btn);
    const place = () => { const w = ROUNDS[round].w; zone = w / 2 + Math.random() * (1 - w); zoneEl.style.left = ((zone - w / 2) * 100).toFixed(1) + '%'; zoneEl.style.width = (w * 100).toFixed(1) + '%'; };
    const tick = (t) => {
      if (over) return;
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
      if (pause > 0) pause -= dt;
      else { pos += dir * ROUNDS[round].v * dt; if (pos > 1) { pos = 2 - pos; dir = -1; } if (pos < 0) { pos = -pos; dir = 1; } }
      cur.style.left = (pos * 100).toFixed(2) + '%';
      raf = requestAnimationFrame(tick);
    };
    const hit = () => {
      if (over || pause > 0) return;
      const w = ROUNDS[round].w;
      if (Math.abs(pos - zone) <= w / 2) {
        pins[round].classList.add('on'); round++;
        if (round === ROUNDS.length) { over = true; btn.disabled = true; return onEnd(true); }
        pause = 0.35; place();
      } else { over = true; btn.disabled = true; bar.classList.add('miss'); onEnd(false); }
    };
    btn.addEventListener('click', hit); bar.addEventListener('pointerdown', hit);
    const unkey = keyHook(hit);
    place(); raf = requestAnimationFrame(tick);
    return { el, ...INFO.lock, stop() { over = true; cancelAnimationFrame(raf); unkey(); } };
  }

  // ---------- Соедини кабели: повернуть плитки 4×4, чтобы кабель дошёл от роутера до узла ----------
  const D = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] }, OPP = { N: 'S', S: 'N', E: 'W', W: 'E' }, ROT = { N: 'E', E: 'S', S: 'W', W: 'N' };
  function pipes(onEnd) {
    onEnd = once(onEnd);
    const N = 4, LIMIT = 30;
    // путь слева направо: в каждом столбце — вертикальный отрезок до случайной строки, потом шаг вправо
    const r0 = Math.floor(Math.random() * N); let r = r0; const conn = Array.from({ length: N }, () => Array.from({ length: N }, () => null));
    let from = 'W';
    for (let c = 0; c < N; c++) {
      const target = Math.floor(Math.random() * N), step = target > r ? 1 : -1;
      while (r !== target) { conn[r][c] = [from, step > 0 ? 'S' : 'N']; from = step > 0 ? 'N' : 'S'; r += step; }
      conn[r][c] = [from, 'E']; from = 'W';
    }
    const r1 = r;
    const tiles = conn.map((row) => row.map((cn) => {
      let set = cn ? cn : Math.random() < 0.5 ? ['N', 'S'] : ['N', 'E'];
      const turns = Math.floor(Math.random() * 4); for (let k = 0; k < turns; k++) set = set.map((d) => ROT[d]);
      return set;
    }));
    // проверка: от входа слева по открытым концам
    const trace = () => {
      const lit = new Set(); let rr = r0, cc = 0, came = 'W';
      for (let guard = 0; guard < N * N + 2; guard++) {
        const t = tiles[rr][cc]; if (!t.includes(came)) return { lit, ok: false };
        lit.add(rr * N + cc); const out = t.find((d) => d !== came);
        if (cc === N - 1 && out === 'E') return { lit, ok: rr === r1 };
        const nr = rr + D[out][0], nc = cc + D[out][1]; if (nr < 0 || nr >= N || nc < 0 || nc >= N) return { lit, ok: false };
        rr = nr; cc = nc; came = OPP[out];
      }
      return { lit, ok: false };
    };
    if (trace().ok) tiles[r0][0] = tiles[r0][0].map((d) => ROT[d]); // не начинать с готового решения
    const tileSvg = (set, on) => {
      const ends = { N: '50,0', E: '100,50', S: '50,100', W: '0,50' };
      return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" rx="10" fill="${LCD_BG}"/>${set.map((d) => `<line x1="50" y1="50" x2="${ends[d].split(',')[0]}" y2="${ends[d].split(',')[1]}" stroke="${on ? LCD : '#4d6b57'}" stroke-width="16" stroke-linecap="round"/>`).join('')}<circle cx="50" cy="50" r="9" fill="${on ? LCD : '#4d6b57'}"/></svg>`;
    };
    const cells = [], grid = mk('div', { class: 'ar-grid' });
    let over = false, left = LIMIT, timer = 0;
    const timeEl = mk('div', { class: 'ar-time' }, '0:30');
    const draw = () => { const { lit, ok } = trace(); cells.forEach((b, i) => { b.innerHTML = tileSvg(tiles[Math.floor(i / N)][i % N], lit.has(i)); }); return ok; };
    for (let i = 0; i < N * N; i++) {
      const b = mk('button', { class: 'ar-tile', type: 'button', 'aria-label': 'Повернуть плитку' });
      b.addEventListener('click', () => {
        if (over) return; const rr = Math.floor(i / N), cc = i % N;
        tiles[rr][cc] = tiles[rr][cc].map((d) => ROT[d]);
        if (draw()) { over = true; clearInterval(timer); grid.classList.add('done'); setTimeout(() => onEnd(true), 450); }
      });
      cells.push(b); grid.append(b);
    }
    const side = (row, label, cls) => { const col = mk('div', { class: 'ar-side' }); for (let k = 0; k < N; k++) col.append(mk('span', { class: k === row ? cls : '' }, k === row ? label : '')); return col; };
    const el = mk('div', { class: 'arcade ar-pipes' }, timeEl, mk('div', { class: 'ar-board' }, side(r0, '⇢', 'ar-src'), grid, side(r1, '◉', 'ar-dst')));
    draw();
    timer = setInterval(() => { if (over) return; left--; timeEl.textContent = '0:' + String(Math.max(0, left)).padStart(2, '0'); if (left <= 5) timeEl.classList.add('warn'); if (left <= 0) { over = true; clearInterval(timer); onEnd(false); } }, 1000);
    return { el, ...INFO.pipes, stop() { over = true; clearInterval(timer); } };
  }

  // ---------- Пакет до сервера: тапами держать пакет между стенами файрвола 10 секунд ----------
  function packet(onEnd) {
    onEnd = once(onEnd);
    const H = 260, GOAL = 10, SPEED = 140, GAP = 104, EVERY = 1.6, GRAV = 900, JUMP = -290;
    const cv = mk('canvas', { class: 'ar-canvas', height: String(H) }), ctx = cv.getContext('2d');
    const prog = mk('i'), bar = mk('div', { class: 'ar-prog' }, prog);
    const hint = mk('div', { class: 'ar-hint' }, 'Нажмите, чтобы начать');
    const el = mk('div', { class: 'arcade ar-packet' }, bar, mk('div', { class: 'ar-stage' }, cv, hint));
    let W = 320, y = H / 2, vy = 0, walls = [], t = 0, spawn = 0.4, started = false, over = false, raf = 0, last = 0;
    const size = () => { W = Math.max(240, Math.min(440, el.clientWidth || 320)); cv.width = W; };
    const flap = () => { if (over) return; if (!started) { started = true; hint.hidden = true; last = 0; } vy = JUMP; };
    const end = (win) => { if (over) return; over = true; cancelAnimationFrame(raf); draw(); onEnd(win); };
    const draw = () => {
      ctx.fillStyle = LCD_BG; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(134,242,154,.08)'; ctx.lineWidth = 1; for (let x = (-(t * SPEED) % 24 + 24) % 24; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      walls.forEach((w) => {
        ctx.fillStyle = RED; ctx.fillRect(w.x, 0, 26, w.g - GAP / 2); ctx.fillRect(w.x, w.g + GAP / 2, 26, H);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let yy = 6; yy < H; yy += 12) { if (yy > w.g - GAP / 2 && yy < w.g + GAP / 2) continue; ctx.fillRect(w.x + 3, yy, 20, 3); }
      });
      const px = W * 0.26;
      ctx.save(); ctx.translate(px, y); ctx.rotate(Math.max(-0.5, Math.min(0.7, vy / 600)));
      ctx.fillStyle = LCD; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-13, -10, 26, 20, 5); else ctx.rect(-13, -10, 26, 20); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = '700 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('01', 0, 1);
      ctx.restore();
    };
    const tick = (now) => {
      if (over) return;
      const dt = last ? Math.min(0.033, (now - last) / 1000) : 0; last = now;
      if (started) {
        t += dt; vy += GRAV * dt; y += vy * dt; spawn -= dt;
        if (spawn <= 0) { spawn = EVERY; walls.push({ x: W + 10, g: GAP / 2 + 20 + Math.random() * (H - GAP - 40) }); }
        walls.forEach((w) => { w.x -= SPEED * dt; }); walls = walls.filter((w) => w.x > -40);
        const px = W * 0.26, hit = walls.some((w) => px + 12 > w.x && px - 12 < w.x + 26 && (y - 9 < w.g - GAP / 2 || y + 9 > w.g + GAP / 2));
        prog.style.width = Math.min(100, (t / GOAL) * 100).toFixed(1) + '%';
        if (y < 9 || y > H - 9 || hit) return end(false);
        if (t >= GOAL) return end(true);
      }
      draw(); raf = requestAnimationFrame(tick);
    };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); flap(); }); hint.addEventListener('pointerdown', (e) => { e.preventDefault(); flap(); });
    const unkey = keyHook(flap);
    requestAnimationFrame(() => { size(); draw(); raf = requestAnimationFrame(tick); });
    return { el, ...INFO.packet, stop() { over = true; cancelAnimationFrame(raf); unkey(); } };
  }

  window.ARCADE = { lock, pipes, packet, INFO, KINDS: ['lock', 'pipes', 'packet'] };
})();
