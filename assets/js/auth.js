// Cuentas con Supabase Auth (correo + contraseña), compartidas por todas las páginas.
//
// - Crea el cliente `sb` con assets/js/config.js (si no está configurado, `sb` es null y el
//   sitio muestra "Mercado no configurado" donde haga falta).
// - Inyecta el modal de "Iniciar sesión" / "Crear cuenta" y el de cambio obligatorio de
//   contraseña (para el admin master con contraseña temporal).
// - Mantiene la sesión en memoria (`getUsuarioActual()` es síncrono) y, cada vez que cambia,
//   repinta el nav, llama `renderAll()` si la página la define y emite `cuenta:cambio`.
// - `cuentaLista` se resuelve cuando ya se sabe si hay sesión: las páginas la esperan antes
//   de pintar lo que depende del usuario.

const sb = (window.supabase && CAMBALACHE_CONFIG.supabaseUrl && CAMBALACHE_CONFIG.supabaseKey)
  ? window.supabase.createClient(CAMBALACHE_CONFIG.supabaseUrl, CAMBALACHE_CONFIG.supabaseKey)
  : null;

let sesionActual = { usuario: null, perfil: null };
let resolverCuentaLista;
const cuentaLista = new Promise((resolve) => { resolverCuentaLista = resolve; });

function mercadoConfigurado() {
  return !!sb;
}

function getUsuarioActual() {
  const { usuario, perfil } = sesionActual;
  if (!usuario) return null;
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: perfil?.nombre || usuario.email,
    esAdmin: !!perfil?.es_admin,
    bloqueado: !!perfil?.bloqueado,
  };
}

function estaLogueado() {
  return !!sesionActual.usuario;
}

// Mensaje en español para errores de Supabase. Los de las funciones de la base ya vienen en
// español (raise exception); los de Auth y de red se traducen aquí.
function mensajeError(err) {
  const msg = err?.message || String(err || '');
  const traducciones = [
    [/Invalid login credentials/i, 'Correo o contraseña incorrectos.'],
    [/User already registered/i, 'Ya existe una cuenta con ese correo.'],
    [/Email not confirmed/i, 'Confirma tu correo antes de iniciar sesión (revisa tu bandeja de entrada).'],
    [/Password should be at least/i, 'La contraseña debe tener al menos 8 caracteres.'],
    [/New password should be different/i, 'La contraseña nueva debe ser distinta de la anterior.'],
    [/rate limit|too many/i, 'Demasiados intentos. Espera un momento y vuelve a intentar.'],
    [/Failed to fetch|NetworkError|Load failed/i, 'No pudimos conectar con el servidor. Revisa tu conexión.'],
    [/JWT|not authorized|permission denied/i, 'Tu sesión expiró o no tienes permiso. Vuelve a iniciar sesión.'],
  ];
  for (const [patron, texto] of traducciones) if (patron.test(msg)) return texto;
  return msg || 'Ocurrió un error inesperado.';
}

async function cargarSesion() {
  if (!sb) {
    sesionActual = { usuario: null, perfil: null };
    return;
  }
  const { data } = await sb.auth.getSession();
  const usuario = data?.session?.user || null;
  let perfil = null;
  if (usuario) {
    const { data: filas } = await sb.from('perfiles').select('*').eq('id', usuario.id).limit(1);
    perfil = filas?.[0] || null;
  }
  sesionActual = { usuario, perfil };
}

function notificarCambioCuenta() {
  renderNavAccount();
  revisarCambioPassword();
  if (typeof renderAll === 'function') renderAll();
  document.dispatchEvent(new CustomEvent('cuenta:cambio'));
}

async function cerrarSesion() {
  if (sb) await sb.auth.signOut();
}

// ---- Nav ----

