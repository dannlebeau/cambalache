// Lógica de canasto.html: cartas para intercambiar y el flujo de intercambio paso a paso. El
// pago y la confirmación de "la otra parte" siguen siendo una simulación local (ver "Acerca
// de"); por eso los botones de esos pasos lo dicen explícitamente. Las ventas ya no van por
// aquí: cada carta tiene un link "Subastar" a publicar.html. La cuenta es la de Supabase
// (assets/js/auth.js); el canasto, los intercambios y los puntos viven en este navegador.

const ESTADOS_INTERCAMBIO_LABEL = {
  pendiente_pago: 'Pendiente de pago',
  esperando_contraparte: 'Pagado · esperando a la otra parte',
  resuelto: 'Resuelto · fondos liberados (demo)',
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
      <div class="perfil-puntos"><i class="fas fa-star"></i> ${getPuntos()} punto(s)</div>
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
  return `
    <div class="canasto-row" data-id="${escapeHtml(item.id)}">
      <div class="canasto-visual">${item.imagen ? `<img src="${escapeHtml(item.imagen)}" alt="" onerror="this.remove()">` : '<i class="fas fa-images"></i>'}</div>
      <div class="canasto-info">
        <strong>${escapeHtml(item.nombre)}</strong>
        <span class="chip-mini" style="background:${meta.color}">${meta.label}</span>
        <div class="canasto-acciones">
          <a class="btn-mini" href="${escapeHtml(urlPublicar(item))}"><i class="fas fa-gavel"></i> Subastar</a>
        </div>
      </div>
      <button class="canasto-remove" data-accion="quitar" title="Quitar del canasto" aria-label="Quitar del canasto"><i class="fas fa-trash"></i></button>
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
  const items = getCanasto();
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

function renderTransacciones() {
  const list = getTransacciones().filter((tx) => tx.tipo === 'intercambio');
  const el = document.getElementById('txList');
  el.innerHTML = list.length
    ? list.map(txIntercambioHtml).join('')
    : '<p class="empty-note">Todavía no iniciaste ningún intercambio.</p>';
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
  const items = getCanasto();
  if (!items.length) return;
  addTransaccion({
    id: 'tx-' + Date.now(),
    tipo: 'intercambio',
    items: items.map(({ id, juego, nombre, imagen }) => ({ id, juego, nombre, imagen })),
    costoTotal: items.length * COSTO_POR_CARTA_INTERCAMBIO,
    estado: 'pendiente_pago',
    creada: new Date().toISOString(),
  });
  saveCanasto([]);
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

// ---- Arranque ----

document.addEventListener('DOMContentLoaded', () => {
  renderAll();

  document.getElementById('canastoList').addEventListener('click', (e) => {
    const row = e.target.closest('.canasto-row');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.closest('[data-accion="quitar"]')) {
      removeFromCanasto(id);
      renderAll();
    }
  });

  document.getElementById('txList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tx-accion]');
    if (!btn) return;
    const row = e.target.closest('.tx-row');
    const tx = getTransacciones().find((t) => t.id === row.dataset.tx);
    if (!tx) return;
    avanzarIntercambio(tx.id, btn.dataset.txAccion);
  });
});
