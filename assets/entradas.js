/* Compra de entradas — simulación de punta a punta.
   No se cobra nada ni se piden datos de tarjeta: el pago se simula y las entradas
   la confirmación avisa que las entradas llegan por mail (no se envía ninguno). */
(() => {
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
      <p class="tk-note">Simulación de compra para el prototipo: no se cobra nada. Precios de referencia de la edición 2026.</p>
      <div class="tk-view" data-view></div>
    </div>`;
  document.body.appendChild(root);
  const sheet = root.querySelector('.tk-sheet');
  const view = root.querySelector('[data-view]');

  /* ---------- estado ---------- */
  let st;
  const reset = () => { st = { step: 1, day: 'vie', qty: { general: 0, tribu: 0, manija: 0 }, name: '', email: '', method: 'mp', order: null }; };
  reset();
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
          ${[['mp', 'Mercado Pago', 'Pago simulado: no te lleva a Mercado Pago ni se cobra'], ['card', 'Tarjeta de crédito o débito', 'Pago simulado: no se piden datos de la tarjeta'], ['transfer', 'Transferencia', 'Pago simulado: no hace falta transferir nada']]
            .map(([v, n, d]) => `<li><label><input type="radio" name="method" value="${v}"${st.method === v ? ' checked' : ''}><span>${n}<small>${d}</small></span></label></li>`).join('')}
        </ul>
        ${summary()}
        <div class="tk-actions"><button class="btn ghost" type="button" data-back>Volver</button><button class="btn alt" type="submit">Confirmar compra simulada</button></div></form>`;
    else if (st.step === 3.5) view.innerHTML = `${steps()}<div class="tk-body"><p class="tk-busy" role="status"><i></i>Procesando el pago simulado…</p></div>`;
    else if (st.step === 4) {
      const o = st.order;
      view.innerHTML = `${steps()}<div class="tk-body tk-ok">
        <span class="tk-mail" aria-hidden="true"></span>
        <h3 tabindex="-1" data-okh>¡Listo, ${esc(o.name.split(' ')[0])}! Revisá tu correo.</h3>
        <p class="tk-lead">Te enviamos ${o.count === 1 ? 'tu entrada' : `tus ${o.count} entradas`} a <strong>${esc(o.email)}</strong>. Si no ${o.count === 1 ? 'la' : 'las'} ves en unos minutos, fijate en spam o promociones.</p>
        <dl class="tk-sum"><dt>Orden</dt><dd>${o.id}</dd><dt>${o.count === 1 ? 'Entrada' : 'Entradas'}</dt><dd>${o.count}</dd><dt class="tot">Total</dt><dd class="tot">${money(o.total)}</dd></dl>
        <p class="tk-note">Presentá el QR del mail en el acceso del Hipódromo de Palermo, de 11 a 18 h.</p>
        <div class="tk-actions"><button class="btn ghost" type="button" data-ics>Agregar al calendario</button><button class="btn" type="button" data-close>Volver al recorrido</button></div></div>`;
    }
  }

  /* ---------- compra ---------- */
  function buy() {
    const sub = subtotal();
    const count = TYPES.reduce((n, t) => n + st.qty[t.id] * t.per, 0);
    const day = DAYS.find(d => d.id === st.day);
    const dates = [...new Set(TYPES.flatMap(t => st.qty[t.id] ? (t.needsDay ? [day.date] : DAYS.map(d => d.date)) : []))].sort();
    st.order = { id: `BF27-${rnd(4)}-${rnd(4)}`, name: st.name, email: st.email, method: st.method, total: sub + Math.round(sub * FEE), count, dates };
  }

  /* ---------- descargas ---------- */
  function downloadBlob(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }
  function ics(o) {
    const dates = o.dates;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const ev = dates.map(d => ['BEGIN:VEVENT', `UID:${o.id}-${d}@bioferia-trazo`, `DTSTAMP:${stamp}`,
      `DTSTART;TZID=America/Argentina/Buenos_Aires:${d}T110000`, `DTEND;TZID=America/Argentina/Buenos_Aires:${d}T180000`,
      'SUMMARY:Bioferia BA 2027', 'LOCATION:Hipódromo de Palermo\\, Av. del Libertador 4101\\, CABA',
      `DESCRIPTION:Orden ${o.id} (simulación)`, 'END:VEVENT'].join('\r\n')).join('\r\n');
    const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Trazo//Bioferia 2027//ES', 'CALSCALE:GREGORIAN', ev, 'END:VCALENDAR'].join('\r\n');
    downloadBlob(new Blob([txt], { type: 'text/calendar' }), `bioferia-2027-${o.id}.ics`);
  }
  /* ---------- abrir / cerrar ---------- */
  const html = document.documentElement;
  function open(which) {
    lastFocus = document.activeElement;
    if (st.step === 4) reset();
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
    if (b) { e.preventDefault(); open(); }
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
    const d = t.closest('[data-day]'); if (d) { st.day = d.dataset.day; render(); root.querySelector(`[data-day="${st.day}"]`).focus(); return; }
    const inc = t.closest('[data-inc]'), dec = t.closest('[data-dec]');
    if (inc || dec) { const id = (inc || dec).dataset[inc ? 'inc' : 'dec']; st.qty[id] = Math.max(0, Math.min(MAX, st.qty[id] + (inc ? 1 : -1))); render();
      const again = root.querySelector(`[data-${inc ? 'inc' : 'dec'}="${id}"]`); (again && !again.disabled ? again : root.querySelector(`[data-inc="${id}"]`)).focus(); return; }
    if (t.closest('[data-next]')) { if (step1ok()) { st.step = 2; render(); root.querySelector('#tk-name').focus(); } return; }
    if (t.closest('[data-back]')) { st.step = st.step === 3 ? 2 : 1; render(); sheet.scrollTop = 0; return; }
    if (t.closest('[data-ics]')) { if (st.order) ics(st.order); return; }
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
