// Иллюстрации турнира: робот, семисегментное табло, перфокарта, радиолампа, резистор, шестерни.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, kids) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); (kids || []).forEach((c) => e.append(c)); return e; };

  // ---------- Робот с дискетой (пиксель-арт 36×43 с объёмом) ----------
  function robot() {
    const C = { o: '#2b3236', l: '#dfe7e9', m: '#a9b6bb', d: '#6f7d82', s: '#a8e6d2', sh: '#d6f8ec', e: '#1f2b28', w: '#ffffff', p: '#f29b8a', r: '#e04a2a', rh: '#ff9f80', lb: '#0e1d13', lc: '#86f29a', y: '#ffcf3f', g: '#4cd964', n: '#20406a', nh: '#335a8a', sm: '#c9d3d6', lab: '#f7f0dc', ln: '#9aa7ac' };
    const svg = el('svg', { viewBox: '0 0 36 43', class: 'robot', 'aria-hidden': 'true', 'shape-rendering': 'crispEdges' });
    let tgt = svg; const R = (x, y, w, h, c, cls) => { const r = el('rect', { x, y, width: w + 0.02, height: h + 0.02, fill: C[c] || c }); if (cls) r.setAttribute('class', cls); tgt.append(r); return r; };
    const grp = (cls) => { const g = el('g', { class: cls }); svg.append(g); tgt = g; return g; };
    const box = (x, y, w, h, fill, hi, lo) => { R(x, y, w, h, 'o'); R(x + 1, y + 1, w - 2, h - 2, fill); if (hi) R(x + 1, y + 1, w - 2, 1, hi); if (lo) R(x + 1, y + h - 2, w - 2, 1, lo); };
    svg.append(el('ellipse', { cx: 17, cy: 41.6, rx: 12, ry: 1.2, fill: 'rgba(0,0,0,.18)' }));
    // антенна
    R(15, 2, 2, 4, 'o'); R(16, 3, 1, 3, 'd'); grp('r-ant'); box(13, 0, 6, 3, 'r'); R(14, 1, 1, 1, 'rh'); tgt = svg;
    // уши-болты
    box(4, 9, 4, 6, 'd', 'm'); box(24, 9, 4, 6, 'd', 'm'); R(3, 11, 1, 2, 'o'); R(28, 11, 1, 2, 'o');
    // голова
    box(7, 5, 18, 14, 'm', 'l', 'd'); R(8, 7, 1, 10, 'l');
    // экран-лицо
    box(10, 8, 12, 8, 's', 'sh'); R(11, 11, 10, 1, '#9bdcc6'); R(11, 13, 10, 1, '#9bdcc6');
    grp('r-eyes'); R(13, 10, 2, 2, 'e'); R(17, 10, 2, 2, 'e'); R(13, 10, 1, 1, 'w'); R(17, 10, 1, 1, 'w'); tgt = svg;
    R(12, 12, 1, 1, 'p'); R(19, 12, 1, 1, 'p');
    R(13, 13, 1, 1, 'e'); R(14, 14, 4, 1, 'e'); R(18, 13, 1, 1, 'e');
    // шея
    R(13, 19, 6, 2, 'o'); R(14, 19, 4, 1, 'd'); R(12, 20, 8, 1, 'o');
    // корпус
    box(6, 21, 20, 13, 'm', 'l', 'd'); R(7, 23, 1, 9, 'l');
    box(10, 23, 12, 7, 'lb'); for (let x = 11; x <= 20; x++) { const r = R(x, 26, 1, 1, 'lc', 'r-wave'); r.style.animationDelay = (x - 11) * -0.12 + 's'; }
    R(11, 31, 2, 1, 'r', 'r-led l1'); R(14, 31, 2, 1, 'y', 'r-led l2'); R(17, 31, 2, 1, 'g', 'r-led l3'); R(20, 31, 1, 1, 'o');
    [[8, 22], [23, 22], [8, 32], [23, 32]].forEach(([x, y]) => R(x, y, 1, 1, 'd'));
    // левая рука
    box(2, 22, 5, 4, 'd', 'm'); box(2, 25, 4, 8, 'm', 'l', 'd'); box(1, 32, 6, 3, 'd', 'm');
    // правая рука вверх с дискетой
    box(25, 21, 5, 4, 'd', 'm'); grp('r-arm'); box(27, 14, 4, 9, 'm', 'l', 'd'); box(26, 12, 6, 3, 'd', 'm');
    box(25, 2, 10, 11, 'n', 'nh'); R(28, 3, 5, 3, 'sm'); R(31, 3, 1, 3, 'o'); box(27, 7, 7, 5, 'lab'); R(28, 9, 5, 1, 'ln'); R(28, 10, 3, 1, 'ln'); R(26, 3, 1, 1, 'o'); tgt = svg;
    // ноги
    box(10, 33, 5, 6, 'm', 'l', 'd'); box(17, 33, 5, 6, 'm', 'l', 'd'); box(8, 38, 8, 3, 'd', 'm'); box(16, 38, 8, 3, 'd', 'm');
    return svg;
  }

  // ---------- Семисегментное табло ----------
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd' };
  function segPaths(W, H, t) {
    const hz = (y) => `M${t / 2 + 1},${y} L${t + 1},${y - t / 2} L${W - t - 1},${y - t / 2} L${W - t / 2 - 1},${y} L${W - t - 1},${y + t / 2} L${t + 1},${y + t / 2}Z`;
    const vt = (x, y0, y1) => `M${x},${y0 + 1} L${x + t / 2},${y0 + t / 2 + 1} L${x + t / 2},${y1 - t / 2 - 1} L${x},${y1 - 1} L${x - t / 2},${y1 - t / 2 - 1} L${x - t / 2},${y0 + t / 2 + 1}Z`;
    return { a: hz(t / 2), g: hz(H / 2), d: hz(H - t / 2), f: vt(t / 2, t / 2, H / 2), b: vt(W - t / 2, t / 2, H / 2), e: vt(t / 2, H / 2, H - t / 2), c: vt(W - t / 2, H / 2, H - t / 2) };
  }
  // groups: [['06','дн'],['02','час'],...]
  function sevenSeg(groups) {
    const W = 22, H = 40, t = 5, gap = 5, colon = 10, P = segPaths(W, H, t);
    let x = 0; const g = el('g', { transform: 'skewX(-6)' });
    groups.forEach(([digits, label], gi) => {
      if (gi) { g.append(el('rect', { x: x + 3, y: 11, width: 4, height: 4, class: 'seg-on seg-colon' }), el('rect', { x: x + 3, y: 26, width: 4, height: 4, class: 'seg-on seg-colon' })); x += colon; }
      const gx = x;
      [...digits].forEach((dch) => {
        const on = SEG[dch] || '';
        const dg = el('g', { transform: `translate(${x} 0)` });
        for (const s of 'abcdefg') dg.append(el('path', { d: P[s], class: on.includes(s) ? 'seg-on' : 'seg-off' }));
        g.append(dg); x += W + gap;
      });
      g.append(el('text', { x: gx + ((x - gap - gx) / 2), y: H + 13, 'text-anchor': 'middle', class: 'seg-label' }, [document.createTextNode(label)]));
    });
    const svg = el('svg', { viewBox: `-4 -2 ${x + 4} ${H + 18}`, class: 'sevenseg', role: 'img' });
    svg.append(g); return svg;
  }

  // ---------- Перфокарта ----------
  function punchCard(seed, vertical) {
    let s = seed; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const cols = 28, rows = 10, W = 150, H = 70;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'pcard' + (vertical ? ' vert' : ''), 'aria-hidden': 'true' });
    svg.append(el('path', { d: `M6,0 H${W} V${H} H0 V6 Z`, fill: '#f1e6c4', stroke: '#c9b98d', 'stroke-width': 0.8 }));
    svg.append(el('rect', { x: 0, y: 8, width: W, height: 2, fill: '#e3a0a0', opacity: 0.5 }));
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const x = 8 + c * 5, y = 13 + r * 5.4;
      if (rnd() < 0.16) svg.append(el('rect', { x: x - 1, y: y - 1.8, width: 2.4, height: 3.8, fill: '#3b372c' }));
      else svg.append(el('text', { x, y: y + 1.6, 'font-size': 3.2, 'text-anchor': 'middle', fill: '#a89b72', 'font-family': 'monospace' }, [document.createTextNode(r)]));
    }
    return svg;
  }

  // ---------- Радиолампа ----------
  let uid = 0;
  function tube() {
    const id = 'tb' + (uid++);
    const svg = el('svg', { viewBox: '0 0 40 96', class: 'tube', 'aria-hidden': 'true' });
    const defs = el('defs');
    const lg = el('linearGradient', { id: id + 'g', x1: 0, x2: 1 });
    lg.append(el('stop', { offset: 0, 'stop-color': '#ffffff', 'stop-opacity': 0.55 }), el('stop', { offset: 0.35, 'stop-color': '#d8e4e6', 'stop-opacity': 0.18 }), el('stop', { offset: 1, 'stop-color': '#9fb3b8', 'stop-opacity': 0.4 }));
    const rg = el('radialGradient', { id: id + 'f' });
    rg.append(el('stop', { offset: 0, 'stop-color': '#ffd27a' }), el('stop', { offset: 0.4, 'stop-color': '#ff7a1a', 'stop-opacity': 0.75 }), el('stop', { offset: 1, 'stop-color': '#ff5a00', 'stop-opacity': 0 }));
    defs.append(lg, rg); svg.append(defs);
    svg.append(el('ellipse', { cx: 20, cy: 46, rx: 16, ry: 22, fill: `url(#${id}f)`, class: 'tube-glow' }));
    svg.append(el('rect', { x: 13, y: 26, width: 14, height: 36, rx: 2, fill: '#5d646a' }));
    svg.append(el('rect', { x: 15, y: 28, width: 10, height: 32, fill: '#3b4044' }));
    svg.append(el('path', { d: 'M17 58 V34 M20 58 V31 M23 58 V34', stroke: '#ff9b3d', 'stroke-width': 1.2, fill: 'none', class: 'tube-fil' }));
    svg.append(el('path', { d: 'M8,74 V22 Q8,4 20,4 Q32,4 32,22 V74 Z', fill: `url(#${id}g)`, stroke: '#8fa3a8', 'stroke-width': 1.2 }));
    svg.append(el('path', { d: 'M12,20 Q12,9 18,7', stroke: '#fff', 'stroke-width': 1.6, fill: 'none', opacity: 0.7 }));
    svg.append(el('rect', { x: 6, y: 72, width: 28, height: 12, rx: 2, fill: '#222' }), el('rect', { x: 6, y: 72, width: 28, height: 3, fill: '#3a3a3a' }));
    [11, 17, 23, 29].forEach((x) => svg.append(el('rect', { x: x - 1, y: 84, width: 2, height: 10, fill: '#b9b296' })));
    return svg;
  }

  // ---------- Резистор ----------
  function resistor(bands, vertical) {
    const svg = el('svg', { viewBox: '0 0 120 24', class: 'resistor' + (vertical ? ' vert' : ''), 'aria-hidden': 'true' });
    svg.append(el('line', { x1: 0, y1: 12, x2: 120, y2: 12, stroke: '#8a8676', 'stroke-width': 2.4 }));
    svg.append(el('path', { d: 'M34,5 Q38,3 44,5 H76 Q82,3 86,5 V19 Q82,21 76,19 H44 Q38,21 34,19 Z', fill: '#d9a46c', stroke: '#7a5530', 'stroke-width': 1.2 }));
    svg.append(el('rect', { x: 36, y: 6, width: 48, height: 3, fill: '#f0c592', opacity: 0.7 }));
    (bands || ['#7a3b1c', '#1c1c1c', '#c2381f', '#c9a227']).forEach((c, i) => svg.append(el('rect', { x: 44 + i * 9 + (i === 3 ? 4 : 0), y: 5, width: 4, height: 14, fill: c })));
    return svg;
  }

  // ---------- Шестерни ----------
  function gear(cx, cy, r, teeth, fill) {
    let d = ''; const ro = r, ri = r * 0.78;
    for (let i = 0; i < teeth * 2; i++) {
      const a0 = (i / (teeth * 2)) * Math.PI * 2, a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2, rr = i % 2 ? ri : ro;
      d += `${i ? 'L' : 'M'}${cx + rr * Math.cos(a0)},${cy + rr * Math.sin(a0)} L${cx + rr * Math.cos(a1)},${cy + rr * Math.sin(a1)} `;
    }
    const g = el('g'); g.append(el('path', { d: d + 'Z', fill, stroke: '#1f3d2d', 'stroke-width': 1 }), el('circle', { cx, cy, r: r * 0.42, fill: '#2f5a44', stroke: '#1f3d2d' }), el('circle', { cx, cy, r: r * 0.16, fill: fill }));
    return g;
  }
  function gears() {
    const svg = el('svg', { viewBox: '0 0 64 52', class: 'gears', 'aria-hidden': 'true' });
    const g1 = gear(22, 30, 16, 10, '#9fb0a3'), g2 = gear(48, 14, 10, 8, '#c2cbbf');
    g1.setAttribute('class', 'g-cw'); g2.setAttribute('class', 'g-ccw');
    g1.style.transformOrigin = '22px 30px'; g2.style.transformOrigin = '48px 14px';
    svg.append(g1, g2); return svg;
  }

  // ---------- Спрайты для поля робота (смотрят вверх) ----------
  const SPR = {
    car: '<path class="dir-arrow" d="M12 -0.6 L18.4 5.4 H5.6 Z" fill="#ec6a1c" stroke="#2b2a22" stroke-width=".9" stroke-linejoin="round"/><rect x="6.5" y="5.5" width="11" height="17" rx="3.4" fill="#c2381f" stroke="#2b2a22" stroke-width="1.2"/><path d="M8 9.5 Q12 7.6 16 9.5 V12.6 H8 Z" fill="#a8dcf0" stroke="#2b2a22" stroke-width=".8"/><rect x="8.2" y="17" width="7.6" height="2.6" rx="1" fill="#7fb6cc" stroke="#2b2a22" stroke-width=".7"/><rect x="7.6" y="6.2" width="2.6" height="1.6" rx=".6" fill="#ffe38a" stroke="#2b2a22" stroke-width=".5"/><rect x="13.8" y="6.2" width="2.6" height="1.6" rx=".6" fill="#ffe38a" stroke="#2b2a22" stroke-width=".5"/><rect x="4.6" y="8" width="2.2" height="4.4" rx="1" fill="#2b2a22"/><rect x="17.2" y="8" width="2.2" height="4.4" rx="1" fill="#2b2a22"/><rect x="4.6" y="16" width="2.2" height="4.4" rx="1" fill="#2b2a22"/><rect x="17.2" y="16" width="2.2" height="4.4" rx="1" fill="#2b2a22"/><rect x="8.4" y="21" width="2.4" height="1" fill="#ff5a3c"/><rect x="13.2" y="21" width="2.4" height="1" fill="#ff5a3c"/>',
    robot: '<path class="dir-arrow" d="M12 -0.8 L18.4 5.2 H5.6 Z" fill="#ec6a1c" stroke="#2b2a22" stroke-width=".9" stroke-linejoin="round"/><rect x="3.2" y="9" width="3.4" height="12" rx="1.2" fill="#4c585d" stroke="#2b2a22" stroke-width=".8"/><rect x="17.4" y="9" width="3.4" height="12" rx="1.2" fill="#4c585d" stroke="#2b2a22" stroke-width=".8"/><path d="M3.8 11h2.2M3.8 14h2.2M3.8 17h2.2M18 11h2.2M18 14h2.2M18 17h2.2" stroke="#97a4a9" stroke-width=".7"/><rect x="6.2" y="5.4" width="11.6" height="16.6" rx="2.6" fill="#b3bfc4" stroke="#2b2a22" stroke-width="1.2"/><rect x="7.6" y="6.6" width="8.8" height="5.6" rx="1.4" fill="#9fe3cf" stroke="#2b2a22" stroke-width=".8"/><circle cx="10" cy="8.6" r="1.25" fill="#17221f"/><circle cx="14" cy="8.6" r="1.25" fill="#17221f"/><circle cx="9.6" cy="8.2" r=".4" fill="#fff"/><circle cx="13.6" cy="8.2" r=".4" fill="#fff"/><path d="M10 10.6 Q12 11.6 14 10.6" fill="none" stroke="#17221f" stroke-width=".6"/><rect x="8.6" y="14.2" width="6.8" height="4.4" rx=".8" fill="#0d1b12"/><path d="M9.2 16.6 l1.2 -1.2 1.2 1.2 1.2 -1.2 1.2 1.2" fill="none" stroke="#86f29a" stroke-width=".6"/><circle cx="12" cy="20.4" r=".8" fill="#e04a2a"/>',
    flag: '<path d="M6 21V3" stroke="#2b2a22" stroke-width="1.6"/><path d="M6 3h12v9H6z" fill="#fff" stroke="#2b2a22" stroke-width="1"/><path d="M6 3h3v3H6zM12 3h3v3h-3zM9 6h3v3H9zM15 6h3v3h-3zM6 9h3v3H6zM12 9h3v3h-3z" fill="#2b2a22"/>',
    drop: '<path d="M12 3 C12 3 5 11 5 15.5 A7 7 0 0 0 19 15.5 C19 11 12 3 12 3Z" fill="#3c8fd6" stroke="#20406a" stroke-width="1.2"/><path d="M9 15a3 3 0 0 0 3 3" stroke="#bfe3ff" stroke-width="1.4" fill="none"/>',
    plate: '<ellipse cx="12" cy="13" rx="9" ry="8" fill="#fffdf5" stroke="#2b2a22" stroke-width="1.2"/><ellipse cx="12" cy="13" rx="5.5" ry="4.8" fill="#f1e6c4"/><path d="M10 11c1-2 3-2 4 0" stroke="#c2381f" stroke-width="1.6" fill="none"/><path d="M3 4v6M5 4v6M4 10v11M20 4c-2 1-2 6 0 7v10" stroke="#6f7d82" stroke-width="1.1" fill="none"/>',
  };
  function sprite(name, dir) {
    const svg = el('svg', { viewBox: '0 -1.5 24 25.5', class: 'sprite', 'aria-hidden': 'true', overflow: 'visible' });
    svg.innerHTML = '<g transform="rotate(' + ((dir || 0) * 90) + ' 12 12)">' + SPR[name] + '</g>';
    return svg;
  }

  // ---------- Шлейф с бегущими импульсами ----------
  function ribbon() {
    const svg = el('svg', { viewBox: '0 0 120 56', class: 'ribbon', 'aria-hidden': 'true' });
    const N = 10, x0 = 25, sw = 7;
    for (let i = 0; i < N; i++) svg.append(el('rect', { x: x0 + i * sw, y: 8, width: sw - 0.8, height: 40, fill: i === 0 ? '#c2381f' : i % 2 ? '#a7a291' : '#bdb8a6' }));
    for (let i = 0; i < 4; i++) { const d = el('rect', { x: x0 + (1 + i * 2.5 | 0) * sw + 1, y: 8, width: sw - 2.8, height: 6, rx: 1, class: 'pulse', fill: '#86f29a' }); d.style.animationDelay = (i * 0.38) + 's'; svg.append(d); }
    const plug = (y) => { svg.append(el('rect', { x: 18, y, width: 84, height: 11, rx: 2, fill: '#2b2a22' }), el('rect', { x: 22, y: y + 2, width: 76, height: 7, fill: '#45423a' })); for (let i = 0; i < 12; i++) svg.append(el('rect', { x: 25 + i * 6.1, y: y + 3.5, width: 3, height: 4, fill: '#c9a227' })); svg.append(el('rect', { x: 10, y: y + 2, width: 8, height: 7, rx: 1, fill: '#7d7660' }), el('rect', { x: 102, y: y + 2, width: 8, height: 7, rx: 1, fill: '#7d7660' })); };
    plug(0); plug(45);
    return svg;
  }

  // ---------- Бобины магнитной ленты ----------
  function reels() {
    const svg = el('svg', { viewBox: '0 0 200 92', class: 'reels', 'aria-hidden': 'true' });
    svg.append(el('rect', { x: 1, y: 1, width: 198, height: 90, rx: 8, fill: '#d9d2bd', stroke: '#7d7660', 'stroke-width': 2 }));
    svg.append(el('rect', { x: 10, y: 8, width: 180, height: 62, rx: 5, fill: '#3c3a32' }));
    const reel = (cx, cls) => {
      const g = el('g', { class: cls }); g.style.transformOrigin = `${cx}px 39px`;
      g.append(el('circle', { cx, cy: 39, r: 26, fill: '#5b4a35' }), el('circle', { cx, cy: 39, r: 26, fill: 'none', stroke: '#8f8668', 'stroke-width': 2 }));
      for (let i = 0; i < 3; i++) { const a = i * 2.094; g.append(el('circle', { cx: cx + 14 * Math.cos(a), cy: 39 + 14 * Math.sin(a), r: 6, fill: '#3c3a32' })); }
      g.append(el('circle', { cx, cy: 39, r: 5, fill: '#c9c1a8', stroke: '#2b2a22' }));
      svg.append(g);
    };
    reel(56, 'reel-a'); reel(144, 'reel-b');
    svg.append(el('path', { d: 'M56,65 L100,70 L144,65', stroke: '#5b4a35', 'stroke-width': 2, fill: 'none' }));
    svg.append(el('rect', { x: 92, y: 64, width: 16, height: 8, fill: '#9aa6ab', stroke: '#2b2a22' }));
    [['#c2381f', 'led-a'], ['#c9a227', 'led-b'], ['#2f8a46', 'led-c']].forEach(([c, cls], i) => svg.append(el('circle', { cx: 24 + i * 12, cy: 80, r: 3.5, fill: c, class: cls })));
    const t = el('text', { x: 186, y: 83, 'text-anchor': 'end', class: 'reels-lbl' }); t.textContent = 'НМЛ · ЗАПИСЬ'; svg.append(t);
    return svg;
  }

  // ---------- Стрелочный прибор ----------
  function meter() {
    const svg = el('svg', { viewBox: '0 0 110 80', class: 'meter', 'aria-hidden': 'true' });
    svg.append(el('rect', { x: 1, y: 1, width: 108, height: 78, rx: 6, fill: '#2b2a22' }), el('rect', { x: 6, y: 6, width: 98, height: 58, rx: 4, fill: '#f4ecd3' }));
    for (let i = 0; i <= 10; i++) { const a = Math.PI * (1.15 + i * 0.07), r1 = 40, r2 = i % 5 ? 35 : 31; svg.append(el('line', { x1: 55 + r1 * Math.cos(a), y1: 62 + r1 * Math.sin(a), x2: 55 + r2 * Math.cos(a), y2: 62 + r2 * Math.sin(a), stroke: i > 7 ? '#c2381f' : '#2b2a22', 'stroke-width': 1.2 })); }
    const t = el('text', { x: 55, y: 50, 'text-anchor': 'middle', class: 'meter-lbl' }); t.textContent = 'V'; svg.append(t);
    const n = el('line', { x1: 55, y1: 62, x2: 55, y2: 26, stroke: '#c2381f', 'stroke-width': 1.6, class: 'needle', 'stroke-linecap': 'round' }); n.style.transformOrigin = '55px 62px'; svg.append(n);
    svg.append(el('circle', { cx: 55, cy: 62, r: 3.5, fill: '#2b2a22' }));
    [20, 90].forEach((x) => svg.append(el('circle', { cx: x, cy: 72, r: 3, fill: '#7d7660' })));
    return svg;
  }

  // ---------- Ряд индикаторов ----------
  function leds(n) {
    const svg = el('svg', { viewBox: `0 0 ${n * 14} 14`, class: 'leds', 'aria-hidden': 'true' });
    const cs = ['#ff5a3c', '#ffcf3f', '#86f29a', '#86f29a', '#5fc3ff'];
    for (let i = 0; i < n; i++) { const c = el('circle', { cx: 7 + i * 14, cy: 7, r: 4.5, fill: cs[i % cs.length], class: 'blink' }); c.style.animationDelay = (i * 0.37 % 1.9) + 's'; c.style.animationDuration = (1.2 + (i * 0.53) % 1.6) + 's'; svg.append(c); }
    return svg;
  }

  window.ART = { robot, sevenSeg, punchCard, tube, resistor, gears, sprite, ribbon, reels, meter, leds };
})();
