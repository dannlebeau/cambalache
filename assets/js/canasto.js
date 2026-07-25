// Lógica de canasto.html: cuenta (login/registro, ver assets/js/auth.js), items del canasto
// (intercambiar o vender), y el flujo de transacciones paso a paso. El pago, la liberación de
// fondos y la confirmación de "la otra parte" siguen siendo una simulación (ver "Acerca de");
// por eso los botones que representan esos pasos lo dicen explícitamente, aunque el resto del
// sitio ya no lo repita en un banner. Usa las funciones y constantes de assets/js/shared.js.

const ESTADOS_INTERCAMBIO_LABEL = {
  pendiente_pago: 'Pendiente de pago',
  esperando_contraparte: 'Pagado · esperando a la otra parte',
  resuelto: 'Resuelto · fondos liberados (demo)',
};

const ESTADOS_VENTA = {
  publicada: { label: 'Publicada · esperando comprador', accion: 'simular_compra', boton: 'Simular: alguien compró y pagó' },
  pagada_esperando_envio: { label: 'Pagada · confirmá el envío', accion: 'confirmar_envio', boton: 'Confirmé que envié la carta' },
  esperando_confirmacion_comprador: { label: 'Enviada · esperando confirmación del comprador', accion: 'simular_confirmacion', boton: 'Simular: el comprador confirmó recepción' },
  resuelto: { label: 'Resuelto · fondos liberados (demo)', accion: null, boton: null },
};

// ---- Render ----

function renderAll() {
  updateCanastoBadge();
  renderPerfilBar();
  renderCanastoItems();
  renderResumenIntercambio();
  renderTransacciones();
}

function renderPerfilBar() {
  const usuario = getUsuarioActual();
  const el = document.getElementById('perfilBar');
  if (usuario) {
    el.innerHTML = `
      <div class="perfil-chip ok"><i class="fas fa-circle-check"></i> Sesión iniciada · ${escapeHtml(usuario.nombre)}</div>
      <div class="perfil-puntos"><i class="fas fa-star"></i> ${usuario.puntos || 0} punto(s)</div>
    `;
  } else {
    el.innerHTML = `
      <div class="perfil-chip warn"><i class="fas fa-triangle-exclamation"></i> No iniciaste sesión</div>
      <button class="btn-mini primary" id="perfilLoginBtn"><i class="fas fa-right-to-bracket"></i> Iniciar sesión</button>
    `;
    document.getElementById('perfilLoginBtn').addEventListener('click', () => openAuthModal('login'));
  }
}

function itemRowHtml(item) {
  const meta = GAME_META[item.juego];
  const comision = item.tipo === 'venta' && item.precio > 0 ? Math.round(item.precio * COMISION_VENTA) : 0;
  return `
    <div class="canasto-row" data-id="${escapeHtml(item.id)}">
      <div class="canasto-visual">${item.imagen ? `<img src="${escapeHtml(item.imagen)}" alt="" onerror="this.remove()">` : '<i class="fas fa-images"></i>'}</div>
      <div class="canasto-info">
        <strong>${escapeHtml(item.nombre)}</strong>
        <span class="chip-mini" style="background:${meta.color}">${meta.label}</span>
        <div class="canasto-tipo-toggle">
          <button class="tipo-btn ${item.tipo === 'intercambio' ? 'active' : ''}" data-accion="tipo" data-valor="intercambio">Intercambiar</button>
          <button class="tipo-btn ${item.tipo === 'venta' ? 'active' : ''}" data-accion="tipo" data-valor="venta">Vender</button>
        </div>
        ${item.tipo === 'venta' ? `
          <div class="precio-row">
            <input type="number" min="0" step="500" class="precio-input" data-accion="precio" value="${item.precio || ''}" placeholder="Precio CLP">
            ${item.precio > 0 ? `<span class="precio-detalle">Comisión 20%: ${formatCLP(comision)} · Recibes: ${formatCLP(item.precio - comision)}</span>` : ''}
            <button class="btn-mini primary" data-accion="publicar" ${item.precio > 0 ? '' : 'disabled'}><i class="fas fa-tag"></i> Publicar en venta</button>
          </div>
        ` : ''}
      </div>
      <button class="canasto-remove" data-accion="quitar" title="Quitar del canasto"><i class="fas fa-trash"></i></button>
    </div>
  `;
}