function renderNavAccount() {
  const el = document.getElementById('navAccount');
  if (!el) return;
  const usuario = getUsuarioActual();
  if (usuario) {
    el.innerHTML = `
      ${usuario.esAdmin ? '<a href="admin.html" class="nav-admin" title="Panel de admin"><i class="fas fa-screwdriver-wrench"></i> Admin</a>' : ''}
      <a href="mi-cuenta.html" class="nav-user" title="Mi cuenta"><i class="fas fa-circle-user"></i> ${escapeHtml(usuario.nombre)}</a>
      <button class="nav-logout" id="navLogoutBtn" title="Cerrar sesión" aria-label="Cerrar sesión"><i class="fas fa-arrow-right-from-bracket"></i></button>
    `;
    document.getElementById('navLogoutBtn').addEventListener('click', cerrarSesion);
  } else {
    el.innerHTML = '<button class="nav-login-btn" id="navLoginBtn"><i class="fas fa-right-to-bracket"></i> Iniciar sesión</button>';
    document.getElementById('navLoginBtn').addEventListener('click', () => openAuthModal('login'));
  }
}

// ---- Modal de login / registro ----

const AUTH_MODAL_HTML = `
<div class="modal-overlay" id="authOverlay">
    <div class="verify-box" role="dialog" aria-modal="true" aria-label="Cuenta">
        <button class="verify-close" id="authClose" type="button" aria-label="Cerrar"><i class="fas fa-xmark"></i></button>
        <div class="auth-tabs">
            <button class="auth-tab active" data-tab="login" type="button">Iniciar sesión</button>
            <button class="auth-tab" data-tab="registro" type="button">Crear cuenta</button>
        </div>
        <p class="verify-error" id="authNoConfig" style="display:none">Las cuentas todavía no están habilitadas en este sitio.</p>
        <form id="loginForm">
            <label for="loginEmail">Correo</label>
            <input type="email" id="loginEmail" autocomplete="email" required>
            <label for="loginPassword">Contraseña</label>
            <input type="password" id="loginPassword" autocomplete="current-password" required>
            <p class="verify-error" id="loginError"></p>
            <button type="submit" class="btn-mini primary"><i class="fas fa-right-to-bracket"></i> Iniciar sesión</button>
        </form>
        <form id="registroForm" style="display:none">
            <label for="registroNombre">Nombre</label>
            <input type="text" id="registroNombre" autocomplete="name" maxlength="60" required>
            <label for="registroEmail">Correo</label>
            <input type="email" id="registroEmail" autocomplete="email" required>
            <label for="registroPassword">Contraseña (mínimo 8 caracteres)</label>
            <input type="password" id="registroPassword" autocomplete="new-password" required minlength="8">
            <label for="registroPassword2">Repetir contraseña</label>
            <input type="password" id="registroPassword2" autocomplete="new-password" required minlength="8">
            <p class="verify-error" id="registroError"></p>
            <p class="verify-ok" id="registroOk" style="display:none"></p>
            <button type="submit" class="btn-mini primary"><i class="fas fa-user-plus"></i> Crear cuenta</button>
        </form>
    </div>
</div>
<div class="modal-overlay" id="passOverlay">
    <div class="verify-box" role="dialog" aria-modal="true" aria-label="Cambiar contraseña">
        <h3>Cambia tu contraseña</h3>
        <p>Tu cuenta tiene una contraseña temporal. Elige una nueva para seguir.</p>
        <form id="passForm">
            <input type="email" id="passUsuario" autocomplete="username" hidden>
            <label for="passNueva">Contraseña nueva (mínimo 8 caracteres)</label>
            <input type="password" id="passNueva" autocomplete="new-password" required minlength="8">
            <label for="passNueva2">Repetir contraseña</label>
            <input type="password" id="passNueva2" autocomplete="new-password" required minlength="8">
            <p class="verify-error" id="passError"></p>
            <button type="submit" class="btn-mini primary"><i class="fas fa-key"></i> Guardar contraseña</button>
        </form>
    </div>
</div>`;

function openAuthModal(tab) {
  document.getElementById('authOverlay').classList.add('open');
  switchAuthTab(tab || 'login');
}

function closeAuthModal() {
  document.getElementById('authOverlay').classList.remove('open');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('loginForm').style.display = tab === 'login' ? 'flex' : 'none';
  document.getElementById('registroForm').style.display = tab === 'registro' ? 'flex' : 'none';
  document.getElementById('loginError').textContent = '';
  document.getElementById('registroError').textContent = '';
  document.getElementById('registroOk').style.display = 'none';
  document.getElementById('authNoConfig').style.display = sb ? 'none' : 'block';
}

