// Código compartido por todas las páginas: metadatos de juegos, formato, escape de HTML, y lo
// que se guarda en localStorage (canasto, transacciones de intercambio simuladas y puntos).
// Las cuentas y el mercado de subastas viven en Supabase (ver assets/js/auth.js).

const GAME_META = {
  ygo: { label: 'Yu-Gi-Oh!', short: 'YGO', color: 'var(--ygo)' },
  poke: { label: 'Pokémon', short: 'POKÉ', color: 'var(--poke)' },
  myl: { label: 'Mitos y Leyendas', short: 'MyL', color: 'var(--myl)' },
};

const CANASTO_KEY = 'cambalache_canasto';
const TX_KEY = 'cambalache_transacciones';

const COSTO_POR_CARTA_INTERCAMBIO = 500; // CLP, por persona, por CADA carta que esa persona pone en el intercambio
const PUNTOS_INTERCAMBIO = 10;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatCLP(valor) {
  return Number(valor).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}

// ---- Canasto ----

function getCanasto() {
  try { return JSON.parse(localStorage.getItem(CANASTO_KEY)) || []; }
  catch { return []; }
}

function saveCanasto(list) {
  localStorage.setItem(CANASTO_KEY, JSON.stringify(list));
  updateCanastoBadge();
}

function isInCanasto(id) {
  return getCanasto().some((c) => c.id === id);
}

function addToCanasto(card) {
  const list = getCanasto();
  if (!list.some((c) => c.id === card.id)) {
    list.push({ id: card.id, juego: card.juego, nombre: card.nombre, imagen: card.imagen });
    saveCanasto(list);
  }
}

function removeFromCanasto(id) {
  saveCanasto(getCanasto().filter((c) => c.id !== id));
}

function updateCanastoBadge() {
  const badge = document.getElementById('canastoBadge');
  if (badge) badge.textContent = getCanasto().length;
}

// ---- Puntos de intercambio ----
// Los intercambios siguen simulados y locales, así que sus puntos también: se guardan en este
// navegador por usuario (la cuenta en sí vive en Supabase, ver assets/js/auth.js).

function clavePuntos(usuarioId) {
  return 'cambalache_puntos_' + usuarioId;
}

function getPuntos() {
  const usuario = getUsuarioActual();
  if (!usuario) return 0;
  return Number(localStorage.getItem(clavePuntos(usuario.id))) || 0;
}

function addPuntos(cantidad) {
  const usuario = getUsuarioActual();
  if (!usuario) return 0;
  const total = getPuntos() + cantidad;
  localStorage.setItem(clavePuntos(usuario.id), String(total));
  return total;
}

// ---- Transacciones simuladas ----

function getTransacciones() {
  try { return JSON.parse(localStorage.getItem(TX_KEY)) || []; }
  catch { return []; }
}

function saveTransacciones(list) {
  localStorage.setItem(TX_KEY, JSON.stringify(list));
}

function addTransaccion(tx) {
  const list = getTransacciones();
  list.unshift(tx);
  saveTransacciones(list);
  return tx;
}

function updateTransaccion(id, cambios) {
  const list = getTransacciones();
  const tx = list.find((t) => t.id === id);
  if (!tx) return null;
  Object.assign(tx, cambios);
  saveTransacciones(list);
  return tx;
}

// ---- Mercado de subastas: formatos compartidos ----

const CONSERVACION = {
  nueva: 'Nueva',
  casi_nueva: 'Casi nueva',
  buena: 'Buena',
  jugada: 'Jugada',
  danada: 'Dañada',
};

const ESTADO_PUBLICACION = {
  pendiente_envio: { label: 'Esperando que envíes la carta', clase: 'warn' },
  en_subasta: { label: 'En subasta', clase: 'activo' },
  adjudicada: { label: 'Adjudicada · esperando pago', clase: 'warn' },
  vendida: { label: 'Vendida', clase: 'ok' },
  por_devolver: { label: 'Por devolver', clase: 'warn' },
  devuelta: { label: 'Devuelta', clase: '' },
  cancelada: { label: 'Cancelada', clase: '' },
};

const ESTADO_VENTA = {
  pendiente_pago: { label: 'Pendiente de pago', clase: 'warn' },
  pagada: { label: 'Pagada · por despachar', clase: 'activo' },
  despachada: { label: 'Despachada', clase: 'activo' },
  liquidada: { label: 'Liquidada', clase: 'ok' },
  impaga: { label: 'Impaga', clase: '' },
};

function estadoHtml(mapa, estado) {
  const e = mapa[estado] || { label: estado, clase: '' };
  return `<span class="estado ${e.clase}">${escapeHtml(e.label)}</span>`;
}

// "2d 4h", "3h 12m", "4m 09s" o "Cerrada".
function tiempoRestante(fin) {
  const ms = new Date(fin).getTime() - Date.now();
  if (ms <= 0) return 'Cerrada';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

function formatFecha(fecha) {
  return new Date(fecha).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
}

// Link a publicar.html con la carta del catálogo ya elegida.
function urlPublicar(card) {
  const params = new URLSearchParams({ juego: card.juego, ref: card.id, nombre: card.nombre });
  if (card.imagenGrande || card.imagen) params.set('imagen', card.imagenGrande || card.imagen);
  return 'publicar.html?' + params;
}