function renderCanastoItems() {
  const list = getCanasto();
  const el = document.getElementById('canastoList');
  el.innerHTML = list.length
    ? list.map(itemRowHtml).join('')
    : '<p class="empty-note">Tu canasto está vacío. Volvé al <a href="index.html">catálogo</a> y agregá cartas.</p>';
}

function renderResumenIntercambio() {
  const items = getCanasto().filter((c) => c.tipo === 'intercambio');
  const el = document.getElementById('resumenIntercambio');
  if (!items.length) { el.innerHTML = ''; return; }
  const costo = items.length * COSTO_POR_CARTA_INTERCAMBIO;
  el.innerHTML = `
    <div class="resumen-box">
      <div>
        <strong>${items.length} carta(s)</strong> lista(s) para intercambiar
        <span class="resumen-costo">${items.length} × ${formatCLP(COSTO_POR_CARTA_INTERCAMBIO)} = ${formatCLP(costo)} (tu parte; la otra persona paga la suya según cuántas cartas ponga ella)</span>
      </div>
      <button class="btn-mini primary" id="iniciarIntercambioBtn"><i class="fas fa-people-arrows"></i> Iniciar intercambio</button>
    </div>
    <span class="money-note">El pago se simula: todavía no se procesa ningún cobro real.</span>
  `;
  document.getElementById('iniciarIntercambioBtn').addEventListener('click', iniciarIntercambio);
}

function txIntercambioHtml(tx) {
  const label = ESTADOS_INTERCAMBIO_LABEL[tx.estado];
  let boton = '';
  if (tx.estado === 'pendiente_pago') {
    boton = `<button class="btn-mini primary" data-tx-accion="pagar">Pagar mi parte (${tx.items.length} × ${formatCLP(COSTO_POR_CARTA_INTERCAMBIO)} = ${formatCLP(tx.costoTotal)}, simulado)</button>`;
  } else if (tx.estado === 'esperando_contraparte') {
    boton = '<button class="btn-mini primary" data-tx-accion="simular_contraparte">Simular: la otra parte pagó y confirmó</button>';
  }
  return `
    <div class="tx-row" data-tx="${tx.id}">
      <div class="tx-head">
        <span class="chip-mini" style="background:var(--accent)">Intercambio</span>
        <span class="tx-estado">${escapeHtml(label)}</span>
      </div>
      <div class="tx-items">${tx.items.map((i) => escapeHtml(i.nombre)).join(', ')}</div>
      ${boton}
    </div>
  `;
}

function txVentaHtml(tx) {
  const est = ESTADOS_VENTA[tx.estado];
  return `
    <div class="tx-row" data-tx="${tx.id}">
      <div class="tx-head">
        <span class="chip-mini" style="background:var(--myl)">Venta</span>
        <span class="tx-estado">${escapeHtml(est.label)}</span>
      </div>
      <div class="tx-items">${escapeHtml(tx.item.nombre)} · ${formatCLP(tx.item.precio)} (recibís ${formatCLP(tx.recibes)})</div>
      ${est.boton ? `<button class="btn-mini primary" data-tx-accion="${est.accion}">${escapeHtml(est.boton)}</button>` : ''}
    </div>
  `;
}

function renderTransacciones() {
  const list = getTransacciones();
  const el = document.getElementById('txList');
  el.innerHTML = list.length
    ? list.map((tx) => (tx.tipo === 'intercambio' ? txIntercambioHtml(tx) : txVentaHtml(tx))).join('')
    : '<p class="empty-note">Todavía no iniciaste ningún intercambio ni venta.</p>';
}

// ---- Acciones de canasto ----

function terminosAceptados() {
  const chk = document.getElementById('aceptaTerminos');
  if (chk && !chk.checked) {
    alert('Primero tenés que leer y aceptar los Términos y Condiciones (más abajo en esta página).');
    return false;
  }
  return true;
}

