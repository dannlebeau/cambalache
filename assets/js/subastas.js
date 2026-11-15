// Lógica de subastas.html: listado de subastas activas con cuenta regresiva, filtro por juego
// y búsqueda. Se actualiza solo (Supabase Realtime sobre `subastas`) cuando alguien puja,
// compra o cierra una subasta.

const estadoListado = { subastas: [], juego: '', texto: '' };
let recargaPendiente = null;

function loteHtml(s) {
  const usuario = getUsuarioActual();
  const vasGanando = usuario && s.lider_id === usuario.id;
  return `
    <a class="lote" href="subasta.html?id=${encodeURIComponent(s.id)}">
      <div class="lote-visual">
        ${s.imagen ? `<img src="${escapeHtml(s.imagen)}" alt="" loading="lazy" onerror="this.remove()">` : '<i class="fas fa-images"></i>'}
        ${chipJuegoHtml(s.juego)}
        <span class="lote-reloj" data-fin="${escapeHtml(s.fin)}"></span>
      </div>
      <div class="lote-cuerpo">
        <h3>${escapeHtml(s.nombre)}</h3>
        <span class="nota">${escapeHtml(CONSERVACION[s.conservacion] || s.conservacion)} · ${s.num_pujas} puja(s)${s.ronda > 1 ? ` · ronda ${s.ronda}` : ''}</span>
        <span class="precio">${formatCLP(s.precio_actual ?? s.precio_base)}<small>${s.precio_actual ? 'puja actual' : 'precio base'}</small></span>
        <span class="nota"><i class="fas fa-bolt"></i> Cómprala ya: ${formatCLP(s.precio_compra_inmediata)}</span>
        ${vasGanando ? '<span class="estado ok">Vas ganando</span>' : ''}
      </div>
    </a>`;
}

function renderListado() {
  const el = document.getElementById('contenido');
  const texto = estadoListado.texto.toLowerCase();
  const lista = estadoListado.subastas.filter((s) =>
    (!estadoListado.juego || s.juego === estadoListado.juego) &&
    (!texto || s.nombre.toLowerCase().includes(texto)));
  if (!estadoListado.subastas.length) {
    el.innerHTML = '<div class="vacio"><i class="fas fa-gavel"></i>No hay subastas abiertas en este momento. <a href="publicar.html">Publica la primera carta</a>.</div>';
    return;
  }
  el.innerHTML = lista.length
    ? `<div class="grilla">${lista.map(loteHtml).join('')}</div>`
    : '<div class="vacio"><i class="fas fa-magnifying-glass"></i>Ninguna subasta coincide con el filtro.</div>';
}

async function cargarSubastas() {
  const el = document.getElementById('contenido');
  try {
    await procesarVencimientos();
    estadoListado.subastas = await leer(
      sb.from('subastas_publicas').select('*').eq('estado', 'activa').order('fin', { ascending: true }));
    renderListado();
  } catch (err) {
    el.innerHTML = avisoHtml('error', 'fa-triangle-exclamation', escapeHtml(err.message));
  }
}

// Varias actualizaciones seguidas (Realtime) se juntan en una sola recarga.
function programarRecarga() {
  clearTimeout(recargaPendiente);
  recargaPendiente = setTimeout(cargarSubastas, 400);
}

document.addEventListener('DOMContentLoaded', async () => {
  const el = document.getElementById('contenido');
  el.innerHTML = '<div class="vacio"><i class="fas fa-spinner fa-spin"></i>Cargando subastas…</div>';
  if (!(await exigirAcceso(el))) return;

  document.getElementById('filtros').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-juego]');
    if (!btn) return;
    document.querySelectorAll('.filtro').forEach((b) => b.classList.toggle('activo', b === btn));
    estadoListado.juego = btn.dataset.juego;
    renderListado();
  });
  document.getElementById('buscador').addEventListener('input', (e) => {
    estadoListado.texto = e.target.value.trim();
    renderListado();
  });
  document.addEventListener('cuenta:cambio', renderListado);

  await cargarSubastas();
  iniciarRelojes(el, programarRecarga);

  sb.channel('listado-subastas')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'subastas' }, programarRecarga)
    .subscribe();
});
