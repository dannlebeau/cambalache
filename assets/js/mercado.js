// Ayudas comunes de las páginas del mercado (subastas, subasta, publicar, mi cuenta, admin).
// Usa `sb`, `cuentaLista` y `getUsuarioActual()` de assets/js/auth.js.

// Cierra subastas vencidas y procesa pagos fuera de plazo antes de leer. pg_cron también lo
// hace cada minuto; esto evita mostrar como abierta una subasta que ya debió cerrar.
async function procesarVencimientos() {
  if (!sb) return;
  const { error } = await sb.rpc('procesar_vencimientos');
  if (error) console.error(error);
}

function avisoHtml(clase, icono, texto) {
  return `<div class="aviso ${clase}"><i class="fas ${icono}"></i> ${texto}</div>`;
}

const AVISO_NO_CONFIGURADO = avisoHtml('error', 'fa-plug-circle-xmark',
  'El mercado todavía no está conectado a su base de datos. Vuelve pronto.');

// Pinta en `el` un aviso y devuelve false si la página no puede seguir (sin Supabase o, si se
// pide, sin sesión / sin admin). Espera a que se sepa si hay sesión.
async function exigirAcceso(el, { sesion = false, admin = false } = {}) {
  await cuentaLista;
  if (!sb) {
    el.innerHTML = AVISO_NO_CONFIGURADO;
    return false;
  }
  const usuario = getUsuarioActual();
  if ((sesion || admin) && !usuario) {
    el.innerHTML = `<div class="vacio"><i class="fas fa-lock"></i>Inicia sesión para ver esta página.<br><br>
      <button class="btn-mini primary" type="button" data-abrir-login><i class="fas fa-right-to-bracket"></i> Iniciar sesión</button></div>`;
    el.querySelector('[data-abrir-login]').addEventListener('click', () => openAuthModal('login'));
    return false;
  }
  if (admin && !usuario.esAdmin) {
    el.innerHTML = avisoHtml('error', 'fa-ban', 'Esta página es solo para administradores.');
    return false;
  }
  return true;
}

function visualHtml(imagen, clase) {
  return `<div class="${clase}">${imagen
    ? `<img src="${escapeHtml(imagen)}" alt="" loading="lazy" onerror="this.remove()">`
    : '<i class="fas fa-images"></i>'}</div>`;
}

function chipJuegoHtml(juego) {
  const meta = GAME_META[juego];
  return meta ? `<span class="chip ${juego}">${escapeHtml(meta.short)}</span>` : '';
}

// Desactiva `btn` mientras corre `accion` (evita doble envío) y devuelve lo que devuelva.
async function conBoton(btn, accion) {
  if (btn.disabled) return undefined;
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Un momento…';
  try {
    return await accion();
  } finally {
    btn.disabled = false;
    btn.innerHTML = html;
  }
}

// Llama una función RPC y lanza un Error con el mensaje ya traducido si falla.
async function rpc(nombre, params) {
  const { data, error } = await sb.rpc(nombre, params);
  if (error) throw new Error(mensajeError(error));
  return data;
}

// Lectura con error traducido.
async function leer(consulta) {
  const { data, error } = await consulta;
  if (error) throw new Error(mensajeError(error));
  return data || [];
}

// Repinta los elementos [data-fin] con el tiempo restante cada segundo; llama `alCerrar` una
// vez por cada elemento que llega a cero.
function iniciarRelojes(raiz, alCerrar) {
  const tick = () => {
    raiz.querySelectorAll('[data-fin]').forEach((el) => {
      const texto = tiempoRestante(el.dataset.fin);
      el.textContent = texto;
      if (texto === 'Cerrada' && !el.dataset.avisado && alCerrar) {
        el.dataset.avisado = '1';
        alCerrar();
      }
    });
  };
  tick();
  return setInterval(tick, 1000);
}

// Llama `fn` solo cuando cambia el usuario (inicia o cierra sesión, u otra cuenta), no en cada
// evento de Auth: supabase-js también avisa al recuperar el foco o refrescar el token.
function alCambiarUsuario(fn) {
  let anterior;
  cuentaLista.then(() => { anterior = getUsuarioActual()?.id || null; });
  document.addEventListener('cuenta:cambio', () => {
    const actual = getUsuarioActual()?.id || null;
    if (anterior === undefined || actual === anterior) return;
    anterior = actual;
    fn();
  });
}