function iniciarIntercambio() {
  if (!terminosAceptados()) return;
  if (!estaLogueado()) { openAuthModal('login'); return; }
  const items = getCanasto().filter((c) => c.tipo === 'intercambio');
  if (!items.length) return;
  addTransaccion({
    id: 'tx-' + Date.now(),
    tipo: 'intercambio',
    items: items.map(({ id, juego, nombre, imagen }) => ({ id, juego, nombre, imagen })),
    costoTotal: items.length * COSTO_POR_CARTA_INTERCAMBIO,
    estado: 'pendiente_pago',
    creada: new Date().toISOString(),
  });
  saveCanasto(getCanasto().filter((c) => c.tipo !== 'intercambio'));
  renderAll();
}

function publicarVenta(itemId) {
  if (!terminosAceptados()) return;
  if (!estaLogueado()) { openAuthModal('login'); return; }
  const item = getCanasto().find((c) => c.id === itemId);
  if (!item || !item.precio || item.precio <= 0) return;
  const comision = Math.round(item.precio * COMISION_VENTA);
  addTransaccion({
    id: 'tx-' + Date.now(),
    tipo: 'venta',
    item: { id: item.id, juego: item.juego, nombre: item.nombre, imagen: item.imagen, precio: item.precio },
    comision,
    recibes: item.precio - comision,
    estado: 'publicada',
    creada: new Date().toISOString(),
  });
  removeFromCanasto(itemId);
  renderAll();
}

function avanzarIntercambio(txId, accion) {
  const tx = getTransacciones().find((t) => t.id === txId);
  if (!tx) return;
  if (accion === 'pagar' && tx.estado === 'pendiente_pago') {
    updateTransaccion(txId, { estado: 'esperando_contraparte' });
  } else if (accion === 'simular_contraparte' && tx.estado === 'esperando_contraparte') {
    updateTransaccion(txId, { estado: 'resuelto', resuelta: new Date().toISOString() });
    addPuntos(PUNTOS_INTERCAMBIO);
  }
  renderAll();
}

function avanzarVenta(txId, accion) {
  const tx = getTransacciones().find((t) => t.id === txId);
  if (!tx) return;
  if (accion === 'simular_compra' && tx.estado === 'publicada') {
    updateTransaccion(txId, { estado: 'pagada_esperando_envio' });
  } else if (accion === 'confirmar_envio' && tx.estado === 'pagada_esperando_envio') {
    updateTransaccion(txId, { estado: 'esperando_confirmacion_comprador' });
  } else if (accion === 'simular_confirmacion' && tx.estado === 'esperando_confirmacion_comprador') {
    updateTransaccion(txId, { estado: 'resuelto', resuelta: new Date().toISOString() });
    addPuntos(PUNTOS_VENTA);
  }
  renderAll();
}

// ---- Arranque ----

document.addEventListener('DOMContentLoaded', () => {
  renderAll();

  document.getElementById('canastoList').addEventListener('click', (e) => {
    const row = e.target.closest('.canasto-row');
    if (!row) return;
    const id = row.dataset.id;
    const tipoBtn = e.target.closest('[data-accion="tipo"]');
    const quitarBtn = e.target.closest('[data-accion="quitar"]');
    const publicarBtn = e.target.closest('[data-accion="publicar"]');
    if (tipoBtn) {
      updateCanastoItem(id, { tipo: tipoBtn.dataset.valor });
      renderAll();
    } else if (quitarBtn) {
      removeFromCanasto(id);
      renderAll();
    } else if (publicarBtn) {
      publicarVenta(id);
    }
  });

  document.getElementById('canastoList').addEventListener('change', (e) => {
    const input = e.target.closest('[data-accion="precio"]');
    if (!input) return;
    const row = e.target.closest('.canasto-row');
    updateCanastoItem(row.dataset.id, { precio: Math.max(0, Number(input.value) || 0) });
    renderAll();
  });

  document.getElementById('txList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tx-accion]');
    if (!btn) return;
    const row = e.target.closest('.tx-row');
    const tx = getTransacciones().find((t) => t.id === row.dataset.tx);
    if (!tx) return;
    if (tx.tipo === 'intercambio') avanzarIntercambio(tx.id, btn.dataset.txAccion);
    else avanzarVenta(tx.id, btn.dataset.txAccion);
  });
});
