// Механики заданий турнира: общий код страницы участника, каталога и игры.
(function () {
'use strict';
const h = (tag, attrs, ...kids) => {
  const el = document.createElement(tag);
  if (attrs) for (const [k,v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
};
function table(tb){
  return h('div',{class:'tbl'}, h('table',null,
    h('thead',null,h('tr',null, tb.rowNums ? h('th',{class:'rn'},'') : null, ...tb.head.map(x=>h('th',null,x)))),
    h('tbody',null, ...tb.rows.map((r,i)=>h('tr',null, tb.rowNums ? h('td',{class:'rn'},String(i+2)) : null, ...r.map(c=>h('td',null,c)))))));
}
const RENDER = {
  choice(d){
    let sel = -1; const api = { onchange(){}, ready:()=>sel>=0, value:()=>sel };
    const btns = d.options.map((o,i)=>h('button',{class:'opt',type:'button','aria-pressed':'false',onclick:()=>{ sel=i; btns.forEach((b,j)=>b.setAttribute('aria-pressed', j===i)); api.onchange(); }}, h('span',{class:'mk'}), h('span',null,o)));
    api.el = h('div',{class:'opts'}, btns); return api;
  },
  multi(d){
    const s = new Set(); const api = { onchange(){}, ready:()=>s.size>0, value:()=>[...s].sort((a,b)=>a-b) };
    const btns = d.options.map((o,i)=>h('button',{class:'opt sq',type:'button','aria-pressed':'false',onclick:(e)=>{ s.has(i)?s.delete(i):s.add(i); e.currentTarget.setAttribute('aria-pressed', s.has(i)); api.onchange(); }}, h('span',{class:'mk'},'✓'), h('span',null,o)));
    api.el = h('div',{class:'opts'}, h('div',{class:'hint'},'Можно выбрать несколько.'), btns); return api;
  },
  spot(d){
    const s = new Set(); const info = h('div',{class:'hint'},`Отмечено: 0 из ${d.need}`);
    const api = { onchange(){}, ready:()=>s.size>0, value:()=>[...s].sort((a,b)=>a-b) };
    const parts = d.parts.map((p,i)=>h('button',{class:'frag',type:'button','aria-pressed':'false',onclick:(e)=>{ s.has(i)?s.delete(i):s.add(i); e.currentTarget.setAttribute('aria-pressed', s.has(i)); info.textContent = `Отмечено: ${s.size} из ${d.need}`; api.onchange(); }}, p));
    const sms = h('div',{class:'sms'}); parts.forEach((p,i)=>{ if(i) sms.append(' '); sms.append(p); });
    api.el = h('div',{style:'display:flex;flex-direction:column;gap:8px'}, sms, info); return api;
  },
  order(d){
    const seq = []; const api = { onchange(){}, ready:()=>seq.length===d.items.length, value:()=>seq.slice() };
    const slots = h('div',{class:'slots'}), pool = h('div',{class:'opts'});
    const draw = () => {
      slots.replaceChildren(...d.items.map((_,k)=> seq[k]!=null
        ? h('div',{class:'slot fill',role:'button',tabindex:'0',onclick:()=>{ seq.splice(k,1); draw(); api.onchange(); }}, h('span',{class:'n'}, k+1), h('span',null, d.items[seq[k]]))
        : h('div',{class:'slot'}, h('span',{class:'n'}, k+1), k===seq.length ? 'нажмите шаг ниже' : '')));
      pool.replaceChildren(...d.items.map((it,i)=> seq.includes(i) ? null : h('button',{class:'opt',type:'button',onclick:()=>{ seq.push(i); draw(); api.onchange(); }}, h('span',{class:'mk'},'+'), h('span',null,it))).filter(Boolean));
    };
    draw();
    api.el = h('div',{style:'display:flex;flex-direction:column;gap:10px'}, h('div',{class:'hint'},'Нажимайте шаги по порядку. Нажмите на поставленный шаг, чтобы убрать его.'), slots, pool); return api;
  },
  match(d){
    const asg = d.left.map(()=>-1); let active = 0;
    const api = { onchange(){}, ready:()=>asg.every(x=>x>=0), value:()=>asg.slice() };
    const L = 'АБВГДЕ';
    const box = h('div',{class:'match'});
    const draw = () => {
      box.replaceChildren(
        h('div',{class:'hint'},'Выберите строку слева (буква), затем подходящее действие.'),
        ...d.left.map((l,i)=>h('button',{class:'opt',type:'button','aria-pressed':String(i===active),onclick:()=>{ active=i; draw(); }},
          h('span',{class:'chip'},L[i]), h('span',{class:'mrow'}, h('span',{class:'mleft mono'},l), h('span',{class:'mright muted'}, asg[i]>=0 ? '→ '+d.right[asg[i]] : '…')))),
        h('div',{class:'eyebrow',style:'margin-top:6px'},'Варианты'),
        ...d.right.map((r,j)=>{ const who = asg.indexOf(j); return h('button',{class:'opt',type:'button',onclick:()=>{ if(active<0) return; const prev = asg.indexOf(j); if (prev>=0) asg[prev]=-1; asg[active]=j; const nx = asg.findIndex(x=>x<0); active = nx; draw(); api.onchange(); }},
          h('span',{class:'chip',style: who>=0?'':'background:var(--line);color:var(--muted)'}, who>=0?L[who]:'·'), h('span',null,r)); }));
    };
    draw(); api.el = box; return api;
  },
  pixel(d){
    const cells = Array(d.rows*d.cols).fill(0); const api = { onchange(){}, ready:()=>true, value:()=>cells.join('') };
    const wrap = h('div',{class:'pixwrap'+(d.theme==='stitch'?' stitch':'')});
    for (let r=0;r<d.rows;r++){
      const row = h('div',{class:'pixrow',style:`grid-template-columns:repeat(${d.cols},minmax(0,1fr))`});
      for (let c=0;c<d.cols;c++){ const k=r*d.cols+c; row.append(h('button',{class:'px',type:'button','aria-pressed':'false','aria-label':`строка ${r+1}, клетка ${c+1}`,onclick:(e)=>{ cells[k]^=1; e.currentTarget.setAttribute('aria-pressed', !!cells[k]); }})); }
      wrap.append(h('div',{class:'pixcode'}, d.code[r]), row);
    }
    api.el = wrap; setTimeout(()=>api.onchange()); return api;
  },
  robot(d){
    const prog = []; let tries = 3, busy = false;
    const api = { onchange(){}, ready:()=>prog.length>0 && !busy, value:()=>prog.join('') };
    const icN = d.theme==='car' ? 'car' : 'robot', goalN = { car:'flag', pipe:'drop', tray:'plate', robot:'flag' }[d.theme] || 'flag';
    const ic = d.theme==='car' ? 'машина' : 'робот', goal = { car:'финиша', pipe:'протечки', tray:'столика', robot:'финиша' }[d.theme] || 'финиша';
    const DR=[-1,0,1,0], DC=[0,1,0,-1];
    const g = d.grid, n = g[0].length; let sr, sc;
    g.forEach((row,i)=>{ const j=row.indexOf('S'); if(j>=0){ sr=i; sc=j; } });
    const cells = [];
    const field = h('div',{class:'field',style:`grid-template-columns:repeat(${n},minmax(0,1fr))`,'aria-label':'Поле'});
    g.forEach((row,r) => { cells.push([]); [...row].forEach((ch) => { const el = h('div',{class:'cell'+(ch==='#'?' wall':ch==='G'?' goal':'')}, ch==='G'?ART.sprite(goalN):null); cells[r].push(el); field.append(el); }); });
    const bot = h('div',{class:'bot'});
    const place = (r,c,dir) => { bot.replaceChildren(ART.sprite(icN, dir)); cells[r][c].append(bot); field.querySelectorAll('.ahead').forEach(x=>x.classList.remove('ahead')); const ar=r+DR[dir], ac=c+DC[dir]; if (cells[ar] && cells[ar][ac]) cells[ar][ac].classList.add('ahead'); };
    place(sr, sc, d.dir);
    const strip = h('div',{class:'prog'}), cnt = h('span',{class:'hint'}), msg = h('div',{class:'runmsg',hidden:true});
    const runBtn = h('button',{class:'btn ghost',type:'button'});
    const draw = () => {
      strip.replaceChildren(...(prog.length ? prog.map((c,i)=>h('span',{class:'c','data-i':i}, c==='F'?'↑':c==='L'?'↺':'↻')) : [h('span',{class:'hint'},'Программа пуста')]));
      cnt.textContent = `Команд: ${prog.length} из ${d.maxLen} · в начале смотрит ${['↑ вверх','→ вправо','↓ вниз','← влево'][d.dir]}`;
      runBtn.textContent = tries ? `▶ Пробный запуск · осталось ${tries}` : 'Пробные запуски закончились';
      runBtn.disabled = busy || !tries || !prog.length;
      api.onchange();
    };
    const add = (c) => { if (busy) return; msg.hidden = true; if (prog.length < d.maxLen) { prog.push(c); draw(); } };
    const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    runBtn.onclick = async () => {
      if (busy || !tries || !prog.length) return;
      busy = true; tries--; draw(); msg.hidden = true;
      let r = sr, c = sc, dir = d.dir, res = 'short';
      const wait = () => new Promise(ok => setTimeout(ok, reduce ? 60 : 320));
      for (let i = 0; i < prog.length; i++) {
        strip.querySelectorAll('.c').forEach(x=>x.classList.toggle('now', +x.dataset.i===i));
        const ch = prog[i];
        if (ch==='L') dir=(dir+3)%4; else if (ch==='R') dir=(dir+1)%4;
        else { const nr=r+DR[dir], nc=c+DC[dir]; if (nr<0||nr>=g.length||nc<0||nc>=n||g[nr][nc]==='#') { res='wall'; if (cells[nr]&&cells[nr][nc]) cells[nr][nc].classList.add('hit'); else field.classList.add('hit'); await wait(); break; } r=nr; c=nc; }
        place(r,c,dir); await wait();
        if (g[r][c]==='G') { res='ok'; break; }
      }
      msg.textContent = res==='ok' ? `Готово: ${ic} у ${goal}!` : res==='wall' ? 'Стоп: впереди стена или край поля' : `Команды кончились, а до ${goal} не добрались`;
      msg.className = 'runmsg ' + (res==='ok'?'good':'bad'); msg.hidden = false;
      await new Promise(ok => setTimeout(ok, 700));
      field.querySelectorAll('.hit').forEach(x=>x.classList.remove('hit')); field.classList.remove('hit');
      strip.querySelectorAll('.c').forEach(x=>x.classList.remove('now'));
      place(sr, sc, d.dir); busy = false; draw();
    };
    const cmds = h('div',{class:'cmds'},
      h('button',{class:'cmd',type:'button',onclick:()=>add('F')}, h('b',null,'↑'),'Вперёд'),
      h('button',{class:'cmd',type:'button',onclick:()=>add('L')}, h('b',null,'↺'),'Налево'),
      h('button',{class:'cmd',type:'button',onclick:()=>add('R')}, h('b',null,'↻'),'Направо'),
      h('button',{class:'cmd',type:'button',onclick:()=>{ if(!busy){ prog.pop(); msg.hidden=true; draw(); } }}, h('b',null,'⌫'),'Стереть'),
      h('button',{class:'cmd',type:'button',onclick:()=>{ if(!busy){ prog.length=0; msg.hidden=true; draw(); } }}, h('b',null,'✕'),'Очистить'));
    draw();
    api.el = h('div',{style:'display:flex;flex-direction:column;gap:10px'},
      h('div',{class:'hint'},`Оранжевая стрелка показывает, куда ${ic==='машина'?'едет машина':'смотрит робот'}, а клетка с оранжевой рамкой — куда он попадёт по команде «Вперёд». «Налево»/«Направо» — поворот на месте на четверть круга. Программу можно 3 раза запустить на пробу.`),
      field, strip, cnt, cmds, runBtn, msg); return api;
  },
  number(d){
    let v = ''; const disp = h('div',{class:'bindisp numdisp'});
    const api = { onchange(){}, ready:()=>/^\d+(,\d+)?$/.test(v), value:()=>v };
    const upd = () => { disp.replaceChildren(h('span',null, v || '0'), d.unit ? h('small',null,' ' + d.unit) : null); disp.classList.toggle('empty', !v); api.onchange(); };
    const press = (k) => { if (k===',' && (v.includes(',') || !v)) return; if (v.length >= 10) return; v += k; upd(); };
    const kp = h('div',{class:'keypad'}, ...'123456789'.split('').map(k=>h('button',{type:'button',onclick:()=>press(k)},k)),
      h('button',{type:'button',onclick:()=>press(',')},','), h('button',{type:'button',onclick:()=>press('0')},'0'), h('button',{type:'button','aria-label':'Стереть',onclick:()=>{ v=v.slice(0,-1); upd(); }},'⌫'));
    upd(); api.el = h('div',{style:'display:flex;flex-direction:column;gap:10px'}, disp, kp); return api;
  },
  text(d){
    let v = ''; const disp = h('div',{class:'bindisp'},'');
    const api = { onchange(){}, ready:()=>v.length>0, value:()=>v };
    const keys = (d.keypad||'01').split('');
    const upd = () => { disp.textContent = v || ' '; api.onchange(); };
    const kp = h('div',{class:'keypad',style:`grid-template-columns:repeat(${d.cols||3},1fr)`}, ...keys.map(k=>h('button',{type:'button',class:/[КБЧС]/.test(k)?'bead-key bead-'+k:'',onclick:()=>{ if (v.length<20) { v+=k; upd(); } }},k)), h('button',{type:'button','aria-label':'Стереть',onclick:()=>{ v=v.slice(0,-1); upd(); }},'⌫'));
    const strip = d.strip ? h('div',{class:'beads','aria-label':'Ряд узора: '+d.strip}, ...[...d.strip].map(c=>h('span',{class:'bead bead-'+c}, c))) : null;
    upd(); api.el = h('div',{style:'display:flex;flex-direction:column;gap:10px'}, strip, disp, kp); return api;
  },
  logic(d){
    const st = d.vars.map(()=>0); const api = { onchange(){}, ready:()=>true, value:()=>st.join('') };
    const sub = h('div',{class:'expr sub'});
    const body = d.expr.split('=').slice(1).join('=').trim(), lhs = d.expr.split('=')[0].trim();
    const drawSub = () => { sub.replaceChildren(h('span',{class:'muted'},'Подставим: '), ...body.split(/([A-D])/).map(p => /^[A-D]$/.test(p) ? h('b',{class: st[d.vars.indexOf(p)] ? 'v1' : 'v0'}, String(st[d.vars.indexOf(p)])) : p)); };
    const sws = d.vars.map((v,i)=>h('button',{class:'sw',type:'button','aria-pressed':'false',onclick:(e)=>{ st[i]^=1; e.currentTarget.setAttribute('aria-pressed', !!st[i]); e.currentTarget.querySelector('small').textContent = st[i]?'1 · вкл':'0 · выкл'; drawSub(); }}, v, h('span',{class:'k'}), h('small',null,'0 · выкл')));
    drawSub();
    api.el = h('div',{style:'display:flex;flex-direction:column;gap:10px'}, h('div',{class:'expr'}, d.expr), h('div',{class:'switches'}, sws), sub, h('div',{class:'hint'},`${lhs} горит, когда всё выражение равно 1. И — оба равны 1; ИЛИ — хотя бы один; НЕ — наоборот.`));
    setTimeout(()=>api.onchange()); return api;
  },
  bits(d){
    const st = Array(d.n).fill(0); const api = { onchange(){}, ready:()=>true, value:()=>st.join('') };
    const lamps = st.map((_,i)=>{ const w = 2 ** (d.n-1-i); return h('button',{class:'lamp',type:'button','aria-pressed':'false','aria-label':'вес '+w,onclick:(e)=>{ st[i]^=1; e.currentTarget.setAttribute('aria-pressed', !!st[i]); e.currentTarget.querySelector('.bit').textContent = st[i]; }}, h('span',{class:'bulb'}), h('span',{class:'bit mono'},'0'), h('small',null, String(w))); });
    api.el = h('div',{style:'display:flex;flex-direction:column;gap:10px'}, h('div',{class:'target'}, h('span',{class:'eyebrow'},'Нужно число'), h('b',null, String(d.target))), h('div',{class:'lamps',style:`grid-template-columns:repeat(${d.n},minmax(0,1fr))`}, lamps), h('div',{class:'hint'},'Нажми на лампочку, чтобы включить. Под лампочкой — её вес.'));
    setTimeout(()=>api.onchange()); return api;
  },
  bins(d){
    const asg = d.items.map(()=>-1); const api = { onchange(){}, ready:()=>asg.every(x=>x>=0), value:()=>asg.slice() };
    const counts = h('div',{class:'bincounts'});
    const drawCounts = () => counts.replaceChildren(...d.bins.map((b,j)=>h('div',{class:'bin'}, h('b',null,b), h('span',null, d.items.filter((_,i)=>asg[i]===j).join(', ') || '—'))));
    const rows = d.items.map((it,i)=>{
      const chips = d.bins.map((b,j)=>h('button',{type:'button',class:'binchip','aria-pressed':'false',onclick:()=>{ asg[i]=j; chips.forEach((c,k)=>c.setAttribute('aria-pressed', k===j)); row.classList.add('placed'); drawCounts(); api.onchange(); }}, b));
      const row = h('div',{class:'binrow'}, h('div',{class:'binitem mono'}, it), h('div',{class:'binchips'}, chips));
      return row;
    });
    drawCounts();
    api.el = h('div',{style:'display:flex;flex-direction:column;gap:10px'}, h('div',{class:'binlist'}, rows), counts); return api;
  },
  rows(d){
    const s = new Set(); const api = { onchange(){}, ready:()=>s.size>0, value:()=>[...s].sort((a,b)=>a-b) };
    const tb = d.table;
    const trs = tb.rows.map((r,i)=>h('tr',{class:'pick',tabindex:'0',role:d.single?'radio':'checkbox','aria-checked':'false',onclick:()=>toggle(i),onkeydown:(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggle(i); } }},
      h('td',{class:'ck'}, h('span',{class:'mk'+(d.single?'':' sq')}, d.single?'':'✓')), tb.rowNums ? h('td',{class:'rn'},String(i+2)) : null, ...r.map(c=>h('td',null,c))));
    const toggle = (i) => { if (d.single) { s.clear(); s.add(i); } else s.has(i) ? s.delete(i) : s.add(i); trs.forEach((tr,k)=>tr.setAttribute('aria-checked', s.has(k))); api.onchange(); };
    api.el = h('div',{style:'display:flex;flex-direction:column;gap:6px'},
      h('div',{class:'tbl'}, h('table',null, h('thead',null,h('tr',null, h('th',{class:'ck'},''), tb.rowNums ? h('th',{class:'rn'},'') : null, ...tb.head.map(x=>h('th',null,x)))), h('tbody',null, trs))),
      h('div',{class:'hint'}, d.single ? 'Нажми на одну строку.' : 'Нажимай на строки, чтобы отметить. Повторное нажатие снимает отметку.')); return api;
  },
  graph(d){
    const path = [d.start]; const api = { onchange(){}, ready:()=>path[path.length-1]===d.end, value:()=>path.slice() };
    const xs = d.nodes.map(n=>n.x), ys = d.nodes.map(n=>n.y);
    const W = 340, Hh = 250, padX = 44, padY = 40;
    const sx = (x)=> padX + (x - Math.min(...xs)) / (Math.max(...xs)-Math.min(...xs)||1) * (W-2*padX);
    const sy = (y)=> padY + (y - Math.min(...ys)) / (Math.max(...ys)-Math.min(...ys)||1) * (Hh-2*padY);
    const NS='http://www.w3.org/2000/svg';
    const s = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text!=null) e.textContent = text; return e; };
    const svg = s('svg',{viewBox:`0 0 ${W} ${Hh}`,role:'img','aria-label':'Схема'});
    const pathTxt = h('div',{class:'path'});
    const adj = (a,b) => d.edges.some(([x,y])=>(x===a&&y===b)||(x===b&&y===a));
    const draw = () => {
      svg.replaceChildren();
      const on = (a,b) => path.some((p,i)=>i && ((path[i-1]===a&&p===b)||(path[i-1]===b&&p===a)));
      d.edges.forEach(([a,b,w])=>{
        const A=d.nodes[a], B=d.nodes[b], act=on(a,b);
        svg.append(s('line',{x1:sx(A.x),y1:sy(A.y),x2:sx(B.x),y2:sy(B.y),stroke:act?'var(--accent)':'var(--line)','stroke-width':act?5:3,'stroke-linecap':'round'}));
        const mx=(sx(A.x)+sx(B.x))/2, my=(sy(A.y)+sy(B.y))/2;
        svg.append(s('rect',{x:mx-12,y:my-10,width:24,height:20,rx:4,fill:'var(--sheet)',stroke:'var(--line)'}));
        svg.append(s('text',{x:mx,y:my+5,'text-anchor':'middle','font-size':13,'font-weight':700,'font-family':'var(--font-mono)',fill:'var(--ink)'}, w));
      });
      const last = path[path.length-1];
      d.nodes.forEach(nd=>{
        const inP = path.includes(nd.id), can = adj(last, nd.id) && !inP, isEnd = nd.id===d.end || nd.id===d.start;
        const g = s('g',{style:'cursor:pointer',tabindex:'0',role:'button','aria-label':nd.label});
        g.append(s('circle',{cx:sx(nd.x),cy:sy(nd.y),r:22,fill:'transparent'}));
        g.append(s('circle',{cx:sx(nd.x),cy:sy(nd.y),r:isEnd?15:12,fill:inP?'var(--accent)':'var(--sheet)',stroke:can?'var(--blue)':'var(--ink)','stroke-width':can?3:2,'stroke-dasharray':can?'4 3':'none'}));
        const ly = sy(nd.y) + (nd.y === Math.max(...ys) ? 32 : -22);
        g.append(s('text',{x:sx(nd.x),y:ly,'text-anchor':'middle','font-size':12,'font-weight':700,'font-family':'var(--font-body)',fill:inP?'var(--accent)':'var(--ink)'}, nd.label));
        const tap = () => {
          if (nd.id === last && path.length>1) path.pop();
          else if (can) path.push(nd.id);
          else return;
          draw(); api.onchange();
        };
        g.addEventListener('click', tap); g.addEventListener('keydown', (e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); tap(); } });
        svg.append(g);
      });
      const len = path.reduce((acc,p,i)=> i ? acc + d.edges.find(([x,y])=>(x===path[i-1]&&y===p)||(x===p&&y===path[i-1]))[2] : 0, 0);
      pathTxt.textContent = path.map(p=>d.nodes[p].label).join(' → ') + (path.length>1 ? `  (${len} ${d.unit})` : '');
    };
    draw();
    api.el = h('div',{class:'graph',style:'display:flex;flex-direction:column;gap:8px'},
      h('div',{class:'hint'},`Начало — «${d.nodes[d.start].label}», конец — «${d.nodes[d.end].label}». Синий пунктир — куда можно перейти. Нажмите последний узел, чтобы отменить шаг.`),
      svg, pathTxt,
      h('button',{class:'btn ghost',type:'button',onclick:()=>{ path.length=1; draw(); api.onchange(); }},'Сбросить путь')); return api;
  },
};
window.MECH = { h, table, RENDER };
})();
