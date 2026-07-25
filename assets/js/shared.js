// Código compartido entre index.html y canasto.html: metadatos de juegos, escape de HTML,
// y todo lo que se guarda en localStorage (canasto, cuentas/sesión, transacciones
// simuladas). No hay servidor propio: las cuentas y el flujo de intercambio/venta viven en
// este navegador (ver README y "Acerca de" para el detalle de qué es real y qué es simulado).

const GAME_META = {
  ygo: { label: 'Yu-Gi-Oh!', short: 'YGO', color: 'var(--ygo)' },
  poke: { label: 'Pokémon', short: 'POKÉ', color: 'var(--poke)' },
  myl: { label: 'Mitos y Leyendas', short: 'MyL', color: 'var(--myl)' },
};

const CANASTO_KEY = 'cambalache_canasto';
const USERS_KEY = 'cambalache_usuarios';
const SESSION_KEY = 'cambalache_sesion';
const TX_KEY = 'cambalache_transacciones';

const COSTO_POR_CARTA_INTERCAMBIO = 500; // CLP, por persona, por CADA carta que esa persona pone en el intercambio
const COMISION_VENTA = 0.2; // 20%
const PUNTOS_INTERCAMBIO = 10;
const PUNTOS_VENTA = 15;

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
    list.push({ id: card.id, juego: card.juego, nombre: card.nombre, imagen: card.imagen, tipo: 'intercambio', precio: 0 });
    saveCanasto(list);
  }
}

function removeFromCanasto(id) {
  saveCanasto(getCanasto().filter((c) => c.id !== id));
}

function updateCanastoItem(id, cambios) {
  const list = getCanasto();
  const item = list.find((c) => c.id === id);
  if (!item) return;
  Object.assign(item, cambios);
  saveCanasto(list);
}

function updateCanastoBadge() {
  const badge = document.getElementById('canastoBadge');
  if (badge) badge.textContent = getCanasto().length;
}

// ---- Cuentas (login/registro) ----
// Cuentas guardadas en este navegador (localStorage), sin servidor propio: no es
// autenticación real entre dispositivos distintos, pero las contraseñas nunca se guardan en
// texto plano (se hashean con SHA-256 vía Web Crypto antes de guardarse).

async function hashPassword(password) {
  const datos = new TextEncoder().encode(password);
  const buffer = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getUsuarios() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
  catch { return []; }
}

function saveUsuarios(list) {
  localStorage.setItem(USERS_KEY, JSON.stringify(list));
}

function getSesionEmail() {
  return localStorage.getItem(SESSION_KEY) || null;
}

function setSesionEmail(email) {
  localStorage.setItem(SESSION_KEY, email);
}

function cerrarSesion() {
  localStorage.removeItem(SESSION_KEY);
}

function getUsuarioActual() {
  const email = getSesionEmail();
  if (!email) return null;
  return getUsuarios().find((u) => u.email === email) || null;
}

function estaLogueado() {
  return !!getUsuarioActual();
}

async function registrarUsuario(nombre, email, password) {
  const emailNorm = email.trim().toLowerCase();
  const usuarios = getUsuarios();
  if (usuarios.some((u) => u.email === emailNorm)) {
    return { ok: false, error: 'Ya existe una cuenta con ese correo.' };
  }
  const passwordHash = await hashPassword(password);
  usuarios.push({ email: emailNorm, nombre: nombre.trim(), passwordHash, puntos: 0, creado: new Date().toISOString() });
  saveUsuarios(usuarios);
  setSesionEmail(emailNorm);
  return { ok: true };
}

async function iniciarSesion(email, password) {
  const emailNorm = email.trim().toLowerCase();
  const usuario = getUsuarios().find((u) => u.email === emailNorm);
  if (!usuario) return { ok: false, error: 'No existe una cuenta con ese correo.' };
  const passwordHash = await hashPassword(password);
  if (usuario.passwordHash !== passwordHash) return { ok: false, error: 'Contraseña incorrecta.' };
  setSesionEmail(emailNorm);
  return { ok: true };
}

function addPuntos(cantidad) {
  const email = getSesionEmail();
  if (!email) return 0;
  const usuarios = getUsuarios();
  const usuario = usuarios.find((u) => u.email === email);
  if (!usuario) return 0;
  usuario.puntos = (usuario.puntos || 0) + cantidad;
  saveUsuarios(usuarios);
  return usuario.puntos;
}

function renderNavAccount() {
  const el = document.getElementById('navAccount');
  if (!el) return;
  const usuario = getUsuarioActual();
  if (usuario) {
    el.innerHTML = `
      <span class="nav-user"><i class="fas fa-circle-user"></i> ${escapeHtml(usuario.nombre)}</span>
      <button class="nav-logout" id="navLogoutBtn" title="Cerrar sesión"><i class="fas fa-arrow-right-from-bracket"></i></button>
    `;
    document.getElementById('navLogoutBtn').addEventListener('click', () => {
      cerrarSesion();
      renderNavAccount();
      if (typeof renderAll === 'function') renderAll();
    });
  } else {
    el.innerHTML = '<button class="nav-login-btn" id="navLoginBtn"><i class="fas fa-right-to-bracket"></i> Iniciar sesión</button>';
    document.getElementById('navLoginBtn').addEventListener('click', () => openAuthModal('login'));
  }
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
