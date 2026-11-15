// Lógica de mi-cuenta.html: compras (con pago simulado dentro del plazo), pujas, cartas
// publicadas (con lo que recibirá el vendedor) y cambio de contraseña. Lo que se ve lo filtra
// la RLS: cada usuario solo lee sus pujas, sus compras y sus publicaciones.

function compraHtml(v) {
  const p = v.publicaciones || {};
  const pendiente = v.estado === 'pendiente_pago';
  return `
    <div class="item">
      ${visualHtml(p.imagen, 'item-visual')}
      <div class="item-info">
        <strong>${escapeHtml(p.nombre || 'Carta')}</strong>
        <span>${estadoHtml(ESTADO_VENTA, v.estado)} · ${formatCLP(v.monto)}${v.tipo === 'compra_inmediata' ? ' · compra inmediata' : ''}</span>
        ${pendiente ? `<span class="nota">Paga antes de: ${escapeHtml(formatFecha(v.limite_pago))} (<span data-fin="${escapeHtml(v.limite_pago)}"></span>). Si no pagas a tiempo, la carta pasa al siguiente postor y tu cuenta se bloquea.</span>` : ''}
        ${v.estado === 'despachada' ? '<span class="nota">Ya te despachamos la carta.</span>' : ''}
        ${pendiente ? `<div class="item-acciones"><button class="btn-mini primary" type="button" data-pagar="${v.id}"><i class="fas fa-credit-card"></i> Pagar ${formatCLP(v.monto)} (simulado)</button></div>` : ''}
      </div>
    </div>`;
}

function pujaHtml(grupo, usuarioId) {
  const s = grupo.subasta;
  const p = s.publicaciones || {};
  const activa = s.estado === 'activa';
  const ganando = s.lider_id === usuarioId;
  let estado;
  if (activa) estado = ganando ? '<span class="estado ok">Vas ganando</span>' : '<span class="estado warn">Te superaron</span>';
  else estado = `<span class="estado">${ganando ? 'Cerrada · ganaste' : 'Cerrada'}</span>`;
  return `
    <div class="item">
      ${visualHtml(p.imagen, 'item-visual')}
      <div class="item-info">
        <strong><a href="subasta.html?id=${s.id}">${escapeHtml(p.nombre || 'Carta')}</a></strong>
        <span>${estado} · tu puja: ${formatCLP(grupo.miMaxima)} · actual: ${formatCLP(s.precio_actual)}</span>
        ${activa ? `<span class="nota">Cierra en <span data-fin="${escapeHtml(s.fin)}"></span></span>` : ''}
      </div>
    </div>`;
}

function publicacionHtml(p) {
  const subastas = (p.subastas || []).slice().sort((a, b) => b.ronda - a.ronda);
  const actual = subastas[0];
  const venta = (p.ventas || []).find((v) => v.estado !== 'impaga');
  let detalle = '';
  if (p.estado === 'pendiente_envio') {
    detalle = `<span class="nota">Envíanos la carta con el código <strong class="mono">#${p.id}</strong>. Te escribimos con la dirección.</span>`;
  } else if (p.estado === 'en_subasta' && actual) {
    detalle = `<span class="nota">Ronda ${actual.ronda} · ${actual.precio_actual ? `puja actual ${formatCLP(actual.precio_actual)}` : `precio base ${formatCLP(actual.precio_base)}, sin pujas`} · cierra en <span data-fin="${escapeHtml(actual.fin)}"></span></span>`;
  } else if (venta) {
    detalle = `<span class="nota">Vendida en ${formatCLP(venta.monto)} · recibes ${formatCLP(venta.pago_vendedor)} (comisión ${formatCLP(venta.comision)}) · ${estadoHtml(ESTADO_VENTA, venta.estado)}</span>`;
  } else if (p.motivo) {
    detalle = `<span class="nota">${escapeHtml(p.motivo)}</span>`;
  }
  return `
    <div class="item">
      ${visualHtml(p.imagen, 'item-visual')}
      <div class="item-info">
        <strong>${actual && p.estado === 'en_subasta' ? `<a href="subasta.html?id=${actual.id}">${escapeHtml(p.nombre)}</a>` : escapeHtml(p.nombre)}</strong>
        <span>${estadoHtml(ESTADO_PUBLICACION, p.estado)} · ${chipJuegoHtml(p.juego)}</span>
        ${detalle}
        ${p.estado === 'pendiente_envio' ? `<div class="item-acciones"><button class="btn-mini peligro" type="button" data-cancelar="${p.id}"><i class="fas fa-xmark"></i> Cancelar publicación</button></div>` : ''}
      </div>
    </div>`;
}

function seccionHtml(id, icono, titulo, items, vacio) {
  return `
    <h2 class="seccion" id="${id}"><i class="fas ${icono}"></i> ${titulo}</h2>
    <div class="panel">${items.length ? items.join('') : `<p class="nota">${vacio}</p>`}</div>`;
}

// Agrupa mis pujas por subasta y se queda con mi puja más alta en cada una.
function agruparPujas(pujas) {
  const porSubasta = new Map();
  for (const p of pujas) {
    if (!p.subastas) continue;
    const g = porSubasta.get(p.subastas.id) || { subasta: p.subastas, miMaxima: 0 };
    g.miMaxima = Math.max(g.miMaxima, p.monto);
    porSubasta.set(p.subastas.id, g);
  }
  return [...porSubasta.values()].sort((a, b) => (a.subasta.estado === 'activa' ? -1 : 1) - (b.subasta.estado === 'activa' ? -1 : 1));
}

