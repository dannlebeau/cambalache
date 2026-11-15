// Lógica de publicar.html: el vendedor publica una carta (llega desde el catálogo o el canasto
// con ?juego=&ref=&nombre=&imagen=, o la escribe a mano). Queda "pendiente de envío" hasta
// que el admin recibe la carta física y la aprueba (ver assets/js/admin.js).

const params = new URLSearchParams(location.search);
let config = null;

function formularioHtml() {
  const juego = GAME_META[params.get('juego')] ? params.get('juego') : '';
  const desdeCatalogo = !!params.get('ref');
  return `
    <form class="panel" id="publicarForm" novalidate>
      <div class="fila-campos">
        <div class="campo">
          <label for="juego">Juego</label>
          <select id="juego" required ${desdeCatalogo ? 'disabled' : ''}>
            <option value="">Elige…</option>
            ${Object.entries(GAME_META).map(([k, m]) => `<option value="${k}" ${k === juego ? 'selected' : ''}>${escapeHtml(m.label)}</option>`).join('')}
          </select>
        </div>
        <div class="campo">
          <label for="nombre">Carta</label>
          <input id="nombre" maxlength="120" required value="${escapeHtml(params.get('nombre') || '')}" ${desdeCatalogo ? 'readonly' : ''}>
          ${desdeCatalogo ? '' : '<span class="ayuda">¿Es de Yu-Gi-Oh! o Pokémon? Mejor elígela en el <a href="index.html">catálogo</a> y aprieta "Subastar esta carta".</span>'}
        </div>
      </div>
      <div class="fila-campos">
        <div class="campo">
          <label for="conservacion">Estado de la carta</label>
          <select id="conservacion" required>
            <option value="">Elige…</option>
            ${Object.entries(CONSERVACION).map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join('')}
          </select>
          <span class="ayuda">Lo confirmamos al recibirla; si no coincide, te la devolvemos.</span>
        </div>
        <div class="campo">
          <label for="precioBase">Precio base (CLP)</label>
          <input id="precioBase" type="number" min="100" step="100" required inputmode="numeric">
          <span class="ayuda">La primera puja parte desde aquí.</span>
        </div>
        <div class="campo">
          <label for="precioMinimo">Precio mínimo (opcional)</label>
          <input id="precioMinimo" type="number" min="100" step="100" inputmode="numeric">
          <span class="ayuda">Si no se vende, se republica con −${Math.round(config.descuento_republicacion * 100)}% cada vez. Bajo este precio, te la devolvemos.</span>
        </div>
      </div>
      <div class="campo">
        <label for="notas">Notas para los compradores (opcional)</label>
        <textarea id="notas" maxlength="500" placeholder="Edición, idioma, detalles del estado…"></textarea>
      </div>
      <div class="panel" id="calculo" style="margin-bottom:1rem"></div>
      <label class="check">
        <input type="checkbox" id="aceptaTerminos">
        <span>Leí y acepto los <a href="terminos.html" target="_blank" rel="noopener">Términos y Condiciones</a>: envío la carta a Cambalache para que quede en custodia, y si se vende, Cambalache se queda con el ${Math.round(config.comision * 100)}% del monto final.</span>
      </label>
      <p class="verify-error" id="publicarError" role="alert"></p>
      <button class="btn-mini primary" type="submit"><i class="fas fa-paper-plane"></i> Publicar y enviar la carta</button>
    </form>`;
}

function renderCalculo() {
  const base = Number(document.getElementById('precioBase').value);
  const el = document.getElementById('calculo');
  if (!Number.isInteger(base) || base < 100) {
    el.innerHTML = '<span class="nota">Escribe un precio base para ver cuánto recibirías.</span>';
    return;
  }
  const comision = Math.round(base * config.comision);
  const compraYa = Math.round((base * (1 + Number(config.recargo_compra_inmediata))) / 100) * 100;
  el.innerHTML = `
    <strong>Si se vende al precio base (${formatCLP(base)}):</strong>
    recibes <strong>${formatCLP(base - comision)}</strong> y Cambalache ${formatCLP(comision)} (${Math.round(config.comision * 100)}%).
    <br><span class="nota">Las pujas pueden subir el precio. Mientras nadie puje, cualquiera puede comprarla de inmediato por ${formatCLP(compraYa)}. La subasta dura ${config.duracion_horas} horas.</span>`;
}

