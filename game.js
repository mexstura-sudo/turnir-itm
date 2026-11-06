// «Захват сети ИТМ» — недельная игра после олимпиады. Демо-версия: всё считается в браузере, соперники — боты.
// Ожидает глобальные: h, RENDER, table (механики из страницы участника), ART, DEMO_TASKS.
(function () {
  'use strict';
  const { h, table, RENDER } = window.MECH;
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const $app = document.getElementById('app');
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  // ---------- сервер (Supabase) ----------
  const CFG = window.TOURNEY_CONFIG || {};
  const LIVE = !!(CFG.supabaseUrl && CFG.supabaseKey && window.supabase);
  const sb = LIVE ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: false } }) : null;
  async function rpc(fn, args) { const { data, error } = await sb.rpc(fn, args); if (error) throw new Error(error.message || 'NETWORK'); return data; }
  const ERR = { BAD_CODE: 'Такого кода нет. Он выдаётся после олимпиады — проверьте цифры.', NOT_STARTED: 'Игра ещё не началась — дата старта во вкладке «Правила».', ENDED: 'Игра завершена.', NOT_ALLOWED: 'Этот узел сейчас недоступен — карта успела измениться.', NO_ENERGY: 'Не хватает энергии.', NO_TASK: 'Задача устарела — откройте узел заново.', NO_TEAM: 'Команда не найдена — напишите организатору.' };
  const errText = (e) => { const m = String((e && e.message) || e); const k = Object.keys(ERR).find((x) => m.includes(x)); return k ? ERR[k] : 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.'; };
  const irkMin = (ms) => { const d = new Date(ms); return ((d.getUTCHours() + 8) % 24) * 60 + d.getUTCMinutes(); };
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }, del: (k) => { try { localStorage.removeItem(k); } catch (e) {} } };
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  let rnd = mulberry32(20261105);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  // ---------- данные ----------
  const GROUPS = 'МР-261 МР-262 МС-26 МШИ-26 НП-26 ПК-26 СП-26 СР-261 СР-262 ТОРА-261 ТОРА-262 ТОРА-263 ТОРА-264 Ш-26 ЭС-26 МР-251 МР-252 МС-25 НП-251 НП-252 П-25 СП-25 ТОРА-251 ТОРА-252 ЭС-25 ТОРА-241 ТОРА-242 СП-23 ТОРА-231 ТОРА-232'.split(' ');
  const TEACHERS = ['Иванова Е. В.', 'Петров С. А.', 'Кузнецова О. Н.', 'Смирнов Д. И.', 'Орлова Т. П.', 'Волков А. Г.', 'Морозова И. С.', 'Лебедев К. М.', 'Никитина Л. А.', 'Захаров В. Н.'];
  const SURN = ['Ковалёв', 'Смирнова', 'Петров', 'Орлова', 'Зуев', 'Белов', 'Тихонова', 'Карпов', 'Лысенко', 'Мухина', 'Гусев', 'Фролова', 'Носков', 'Рябова', 'Шилов', 'Егорова', 'Титов', 'Котова', 'Пахомов', 'Савина'];
  const REGIONS = ['Автомастерская', 'Сварочный цех', 'Серверная', 'Актовый зал', 'Швейный цех', 'Столовая', 'Учительская'];
  const T_TEAM = 'Преподаватели', T_COLOR = '#c99a06', TI = GROUPS.length; // команда преподавателей — последняя
  const VALUE = { node: 1, server: 3, core: 5, base: 0 };
  // неделя турнира: 5 дней, каждый день — событие, которое переворачивает поле
  const DAYS = [
    null,
    { t: 'Запуск сети', d: 'Сеть открыта! Захват свободных узлов сегодня стоит 0 ⚡ — нужна только задача. Занимайте территорию, пока она ничья.', captureFree: true, hot: 0 },
    { t: 'Блэкаут в Серверной', d: 'Ночью пропало питание: все узлы Серверной снова свободны, щиты сброшены. Серверы сегодня приносят ×2.', flip: 'blackout', region: 2, serverX: 2, hot: 5 },
    { t: 'Ремонт: двери переставили', d: 'Часть проёмов заложили, прорубили новые — кабели пошли иначе. Проверьте связь с базой: отрезанные узлы не дают очков. Укрепление сегодня бесплатно.', flip: 'doors', fortifyFree: true, hot: 4 },
    { t: 'Концерт: прожектор на лидеров', d: 'У трёх лидеров рейтинга сброшены щиты, атака на их узлы дешевле на 1 ⚡. В Актовом зале концерт — его узлы приносят ×2.', flip: 'leaders', region: 3, regionX: 2, leaderAttack: -1, hot: 3 },
    { t: 'Финальный штурм', d: 'Все щиты в сети сброшены. Атака везде дешевле на 1 ⚡, ядра цехов приносят ×2. Итоги — {final}.', flip: 'shields', attack: -1, coreX: 2, hot: 6 },
  ];
  const LAST_DAY = 5, END_MIN = 22 * 60, E_CAP = 6; // демо: финал в 22:00 пятого дня; энергия копится до 6
  // даты игры берутся с сервера (пульт → «Игра: сроки»); в демо — 9–13 ноября
  const DEF_START = Date.UTC(2026, 10, 8, 16, 0), DEF_END = Date.UTC(2026, 10, 13, 14, 0);
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'], WDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const fmtIrk = (d) => ({ text: d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()], short: d.getUTCDate() + '.' + String(d.getUTCMonth() + 1).padStart(2, '0'), wd: WDAYS[d.getUTCDay()], hm: String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'), key: d.toISOString().slice(0, 10) });
  const atIrk = (ms) => fmtIrk(new Date(ms + 8 * 3600e3));
  const gStart = () => G.startsAt || DEF_START, gEnd = () => G.endsAt || DEF_END;
  // дата n-го игрового дня (по календарю Иркутска)
  function dayDate(n) { const b = new Date(gStart() + 8 * 3600e3); return fmtIrk(new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + Math.max(1, n) - 1, 12))); }
  const startText = () => { const a = atIrk(gStart()); return `${a.text} в ${a.hm.replace(/^0(?=\d:)/, '')}`; };
  const finalText = (day) => { const e = atIrk(gEnd()); return (day && dayDate(day).key === e.key ? 'сегодня' : e.text) + ' в ' + e.hm; };
  const evText = (ev, day) => String(ev.d || '').replace('{final}', finalText(day));
  const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  // группы — от зелёного до малинового; жёлто-оранжевый и красный оставлены преподавателям и значкам атаки
  const teamColor = (i, n) => `hsl(${Math.round(78 + ((i * 11) % n) * (272 / n))} ${i % 2 ? 50 : 62}% ${i % 3 === 0 ? 42 : i % 3 === 1 ? 52 : 34}%)`;

  // ---------- карта: план учебного корпуса ----------
  const adjOf = (N, E) => { const a = Array.from({ length: N }, () => []); E.forEach(([x, y]) => { a[x].push(y); a[y].push(x); }); return a; };
  const reachFrom = (N, E, s) => { const a = adjOf(N, E), seen = new Set([s]), q = [s]; while (q.length) { const u = q.shift(); a[u].forEach((v) => { if (!seen.has(v)) { seen.add(v); q.push(v); } }); } return seen; };
  const gapsOf = (ts) => { ts = ts.slice().sort((a, b) => a - b); const out = []; ts.forEach((t) => { const last = out[out.length - 1]; if (last && t - 13 <= last[1] + 8) last[1] = t + 13; else out.push([t - 13, t + 13]); }); return out; };
  const ekey = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  // двери: кабель между цехами — только через открытый проём
  function setDoors(L, open) {
    const doors = L.pool.filter((d) => open.has(d.k));
    L.edges = L.fixed.concat(doors.map((d) => [d.a, d.b])); L.adj = adjOf(L.nodes.length, L.edges);
    L.plan.walls.forEach((w, wi) => { w.gaps = gapsOf(doors.filter((d) => d.wi === wi).map((d) => d.t)); });
  }
  function rewireDoors(L) {
    const open = new Set(L.edges.map(([a, b]) => ekey(a, b)).filter((k) => L.poolKeys.has(k)));
    for (let attempt = 0; attempt < 40; attempt++) {
      const next = new Set();
      L.plan.walls.forEach((w, wi) => {
        const onW = L.pool.filter((d) => d.wi === wi), o = shuffle(onW.filter((d) => open.has(d.k))), c = shuffle(onW.filter((d) => !open.has(d.k)));
        const keep = o.slice(0, Math.floor(o.length / 2)), add = c.slice(0, Math.max(2, o.length - keep.length));
        keep.concat(add).forEach((d) => next.add(d.k));
      });
      const E = L.fixed.concat(L.pool.filter((d) => next.has(d.k)).map((d) => [d.a, d.b]));
      if (reachFrom(L.nodes.length, E, 0).size < L.nodes.length) continue;
      const changed = L.pool.filter((d) => open.has(d.k) !== next.has(d.k));
      setDoors(L, next);
      return { closed: changed.filter((d) => open.has(d.k)).length, opened: changed.filter((d) => next.has(d.k)).length, hit: [...new Set(changed.flatMap((d) => [d.a, d.b]))] };
    }
    return { closed: 0, opened: 0, hit: [] };
  }
  function buildMap() {
    rnd = mulberry32(77);
    const cols = 12, rows = 13, SX = 62, SY = 54, OX = 46, OY = 56;
    const bx0 = OX - 34, bx1 = OX + (cols - 1) * SX + SX / 2 + 34, by0 = OY - 34, by1 = OY + (rows - 1) * SY + 32;
    const yW1 = OY + 3.5 * SY, yW2 = OY + 8.5 * SY, vx = (c) => OX + c * SX + SX / 4;
    const xA = vx(5), xB1 = vx(3), xB2 = vx(8), xC = vx(6);
    // комнаты: [x0, y0, x1, y1] в порядке REGIONS
    const rooms = [[bx0, by0, xA, yW1], [xA, by0, bx1, yW1], [bx0, yW1, xB1, yW2], [xB2, yW1, bx1, yW2], [bx0, yW2, xC, by1], [xC, yW2, bx1, by1], [xB1, yW1, xB2, yW2]];
    const PROP = [[0.3, 0.55], [0.7, 0.52], [0.5, 0.44], [0.55, 0.56], [0.28, 0.52], [0.66, 0.5], [0.3, 0.33]];
    const regions = rooms.map(([x0, y0, x1, y1], i) => ({ id: i, name: REGIONS[i], x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, px: x0 + (x1 - x0) * PROP[i][0], py: y0 + (y1 - y0) * PROP[i][1] }));
    const roomOf = (x, y) => rooms.findIndex(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);
    let nodes = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      let x = OX + c * SX + (r % 2) * SX / 2 + (rnd() - 0.5) * 16; const y = OY + r * SY + (rnd() - 0.5) * 14;
      (y < yW1 ? [xA] : y < yW2 ? [xB1, xB2] : [xC]).forEach((w) => { if (Math.abs(x - w) < 16) x = w + (x < w ? -16 : 16); });
      const region = roomOf(x, y), R = regions[region];
      if (Math.hypot(x - R.px, y - R.py) < 50) continue; // место под оборудование цеха
      nodes.push({ r, c, x, y, region, owner: null, shield: 0, kind: 'node' });
    }
    const linkUp = () => {
      const idx = new Map(); nodes.forEach((n, i) => { n.id = i; idx.set(n.r * cols + n.c, i); });
      const at = (r, c) => (r >= 0 && r < rows && c >= 0 && c < cols && idx.has(r * cols + c) ? idx.get(r * cols + c) : -1);
      const E = []; nodes.forEach((n) => { const { r, c } = n; [at(r, c + 1), ...(r % 2 ? [at(r + 1, c), at(r + 1, c + 1)] : [at(r + 1, c - 1), at(r + 1, c)])].forEach((m) => m >= 0 && E.push([n.id, m])); });
      return E;
    };
    let E = linkUp();
    const main = reachFrom(nodes.length, E, Math.floor(nodes.length / 2));
    if (main.size < nodes.length) { nodes = nodes.filter((n) => main.has(n.id)); E = linkUp(); }
    // стены: кабели проходят только через дверные проёмы
    const walls = [{ o: 'h', at: yW1, a: bx0, b: bx1 }, { o: 'h', at: yW2, a: bx0, b: bx1 }, { o: 'v', at: xA, a: by0, b: yW1 }, { o: 'v', at: xB1, a: yW1, b: yW2 }, { o: 'v', at: xB2, a: yW1, b: yW2 }, { o: 'v', at: xC, a: yW2, b: by1 }];
    const crossing = ([p, q]) => { const A = nodes[p], B = nodes[q]; for (let wi = 0; wi < walls.length; wi++) { const w = walls[wi]; const [ua, ub, va, vb] = w.o === 'h' ? [A.y, B.y, A.x, B.x] : [A.x, B.x, A.y, B.y]; if ((ua - w.at) * (ub - w.at) >= 0) continue; const t = va + (vb - va) * (w.at - ua) / (ub - ua); if (t > w.a && t < w.b) return { wi, t }; } return null; };
    const cr = E.map(crossing), alive = E.map(() => true), perWall = walls.map(() => 0); cr.forEach((c) => c && perWall[c.wi]++);
    const pool = E.map((e, i) => (cr[i] ? { a: e[0], b: e[1], k: ekey(e[0], e[1]), wi: cr[i].wi, t: cr[i].t } : null)).filter(Boolean);
    const order = shuffle(E.map((_, i) => i));
    order.forEach((i) => {
      const c = cr[i]; if (rnd() >= (c ? 0.7 : 0.16)) return; if (c && perWall[c.wi] <= 3) return;
      alive[i] = false; if (reachFrom(nodes.length, E.filter((_, k) => alive[k]), 0).size < nodes.length) { alive[i] = true; return; }
      if (c) perWall[c.wi]--;
    });
    const fixed = E.filter((_, i) => alive[i] && !cr[i]), openDoors = new Set(E.filter((_, i) => alive[i] && cr[i]).map(([a, b]) => ekey(a, b)));
    const plan = { bx0, by0, bx1, by1, ent: (xC + bx1) / 2 + 30, walls: walls.map((w) => ({ ...w, gaps: [] })) };
    // база преподавателей — в Учительской, ядра и серверы цехов
    const near = (arr, x, y) => arr.reduce((b, n) => ((n.x - x) ** 2 + (n.y - y) ** 2 < (b.x - x) ** 2 + (b.y - y) ** 2 ? n : b));
    const TR = regions[6], tBase = near(nodes.filter((n) => n.region === 6), TR.x0 + (TR.x1 - TR.x0) * 0.68, TR.y0 + (TR.y1 - TR.y0) * 0.64);
    tBase.kind = 'base';
    regions.forEach((R) => {
      const inR = nodes.filter((n) => n.region === R.id && n.kind === 'node').sort((a, b) => ((a.x - R.cx) ** 2 + (a.y - R.cy) ** 2) - ((b.x - R.cx) ** 2 + (b.y - R.cy) ** 2));
      const core = R.id === 6 ? inR[inR.length - 1] : inR[0]; if (core) core.kind = 'core';
      inR.slice(3).filter((n, k) => k % 5 === 2 && n.kind === 'node').slice(0, 2).forEach((n) => (n.kind = 'server'));
    });
    const teams = GROUPS.map((name, i) => ({ id: i, name, color: teamColor(i, GROUPS.length), base: -1, members: ri(7, 24), captures: 0 }));
    teams.push({ id: TI, name: T_TEAM, color: T_COLOR, base: tBase.id, members: 26, captures: 0, teach: true });
    tBase.owner = TI;
    // базы групп — максимально далеко друг от друга
    const free = nodes.filter((n) => n.kind === 'node'), chosen = [tBase];
    for (let i = 0; i < GROUPS.length; i++) { let best = null, bd = -1; free.forEach((n) => { if (n.kind !== 'node') return; const d = Math.min(...chosen.map((m) => (n.x - m.x) ** 2 + (n.y - m.y) ** 2)); if (d > bd) { bd = d; best = n; } }); best.kind = 'base'; best.owner = i; teams[i].base = best.id; chosen.push(best); }
    const L = { nodes, teams, regions, plan, pool, poolKeys: new Set(pool.map((d) => d.k)), fixed, edges: [], adj: [], hot: null, leaders: [], log: [], hackers: {} };
    setDoors(L, openDoors);
    return L;
  }

  // ---------- правила ----------
  function connected(L, t) { const b = L.teams[t].base, seen = new Set([b]), q = [b]; while (q.length) { const u = q.shift(); L.adj[u].forEach((v) => { if (!seen.has(v) && L.nodes[v].owner === t) { seen.add(v); q.push(v); } }); } return seen; }
  function reachable(L, t) { const c = connected(L, t), out = new Set(); c.forEach((u) => L.adj[u].forEach((v) => { const n = L.nodes[v]; if (n.owner !== t && n.kind !== 'base') out.add(v); })); return out; }
  function nodeValue(L, n, ev) {
    if (n.kind === 'base') return 0;
    let v = VALUE[n.kind];
    if (n.kind === 'core' && ev.coreX) v *= ev.coreX;
    if (n.kind === 'server' && ev.serverX) v *= ev.serverX;
    if (ev.regionX && n.region === ev.region) v *= ev.regionX;
    return v + (L.hot === n.id ? 10 : 0);
  }
  function score(L, t, ev) {
    ev = ev || {}; const c = connected(L, t); let s = 0; c.forEach((u) => { s += nodeValue(L, L.nodes[u], ev); });
    L.regions.forEach((r) => { const all = L.nodes.filter((n) => n.region === r.id && n.kind !== 'base'); const mine = all.filter((n) => c.has(n.id)); if (mine.length * 2 > all.length) s += 10; });
    return s;
  }
  const evOf = (G) => DAYS[G.day] || {};
  // горячая точка дня — второй по близости к центру цеха узел (не база и не ядро)
  function hotNode(L, day) {
    const r = DAYS[day].hot, R = L.regions[r], cand = L.nodes.filter((n) => n.region === r && n.kind !== 'base' && n.kind !== 'core').sort((a, b) => ((a.x - R.cx) ** 2 + (a.y - R.cy) ** 2) - ((b.x - R.cx) ** 2 + (b.y - R.cy) ** 2));
    return cand.length ? cand[Math.min(1, cand.length - 1)].id : null;
  }
  function cost(G, L, n, action) {
    const ev = evOf(G); let c = action === 'capture' ? 1 : action === 'attack' ? 2 + n.shield : 1;
    if (action === 'attack') { if (ev.attack) c += ev.attack; if (ev.leaderAttack && L.leaders.includes(n.owner)) c += ev.leaderAttack; }
    if (action === 'fortify' && ev.fortifyFree) c = 0;
    if (action === 'capture' && ev.captureFree) c = 0;
    return Math.max(0, c);
  }
  function apply(L, n, t, action, who) {
    const prev = n.owner;
    if (action === 'fortify') { n.shield = Math.min(3, n.shield + 1); }
    else { n.owner = t; n.shield = 0; L.teams[t].captures++; }
    L.hackers[who + '|' + t] = (L.hackers[who + '|' + t] || 0) + (action === 'fortify' ? 0 : 1);
    return prev;
  }

  // ---------- боты ----------
  const botName = (L, t) => (L.teams[t].teach ? pick(TEACHERS) : pick(SURN));
  function botAction(G, L, t, who, silent) {
    const reach = [...reachable(L, t)].map((i) => L.nodes[i]); if (!reach.length) return null;
    const neutral = reach.filter((n) => n.owner == null), enemy = reach.filter((n) => n.owner != null && n.shield < 2);
    let n, action;
    const own = [...connected(L, t)].map((i) => L.nodes[i]).filter((x) => x.kind !== 'base' && x.shield < 3);
    if (own.length && rnd() < 0.18) { n = pick(own); action = 'fortify'; }
    else if (neutral.length && rnd() < 0.8) { n = pick(neutral); action = 'capture'; }
    else if (enemy.length && rnd() < 0.6) { n = pick(enemy); action = 'attack'; }
    else if (neutral.length) { n = pick(neutral); action = 'capture'; }
    else { if (!own.length) return null; n = pick(own); action = 'fortify'; }
    if (rnd() > (action === 'attack' ? 0.65 : 0.82)) return null;
    const prev = apply(L, n, t, action, who);
    const entry = { day: G.day, t, who, action, node: n.id, prev, time: Date.now() };
    L.log.unshift(entry); if (L.log.length > 120) L.log.length = 120;
    return entry;
  }
  function botDay(G, L, intensity) {
    L.teams.forEach((tm, t) => { const k = Math.round(ri(2, 5) * intensity * Math.sqrt(tm.members / 14)); for (let i = 0; i < k; i++) { if (G.me && t === G.me.team && i % 2) continue; botAction(G, L, t, botName(L, t)); } });
  }

  // ---------- состояние игры ----------
  const G = { day: 1, clock: 9 * 60, L: null, me: null, view: 'map', sel: null, vb: null, over: false };
  // утро нового дня: событие переворачивает поле, появляется горячая точка
  function dayFlip(L, day) {
    const ev = DAYS[day], out = { day, hit: [], lines: [] };
    if (ev.flip === 'blackout') { L.nodes.forEach((n) => { if (n.region === ev.region && n.kind !== 'base' && (n.owner != null || n.shield)) { n.owner = null; n.shield = 0; out.hit.push(n.id); } }); out.lines.push(`Освобождено узлов в Серверной: ${out.hit.length}`); }
    if (ev.flip === 'doors') { const r = rewireDoors(L); out.hit = r.hit; out.lines.push(`Заложено проёмов: ${r.closed}, прорублено новых: ${r.opened}`); }
    if (ev.flip === 'leaders') { L.leaders = standings(L).slice(0, 3).map((r) => r.i); L.nodes.forEach((n) => { if (L.leaders.includes(n.owner) && n.shield) { n.shield = 0; out.hit.push(n.id); } }); out.lines.push('Под прожектором: ' + L.leaders.map((t) => L.teams[t].name).join(', ')); }
    else L.leaders = [];
    if (ev.flip === 'shields') { L.nodes.forEach((n) => { if (n.shield) { n.shield = 0; out.hit.push(n.id); } }); out.lines.push(`Сброшено щитов на ${out.hit.length} узлах`); }
    L.hot = hotNode(L, day);
    return out;
  }
  // ход времени: каждые 2 часа (в чётные часы) +1 ⚡, соперники действуют; в полночь — новый день
  function advance(mins) {
    const L = G.L, me = G.me; let brief = null, gained = 0;
    for (let m = 0; m < mins && !G.over; m += 10) {
      const prev = G.clock; G.clock += 10;
      if (Math.floor(G.clock / 120) > Math.floor(prev / 120)) {
        if (me.energy < E_CAP) { me.energy++; gained++; }
        const night = G.clock % 1440 < 7 * 60;
        L.teams.forEach((tm, t) => { if (rnd() < (night ? 0.06 : 0.3) * Math.sqrt(tm.members / 14) && !(t === me.team && rnd() < 0.5)) botAction(G, L, t, botName(L, t)); });
      }
      if (G.clock >= 1440) {
        G.clock -= 1440;
        if (G.day < LAST_DAY) { const before = score(L, me.team, evOf(G)); G.day++; brief = dayFlip(L, G.day); brief.before = before; brief.after = score(L, me.team, evOf(G)); }
      }
      if (G.day === LAST_DAY && G.clock >= END_MIN) { G.clock = END_MIN; G.over = true; }
    }
    return { brief, gained };
  }
  function startDemo(asTeacher) {
    const L = G.L = buildMap();
    const myTeam = asTeacher ? TI : GROUPS.indexOf('ТОРА-231');
    G.me = asTeacher ? { name: 'Петрова А. С.', teacher: true, team: myTeam, energy: 11, captures: 0, code: 'ИТМ-0000-01', score: 168 } : { name: 'Ковалёв Дмитрий', team: myTeam, energy: 13, captures: 0, code: 'ИТМ-7203-19', score: 190 };
    rnd = mulberry32(4242);
    G.day = 1; G.clock = 9 * 60; G.over = false; dayFlip(L, 1);
    for (let k = 0, done = 0; k < 12 && done < 3; k++) if (botAction(G, L, myTeam, asTeacher ? pick(TEACHERS) : pick(SURN))) done++; // одногруппники уже начали
    botDay(G, L, 0.8); advance(5 * 60 + 40); // демо открывается в понедельник, 14:40
    G.view = 'map'; G.sel = null; G.vb = null;
    showGame();
  }
  const teamName = (L, t) => (t == null ? 'нейтральный' : L.teams[t].name);
  const nodeTitle = (L, n) => `${n.kind === 'core' ? 'Ядро' : n.kind === 'server' ? 'Сервер' : n.kind === 'base' ? 'База' : 'Узел'} ${String(n.id).padStart(3, '0')} · ${L.regions[n.region].name}`;
  const grpWord = () => (G.me && G.me.teacher ? 'команды' : 'группы');

  // ---------- задачи-взломы ----------
  const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];
  function robotOk(c, p) { if (!p || p.length > c.maxLen) return false; const g = c.grid; let r, cc, d = c.dir; g.forEach((row, i) => { const j = row.indexOf('S'); if (j >= 0) { r = i; cc = j; } }); for (const ch of p) { if (ch === 'L') d = (d + 3) % 4; else if (ch === 'R') d = (d + 1) % 4; else { r += DR[d]; cc += DC[d]; if (r < 0 || r >= g.length || cc < 0 || cc >= g[0].length || g[r][cc] === '#') return false; if (g[r][cc] === 'G') return true; } } return false; }
  function check(type, ans, sub) { try { if (sub == null) return false; switch (type) {
    case 'choice': return +sub === +ans;
    case 'multi': case 'spot': case 'rows': return JSON.stringify([...new Set(sub)].sort((a, b) => a - b)) === JSON.stringify(ans);
    case 'order': case 'match': case 'graph': case 'bins': return JSON.stringify(sub) === JSON.stringify(ans);
    case 'pixel': case 'logic': case 'bits': return sub === ans;
    case 'number': return Math.abs(parseFloat(String(sub).replace(',', '.')) - ans.v) <= (ans.tol || 0) + 1e-6;
    case 'text': { const s = String(sub).replace(/\s/g, '').toLowerCase(); return ans.strip0 ? (s.replace(/^0+/, '') || '0') === (ans.v.replace(/^0+/, '') || '0') : s === ans.v.toLowerCase(); }
    case 'robot': return robotOk(ans, sub);
  } } catch (e) {} return false; }
  const QUICK = new Set(['bits', 'choice', 'logic', 'spot', 'match', 'bins', 'rows', 'number', 'text']);
  function pickTask(action, n) {
    const pool = action === 'attack' ? (n.shield >= 2 ? 'boss' : 'medium') : 'easy';
    const list = DEMO_TASKS.filter((v) => v.pool === pool && QUICK.has(v.type));
    return list[Math.floor(Math.random() * list.length)];
  }

  // ---------- экраны ----------
  function clear() { if (G.timer) { clearInterval(G.timer); G.timer = null; } $app.replaceChildren(); }
  function showLogin(msg, auto) {
    clear(); stopPoll(); G.live = false;
    const inp = h('input', { class: 't code-in', id: 'f-code', placeholder: 'ИТМ-0000-00', maxlength: '11', autocomplete: 'off', inputmode: 'numeric', spellcheck: 'false' });
    const err = h('p', { class: 'err', hidden: !msg }, msg || '');
    const form = h('form', { class: 'sheet screws', novalidate: true },
      h('h2', null, 'Вход в игру'),
      h('p', { style: 'margin:0' }, 'Код выдаётся после прохождения олимпиады — он на экране с результатом.'),
      h('label', { class: 'f' }, 'Ваш код', inp), err,
      h('button', { class: 'btn', type: 'submit' }, 'Подключиться к сети'));
    const btn = form.querySelector('button[type=submit]');
    form.addEventListener('submit', (e) => {
      e.preventDefault(); const v = inp.value.trim().toUpperCase().replace(/\s/g, '');
      if (!/^ИТМ-\d{4}-\d{2}$/.test(v)) { err.textContent = 'Код выглядит так: ИТМ-7203-19 — шесть цифр.'; err.hidden = false; return; }
      if (LIVE) liveLogin(v, err, btn); else startDemo(v === 'ИТМ-0000-01');
    });
    inp.addEventListener('input', () => { const v = inp.value.replace(/^ИТМ/i, '').replace(/\D/g, '').slice(0, 6); inp.value = v ? 'ИТМ-' + v.slice(0, 4) + (v.length > 4 ? '-' + v.slice(4) : '') : ''; });
    $app.append(
      h('div', { class: 'screen' }, h('div', { class: 'glass g-intro' }, netArt(), h('div', { class: 'hero-txt' },
        h('h1', null, 'Захват сети ИТМ'),
        h('p', { style: 'margin:0' }, 'Пять дней: 30 групп и команда преподавателей в одной сети учебного корпуса. Взламывайте узлы задачами по информатике, держите линии связи и выводите свою команду на первое место.')))),
      LIVE ? null : h('div', { class: 'banner' }, h('span', null, 'Демо-режим: соперники — боты, данные не сохраняются.'),
        h('span', { class: 'demo-codes' }, h('button', { type: 'button', onclick: () => { inp.value = 'ИТМ-7203-19'; } }, 'Код студента'), h('button', { type: 'button', onclick: () => { inp.value = 'ИТМ-0000-01'; } }, 'Код преподавателя'))),
      form,
      rulesSheet());
    // код из ссылки «Войти в игру» или с прошлого входа
    const fromHash = decodeURIComponent((location.hash || '').slice(1)).toUpperCase();
    const known = /^ИТМ-\d{4}-\d{2}$/.test(fromHash) ? fromHash : LIVE ? store.get('zs_code') : null;
    if (known) { inp.value = known; if (LIVE && auto) liveLogin(known, err, btn); }
  }
  // ---------- живая игра ----------
  async function liveLogin(code, err, btn) {
    btn.disabled = true; btn.textContent = 'Подключаемся…';
    try {
      const st = await rpc('g_login', { p_code: code });
      store.set('zs_code', code);
      G.live = true; G.code = code; G.L = buildMap(); G.ver = -1; G.logId = 0; G.day = null; G.view = 'map'; G.sel = null; G.vb = null; G.over = false;
      G.me = { name: st.me.name, team: st.me.team, energy: st.me.energy, captures: st.me.captures, code, teacher: !!G.L.teams[st.me.team].teach };
      applyLive(st, true);
      showGame(); maybeBrief(); startPoll();
    } catch (e) { err.textContent = errText(e); err.hidden = false; btn.disabled = false; btn.textContent = 'Подключиться к сети'; }
  }
  function applyLive(st, first) {
    const L = G.L, me = G.me, now = Date.parse(st.now);
    G.skew = now - Date.now(); G.startsAt = Date.parse(st.starts_at); G.endsAt = Date.parse(st.ends_at);
    const prevDay = G.day; G.day = st.day; G.over = now >= G.endsAt; G.clock = irkMin(now);
    Object.assign(me, { energy: st.me.energy, captures: st.me.captures, team: st.me.team, name: st.me.name });
    if (st.doors) setDoors(L, new Set(st.doors.map(([a, b]) => ekey(a, b))));
    st.nodes.forEach(([id, owner, shield]) => { const n = L.nodes[id]; if (n) { n.owner = owner; n.shield = shield; } });
    L.hot = st.hot; L.leaders = st.leaders || [];
    L.teams.forEach((t, i) => { t.members = (st.members || {})[i] || 0; });
    G.top = st.top || [];
    const fresh = [];
    (st.log || []).slice().reverse().forEach(([id, day, t, who, action, node, prev]) => { if (id <= G.logId) return; G.logId = id; const e = { id, day, t, who, action, node, prev, me: t === me.team && who === me.name }; L.log.unshift(e); fresh.push(e); });
    if (L.log.length > 120) L.log.length = 120;
    G.ver = st.ver;
    return { dayChanged: prevDay != null && prevDay !== G.day, fresh: first ? [] : fresh };
  }
  let polling = false, visHooked = false;
  function startPoll() {
    stopPoll(); G.poll = setInterval(pollLive, 20000);
    if (!visHooked) { visHooked = true; document.addEventListener('visibilitychange', () => { if (!document.hidden && G.live) pollLive(); }); }
  }
  function stopPoll() { if (G.poll) { clearInterval(G.poll); G.poll = null; } }
  async function pollLive() {
    if (!G.live || polling || document.hidden || document.querySelector('.hack-modal')) return;
    polling = true;
    try {
      const r = applyLive(await rpc('g_state', { p_code: G.code, p_ver: G.ver, p_log: G.logId }), false);
      if (r.dayChanged) { G.sel = null; showGame(); maybeBrief(); return; }
      const hud = document.querySelector('.hud'); if (hud) hud.replaceWith(buildHud());
      if (G.view === 'map' && mapRefs && mapRefs.L === G.L) { mapRefs.draw(); if (G.sel != null) mapRefs.drawSheet(); r.fresh.filter((e) => !e.me).slice(0, 4).forEach((e) => liveUpdate(G.L, e)); }
      else if (G.view === 'rank' || G.view === 'log') { const cur = document.querySelector('[data-view]'); if (cur) cur.replaceWith(viewEl(G.L)); }
    } catch (e) { /* тихо — следующий опрос через 20 с */ } finally { polling = false; }
  }
  function maybeBrief() {
    if (!G.live || !G.day) return;
    const k = 'zs_brief_' + G.code; if (+(store.get(k) || 0) >= G.day) return;
    store.set(k, String(G.day)); showBrief({ day: G.day, hit: [], lines: [] });
  }
  function netArt() { const s = sv('svg', { viewBox: '0 0 160 110', class: 'net-art', 'aria-hidden': 'true' }); const P = [[20, 20], [70, 14], [128, 26], [40, 60], [94, 56], [140, 80], [20, 96], [78, 98]]; [[0, 1], [1, 2], [0, 3], [1, 4], [2, 4], [3, 4], [4, 5], [3, 6], [6, 7], [4, 7], [5, 7]].forEach(([a, b]) => s.append(sv('line', { x1: P[a][0], y1: P[a][1], x2: P[b][0], y2: P[b][1], stroke: '#8f8668', 'stroke-width': 2 }))); const C = ['#c2381f', '#20406a', '#2f8a46', '#c2381f', '#ec6a1c', '#20406a', '#2f8a46', '#e9dfc0']; P.forEach(([x, y], i) => { const c = sv('circle', { cx: x, cy: y, r: i === 4 ? 10 : 7, fill: C[i], stroke: '#2b2a22', 'stroke-width': 2, class: 'na-n' }); c.style.animationDelay = (i * 0.4) + 's'; s.append(c); }); return s; }
  function rulesSheet() {
    return h('div', { class: 'sheet rules-sheet' },
      h('h2', null, 'Правила'),
      h('div', { class: 'rule-grid' },
        h('div', null, h('b', null, '⚡ Энергия'), h('p', null, 'Старт — от баллов олимпиады: 5 + балл ÷ 20 (до 15). Каждые 2 часа — в 0:00, 2:00 … 22:00 — +1 ⚡. Копится до 6 ⚡: заходите утром и вечером, чтобы заряд не простаивал.')),
        h('div', null, h('b', null, '◯ Захват'), h('p', null, 'Свободный узел рядом с территорией: 1 ⚡ + лёгкая задача.')),
        h('div', null, h('b', null, '⚔ Атака'), h('p', null, 'Узел соперника: 2 ⚡ + 1 ⚡ за каждый щит. Задача сложнее, при 2+ щитах — «босс».')),
        h('div', null, h('b', null, '◎ Щиты'), h('p', null, 'Укрепить свой узел: 1 ⚡ + задача, до 3 щитов. Захват сбрасывает щиты.')),
        h('div', null, h('b', null, '🔗 Связь'), h('p', null, 'Узлы, отрезанные от базы, не приносят очков. Между цехами кабели идут только через двери.')),
        h('div', null, h('b', null, '★ Очки'), h('p', null, 'Узел — 1, сервер ▣ — 3, ядро цеха ★ — 5. Больше половины цеха — ещё +10.')),
        h('div', null, h('b', null, '🔥 Горячая точка'), h('p', null, 'Каждый день один узел горит: пока он ваш, он приносит +10 очков.')),
        h('div', null, h('b', null, '📅 5 дней'), h('p', null, `С ${dayDate(1).text} по ${atIrk(gEnd()).text}. Каждую полночь — событие, которое переворачивает поле. Итоги — ${finalText(0)}.`))),
      h('p', { class: 'small muted', style: 'margin:0' }, 'Ошибка во взломе сжигает потраченную энергию. Студенты играют за свои группы, преподаватели — общей командой «Преподаватели» с базой в Учительской.'));
  }
  // теория для задач уровня БОСС
  const THEORY = {
    logic: { t: 'Логическая схема', s: 'И · ИЛИ · НЕ',
      rules: ['И даёт 1, только если оба входа равны 1.', 'ИЛИ даёт 1, если хотя бы один вход равен 1.', 'НЕ переворачивает: НЕ 1 = 0, НЕ 0 = 1.', 'Решайте с конца. Если вся формула — «(…) И (…)», обе скобки обязаны быть 1: так находятся первые переключатели, остальные подставляются.'],
      ex: ['Лампа = ((НЕ D ИЛИ (B ИЛИ НЕ C)) И A) И (D И C)', '(D И C) = 1  →  D = 1, C = 1', 'НЕ D = 0 и НЕ C = 0  →  нужно B = 1', '(…) И A = 1  →  A = 1', 'Ответ: A = 1, B = 1, C = 1, D = 1'] },
    image: { t: 'Объём изображения', s: 'пиксели → биты → Кбайты',
      rules: ['Бит на пиксель i: 2 цвета — 1 бит, 4 — 2, 16 — 4, 256 — 8 (2^i = число цветов).', 'Объём = ширина × высота × i (в битах).', 'Биты ÷ 8 = байты, байты ÷ 1024 = Кбайты.'],
      ex: ['512 × 256 пикселей, палитра 16 цветов', '16 цветов → i = 4 бита', '512 · 256 · 4 = 524 288 бит', '÷ 8 = 65 536 байт ÷ 1024', 'Ответ: 64 Кбайт (степенями: 2⁹·2⁸·2² / 2³ / 2¹⁰ = 2⁶)'] },
    trace: { t: 'Трассировка программы', s: 'выполнить код на бумаге',
      rules: ['Заведите таблицу: i | условие | s. Каждый шаг цикла — новая строка.', 'mod — остаток от деления: 7 mod 3 = 1, 9 mod 3 = 0.', '«для i от 1 до 14» — i пробегает 1, 2, …, 14 включительно.', 'Ищите короткий путь: часто проще посчитать «всё минус лишнее».'],
      ex: ['для i от 1 до 14: если i mod 3 ≠ 0: s = s + i', 'сумма 1 … 14 = 14 · 15 / 2 = 105', 'лишние (делятся на 3): 3 + 6 + 9 + 12 = 30', 'Ответ: s = 105 − 30 = 75'] },
    formula: { t: 'Формулы с условием', s: 'СЧЁТЕСЛИ · СУММЕСЛИ',
      rules: ['=СЧЁТЕСЛИ(диапазон; условие) — сколько ячеек подходит.', '=СУММЕСЛИ(где проверять; условие; что складывать) — сумма только по подходящим строкам.', '">68" — строго больше, 68 не входит; ">=68" — входит; "НА" — точное совпадение текста.', 'Сначала отметьте подходящие строки, потом считайте.'],
      ex: ['=СУММЕСЛИ(B2:B7; "НА"; C2:C7)', 'строки, где в B стоит «НА»: 3, 4, 5, 7', 'их значения в C: 22 + 91 + 43 + 81', 'Ответ: 237'] },
  };
  const THEORY_OF = { b_logic4: 'logic', b_image: 'image', b_trace: 'trace', b_countif: 'formula' };
  function theoryCard(k) {
    const T = THEORY[k];
    return h('div', { class: 'th-card' }, h('div', { class: 'th-head' }, h('b', null, T.t), h('span', null, T.s)),
      h('ul', null, ...T.rules.map((r) => h('li', null, r))),
      h('div', { class: 'th-ex' }, h('span', { class: 'th-lbl' }, 'Пример'), ...T.ex.map((x, i) => h('div', { class: i === T.ex.length - 1 ? 'th-ans' : '' }, x))));
  }
  function theorySheet() {
    return h('section', { class: 'sheet theory-sheet' }, h('h2', null, 'Как решать задачи уровня БОСС ⭐⭐⭐'),
      h('p', { style: 'margin:0' }, 'Босс выпадает при атаке на узел с 2–3 щитами. Ошибка сжигает энергию — минута на черновике дешевле поспешного ответа.'),
      h('div', { class: 'th-grid' }, ...Object.keys(THEORY).map(theoryCard)),
      h('div', { class: 'th-tips' }, h('b', null, 'Общие приёмы'), h('ul', null,
        h('li', null, 'Перескажите условие своими словами: что дано и что нужно найти.'),
        h('li', null, 'Следите за единицами: биты или байты, байты или Кбайты.'),
        h('li', null, 'Сделайте прикидку: «64 Кбайт» правдоподобно, «65 536 Кбайт» — нет.'),
        h('li', null, 'Получили ответ — подставьте его обратно в условие.'))));
  }
  function calendarSheet() {
    return h('section', { class: 'sheet' }, h('h2', null, `Неделя игры · ${dayDate(1).text} – ${dayDate(LAST_DAY).text}`),
      h('ol', { class: 'cal' }, ...DAYS.slice(1).map((d, i) => { const n = i + 1, open = n <= G.day; return h('li', { class: n === G.day ? 'today' : n < G.day ? 'past' : 'locked' },
        h('span', { class: 'cal-d' }, h('b', null, dayDate(n).text.split(' ')[0]), h('small', null, dayDate(n).wd)),
        h('div', null, h('b', null, open ? d.t : 'Событие засекречено'), h('span', null, open ? evText(d, n) : `Откроется ${dayDate(n).text} в 0:00 — и перевернёт поле.`))); })),
      h('p', { class: 'small muted', style: 'margin:0' }, 'Каждую полночь начинается новый день: событие меняет поле, на карте загорается новая горячая точка 🔥.'));
  }
  const kindLabel = (n) => ({ core: 'Ядро', server: 'Сервер', node: 'Узел', base: 'База' }[n.kind]);
  function toast(text, alarm) { const t = document.createElement('div'); t.className = 'toast' + (alarm ? ' alarm' : ''); t.textContent = text; document.body.append(t); setTimeout(() => t.remove(), 3400); }

  function buildHud() {
    const L = G.L, me = G.me, myT = L.teams[me.team], ev = evOf(G);
    if (G.live) G.clock = irkMin(Date.now() + (G.skew || 0));
    const daySub = G.day ? `${dayDate(G.day).wd} ${dayDate(G.day).short} · ${hhmm(G.clock)}` : `старт ${atIrk(gStart()).short}`;
    const enSub = G.over ? 'игра окончена' : !G.day ? 'до старта' : me.energy >= E_CAP ? 'запас полон' : '+1 в ' + hhmm((Math.floor(G.clock / 120) + 1) * 120);
    return h('div', { class: 'hud' },
      h('div', { class: 'hud-who' }, h('span', { class: 'swatch', style: `background:${myT.color}` }), h('div', null, h('b', null, me.name), h('small', null, myT.name))),
      h('div', { class: 'hud-en', title: 'Энергия' }, h('small', null, 'Энергия'), h('b', null, '⚡ ' + me.energy), h('small', { class: 'hud-sub' }, enSub)),
      h('div', { class: 'hud-day' }, h('small', null, 'День'), h('b', null, (G.day || 0) + ' / ' + LAST_DAY), h('small', { class: 'hud-sub' }, daySub)));
  }
  function viewEl(L) {
    const el = G.view === 'map' ? mapView(L) : G.view === 'rank' ? rankView(L) : G.view === 'log' ? logView(L) : h('div', { class: 'mapcol' },
      G.live ? h('section', { class: 'sheet mycode' }, h('div', null, h('span', { class: 'eyebrow' }, 'Ваш код'), h('div', null, h('b', null, G.code))), h('button', { class: 'btn ghost', type: 'button', onclick: () => { store.del('zs_code'); showLogin(); } }, 'Выйти')) : null,
      rulesSheet(), calendarSheet(), theorySheet());
    el.setAttribute('data-view', G.view); return el;
  }
  function showGame() {
    clear();
    const L = G.L, me = G.me, ev = evOf(G);
    const tabs = h('div', { class: 'gtabs', role: 'tablist' }, ...[['map', 'Карта'], ['rank', 'Рейтинг'], ['log', 'Журнал'], ['rules', 'Правила']].map(([k, l]) => h('button', { class: 'key', type: 'button', role: 'tab', 'aria-pressed': String(G.view === k), onclick: () => { G.view = k; showGame(); } }, l)));
    const hot = L.hot != null && G.day ? L.nodes[L.hot] : null;
    const wideScr = window.innerWidth >= 700 && window.innerHeight >= 600;
    const event = G.day ? h('details', { class: 'event', open: G.evOpen != null ? G.evOpen : wideScr, ontoggle: (e) => { G.evOpen = e.target.open; } }, h('summary', null, h('span', { class: 'ev-lbl' }, `Событие дня · ${dayDate(G.day).wd}, ${dayDate(G.day).text}`), h('b', null, ev.t || '')), h('span', null, evText(ev, G.day)),
      hot && !G.over ? h('button', { type: 'button', class: 'ev-hot', onclick: () => { G.view = 'map'; G.sel = hot.id; G.focus = hot.id; showGame(); } }, '🔥 Горячая точка: ', h('b', null, `${kindLabel(hot)} · ${L.regions[hot.region].name}`), ` — +10, ${hot.owner == null ? 'пока ничья' : 'держит ' + L.teams[hot.owner].name} ›`) : null)
      : h('div', { class: 'event' }, h('span', { class: 'ev-lbl' }, 'Скоро старт'), h('b', null, `Игра начнётся ${startText()}`), h('span', null, 'Вы уже в сети! Пока можно изучить карту, правила и разбор задач-боссов. Энергия начнёт копиться со старта.'));
    const bar = G.live ? null
      : h('div', { class: 'banner' }, h('span', null, G.over ? 'Демо · конец' : 'Демо'),
        h('span', { class: 'demo-codes' },
          h('button', { type: 'button', disabled: G.over, title: 'Промотать 2 часа', onclick: () => skip(120) }, '⏩ +2 часа'),
          h('button', { type: 'button', disabled: G.over, title: G.day >= LAST_DAY ? 'К итогам' : 'Утро следующего дня', onclick: () => skip(G.day >= LAST_DAY ? END_MIN - G.clock : 1440 - G.clock + 9 * 60) }, G.day >= LAST_DAY ? '⏭ Итоги' : '⏭ Утро'),
          h('button', { type: 'button', onclick: () => showLogin() }, 'Выйти')));
    $app.append(...[buildHud(), event, bar, tabs, viewEl(L)].filter(Boolean));
    if ((G.day >= LAST_DAY || G.over) && G.view === 'map') $app.append(finalView(L));
    // демо: соперники ходят, пока вы смотрите
    if (!reduce && !G.live) G.timer = setInterval(() => { if (document.hidden || G.over) return; const t = Math.floor(Math.random() * L.teams.length); if (t === me.team && Math.random() < 0.5) return; const e = botAction(G, L, t, botName(L, t)); if (e) liveUpdate(L, e); }, 6500);
  }

  // ---------- карта ----------
  let mapRefs = null;
  const PAPER = '#fbf6e6', INK = '#2b2a22';
  const REG_TINT = ['#f3dcc6', '#f5e6ad', '#cfe2ee', '#f1cfc7', '#e6d5ee', '#d6e9cf', '#eedfc2'];
  const REG_MID = ['#e2bf9c', '#e6cf74', '#a8c7dd', '#e2aa9c', '#cdb3de', '#b2d4a4', '#d8bd8c'];
  const REG_INK = ['#9a5a2c', '#8a6a10', '#2c5f86', '#a3402c', '#6c4a86', '#3f7a3a', '#6b5531'];
  const FLOOR = [0, 1, 2, 5, 3, 0, 4];
  const REG_ICON = [
    'M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-.4-.4-2.1z', // ключ
    'M13 2 4 14h7l-1 8 9-12h-7z', // искра
    'M5 4h14v6H5zM5 14h14v6H5zM8 7h.01M8 17h.01', // стойка
    'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4M8 21h8', // микрофон
    'M5 19 19 5M15 5h4v4M7 13a3 3 0 1 0 4 4', // игла с ниткой
    'M6 3v8M4 3v4a2 2 0 0 0 4 0V3M6 11v10M17 3c-2 2-2 7 0 8v10', // вилка и нож
    'M2 9l10-5 10 5-10 5zM6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6', // шапочка выпускника
  ];
  const CAP = 'M-8 -1.5 0 -5.5 8 -1.5 0 2.5ZM-4.5 0.5v3.6c2.6 2 6.4 2 9 0V0.5M8 -1.5v5';
  const FLOOR_DEFS = `
    <pattern id="fl0" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 .5H.5V22" fill="none" stroke="rgba(70,55,30,.13)"/></pattern>
    <pattern id="fl1" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M2 5l3-3M9 12l3-3M9 2l3 3M2 9l3 3" stroke="rgba(70,55,30,.17)" stroke-width="1.3" stroke-linecap="round"/></pattern>
    <pattern id="fl2" width="30" height="30" patternUnits="userSpaceOnUse"><rect x="1.5" y="1.5" width="27" height="27" rx="2" fill="none" stroke="rgba(30,60,90,.16)"/><circle cx="5" cy="5" r="1.1" fill="rgba(30,60,90,.22)"/><circle cx="25" cy="25" r="1.1" fill="rgba(30,60,90,.22)"/></pattern>
    <pattern id="fl3" width="64" height="24" patternUnits="userSpaceOnUse"><path d="M0 11.5H64M0 23.5H64M20 0V12M52 12V24" stroke="rgba(100,70,30,.15)"/></pattern>
    <pattern id="fl4" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M0 0 8 8M8 16 16 8M8 0 16 8M0 16 8 8" stroke="rgba(100,70,30,.13)"/></pattern>
    <pattern id="fl5" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.2" fill="rgba(140,40,25,.17)"/><circle cx="9" cy="9" r="1.2" fill="rgba(140,40,25,.17)"/></pattern>`;
  // оборудование цехов: тонкая графика под сетью, кое-что шевелится
  function propArt(i, k, t, anim) {
    const A = (x) => (anim ? x : '');
    const blink = (d, dur) => A(`<animate attributeName="opacity" values="1;.12;1" keyTimes="0;.5;1" calcMode="discrete" dur="${dur || 1.2 + (d % 3) * 0.45}s" begin="${(d * 0.37).toFixed(2)}s" repeatCount="indefinite"/>`);
    const steam = (x, y, s = 1) => [0, 1, 2].map((j) => `<circle cx="${x}" cy="${anim ? y : y - j * 7 * s}" r="${(3 + j) * s}" fill="${PAPER}" stroke="${k}" stroke-width=".9" opacity="${anim ? 0 : 0.6 - j * 0.15}">${A(`<animate attributeName="opacity" values=".8;0" dur="2.4s" begin="${j * 0.8}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;${j % 2 ? 3 : -3} ${-18 * s}" dur="2.4s" begin="${j * 0.8}s" repeatCount="indefinite"/>`)}</circle>`).join('');
    const st = `stroke="${k}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
    switch (i) {
      case 0: return `<path d="M-52 31H52" ${st} stroke-width="2.5"/><path d="M-52 31l-4 4M-40 31l-4 4M-28 31l-4 4M44 31l-4 4M56 31l-4 4" ${st} stroke-width="1"/>
        <rect x="-47" y="-26" width="6" height="57" rx="1" fill="${t}" stroke="${k}" stroke-width="1.8"/><rect x="41" y="-26" width="6" height="57" rx="1" fill="${t}" stroke="${k}" stroke-width="1.8"/>
        <g>${A('<animateTransform attributeName="transform" type="translate" values="0 2;0 -6;0 -6;0 2;0 2" keyTimes="0;.35;.6;.9;1" dur="7s" repeatCount="indefinite"/>')}
          <path d="M-41 12H41" ${st} stroke-width="3"/>
          <path d="M-36 4L-33 -6L-19 -9L-10 -21H13L23 -9L35 -7L37 4Z" fill="${PAPER}" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
          <path d="M-7 -18L-13 -10H-1V-18ZM3 -18V-10H18L12 -18Z" fill="#cfe2ee" stroke="${k}" stroke-width="1.3" stroke-linejoin="round"/>
          <path d="M-34 -3h4M31 -4h4M-1 -9v12" ${st} stroke-width="1.6"/>
          <circle cx="-21" cy="5" r="7" fill="#3c3a32" stroke="${k}" stroke-width="1.5"/><circle cx="-21" cy="5" r="2.6" fill="${PAPER}"/>
          <circle cx="23" cy="5" r="7" fill="#3c3a32" stroke="${k}" stroke-width="1.5"/><circle cx="23" cy="5" r="2.6" fill="${PAPER}"/></g>`;
      case 1: return `<rect x="-47" y="-35" width="94" height="68" rx="4" fill="none" stroke="#d9a521" stroke-width="3" stroke-dasharray="8 5"/>
        <rect x="-32" y="-1" width="52" height="6" rx="1" fill="${t}" stroke="${k}" stroke-width="1.8"/><path d="M-27 5V27M15 5V27M-27 19H15" ${st} stroke-width="2"/>
        <rect x="-14" y="-8" width="24" height="7" fill="#8f8668" stroke="${k}" stroke-width="1.4"/>
        <path d="M12 -26 3 -10" ${st} stroke-width="3.2"/><path d="M12 -26q8 -7 16 -3" ${st} stroke-width="1.6"/>
        <g>${A('<animate attributeName="opacity" values="1;.2;.9;.35;1" dur=".8s" repeatCount="indefinite"/>')}<circle cx="3" cy="-9" r="4.5" fill="#fff3b0"/><path d="M3 -9l-10 -6M3 -9l-2 -12M3 -9l9 -8M3 -9l11 -1M3 -9l-10 3M3 -9l5 7" stroke="#ec6a1c" stroke-width="1.6" stroke-linecap="round"/></g>
        <rect x="27" y="-26" width="8" height="49" rx="4" fill="#7aa0c4" stroke="${k}" stroke-width="1.6"/><rect x="36.5" y="-21" width="8" height="44" rx="4" fill="#c2381f" stroke="${k}" stroke-width="1.6"/>
        <path d="M29 -26v-4h4v4M38.5 -21v-4h4v4" ${st} stroke-width="1.4"/>`;
      case 2: { let s = `<path d="M-42 -33H42" ${st} stroke-width="2.5" stroke-dasharray="5 3"/>`;
        for (let r = 0; r < 3; r++) { const x = -38 + r * 26; s += `<path d="M${x + 12} -33V-28" ${st} stroke-width="1.6"/><rect x="${x}" y="-28" width="24" height="58" rx="2" fill="#3c3a32" stroke="${k}" stroke-width="1.8"/>`;
          for (let j = 0; j < 6; j++) s += `<rect x="${x + 3}" y="${-24 + j * 9}" width="18" height="6.5" rx="1" fill="#57534a"/><circle cx="${x + 18}" cy="${-20.8 + j * 9}" r="1.7" fill="${(j + r) % 3 ? '#86f29a' : '#ffcf3f'}">${blink(r * 6 + j)}</circle><path d="M${x + 6} ${-20.8 + j * 9}h7" stroke="#8f8668" stroke-width="1"/>`; }
        return s; }
      case 3: { let s = `<rect x="-48" y="-38" width="96" height="30" rx="2" fill="${t}" stroke="${k}" stroke-width="1.8"/>`;
        s += `<g>${A('<animateTransform attributeName="transform" type="rotate" values="-12 -40 -44;16 -40 -44;-12 -40 -44" dur="6s" repeatCount="indefinite"/>')}<path d="M-40 -44 -10 -9 8 -15Z" fill="#fff3b0" opacity=".8"/></g>`;
        s += `<rect x="-48" y="-8" width="96" height="7" rx="1.5" fill="#9a5a2c" stroke="${k}" stroke-width="1.6"/>`;
        s += `<path d="M0 -10V-25M-4 -9.5h8" ${st} stroke-width="1.6"/><rect x="-2.3" y="-31" width="4.6" height="6.5" rx="2.3" fill="#3c3a32"/>`;
        s += `<path d="M-48 -38h20q-6 8 -2 15q-4 7 2 15h-20z" fill="#c2381f" stroke="${k}" stroke-width="1.4"/><path d="M48 -38h-20q6 8 2 15q4 7 -2 15h20z" fill="#c2381f" stroke="${k}" stroke-width="1.4"/>`;
        s += `<path d="M-42 -36v26M-36 -36v26M42 -36v26M36 -36v26" stroke="#8f2a17" stroke-width="1"/><rect x="-50" y="-44" width="100" height="7" rx="2" fill="#a3402c" stroke="${k}" stroke-width="1.4"/>`;
        s += `<circle cx="-40" cy="-44" r="3.4" fill="#3c3a32" stroke="${k}"/>`;
        for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) s += `<rect x="${-46 + c * 11.6}" y="${6 + r * 10}" width="9" height="6" rx="2" fill="${t}" stroke="${k}" stroke-width="1"/>`;
        return s; }
      case 4: return `<rect x="-46" y="8" width="64" height="6" rx="1.5" fill="${t}" stroke="${k}" stroke-width="1.8"/><path d="M-40 14V30M12 14V30" ${st} stroke-width="2"/>
        <path d="M-36 8V-14Q-36 -19 -31 -19H10V2H3V-9H-26V8Z" fill="${PAPER}" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="-38" cy="-9" r="5" fill="${t}" stroke="${k}" stroke-width="1.6"/><rect x="-20" y="-26" width="6" height="7" fill="#c2381f" stroke="${k}" stroke-width="1.2"/>
        <path d="M-17 -26Q-6 -35 6 -19" fill="none" stroke="#c2381f" stroke-width="1" stroke-dasharray="2 2"/>
        <path d="M-14 7H18" stroke="#2f6fb5" stroke-width="2.6"/><path d="M-12 7H4" stroke="${PAPER}" stroke-width="1" stroke-dasharray="2 2"/>
        <path d="M6 1V7" ${st} stroke-width="1.6">${A('<animateTransform attributeName="transform" type="translate" values="0 0;0 3;0 0" dur=".35s" repeatCount="indefinite"/>')}</path>
        <path d="M32 -26q-9 2 -9 11q0 7 4 11q-5 6 -5 12h20q0 -6 -5 -12q4 -4 4 -11q0 -9 -9 -11z" fill="${t}" stroke="${k}" stroke-width="1.8"/><circle cx="32" cy="-28" r="2.5" fill="${k}"/><path d="M32 8V29M25 29H39" ${st} stroke-width="2"/>
        <path d="M24 -14q8 3 16 0" ${st} stroke-width="1" stroke-dasharray="2 2"/>`;
      case 5: { const tbl = (cx, cy) => [[17, 0], [-17, 0], [0, 17], [0, -17]].map(([dx, dy]) => `<circle cx="${cx + dx}" cy="${cy + dy}" r="4.5" fill="${t}" stroke="${k}" stroke-width="1.4"/>`).join('') + `<circle cx="${cx}" cy="${cy}" r="12" fill="${PAPER}" stroke="${k}" stroke-width="2"/><circle cx="${cx - 5}" cy="${cy - 3}" r="3" fill="none" stroke="${k}"/><circle cx="${cx + 5}" cy="${cy + 3}" r="3" fill="none" stroke="${k}"/>`;
        return tbl(-30, -8) + tbl(2, 17) + `<rect x="24" y="-24" width="24" height="30" rx="2" fill="${t}" stroke="${k}" stroke-width="1.8"/><circle cx="30" cy="-17" r="3" fill="none" stroke="${k}" stroke-width="1.4"/><circle cx="42" cy="-17" r="3" fill="none" stroke="${k}" stroke-width="1.4"/><rect x="28" y="-8" width="16" height="10" rx="1" fill="${PAPER}" stroke="${k}" stroke-width="1.3"/>
          <path d="M27 -24v-9h12v9Z" fill="#8f8668" stroke="${k}" stroke-width="1.5"/><path d="M25 -33h16" ${st} stroke-width="1.8"/>${steam(33, -36)}`; }
      case 6: { const books = ['#c2381f', '#2f6fb5', '#2f8a46', '#d9a521', '#6c4a86', '#9a5a2c'];
        let s = `<rect x="-46" y="-34" width="58" height="33" rx="2" fill="#2f5a44" stroke="${k}" stroke-width="2.5"/><text x="-17" y="-20" text-anchor="middle" class="p-chalk">1011₂ = 11</text><text x="-17" y="-8" text-anchor="middle" class="p-chalk">A ∧ ¬B</text><path d="M-44 2H10" ${st} stroke-width="2"/>
          <rect x="-38" y="10" width="44" height="12" rx="1.5" fill="${t}" stroke="${k}" stroke-width="1.8"/><path d="M-34 22v8M2 22v8" ${st} stroke-width="2"/>
          <rect x="-33" y="4" width="13" height="6" fill="#c2381f" stroke="${k}" stroke-width="1"/><rect x="-31" y="0" width="10" height="4" fill="#2f6fb5" stroke="${k}" stroke-width="1"/>
          <path d="M-8 2h7v8h-7z" fill="${PAPER}" stroke="${k}" stroke-width="1.3"/><path d="M-1 4h2.5v4H-1" ${st} stroke-width="1.2"/>${steam(-4.5, -1, 0.5)}
          <rect x="20" y="-34" width="26" height="62" rx="1.5" fill="${t}" stroke="${k}" stroke-width="1.8"/><path d="M20 -13H46M20 8H46" ${st} stroke-width="1.6"/>`;
        [-34, -13, 8].forEach((y0, sh) => { let x = 23; for (let b = 0; b < 5 && x < 43; b++) { const w = 3 + ((b + sh) % 3), hgt = 14 + ((b * 7 + sh) % 6); s += `<rect x="${x}" y="${y0 + 20 - hgt}" width="${w}" height="${hgt}" fill="${books[(b + sh * 2) % 6]}" stroke="${k}" stroke-width=".8"/>`; x += w + 1; } });
        return s; }
    }
    return '';
  }
  function drawPlan(L, g) {
    const P = L.plan; let s = '';
    // двор: дорожка ко входу, деревья, скамейка
    s += `<path d="M${P.ent - 22} ${P.by1}h44l10 60h-64z" fill="#e3d9bb" stroke="#c8bb95" stroke-width="1.2"/>`;
    const trees = [[P.bx0 - 20, P.by0 + 50, 15], [P.bx0 - 24, P.by0 + 230, 13], [P.bx0 - 18, P.by1 - 70, 16], [P.bx1 + 22, P.by0 + 90, 15], [P.bx1 + 20, P.by0 + 300, 12], [P.bx1 + 24, P.by1 - 110, 16], [P.bx0 + 90, P.by1 + 26, 14], [P.bx0 + 250, P.by1 + 30, 12], [P.bx1 - 40, P.by1 + 28, 15], [P.bx0 + 160, P.by0 - 22, 13], [P.bx1 - 170, P.by0 - 24, 14]];
    trees.forEach(([x, y, r]) => { s += `<g transform="translate(${x} ${y})"><circle r="${r}" fill="#c3d6a0" stroke="#6c8a4e" stroke-width="1.6"/><circle cx="${-r * 0.3}" cy="${-r * 0.3}" r="${r * 0.42}" fill="#d9e8bd"/><circle cx="${r * 0.35}" cy="${r * 0.2}" r="1.6" fill="#6c8a4e"/></g>`; });
    s += `<g transform="translate(${P.ent + 60} ${P.by1 + 22})"><rect x="-16" y="-3" width="32" height="6" rx="1.5" fill="#d8bd8c" stroke="#6b5531" stroke-width="1.2"/><path d="M-12 3v5M12 3v5" stroke="#6b5531" stroke-width="1.6"/></g>`;
    // полы цехов
    L.regions.forEach((r, i) => { s += `<rect x="${r.x0}" y="${r.y0}" width="${r.x1 - r.x0}" height="${r.y1 - r.y0}" fill="${REG_TINT[i]}"/><rect x="${r.x0}" y="${r.y0}" width="${r.x1 - r.x0}" height="${r.y1 - r.y0}" fill="url(#fl${FLOOR[i]})"/>`; });
    // оборудование
    L.regions.forEach((r, i) => { s += `<g transform="translate(${r.px.toFixed(1)} ${r.py.toFixed(1)})" opacity=".9">${propArt(i, REG_INK[i], REG_MID[i], !reduce)}</g>`; });
    // внутренние стены с дверными проёмами
    let wallStr = '';
    P.walls.forEach((w, wi) => {
      let from = w.a; const seg = (a, b) => { if (b - a < 1) return; wallStr += w.o === 'h' ? `<path d="M${a} ${w.at}H${b}"/>` : `<path d="M${w.at} ${a}V${b}"/>`; };
      const doorsSvg = [];
      w.gaps.forEach(([g0, g1], gi) => { seg(from, g0); from = g1; const L2 = g1 - g0; if (L2 > 34) return; const side = (gi + wi) % 2 ? 1 : -1;
        doorsSvg.push(w.o === 'h' ? `<path d="M${g0} ${w.at}V${w.at + side * L2}A${L2} ${L2} 0 0 ${side > 0 ? 0 : 1} ${g1} ${w.at}"/>` : `<path d="M${w.at} ${g0}H${w.at + side * L2}A${L2} ${L2} 0 0 ${side > 0 ? 1 : 0} ${w.at} ${g1}"/>`); });
      seg(from, w.b);
      s += `<g fill="none" stroke="#9a9070" stroke-width="1" opacity=".75">${doorsSvg.join('')}</g>`;
    });
    s += `<g fill="none" stroke="#6a6452" stroke-width="5" stroke-linecap="square">${wallStr}</g>`;
    g.innerHTML = s;
    // наружная стена: окна и вход
    const out = sv('g', {});
    out.append(sv('path', { d: `M${P.ent + 20} ${P.by1}H${P.bx1}V${P.by0}H${P.bx0}V${P.by1}H${P.ent - 20}`, fill: 'none', stroke: '#4a463a', 'stroke-width': 8, 'stroke-linejoin': 'miter' }));
    const win = (x, y, vert) => out.append(sv('rect', vert ? { x: x - 2, y: y - 13, width: 4, height: 26, fill: '#dfeef6', stroke: '#4a463a', 'stroke-width': 0.8 } : { x: x - 13, y: y - 2, width: 26, height: 4, fill: '#dfeef6', stroke: '#4a463a', 'stroke-width': 0.8 }));
    for (let x = P.bx0 + 44; x < P.bx1 - 30; x += 68) win(x, P.by0);
    for (let y = P.by0 + 50; y < P.by1 - 30; y += 68) { win(P.bx0, y, true); win(P.bx1, y, true); }
    for (let x = P.bx0 + 44; x < P.bx1 - 30; x += 68) if (Math.abs(x - P.ent) > 40) win(x, P.by1);
    [6, 11, 16].forEach((d, i) => out.append(sv('path', { d: `M${P.ent - 20 - i * 3} ${P.by1 + d}H${P.ent + 20 + i * 3}`, stroke: '#8f8668', 'stroke-width': 2 })));
    const sign = sv('text', { x: P.ent, y: P.by1 + 34, 'text-anchor': 'middle', class: 'p-sign' }); sign.textContent = 'ВХОД'; out.append(sign);
    g.append(out);
  }
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  // значок узла (используется и на карте, и в легенде)
  function nodeShape(kind, fill, opts = {}) {
    const g = sv('g', {});
    const sw = opts.mine ? 2.6 : 2;
    if (kind === 'base') { g.append(sv('rect', { x: -13, y: -13, width: 26, height: 26, rx: 5, fill, stroke: INK, 'stroke-width': 2.6 })); g.append(opts.teach ? sv('path', { d: CAP, fill: PAPER, stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }) : sv('path', { d: 'M-4 7V-7M-4 -7h9l-2.5 3.5L5 0h-9', fill: PAPER, stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round' })); }
    else if (kind === 'core') { const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6.5 : 14; return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`; }).join(' '); g.append(sv('polygon', { points: pts, fill, stroke: INK, 'stroke-width': sw, 'stroke-linejoin': 'round' })); }
    else if (kind === 'server') { g.append(sv('rect', { x: -9.5, y: -11, width: 19, height: 22, rx: 2.5, fill, stroke: INK, 'stroke-width': sw })); [-5, 0, 5].forEach((y) => { g.append(sv('line', { x1: -5.5, y1: y, x2: 3, y2: y, stroke: INK, 'stroke-width': 1.4 })); g.append(sv('circle', { cx: 5.5, cy: y, r: 1, fill: INK })); }); }
    else { g.append(sv('circle', { r: 10, fill, stroke: INK, 'stroke-width': sw })); if (opts.mine) g.append(sv('circle', { r: 3.4, fill: PAPER })); }
    return g;
  }
  function badge(type, n) {
    const g = sv('g', { class: 'bdg bdg-' + type });
    if (type === 'plus' || type === 'attack') { g.setAttribute('transform', 'translate(10 10)'); const b = sv('g', { class: 'bob' }); b.append(sv('circle', { r: 6.5, fill: type === 'plus' ? '#ec6a1c' : '#c2381f', stroke: INK, 'stroke-width': 1.4 }), sv('path', { d: type === 'plus' ? 'M-3 0h6M0 -3v6' : 'M-3 -3l6 6M3 -3l-6 6', stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round' })); g.append(b); }
    if (type === 'shield') { g.setAttribute('transform', 'translate(-11 -11)'); g.append(sv('path', { d: 'M0 -6.5 5.5 -4.5V0c0 3.5-2.6 5.6-5.5 6.8C-2.9 5.6-5.5 3.5-5.5 0v-4.5z', fill: '#20406a', stroke: PAPER, 'stroke-width': 1.2 })); const t = sv('text', { y: 2.6, 'text-anchor': 'middle', class: 'bdg-n' }); t.textContent = n; g.append(t); }
    if (type === 'hot') { g.setAttribute('transform', 'translate(0 -22)'); g.append(sv('circle', { r: 7.5, fill: '#ffcf3f', stroke: INK, 'stroke-width': 1.4 }), sv('path', { d: 'M0 -4.6c2.4 2.2 3.5 3.9 3.5 5.7a3.5 3.5 0 0 1-7 0c0-1.2.6-2.3 1.5-3 .1 1.1.6 1.8 1.3 2 .2-1.7.3-3 .7-4.7z', fill: '#c2381f' })); }
    if (type === 'cut') { g.setAttribute('transform', 'translate(10 -10)'); g.append(sv('circle', { r: 6, fill: PAPER, stroke: '#6f6a55', 'stroke-width': 1.2 }), sv('path', { d: 'M-3 1.5 -1 -.5M1 .5 3 -1.5M-1.5 -2.5l.8 1.4M1.5 2.5l-.8-1.4', stroke: '#6f6a55', 'stroke-width': 1.3, 'stroke-linecap': 'round' })); }
    return g;
  }
  function roomTag(R, i, ctrlColor) {
    const label = R.name.toUpperCase(), wpx = label.length * 7.4 + 48;
    const lg = sv('g', { transform: `translate(${(R.x0 + 14 + wpx / 2).toFixed(0)} ${R.y0.toFixed(0)})`, class: 'reg-tag' });
    lg.append(sv('rect', { x: -wpx / 2, y: -11, width: wpx, height: 22, rx: 11, fill: PAPER, stroke: REG_INK[i], 'stroke-width': 1.6 }));
    lg.append(sv('path', { d: REG_ICON[i] || '', transform: `translate(${-wpx / 2 + 6} -8) scale(.66)`, fill: 'none', stroke: REG_INK[i], 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    const t = sv('text', { x: 3, y: 4, 'text-anchor': 'middle', class: 'reg-lbl', fill: REG_INK[i] }); t.textContent = label; lg.append(t);
    lg.append(sv('circle', ctrlColor ? { cx: wpx / 2 - 11, cy: 0, r: 5.5, fill: ctrlColor, stroke: INK, 'stroke-width': 1.4 } : { cx: wpx / 2 - 11, cy: 0, r: 5, fill: 'none', stroke: REG_INK[i], 'stroke-width': 1.3, 'stroke-dasharray': '2 2' }));
    return lg;
  }

  const fillEl = (el, ...xs) => el.replaceChildren(...xs.filter((x) => x != null && x !== false));
  function mapView(L) {
    const me = G.me, team = me.team, myColor = L.teams[team].color, P = L.plan;
    const X0 = P.bx0 - 36, X1 = P.bx1 + 36, Y0 = P.by0 - 40, Y1 = P.by1 + 44;
    const svg = sv('svg', { class: 'netmap', role: 'img', 'aria-label': 'Карта сети техникума' });
    const defs = sv('defs', {});
    defs.innerHTML = `<pattern id="hatchCut" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#8f8668" stroke-width="2"/></pattern>
      <radialGradient id="haloG"><stop offset="0" stop-color="${myColor}" stop-opacity=".6"/><stop offset=".55" stop-color="${myColor}" stop-opacity=".3"/><stop offset="1" stop-color="${myColor}" stop-opacity="0"/></radialGradient>${FLOOR_DEFS}`;
    svg.append(defs);
    const bg = sv('g', { class: 'plan' }); svg.append(bg); drawPlan(L, bg);
    const layer = sv('g', {}); svg.append(layer);
    const fx = sv('g', { class: 'fx' }); svg.append(fx);
    let drag = null;
    const clampVB = (v) => { const m = v.w * 0.05; if (v.w >= X1 - X0) v.x = (X0 + X1 - v.w) / 2; else v.x = Math.max(X0 - m, Math.min(X1 - v.w + m, v.x)); const bot = G.sel != null ? v.h * 0.5 : m; if (v.h >= Y1 - Y0) v.y = Math.max(Y0 - m, Math.min(v.y, (Y0 + Y1 - v.h) / 2 + bot)); else v.y = Math.max(Y0 - m, Math.min(Y1 - v.h + bot, v.y)); return v; };
    const setVB = () => { const asp = (svg.clientHeight || 1) / (svg.clientWidth || 1); G.vb.h = G.vb.w * asp; if (!drag) clampVB(G.vb); svg.setAttribute('viewBox', `${G.vb.x} ${G.vb.y} ${G.vb.w} ${G.vb.h}`); };
    const flyTo = (x, y, w, ay) => {
      const from = { ...G.vb }, tw = w || G.vb.w, asp = (svg.clientHeight || 1) / (svg.clientWidth || 1), th = tw * asp;
      const to = clampVB({ x: x - tw / 2, y: y - th * (ay != null ? ay : G.sel != null ? 0.3 : 0.45), w: tw, h: th });
      if (reduce) { G.vb = { ...to, h: th }; setVB(); return; }
      const t0 = performance.now(); const step = (t) => { const k = Math.min(1, (t - t0) / 420), e = 1 - (1 - k) ** 3; G.vb.x = from.x + (to.x - from.x) * e; G.vb.y = from.y + (to.y - from.y) * e; G.vb.w = from.w + (to.w - from.w) * e; setVB(); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
    };
    if (!G.vb) { const b = L.nodes[L.teams[team].base]; G.vb = { x: b.x - 200, y: b.y - 160, w: 400, h: 400 }; }

    const hudChip = h('div', { class: 'map-chip' });
    const sheet = h('div', { class: 'map-sheet' });
    const ctl = h('div', { class: 'mapctl' },
      h('button', { type: 'button', class: 'mbtn', 'aria-label': 'Приблизить', onclick: () => zoom(0.72) }, '+'),
      h('button', { type: 'button', class: 'mbtn', 'aria-label': 'Отдалить', onclick: () => zoom(1 / 0.72) }, '−'),
      h('button', { type: 'button', class: 'mbtn', 'aria-label': 'К базе', title: 'К базе', onclick: () => { const b = L.nodes[L.teams[team].base]; flyTo(b.x, b.y + 40, 400); } }, '⌂'),
      h('button', { type: 'button', class: 'mbtn', 'aria-label': 'Вся сеть', title: 'Вся сеть', onclick: () => { G.sel = null; draw(); drawSheet(); const asp = (svg.clientHeight || 1) / (svg.clientWidth || 1); flyTo((X0 + X1) / 2, (Y0 + Y1) / 2 + 10, Math.max(X1 - X0, (Y1 - Y0 + 30) / asp) + 10, 0.5); } }, '⤢'),
      h('button', { type: 'button', class: 'mbtn', 'aria-label': 'Как читать карту', title: 'Как читать карту', onclick: showLegend }, '?'));
    const wrap = h('div', { class: 'mapwrap' }, svg, hudChip, ctl, sheet);
    function zoom(f) { const cx = G.vb.x + G.vb.w / 2, cy = G.vb.y + G.vb.h / 2; G.vb.w = Math.max(170, Math.min((X1 - X0) * 1.25, G.vb.w * f)); G.vb.x = cx - G.vb.w / 2; setVB(); G.vb.y = cy - G.vb.h / 2; setVB(); }
    // палец: один — двигать карту, два — масштаб (щипок); перерисовка не чаще кадра
    const ptrs = new Map(); let pinch = null, raf = 0;
    const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; setVB(); }); };
    const toSvg = (cx, cy) => { const r = svg.getBoundingClientRect(); return { x: G.vb.x + (cx - r.left) / r.width * G.vb.w, y: G.vb.y + (cy - r.top) / r.height * G.vb.h }; };
    svg.addEventListener('pointerdown', (e) => {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { svg.setPointerCapture(e.pointerId); } catch (x) { /* не критично */ }
      if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, vx: G.vb.x, vy: G.vb.y, moved: false };
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, w: G.vb.w, anchor: toSvg((a.x + b.x) / 2, (a.y + b.y) / 2) }; if (drag) drag.moved = true; }
    });
    svg.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, d = Math.hypot(a.x - b.x, a.y - b.y) || 1, r = svg.getBoundingClientRect();
        G.vb.w = Math.max(170, Math.min((X1 - X0) * 1.25, pinch.w * pinch.d / d)); G.vb.h = G.vb.w * (r.height / r.width);
        G.vb.x = pinch.anchor.x - (mx - r.left) / r.width * G.vb.w; G.vb.y = pinch.anchor.y - (my - r.top) / r.height * G.vb.h;
        schedule(); return;
      }
      if (!drag) return; const k = G.vb.w / svg.clientWidth, dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      if (drag.moved) { G.vb.x = drag.vx - dx * k; G.vb.y = drag.vy - dy * k; schedule(); }
    });
    const release = (e) => {
      ptrs.delete(e.pointerId);
      if (pinch) { if (ptrs.size < 2) { pinch = null; drag = null; setVB(); } return; }
      const d = drag; drag = null; if (!d) return; if (d.moved || e.type === 'pointercancel') { setVB(); return; }
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      let best = null, bd = (24 * G.vb.w / 400) ** 2 + 400; L.nodes.forEach((n) => { const dd = (n.x - p.x) ** 2 + (n.y - p.y) ** 2; if (dd < bd) { bd = dd; best = n; } });
      G.sel = best ? best.id : null; draw(); drawSheet(); if (best) flyTo(best.x, best.y, G.vb.w);
    };
    svg.addEventListener('pointerup', release); svg.addEventListener('pointercancel', release);
    svg.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 0.87); }, { passive: false });

    function draw() {
      layer.replaceChildren();
      const reach = reachable(L, team), conns = L.teams.map((_, t) => connected(L, t));
      // моя территория — мягкое свечение
      const halo = sv('g', { opacity: 0.9 }); conns[team].forEach((u) => halo.append(sv('circle', { cx: L.nodes[u].x, cy: L.nodes[u].y, r: 40, fill: 'url(#haloG)' }))); layer.append(halo);
      // кабели
      const myEdges = [];
      L.edges.forEach(([a, b]) => {
        const A = L.nodes[a], B = L.nodes[b]; const same = A.owner != null && A.owner === B.owner && conns[A.owner].has(a) && conns[A.owner].has(b);
        const isMine = same && A.owner === team;
        if (same) layer.append(sv('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: INK, 'stroke-width': isMine ? 7.5 : 6.5, 'stroke-linecap': 'round', opacity: 0.85 }));
        layer.append(sv('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: same ? L.teams[A.owner].color : '#9d916abb', 'stroke-width': same ? (isMine ? 4.5 : 3.6) : 2.2, 'stroke-linecap': 'round', class: isMine ? 'my-edge' : '' }));
        if (isMine) myEdges.push([A, B]);
      });
      if (!reduce) myEdges.slice(0, 14).forEach(([A, B], i) => { const c = sv('circle', { r: 2.6, fill: PAPER, stroke: INK, 'stroke-width': 0.8 }); const am = sv('animateMotion', { dur: (1.6 + (i % 5) * 0.35) + 's', repeatCount: 'indefinite', path: i % 2 ? `M${A.x},${A.y} L${B.x},${B.y}` : `M${B.x},${B.y} L${A.x},${A.y}`, begin: (i * 0.23) + 's' }); c.append(am); layer.append(c); });
      // узлы
      L.nodes.forEach((n) => {
        const owned = n.owner != null, cut = owned && !conns[n.owner].has(n.id), isMine = owned && n.owner === team;
        const g = sv('g', { transform: `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`, 'data-id': n.id, class: 'nd' + (cut ? ' cut' : '') });
        const canPlus = reach.has(n.id) && n.owner == null, canAtk = reach.has(n.id) && owned;
        if (L.hot === n.id) g.append(sv('circle', { r: 24, fill: 'rgba(255,207,63,.25)', stroke: '#e0a100', 'stroke-width': 2.5, class: 'hotring' }));
        if (canPlus || canAtk) g.append(sv('circle', { r: 18, fill: 'none', stroke: canPlus ? '#ec6a1c' : '#c2381f', 'stroke-width': 2.2, 'stroke-dasharray': '4 3', class: 'reach' }));
        const fill = !owned ? PAPER : cut ? 'url(#hatchCut)' : L.teams[n.owner].color;
        const shape = nodeShape(n.kind, fill, { mine: isMine && !cut, teach: owned && L.teams[n.owner].teach });
        if (cut) shape.querySelectorAll('[fill]').forEach((el) => { if (el.getAttribute('fill') === 'url(#hatchCut)') el.setAttribute('stroke', L.teams[n.owner].color); });
        g.append(shape);
        if (n.kind === 'base') {
          const name = L.teams[n.owner].name, lbl = isMine ? 'ВЫ · ' + name : name, wpx = lbl.length * 6.4 + 12;
          g.append(sv('rect', { x: -wpx / 2, y: 17, width: wpx, height: 15, rx: 7.5, fill: isMine ? '#ec6a1c' : L.teams[n.owner].teach ? '#7a5d05' : INK }));
          const t = sv('text', { y: 28, 'text-anchor': 'middle', class: 'base-lbl' }); t.textContent = lbl; g.append(t);
          if (isMine) g.append(sv('rect', { x: -19, y: -19, width: 38, height: 38, rx: 8, fill: 'none', stroke: '#ec6a1c', 'stroke-width': 2.4, class: 'mybase' }));
        }
        if (n.shield) g.append(badge('shield', n.shield));
        if (canPlus) g.append(badge('plus')); else if (canAtk) g.append(badge('attack'));
        if (cut) g.append(badge('cut'));
        if (L.hot === n.id) g.append(badge('hot'));
        if (G.sel === n.id) { const rt = sv('g', { class: 'reticle' }); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => rt.append(sv('path', { d: `M${sx * 23},${sy * 13} V${sy * 23} H${sx * 13}`, fill: 'none', stroke: '#ec6a1c', 'stroke-width': 3, 'stroke-linecap': 'round' }))); g.append(rt); }
        layer.append(g);
      });
      // таблички цехов: точка — цвет команды, которая держит цех
      L.regions.forEach((R, i) => { const all = L.nodes.filter((n) => n.region === R.id && n.kind !== 'base'); let ctrl = null; L.teams.forEach((_, t) => { if (all.filter((n) => conns[t].has(n.id)).length * 2 > all.length) ctrl = t; }); layer.append(roomTag(R, i, ctrl == null ? null : L.teams[ctrl].color)); });
      const rows = standings(L), place = rows.findIndex((r) => r.i === team) + 1, mineRow = rows[place - 1];
      hudChip.replaceChildren(h('span', { class: 'swatch', style: `background:${myColor}` }), h('b', null, `${mineRow.nodes} узл. · ${mineRow.s} очк.`), h('span', null, `${place}-е место`));
    }

    function drawSheet() {
      const n = G.sel != null ? L.nodes[G.sel] : null;
      if (!n) { sheet.className = 'map-sheet hint'; fillEl(sheet, h('span', null, 'Нажмите на узел со значком '), h('i', { class: 'mini plus' }, '+'), h('span', null, ' или '), h('i', { class: 'mini atk' }, '×')); return; }
      sheet.className = 'map-sheet open';
      const reach = reachable(L, team), own = n.owner === team, conn = n.owner != null && connected(L, n.owner).has(n.id);
      const ownerT = n.owner != null ? L.teams[n.owner] : null;
      const acts = [];
      const live = !G.over && G.day >= 1;
      if (live && reach.has(n.id)) acts.push(n.owner == null ? 'capture' : 'attack');
      if (live && own && n.kind !== 'base' && n.shield < 3 && conn) acts.push('fortify');
      const tier = (a) => (a === 'attack' ? (n.shield >= 2 ? '⭐⭐⭐' : '⭐⭐') : '⭐');
      const why0 = n.kind === 'base' ? (own ? `База вашей ${grpWord()}. Отсюда растёт ваша сеть.` : (ownerT.teach ? 'База преподавателей. Захватить нельзя.' : 'Базу группы захватить нельзя.')) : own && !conn ? 'Узел отрезан от базы: не приносит очков. Восстановите связь через соседние узлы.' : own ? (n.shield >= 3 ? 'Узел укреплён до предела.' : 'Ваш узел. Укрепите его, чтобы атаковать было дороже.') : !reach.has(n.id) ? 'Далеко: сначала захватите узел рядом с ним.' : n.owner == null ? 'Свободный узел рядом с вашей сетью.' : ownerT.teach ? 'Узел преподавателей на вашей границе.' : 'Узел соперника на вашей границе.';
      const why = G.over ? 'Турнир завершён — поле зафиксировано.' : !G.day ? `Игра начнётся ${startText()} — тогда узлы можно будет захватывать.` : (L.hot === n.id ? '🔥 Горячая точка дня: +10 очков, пока узел ваш. ' : '') + (n.owner != null && L.leaders.includes(n.owner) && !own ? 'Команда под прожектором — атака дешевле. ' : '') + why0;
      const kindName = { core: 'Ядро цеха', server: 'Сервер', base: ownerT && ownerT.teach ? 'База преподавателей' : 'База группы', node: 'Узел' }[n.kind];
      fillEl(sheet,
        h('button', { type: 'button', class: 'sh-x', 'aria-label': 'Закрыть', onclick: () => { G.sel = null; draw(); drawSheet(); } }, '×'),
        h('div', { class: 'sh-top' },
          h('span', { class: 'sh-ico' }, (() => { const s = sv('svg', { viewBox: '-16 -16 32 32', width: 34, height: 34 }); s.append(nodeShape(n.kind, ownerT ? ownerT.color : PAPER, { teach: ownerT && ownerT.teach })); return s; })()),
          h('div', { class: 'sh-txt' }, h('span', { class: 'eyebrow' }, `${kindName} · ${L.regions[n.region].name}`), h('b', null, ownerT ? ownerT.name : 'Свободен')),
          n.kind !== 'base' ? h('span', { class: 'np-val' + (L.hot === n.id ? ' hot' : '') }, '+' + nodeValue(L, n, evOf(G))) : null),
        h('div', { class: 'sh-meta' }, h('span', null, 'Щиты'), h('span', { class: 'np-shields' }, ...Array.from({ length: 3 }, (_, i) => h('i', { class: i < n.shield ? 'on' : '' })))),
        h('p', { class: 'sh-why' }, why),
        acts.length ? h('div', { class: 'np-acts' }, ...acts.map((a) => { const c = cost(G, L, n, a); return h('button', { class: 'btn' + (a === 'fortify' ? ' ghost' : a === 'attack' ? ' btn-atk' : ''), type: 'button', disabled: me.energy < c, onclick: () => hack(L, n, a) },
          h('span', null, { capture: 'Захватить', attack: 'Атаковать', fortify: 'Укрепить щит' }[a]), h('small', null, ` ${c} ⚡ · задача ${tier(a)}`)); })) : null,
        acts.length && acts.some((a) => me.energy < cost(G, L, n, a)) ? h('p', { class: 'err', style: 'margin:0' }, 'Не хватает энергии — завтра будет +3 ⚡.') : null);
    }

    function playAnim() {
      const a = G.anim; if (!a || reduce) { G.anim = null; return; } G.anim = null;
      const n = L.nodes[a.node];
      if (a.from != null) { const f = L.nodes[a.from]; const len = Math.hypot(n.x - f.x, n.y - f.y); const beam = sv('line', { x1: f.x, y1: f.y, x2: n.x, y2: n.y, stroke: a.color, 'stroke-width': 6, 'stroke-linecap': 'round', class: 'beam' }); beam.style.strokeDasharray = len; beam.style.strokeDashoffset = len; beam.style.setProperty('--len', len); fx.append(beam); setTimeout(() => beam.remove(), 1200); }
      ripple(n, a.color, a.from != null ? 320 : 0);
    }
    function ripple(n, color, delay) { setTimeout(() => { [0, 180].forEach((dl) => { const c = sv('circle', { cx: n.x, cy: n.y, r: 12, fill: 'none', stroke: color, 'stroke-width': 4, class: 'ripple' }); c.style.animationDelay = dl + 'ms'; fx.append(c); setTimeout(() => c.remove(), 1400); }); }, delay || 0); }

    const flash = (ids) => (ids || []).slice(0, 18).forEach((id, i) => ripple(L.nodes[id], '#ec6a1c', i * 110));
    mapRefs = { L, draw, drawSheet, svg, ripple, team, flash };
    requestAnimationFrame(() => { setVB(); playAnim(); if (G.focus != null) { const f = L.nodes[G.focus]; G.focus = null; flyTo(f.x, f.y, Math.min(G.vb.w, 380)); } });
    window.addEventListener('resize', setVB, { once: true });
    draw(); drawSheet();
    const col = h('div', { class: 'mapcol' }, wrap);
    if (!seenTips()) col.append(coach(() => col.querySelector('.coach').remove()));
    return col;
  }
  function seenTips() { try { return localStorage.getItem('zs_tips') === '1'; } catch (e) { return !!G.tips; } }
  function coach(close) {
    const ok = () => { try { localStorage.setItem('zs_tips', '1'); } catch (e) {} G.tips = true; close(); };
    return h('div', { class: 'coach sheet screws' },
      h('h3', null, 'Как играть — за 10 секунд'),
      h('ol', { class: 'coach-steps' },
        h('li', null, h('b', null, 'Светлое пятно — ваша сеть.'), G.me && G.me.teacher ? ' Она растёт от базы преподавателей в Учительской.' : ' Она растёт от базы вашей группы с флажком.'),
        h('li', null, h('i', { class: 'mini plus' }, '+'), ' — свободный узел рядом: его можно захватить, ', h('i', { class: 'mini atk' }, '×'), ' — узел соперника: его можно атаковать.'),
        h('li', null, h('b', null, 'Нажмите на узел'), ' — внизу карты появится карточка с кнопкой. Решите задачу — узел ваш.')),
      h('button', { class: 'btn', type: 'button', onclick: ok }, 'Понятно, в бой'));
  }
  function showLegend() {
    const row = (svgNode, title, text) => h('div', { class: 'lg-row' }, h('span', { class: 'lg-ico' }, svgNode), h('div', null, h('b', null, title), h('span', null, text)));
    const ico = (build) => { const s = sv('svg', { viewBox: '-20 -20 40 40', width: 40, height: 40 }); build(s); return s; };
    const m = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'sheet legend-sheet' },
      h('h2', null, 'Как читать карту'),
      row(ico((s) => s.append(nodeShape('node', '#fbf6e6'))), 'Узел · 1 очко', 'Обычная точка сети.'),
      row(ico((s) => s.append(nodeShape('server', '#fbf6e6'))), 'Сервер · 3 очка', 'Ценнее обычного узла.'),
      row(ico((s) => s.append(nodeShape('core', '#fbf6e6'))), 'Ядро цеха · 5 очков', 'Одно на цех. Держите больше половины цеха — ещё +10.'),
      row(ico((s) => s.append(nodeShape('base', '#2f6fb5'))), 'База группы', 'Отсюда растёт сеть. Захватить нельзя.'),
      row(ico((s) => s.append(nodeShape('base', T_COLOR, { teach: true }))), 'База преподавателей', 'В Учительской. Преподаватели играют одной командой на общей карте.'),
      row(ico((s) => { s.append(nodeShape('node', '#fbf6e6')); s.append(badge('plus')); }), 'Можно захватить', 'Свободный узел рядом с вашей сетью: 1 ⚡ и лёгкая задача.'),
      row(ico((s) => { s.append(nodeShape('node', '#c2381f')); s.append(badge('attack')); }), 'Можно атаковать', 'Узел соперника на границе: 2 ⚡ + щиты, задача сложнее.'),
      row(ico((s) => { s.append(nodeShape('node', '#2f6fb5')); s.append(badge('shield', 2)); }), 'Щиты', 'Каждый щит делает атаку на 1 ⚡ дороже. Захват сбрасывает щиты.'),
      row(ico((s) => { const g = nodeShape('node', 'url(#hatchLg)'); s.innerHTML = '<defs><pattern id="hatchLg" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#8f8668" stroke-width="2"/></pattern></defs>'; s.append(g); s.append(badge('cut')); }), 'Отрезан от базы', 'Не приносит очков, пока связь не восстановлена.'),
      row(ico((s) => { s.append(sv('circle', { r: 15, fill: 'rgba(255,207,63,.25)', stroke: '#e0a100', 'stroke-width': 2 })); s.append(nodeShape('node', PAPER)); const b = badge('hot'); b.setAttribute('transform', 'translate(9 -9) scale(.9)'); s.append(b); }), 'Горячая точка', 'Каждый день новая. Пока узел ваш — +10 очков.'),
      row(ico((s) => { s.append(sv('rect', { x: -18, y: -9, width: 36, height: 18, rx: 9, fill: PAPER, stroke: '#9a5a2c', 'stroke-width': 1.6 })); s.append(sv('circle', { cx: 8, cy: 0, r: 5.5, fill: '#2f8a46', stroke: INK, 'stroke-width': 1.4 })); s.append(sv('path', { d: 'M-12 0h11', stroke: '#9a5a2c', 'stroke-width': 2.4, 'stroke-linecap': 'round' })); }), 'Табличка цеха', 'Цветная точка — команда, которая держит больше половины цеха (+10 очков). Пунктир — цех ничей.'),
      row(ico((s) => { s.append(sv('path', { d: 'M-18 0H-7M7 0H18', stroke: '#6a6452', 'stroke-width': 5 })); s.append(sv('path', { d: 'M-7 0V-14A14 14 0 0 1 7 0', fill: 'none', stroke: '#9a9070', 'stroke-width': 1.2 })); s.append(sv('line', { x1: 0, y1: -16, x2: 0, y2: 16, stroke: '#a39770', 'stroke-width': 2.2 })); }), 'Стены и двери', 'Кабели идут между цехами только через дверные проёмы.'),
      h('button', { class: 'btn', type: 'button', onclick: () => m.remove() }, 'Понятно')));
    m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
    document.body.append(m);
  }
  function liveUpdate(L, e) {
    const hitMe = e.prev === G.me.team && e.action !== 'fortify';
    if (G.view === 'map' && mapRefs && mapRefs.L === L) { mapRefs.draw(); if (G.sel === e.node) mapRefs.drawSheet(); mapRefs.ripple(L.nodes[e.node], hitMe ? '#c2381f' : L.teams[e.t].color); }
    if (G.live && !hitMe) return; // в живой игре всплывают только атаки на вашу команду
    const t = document.createElement('div'); t.className = 'toast' + (hitMe ? ' alarm' : ''); t.textContent = (hitMe ? '⚠ ' : '') + logText(L, e); document.body.append(t); setTimeout(() => t.remove(), 3400);
  }

  // ---------- взлом ----------
  async function hack(L, n, action) {
    const me = G.me; let v, c, token;
    if (G.live) {
      if (document.querySelector('.hack-modal')) return;
      try { const t = await rpc('g_task', { p_code: G.code, p_node: n.id, p_action: action }); v = { type: t.task.type, payload: t.task, pool: t.pool, tpl: t.tpl }; c = t.cost; token = t.token; me.energy = t.energy; }
      catch (e) { toast(errText(e), true); pollLive(); return; }
    } else { c = cost(G, L, n, action); v = pickTask(action, n); }
    G.lastTask = v;
    const R = RENDER[v.type](v.payload.data || {});
    const go = h('button', { class: 'btn', type: 'button', disabled: true }, { capture: 'Взломать', attack: 'Атаковать', fortify: 'Укрепить' }[action] + ' · ' + c + ' ⚡');
    const no = h('button', { class: 'btn ghost', type: 'button' }, 'Отмена');
    R.onchange = () => { go.disabled = !R.ready(); };
    const d = v.payload.data || {};
    const sheet = h('div', { class: 'sheet task screws hack' },
      h('div', { class: 'hack-head' }, h('span', { class: 'eyebrow' }, { capture: 'Взлом', attack: 'Атака', fortify: 'Укрепление' }[action] + ' · ' + nodeTitle(L, n)), h('span', { class: 'pts' + (v.pool === 'boss' ? ' boss' : '') }, v.pool === 'boss' ? '⭐⭐⭐' : v.pool === 'medium' ? '⭐⭐' : '⭐')),
      h('div', { class: 'tasktitle' }, v.payload.title), h('div', { class: 'task-text' }, v.payload.text),
      v.pool === 'boss' && THEORY_OF[v.tpl] ? h('details', { class: 'th-inline' }, h('summary', null, '📘 Как решать такие задачи'), theoryCard(THEORY_OF[v.tpl])) : null,
      typeof d.code === 'string' ? h('pre', { class: 'code' }, d.code) : null, d.table && v.type !== 'rows' ? table(d.table) : null,
      R.el, h('div', { class: 'row2' }, no, go));
    const m = h('div', { class: 'modal hack-modal', role: 'dialog', 'aria-modal': 'true' }, sheet);
    no.onclick = () => m.remove();
    const result = (cls, icon, title, text) => sheet.replaceChildren(h('div', { class: 'result ' + cls },
      h('div', { class: 'res-icon' }, icon), h('h2', null, title), h('p', null, text),
      h('p', { class: 'small muted' }, 'Осталось энергии: ⚡ ' + me.energy),
      h('button', { class: 'btn', type: 'button', onclick: () => { m.remove(); showGame(); if (G.live) pollLive(); } }, 'На карту')));
    go.onclick = async () => {
      const conn = connected(L, me.team), from = action === 'fortify' ? null : L.adj[n.id].find((u) => conn.has(u));
      let ok;
      if (G.live) {
        go.disabled = true; no.disabled = true; go.textContent = 'Проверяем…';
        let r; try { r = await rpc('g_answer', { p_token: token, p_answer: R.value() }); } catch (e) { r = { status: 'error', msg: errText(e) }; }
        if (r.node) { const [id, owner, shield] = r.node; const x = L.nodes[id]; x.owner = owner; x.shield = shield; }
        if (r.energy != null) me.energy = r.energy;
        if (r.status === 'changed') return result('no', '↻', 'Узел изменился', 'Пока вы решали, узел успел захватить или укрепить кто-то другой. Энергия не потрачена — посмотрите на карту ещё раз.');
        if (r.status === 'no_energy') return result('no', '⚡', 'Не хватает энергии', 'Энергия не потрачена. Новая приходит каждые 2 часа.');
        if (r.status === 'error') return result('no', '!', 'Ответ не отправлен', r.msg);
        ok = r.status === 'ok'; c = r.cost != null ? r.cost : c;
        if (ok) { me.captures += action === 'fortify' ? 0 : 1; G.anim = { node: n.id, from: from == null ? null : from, color: L.teams[me.team].color }; G.sel = n.id; }
      } else {
        ok = check(v.type, v.answer, R.value());
        me.energy -= c;
        if (ok) { const prev = apply(L, n, me.team, action, me.name); me.captures += action === 'fortify' ? 0 : 1; L.log.unshift({ day: G.day, t: me.team, who: me.name, action, node: n.id, prev, time: Date.now(), me: true }); G.anim = { node: n.id, from: from == null ? null : from, color: L.teams[me.team].color }; G.sel = n.id; }
      }
      if (ok) result('ok', '✓', { capture: 'Узел захвачен!', attack: 'Узел отбит у соперника!', fortify: 'Щит установлен!' }[action], action === 'fortify' ? `Щитов на узле: ${n.shield}. Атаковать его теперь дороже.` : `${nodeTitle(L, n)} теперь принадлежит ${teamName(L, me.team)}.`);
      else result('no', '✗', 'Взлом не удался', `Ответ неверный, потрачено ${c} ⚡. Попробуйте другой узел или задачу.`);
    };
    document.body.append(m);
  }

  // ---------- рейтинг, журнал, итоги ----------
  function standings(L) { const ev = evOf(G); return L.teams.map((t, i) => ({ t, i, s: score(L, i, ev), nodes: connected(L, i).size - 1 })).sort((a, b) => b.s - a.s || b.nodes - a.nodes); }
  function rankView(L) {
    const rows = standings(L), max = Math.max(1, rows[0].s);
    const hk = G.live ? (G.top || []).map(([who, t, v]) => ({ who, t, v })) : Object.entries(L.hackers).map(([k, v]) => { const [who, t] = k.split('|'); return { who, t: +t, v }; }).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 8);
    return h('div', { class: 'rank' },
      h('section', { class: 'sheet' }, h('h2', null, 'Рейтинг команд'),
        h('ol', { class: 'standings' }, ...rows.map((r, k) => h('li', { class: (r.i === G.me.team ? 'me' : '') + (r.t.teach ? ' teach' : '') },
          h('span', { class: 'st-n' }, String(k + 1)), h('span', { class: 'swatch', style: `background:${r.t.color}` }),
          h('span', { class: 'st-name' }, r.t.name, h('small', null, r.t.teach ? ` · ${r.t.members} преп.` : ` · ${r.t.members} уч.`)),
          h('span', { class: 'st-bar' }, h('i', { style: `width:${Math.round(r.s / max * 100)}%;background:${r.t.color}` })),
          h('span', { class: 'st-s' }, String(r.s)))))),
      h('section', { class: 'printout' }, h('h3', null, 'Лучшие взломщики'),
        h('table', { class: 'board' }, h('thead', null, h('tr', null, h('th', { class: 'n' }, '#'), h('th', null, 'Игрок'), h('th', { class: 'n' }, 'Захв.'))),
          h('tbody', null, ...hk.map((x, i) => h('tr', null, h('td', { class: 'n' }, String(i + 1)), h('td', null, x.who, h('div', { class: 'small muted' }, L.teams[x.t].name)), h('td', { class: 'n' }, String(x.v)))))),
        h('div', { class: 'barcode', 'aria-hidden': 'true' })));
  }
  function logText(L, e) {
    const n = L.nodes[e.node], tn = teamName(L, e.t);
    const who = `${e.who} (${tn})`;
    if (e.action === 'fortify') return `${who} укрепил ${nodeTitle(L, n)}`;
    if (e.prev == null) return `${who} захватил ${nodeTitle(L, n)}`;
    return `${who} отбил ${nodeTitle(L, n)} у ${teamName(L, e.prev)}`;
  }
  function logView(L) {
    return h('section', { class: 'sheet' }, h('h2', null, 'Журнал сети'),
      h('ul', { class: 'netlog' }, ...L.log.slice(0, 60).map((e) => h('li', { class: e.me ? 'me' : e.prev === G.me.team ? 'hit' : '' },
        h('span', { class: 'swatch', style: `background:${L.teams[e.t].color}` }), h('span', { class: 'lg-d' }, 'день ' + e.day), h('span', null, logText(L, e))))));
  }
  function finalView(L) {
    const rows = standings(L);
    return h('section', { class: 'sheet final screws' }, h('h2', null, G.over ? 'Итоги турнира' : 'Финальный день'), h('p', { class: 'small muted', style: 'margin:0' }, G.over ? `Игра завершена ${finalText(0)}.` : `Итоги — ${finalText(G.day)}. Сейчас — по текущему счёту.`),
      h('div', { class: 'podium' }, ...rows.slice(0, 3).map((r, i) => h('div', { class: 'pd pd' + (i + 1) }, h('span', { class: 'swatch', style: `background:${r.t.color}` }), h('b', null, r.t.name), h('span', null, r.s + ' очков'), h('i', null, ['🥇', '🥈', '🥉'][i])))),
      rows.slice(0, 3).some((r) => r.t.teach) ? h('p', { class: 'small', style: 'margin:0' }, 'Лучшая группа студентов: ', h('b', null, rows.find((r) => !r.t.teach).t.name)) : null);
  }

  function skip(mins) {
    const r = advance(mins); G.sel = null; showGame();
    if (r.brief) showBrief(r.brief); else toast(`${hhmm(G.clock)}${r.gained ? ` · +${r.gained} ⚡` : ''}${G.over ? ' · турнир завершён' : ''}`);
  }
  // утренняя сводка: что перевернулось за ночь
  function showBrief(b) {
    const L = G.L, ev = DAYS[b.day], hot = L.hot != null ? L.nodes[L.hot] : null;
    const close = () => { m.remove(); if (mapRefs) mapRefs.flash(b.hit); };
    const m = h('div', { class: 'modal brief-modal', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'sheet brief screws' },
      h('span', { class: 'eyebrow' }, `День ${b.day} из ${LAST_DAY} · ${dayDate(b.day).wd}, ${dayDate(b.day).text}`),
      h('h2', null, ev.t), h('p', { style: 'margin:0' }, evText(ev, b.day)),
      b.lines.length || b.before != null ? h('div', { class: 'brief-box' }, h('b', null, 'Что изменилось на поле'), h('ul', null, ...b.lines.map((x) => h('li', null, x)), b.before != null ? h('li', null, 'Ваша команда: ', `${b.before} → `, h('b', null, `${b.after} очк.`)) : null)) : null,
      hot ? h('p', { class: 'brief-hot', style: 'margin:0' }, '🔥 Горячая точка дня: ', h('b', null, `${kindLabel(hot)} · ${L.regions[hot.region].name}`), ' — +10 очков, пока узел ваш.') : null,
      h('div', { class: 'row2' }, h('button', { class: 'btn ghost', type: 'button', onclick: close }, 'На карту'),
        hot ? h('button', { class: 'btn', type: 'button', onclick: () => { m.remove(); G.view = 'map'; G.sel = hot.id; G.focus = hot.id; showGame(); if (mapRefs) mapRefs.flash(b.hit); } }, 'К горячей точке') : null)));
    document.body.append(m);
  }

  window.__zahvat = G; // для отладки демо
  showLogin(null, true);
})();
