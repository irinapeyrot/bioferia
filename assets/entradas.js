/* Compra de entradas — simulación de punta a punta.
   No se cobra nada ni se piden datos de tarjeta: el pago se simula y las entradas
   quedan guardadas en este navegador (localStorage), con QR y descarga en PNG. */
(() => {
  const KEY = 'bioferia-entradas';
  const FEE = 0.10;
  const DAYS = [
    { id: 'vie', label: 'Viernes 9', short: 'Vie 9 abr', date: '20270409' },
    { id: 'sab', label: 'Sábado 10', short: 'Sáb 10 abr', date: '20270410' },
    { id: 'dom', label: 'Domingo 11', short: 'Dom 11 abr', date: '20270411' }
  ];
  const TYPES = [
    { id: 'general', name: 'General', desc: 'Una persona, un día.', price: 20000, per: 1, needsDay: true },
    { id: 'tribu', name: 'Pack Tribu 4x3', desc: 'Cuatro entradas para un mismo día, al precio de tres.', price: 60000, per: 4, needsDay: true },
    { id: 'manija', name: 'Pack Manija 3x2', desc: 'Una persona, los tres días, al precio de dos.', price: 40000, per: 1, needsDay: false }
  ];
  const MAX = 10;
  const money = n => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const save = list => { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } };
  let orders = load();

  const rnd = n => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; const r = new Uint32Array(n); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(r) : r.forEach((_, i) => r[i] = Math.random() * 1e9); r.forEach(v => s += a[v % a.length]); return s; };

  /* ---------- DOM ---------- */
  const root = document.createElement('div');
  root.className = 'tk';
  root.id = 'entradas';
  root.innerHTML = `
    <div class="tk-scrim" data-close></div>
    <div class="tk-sheet" role="dialog" aria-modal="true" aria-labelledby="tk-title" tabindex="-1">
      <div class="tk-head">
        <h2 id="tk-title">Entradas</h2>
        <button class="tk-close" type="button" data-close aria-label="Cerrar">×</button>
      </div>
      <div class="tk-tabs" role="tablist">
        <button type="button" role="tab" data-tab="buy" aria-selected="true">Comprar</button>
        <button type="button" role="tab" data-tab="mine" aria-selected="false">Mis entradas <span data-count></span></button>
      </div>
      <p class="tk-note">Simulación de compra para el prototipo: no se cobra nada ni se envían mails. Precios de referencia de la edición 2026.</p>
      <div class="tk-view" data-view></div>
    </div>`;
  document.body.appendChild(root);
  const sheet = root.querySelector('.tk-sheet');
  const view = root.querySelector('[data-view]');
  const tabs = root.querySelectorAll('[data-tab]');
  const countEl = root.querySelector('[data-count]');

  /* ---------- estado ---------- */
  let st;
  const reset = () => { st = { step: 1, day: null, qty: { general: 0, tribu: 0, manija: 0 }, name: '', email: '', method: 'mp', order: null }; };
  reset();
  let tab = 'buy';
  let lastFocus = null;

  const subtotal = () => TYPES.reduce((s, t) => s + t.price * st.qty[t.id], 0);
  const needsDay = () => TYPES.some(t => t.needsDay && st.qty[t.id] > 0);
  const anyQty = () => TYPES.some(t => st.qty[t.id] > 0);
  const step1ok = () => anyQty() && (!needsDay() || st.day);

  const steps = () => {
    const names = ['Entradas', 'Tus datos', 'Pago', 'Listo'];
    return `<ol class="tk-steps" aria-label="Pasos">${names.map((n, i) => {
      const k = i + 1; const c = k < st.step ? 'done' : k === st.step ? 'now' : '';
      return `<li class="${c}"${k === st.step ? ' aria-current="step"' : ''}><span>${n}</span></li>`;
    }).join('')}</ol>`;
  };
  const summary = () => {
    const sub = subtotal(); const fee = Math.round(sub * FEE);
    const lines = TYPES.filter(t => st.qty[t.id]).map(t => `<dt>${st.qty[t.id]} × ${esc(t.name)}</dt><dd>${money(t.price * st.qty[t.id])}</dd>`).join('');
    return `<dl class="tk-sum">${lines || '<dt>Todavía no elegiste entradas</dt><dd>—</dd>'}
      <dt>Cargo por servicio (10%)</dt><dd>${money(fee)}</dd>
      <dt class="tot">Total</dt><dd class="tot">${money(sub + fee)}</dd></dl>`;
  };

  function render() {
    tabs.forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    const n = orders.reduce((s, o) => s + o.tickets.length, 0);
    countEl.textContent = n ? `(${n})` : '';
    if (tab === 'mine') return renderMine();
    if (st.step === 1) view.innerHTML = `${steps()}<div class="tk-body">
        <p class="tk-q" id="tk-dq">¿Qué día venís? <small style="font-weight:500;font-size:.8rem">(para General y Pack Tribu)</small></p>
        <div class="tk-days" role="group" aria-labelledby="tk-dq">${DAYS.map(d => `<button type="button" data-day="${d.id}" aria-pressed="${st.day === d.id}">${d.label}<small>abril · 11 a 18 h</small></button>`).join('')}</div>
        <p class="tk-q">Elegí tus entradas</p>
        <ul class="tk-types">${TYPES.map(t => `<li class="tk-type${st.qty[t.id] ? ' on' : ''}">
          <div><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p><p class="price">${money(t.price)}</p></div>
          <div class="tk-qty"><button type="button" data-dec="${t.id}" aria-label="Quitar ${esc(t.name)}"${st.qty[t.id] ? '' : ' disabled'}>−</button>
          <output aria-live="polite" aria-label="Cantidad de ${esc(t.name)}">${st.qty[t.id]}</output>
          <button type="button" data-inc="${t.id}" aria-label="Sumar ${esc(t.name)}"${st.qty[t.id] >= MAX ? ' disabled' : ''}>+</button></div></li>`).join('')}</ul>
        ${summary()}
        <p class="err" data-err role="status">${anyQty() && needsDay() && !st.day ? 'Elegí el día para la General o el Pack Tribu.' : ''}</p>
        <div class="tk-actions"><span></span><button class="btn" type="button" data-next${step1ok() ? '' : ' disabled'}>Continuar</button></div></div>`;
    else if (st.step === 2) view.innerHTML = `${steps()}<form class="tk-form tk-body" novalidate data-form>
        <div class="field"><label for="tk-name">Nombre y apellido</label><input id="tk-name" name="name" autocomplete="name" required value="${esc(st.name)}"><p class="err" id="tk-name-e"></p></div>
        <div class="field"><label for="tk-mail">Mail</label><input id="tk-mail" name="email" type="email" inputmode="email" autocomplete="email" required value="${esc(st.email)}"><p class="err" id="tk-mail-e"></p></div>
        <p class="tk-note">Las entradas son nominativas. En la versión real te llegarían a este mail.</p>
        ${summary()}
        <div class="tk-actions"><button class="btn ghost" type="button" data-back>Volver</button><button class="btn" type="submit">Ir al pago</button></div></form>`;
    else if (st.step === 3) view.innerHTML = `${steps()}<form class="tk-body" data-pay>
        <p class="tk-q" id="tk-pq">¿Cómo pagás?</p>
        <ul class="tk-pay" role="radiogroup" aria-labelledby="tk-pq">
          ${[['mp', 'Mercado Pago', 'Dinero en cuenta o cuotas'], ['card', 'Tarjeta de crédito o débito', 'Se simula: no se piden datos de la tarjeta'], ['transfer', 'Transferencia', 'Alias simulado, se acredita al instante']]
            .map(([v, n, d]) => `<li><label><input type="radio" name="method" value="${v}"${st.method === v ? ' checked' : ''}><span>${n}<small>${d}</small></span></label></li>`).join('')}
        </ul>
        ${summary()}
        <div class="tk-actions"><button class="btn ghost" type="button" data-back>Volver</button><button class="btn alt" type="submit">Confirmar compra simulada</button></div></form>`;
    else if (st.step === 3.5) view.innerHTML = `${steps()}<div class="tk-body"><p class="tk-busy" role="status"><i></i>Procesando el pago simulado…</p></div>`;
    else if (st.step === 4) {
      const o = st.order;
      view.innerHTML = `${steps()}<div class="tk-body tk-ok">
        <h3 tabindex="-1" data-okh>¡Listo, ${esc(o.name.split(' ')[0])}! Nos vemos en el Hipódromo.</h3>
        <p class="tk-note">Orden ${o.id} · ${money(o.total)} · ${o.tickets.length} ${o.tickets.length === 1 ? 'entrada' : 'entradas'}. Quedan guardadas en "Mis entradas" de este navegador.</p>
        ${ticketsHTML(o)}
        <div class="tk-actions"><button class="btn ghost" type="button" data-ics="${o.id}">Agregar al calendario</button><button class="btn" type="button" data-again>Comprar más</button></div></div>`;
      paintQR(view);
    }
  }

  function ticketsHTML(o) {
    return `<ul class="tk-tickets">${o.tickets.map(t => `<li class="tk-ticket">
      <div><h4>${esc(t.type)}</h4><p>${esc(t.day)}</p><p>11&nbsp;a&nbsp;18&nbsp;h · Hipódromo de Palermo</p><p>${esc(o.name)}</p><p class="code">${t.code}</p></div>
      <div class="tk-qr" data-qr="${t.code}" aria-label="Código QR de la entrada ${t.code}" role="img"></div>
      <button class="tk-dl" type="button" data-dl="${o.id}|${t.code}">Descargar entrada</button></li>`).join('')}</ul>`;
  }

  function renderMine() {
    if (!orders.length) { view.innerHTML = `<div class="tk-body"><p class="tk-empty">Todavía no tenés entradas en este navegador.</p><div class="tk-actions"><span></span><button class="btn" type="button" data-tab="buy">Comprar entradas</button></div></div>`; return; }
    view.innerHTML = `<div class="tk-body">${orders.slice().reverse().map(o => `<section class="tk-order">
      <h3>Orden ${o.id} · ${money(o.total)}</h3>${ticketsHTML(o)}
      <div class="tk-actions"><button class="btn ghost" type="button" data-ics="${o.id}">Agregar al calendario</button></div></section>`).join('')}
      <div class="tk-actions"><span></span><button class="btn ghost" type="button" data-clear>Borrar entradas de prueba</button></div></div>`;
    paintQR(view);
  }

  /* ---------- QR (qrcodejs, carga diferida) ---------- */
  let qrLib = null;
  const getQR = () => qrLib || (qrLib = new Promise(res => {
    if (window.QRCode) return res(window.QRCode);
    const s = document.createElement('script');
    s.src = 'assets/qrcode.min.js';
    s.onload = () => res(window.QRCode || null); s.onerror = () => res(null);
    document.head.appendChild(s);
  }));
  const qrPayload = code => `BIOFERIA27|${code}|SIMULACION`;
  function paintQR(scope) {
    getQR().then(Q => scope.querySelectorAll('[data-qr]').forEach(el => {
      if (el.firstChild) return;
      if (!Q) { el.textContent = el.dataset.qr.slice(-4); return; }
      new Q(el, { text: qrPayload(el.dataset.qr), width: 192, height: 192, colorDark: '#070809', colorLight: '#F0EBE3', correctLevel: Q.CorrectLevel.M });
      el.removeAttribute('title');
    }));
  }

  /* ---------- compra ---------- */
  function buy() {
    const sub = subtotal();
    const id = `BF27-${rnd(4)}-${rnd(4)}`;
    const dayLabel = DAYS.find(d => d.id === st.day);
    const tickets = [];
    TYPES.forEach(t => {
      for (let i = 0; i < st.qty[t.id] * t.per; i++) tickets.push({
        code: `${id.slice(5)}-${String(tickets.length + 1).padStart(2, '0')}`,
        type: t.id === 'manija' ? 'Pack Manija · 3 días' : t.id === 'tribu' ? 'Pack Tribu · General' : 'General',
        day: t.needsDay ? `${dayLabel.label} de abril 2027` : '9, 10 y 11 de abril 2027',
        days: t.needsDay ? [dayLabel.date] : DAYS.map(d => d.date)
      });
    });
    const o = { id, created: Date.now(), name: st.name, email: st.email, method: st.method, total: sub + Math.round(sub * FEE), tickets };
    orders.push(o); save(orders);
    st.order = o;
  }

  /* ---------- descargas ---------- */
  function downloadBlob(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }
  function ics(o) {
    const dates = [...new Set(o.tickets.flatMap(t => t.days))].sort();
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const ev = dates.map(d => ['BEGIN:VEVENT', `UID:${o.id}-${d}@bioferia-trazo`, `DTSTAMP:${stamp}`,
      `DTSTART;TZID=America/Argentina/Buenos_Aires:${d}T110000`, `DTEND;TZID=America/Argentina/Buenos_Aires:${d}T180000`,
      'SUMMARY:Bioferia BA 2027', 'LOCATION:Hipódromo de Palermo\\, Av. del Libertador 4101\\, CABA',
      `DESCRIPTION:Orden ${o.id} (simulación)`, 'END:VEVENT'].join('\r\n')).join('\r\n');
    const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Trazo//Bioferia 2027//ES', 'CALSCALE:GREGORIAN', ev, 'END:VCALENDAR'].join('\r\n');
    downloadBlob(new Blob([txt], { type: 'text/calendar' }), `bioferia-2027-${o.id}.ics`);
  }
  async function ticketPNG(o, t) {
    const W = 1080, H = 1500, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const F = getComputedStyle(document.body).fontFamily;
    try { await document.fonts.load(`700 40px ${F}`); } catch (e) {}
    g.fillStyle = '#070809'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#A62C54'; g.beginPath(); g.arc(W - 80, 120, 330, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4A4582'; g.beginPath(); g.roundRect(-120, H - 150, 560, 220, 110); g.fill();
    g.fillStyle = '#D0D822'; g.beginPath(); g.arc(150, 150, 46, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#F0EBE3'; g.textBaseline = 'alphabetic';
    g.font = `700 112px ${F}`; g.fillText('Bioferia', 80, 360);
    g.font = `700 48px ${F}`; g.fillText('BA 2027', 84, 430);
    g.font = `700 60px ${F}`; g.fillText(t.type, 80, 560);
    g.font = `400 40px ${F}`; g.globalAlpha = .9;
    g.fillText(`${t.day} · 11 a 18 h`, 80, 625); g.fillText('Hipódromo de Palermo · Av. del Libertador 4101', 80, 680);
    g.fillText(o.name, 80, 735); g.globalAlpha = 1;
    // QR
    g.fillStyle = '#F0EBE3'; g.beginPath(); g.roundRect(80, 800, 440, 440, 40); g.fill();
    const Q = await getQR();
    if (Q) {
      const tmp = document.createElement('div'); new Q(tmp, { text: qrPayload(t.code), width: 360, height: 360, colorDark: '#070809', colorLight: '#F0EBE3', correctLevel: Q.CorrectLevel.M });
      const qc = tmp.querySelector('canvas'); if (qc) { g.imageSmoothingEnabled = false; g.drawImage(qc, 120, 840, 360, 360); }
    }
    g.fillStyle = '#D0D822'; g.font = `700 44px ${F}`; g.fillText(t.code, 580, 900);
    g.fillStyle = '#F0EBE3'; g.font = `400 30px ${F}`; g.globalAlpha = .8;
    g.fillText(`Orden ${o.id}`, 580, 950); g.fillText('Entrada simulada', 580, 995); g.fillText('sin valor comercial', 580, 1035);
    g.globalAlpha = .7; g.fillText('Propuesta de identidad · Trazo · Escuela Da Vinci', 80, 1310); g.globalAlpha = 1;
    // línea punteada del recorrido
    g.fillStyle = '#F0EBE3'; for (let x = 80; x < W - 80; x += 26) { g.beginPath(); g.arc(x, 770, 4, 0, Math.PI * 2); g.fill(); }
    c.toBlob(b => b && downloadBlob(b, `bioferia-2027-${t.code}.png`), 'image/png');
  }

  /* ---------- abrir / cerrar ---------- */
  const html = document.documentElement;
  function open(which) {
    lastFocus = document.activeElement;
    tab = which || 'buy';
    if (tab === 'buy' && st.step === 4) reset();
    render();
    root.classList.add('open'); html.classList.add('tk-open');
    document.querySelectorAll('body > *:not(.tk):not(script)').forEach(el => { if (!el.hasAttribute('inert')) { el.setAttribute('inert', ''); el.dataset.tkInert = '1'; } });
    requestAnimationFrame(() => sheet.focus({ preventScroll: true }));
  }
  function close() {
    root.classList.remove('open'); html.classList.remove('tk-open');
    document.querySelectorAll('[data-tk-inert]').forEach(el => { el.removeAttribute('inert'); delete el.dataset.tkInert; });
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-tickets]');
    if (b) { e.preventDefault(); open(b.dataset.tickets || 'buy'); }
  });
  document.addEventListener('keydown', e => {
    if (!root.classList.contains('open')) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key === 'Tab') {
      const f = [...sheet.querySelectorAll('button:not([disabled]),input,[tabindex]:not([tabindex="-1"]),a[href]')].filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, true);
  // evita que la rueda/touch dentro del panel mueva el recorrido de fondo
  ['wheel', 'touchmove'].forEach(ev => root.addEventListener(ev, e => e.stopPropagation(), { passive: true }));

  root.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-close]')) return close();
    const tb = t.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; if (tab === 'buy' && st.step === 4) reset(); render(); return; }
    const d = t.closest('[data-day]'); if (d) { st.day = d.dataset.day; render(); root.querySelector(`[data-day="${st.day}"]`).focus(); return; }
    const inc = t.closest('[data-inc]'), dec = t.closest('[data-dec]');
    if (inc || dec) { const id = (inc || dec).dataset[inc ? 'inc' : 'dec']; st.qty[id] = Math.max(0, Math.min(MAX, st.qty[id] + (inc ? 1 : -1))); render();
      const again = root.querySelector(`[data-${inc ? 'inc' : 'dec'}="${id}"]`); (again && !again.disabled ? again : root.querySelector(`[data-inc="${id}"]`)).focus(); return; }
    if (t.closest('[data-next]')) { if (step1ok()) { st.step = 2; render(); root.querySelector('#tk-name').focus(); } return; }
    if (t.closest('[data-back]')) { st.step = st.step === 3 ? 2 : 1; render(); sheet.scrollTop = 0; return; }
    if (t.closest('[data-again]')) { reset(); render(); sheet.scrollTop = 0; return; }
    const ic = t.closest('[data-ics]'); if (ic) { const o = orders.find(x => x.id === ic.dataset.ics); if (o) ics(o); return; }
    const dl = t.closest('[data-dl]'); if (dl) { const [oid, code] = dl.dataset.dl.split('|'); const o = orders.find(x => x.id === oid); const tk = o && o.tickets.find(x => x.code === code); if (tk) ticketPNG(o, tk); return; }
    if (t.closest('[data-clear]')) { orders = []; save(orders); render(); return; }
  });
  root.addEventListener('submit', e => {
    e.preventDefault();
    if (e.target.matches('[data-form]')) {
      const f = e.target, n = f.name.value.trim(), m = f.email.value.trim();
      const okN = n.length >= 3 && /\s/.test(n), okM = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m);
      f.name.setAttribute('aria-invalid', String(!okN)); f.email.setAttribute('aria-invalid', String(!okM));
      f.querySelector('#tk-name-e').textContent = okN ? '' : 'Escribí nombre y apellido.';
      f.querySelector('#tk-mail-e').textContent = okM ? '' : 'Revisá el mail: falta algo (ej. nombre@mail.com).';
      st.name = n; st.email = m;
      if (!okN) return f.name.focus();
      if (!okM) return f.email.focus();
      st.step = 3; render(); sheet.scrollTop = 0; root.querySelector('input[name="method"]:checked').focus();
    } else if (e.target.matches('[data-pay]')) {
      st.method = e.target.method.value || 'mp';
      st.step = 3.5; render();
      setTimeout(() => { buy(); st.step = 4; render(); sheet.scrollTop = 0; const h = root.querySelector('[data-okh]'); h && h.focus(); }, 1500);
    }
  });
  root.addEventListener('input', e => { if (e.target.name === 'name') st.name = e.target.value; if (e.target.name === 'email') st.email = e.target.value; });
})();