function exitoHtml(id, nombre) {
  return `
    <div class="panel">
      ${avisoHtml('ok', 'fa-circle-check', `Publicaste <strong>${escapeHtml(nombre)}</strong>. Código de envío: <strong class="mono">#${id}</strong>.`)}
      <h2 class="seccion" style="margin-top:0"><i class="fas fa-truck-fast"></i> Siguiente paso: envíanos la carta</h2>
      <ol style="padding-left:1.2rem;display:flex;flex-direction:column;gap:.4rem">
        <li>Te escribiremos al correo de tu cuenta con la dirección de envío.</li>
        <li>Envía la carta protegida (funda + toploader) y anota el código <strong class="mono">#${id}</strong> en el paquete.</li>
        <li>Cuando la recibamos y revisemos, sale a subasta y lo verás en <a href="mi-cuenta.html">Mi cuenta</a>.</li>
      </ol>
      <p style="margin-top:1rem"><a class="btn-mini" href="mi-cuenta.html"><i class="fas fa-circle-user"></i> Ir a Mi cuenta</a>
         <a class="btn-mini" href="publicar.html"><i class="fas fa-plus"></i> Publicar otra</a></p>
    </div>`;
}

async function enviarPublicacion(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const errEl = document.getElementById('publicarError');
  const juego = document.getElementById('juego').value;
  const nombre = document.getElementById('nombre').value.trim();
  const conservacion = document.getElementById('conservacion').value;
  const base = Number(document.getElementById('precioBase').value);
  const minimoTexto = document.getElementById('precioMinimo').value;
  const minimo = minimoTexto ? Number(minimoTexto) : null;

  errEl.textContent = '';
  if (!juego) return void (errEl.textContent = 'Elige el juego.');
  if (!nombre) return void (errEl.textContent = 'Escribe el nombre de la carta.');
  if (!conservacion) return void (errEl.textContent = 'Indica el estado de la carta.');
  if (!Number.isInteger(base) || base < 100) return void (errEl.textContent = 'El precio base debe ser un número entero de al menos $100.');
  if (minimo !== null && (!Number.isInteger(minimo) || minimo < 100 || minimo > base)) {
    return void (errEl.textContent = 'El precio mínimo debe estar entre $100 y el precio base.');
  }
  if (!document.getElementById('aceptaTerminos').checked) return void (errEl.textContent = 'Tienes que aceptar los Términos y Condiciones.');

  await conBoton(form.querySelector('button[type="submit"]'), async () => {
    try {
      const id = await rpc('publicar_carta', {
        p_juego: juego,
        p_carta_ref: params.get('ref') || `${juego}-manual-${Date.now()}`,
        p_nombre: nombre,
        p_imagen: (params.get('imagen') || '').startsWith('https://') ? params.get('imagen') : null,
        p_conservacion: conservacion,
        p_notas: document.getElementById('notas').value,
        p_precio_base: base,
        p_precio_minimo: minimo,
      });
      document.getElementById('contenido').innerHTML = exitoHtml(id, nombre);
    } catch (err) {
      errEl.textContent = err.message;
    }
  });
}

async function pintarPagina() {
  const el = document.getElementById('contenido');
  if (!(await exigirAcceso(el, { sesion: true }))) return;
  try {
    [config] = await leer(sb.from('configuracion').select('*').limit(1));
  } catch (err) {
    el.innerHTML = avisoHtml('error', 'fa-triangle-exclamation', escapeHtml(err.message));
    return;
  }
  const imagen = params.get('imagen');
  el.innerHTML = `${imagen ? `<div style="max-width:160px;margin-bottom:1.2rem">${visualHtml(imagen, 'detalle-visual')}</div>` : ''}${formularioHtml()}`;
  document.getElementById('precioBase').addEventListener('input', renderCalculo);
  document.getElementById('publicarForm').addEventListener('submit', enviarPublicacion);
  renderCalculo();
}

document.addEventListener('DOMContentLoaded', () => {
  pintarPagina();
  // Si inicia o cierra sesión aquí, se vuelve a pintar (sin perder el ?juego=… de la URL).
  alCambiarUsuario(pintarPagina);
});