// Desactiva el botón mientras corre `accion`, para evitar el doble envío.
async function conBotonOcupado(form, accion) {
  const btn = form.querySelector('button[type="submit"]');
  if (btn.disabled) return;
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Un momento…';
  try {
    await accion();
  } finally {
    btn.disabled = false;
    btn.innerHTML = html;
  }
}

async function enviarLogin(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const errEl = document.getElementById('loginError');
  if (!sb) return;
  await conBotonOcupado(form, async () => {
    errEl.textContent = '';
    const { error } = await sb.auth.signInWithPassword({
      email: document.getElementById('loginEmail').value.trim(),
      password: document.getElementById('loginPassword').value,
    });
    if (error) { errEl.textContent = mensajeError(error); return; }
    form.reset();
    closeAuthModal();
  });
}

async function enviarRegistro(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const errEl = document.getElementById('registroError');
  const okEl = document.getElementById('registroOk');
  if (!sb) return;
  const nombre = document.getElementById('registroNombre').value.trim();
  const email = document.getElementById('registroEmail').value.trim();
  const p1 = document.getElementById('registroPassword').value;
  const p2 = document.getElementById('registroPassword2').value;
  errEl.textContent = '';
  okEl.style.display = 'none';
  if (!nombre) { errEl.textContent = 'Escribe tu nombre.'; return; }
  if (p1.length < 8) { errEl.textContent = 'La contraseña debe tener al menos 8 caracteres.'; return; }
  if (p1 !== p2) { errEl.textContent = 'Las contraseñas no coinciden.'; return; }

  await conBotonOcupado(form, async () => {
    const { data, error } = await sb.auth.signUp({
      email,
      password: p1,
      options: { data: { nombre }, emailRedirectTo: new URL('mi-cuenta.html', location.href).href },
    });
    if (error) { errEl.textContent = mensajeError(error); return; }
    form.reset();
    if (data.session) {
      closeAuthModal();
    } else {
      // Con confirmación de correo activada, la cuenta queda pendiente hasta hacer clic en el link.
      okEl.textContent = `Te enviamos un correo a ${email} para confirmar tu cuenta. Después inicia sesión.`;
      okEl.style.display = 'block';
    }
  });
}

// ---- Cambio obligatorio de contraseña ----

function revisarCambioPassword() {
  const overlay = document.getElementById('passOverlay');
  if (!overlay) return;
  document.getElementById('passUsuario').value = sesionActual.usuario?.email || '';
  overlay.classList.toggle('open', !!sesionActual.perfil?.debe_cambiar_password);
}

async function enviarCambioPassword(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const errEl = document.getElementById('passError');
  const p1 = document.getElementById('passNueva').value;
  const p2 = document.getElementById('passNueva2').value;
  errEl.textContent = '';
  if (p1.length < 8) { errEl.textContent = 'La contraseña debe tener al menos 8 caracteres.'; return; }
  if (p1 !== p2) { errEl.textContent = 'Las contraseñas no coinciden.'; return; }
  await conBotonOcupado(form, async () => {
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) { errEl.textContent = mensajeError(error); return; }
    const { error: errRpc } = await sb.rpc('confirmar_cambio_password');
    if (errRpc) { errEl.textContent = mensajeError(errRpc); return; }
    form.reset();
    await cargarSesion();
    notificarCambioCuenta();
  });
}

// ---- Arranque ----

document.addEventListener('DOMContentLoaded', async () => {
  document.body.insertAdjacentHTML('beforeend', AUTH_MODAL_HTML);

  document.getElementById('authClose').addEventListener('click', closeAuthModal);
  document.getElementById('authOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'authOverlay') closeAuthModal();
  });
  document.querySelectorAll('.auth-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
  });
  document.getElementById('loginForm').addEventListener('submit', enviarLogin);
  document.getElementById('registroForm').addEventListener('submit', enviarRegistro);
  document.getElementById('passForm').addEventListener('submit', enviarCambioPassword);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAuthModal();
  });

  try {
    await cargarSesion();
  } catch (err) {
    console.error(err);
  }
  notificarCambioCuenta();
  resolverCuentaLista();

  if (sb) {
    // Supabase recomienda no llamar a otros métodos dentro del callback: se difiere.
    sb.auth.onAuthStateChange((evento) => {
      if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(evento)) return;
      setTimeout(async () => {
        await cargarSesion();
        notificarCambioCuenta();
      }, 0);
    });
  }
});