async function cargarCuenta() {
  const el = document.getElementById('contenido');
  if (!(await exigirAcceso(el, { sesion: true }))) return;
  const usuario = getUsuarioActual();
  document.getElementById('saludo').textContent = `Hola, ${usuario.nombre}. Tus cartas publicadas, tus pujas y tus compras.`;
  try {
    await procesarVencimientos();
    const [compras, pujas, publicaciones] = await Promise.all([
      leer(sb.from('ventas').select('*, publicaciones(nombre, imagen, juego)')
        .eq('comprador_id', usuario.id).neq('estado', 'impaga').order('creada', { ascending: false })),
      leer(sb.from('pujas').select('monto, subastas(id, fin, estado, precio_actual, lider_id, publicaciones(nombre, imagen, juego))')
        .eq('usuario_id', usuario.id).order('creada', { ascending: false }).limit(200)),
      leer(sb.from('publicaciones').select('*, subastas(id, ronda, precio_base, precio_actual, fin, estado), ventas(estado, monto, comision, pago_vendedor)')
        .eq('vendedor_id', usuario.id).order('creada', { ascending: false })),
    ]);

    el.innerHTML = `
      ${usuario.bloqueado ? avisoHtml('error', 'fa-ban', 'Tu cuenta está bloqueada (por ejemplo, por una compra sin pagar). Escríbenos para revisarla.') : ''}
      <div class="aviso simulado"><strong>Pagos en modo prueba:</strong> el botón "Pagar" simula el pago; no se cobra nada real.</div>
      ${seccionHtml('compras', 'fa-bag-shopping', 'Mis compras', compras.map(compraHtml), 'Todavía no ganas ni compras ninguna carta.')}
      ${seccionHtml('pujas', 'fa-gavel', 'Mis pujas', agruparPujas(pujas).map((g) => pujaHtml(g, usuario.id)), 'Todavía no pujas en ninguna subasta. <a href="subastas.html">Ver subastas</a>.')}
      ${seccionHtml('publicaciones', 'fa-tags', 'Mis cartas publicadas', publicaciones.map(publicacionHtml), 'No publicaste cartas. <a href="publicar.html">Publicar una carta</a>.')}
      <h2 class="seccion" id="seguridad"><i class="fas fa-key"></i> Cambiar contraseña</h2>
      <form class="panel" id="passCuentaForm" style="max-width:420px" novalidate>
        <input type="email" autocomplete="username" value="${escapeHtml(usuario.email)}" hidden>
        <div class="campo"><label for="passCuenta1">Contraseña nueva (mínimo 8 caracteres)</label><input type="password" id="passCuenta1" autocomplete="new-password" minlength="8" required></div>
        <div class="campo"><label for="passCuenta2">Repetir contraseña</label><input type="password" id="passCuenta2" autocomplete="new-password" minlength="8" required></div>
        <p class="verify-error" id="passCuentaError" role="alert"></p>
        <p class="verify-ok" id="passCuentaOk" style="display:none">Contraseña actualizada.</p>
        <button class="btn-mini primary" type="submit"><i class="fas fa-key"></i> Guardar</button>
      </form>
      <p class="nota" style="margin-top:1.5rem">Puntos de intercambio en este navegador: ${getPuntos()}.</p>`;
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
  } catch (err) {
    el.innerHTML = avisoHtml('error', 'fa-triangle-exclamation', escapeHtml(err.message));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('contenido');
  el.innerHTML = '<div class="vacio"><i class="fas fa-spinner fa-spin"></i>Cargando tu cuenta…</div>';
  cargarCuenta();
  iniciarRelojes(el, cargarCuenta);
  alCambiarUsuario(cargarCuenta);

  el.addEventListener('click', async (e) => {
    const pagar = e.target.closest('[data-pagar]');
    const cancelar = e.target.closest('[data-cancelar]');
    if (pagar) {
      if (!confirm('Esto SIMULA el pago: no se cobra nada real. ¿Continuar?')) return;
      await conBoton(pagar, async () => {
        try {
          await rpc('simular_pago', { p_venta_id: Number(pagar.dataset.pagar) });
          await cargarCuenta();
        } catch (err) {
          alert(err.message);
        }
      });
    } else if (cancelar) {
      if (!confirm('¿Cancelar esta publicación? Solo se puede mientras no hayas enviado la carta.')) return;
      await conBoton(cancelar, async () => {
        try {
          await rpc('cancelar_publicacion', { p_publicacion_id: Number(cancelar.dataset.cancelar) });
          await cargarCuenta();
        } catch (err) {
          alert(err.message);
        }
      });
    }
  });

  el.addEventListener('submit', async (e) => {
    if (e.target.id !== 'passCuentaForm') return;
    e.preventDefault();
    const errEl = document.getElementById('passCuentaError');
    const okEl = document.getElementById('passCuentaOk');
    const p1 = document.getElementById('passCuenta1').value;
    const p2 = document.getElementById('passCuenta2').value;
    errEl.textContent = '';
    okEl.style.display = 'none';
    if (p1.length < 8) return void (errEl.textContent = 'La contraseña debe tener al menos 8 caracteres.');
    if (p1 !== p2) return void (errEl.textContent = 'Las contraseñas no coinciden.');
    await conBoton(e.target.querySelector('button'), async () => {
      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) { errEl.textContent = mensajeError(error); return; }
      e.target.reset();
      okEl.style.display = 'block';
    });
  });
});
