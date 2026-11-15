// Lógica de admin.html: recepción de cartas (aprobar/rechazar), subastas activas, ventas
// (despachar y liquidar 10/90), devoluciones, reglas de la subasta y mantenedor de usuarios.
// Cada acción llama una función admin_* de la base, que vuelve a verificar que quien la
// llama es admin: esconder esta página no es la seguridad, la RLS sí.

const PESTANAS = [
  ['recepcion', 'fa-inbox', 'Recepción'],
  ['subastas', 'fa-gavel', 'En subasta'],
  ['ventas', 'fa-truck-fast', 'Ventas'],
  ['devoluciones', 'fa-rotate-left', 'Devoluciones'],
  ['reglas', 'fa-sliders', 'Reglas'],
  ['usuarios', 'fa-users', 'Usuarios'],
];

let pestanaActual = (location.hash || '#recepcion').slice(1);
let datos = null;

function usuarioTexto(id) {
  const u = datos.usuarios.get(id);
  return u ? `${escapeHtml(u.nombre)} · <a href="mailto:${escapeHtml(u.email)}">${escapeHtml(u.email)}</a>` : '<span class="nota">usuario desconocido</span>';
}

function cartaHtml(p, extra, acciones) {
  return `
    <div class="item">
      ${visualHtml(p.imagen, 'item-visual')}
      <div class="item-info">
        <strong>${escapeHtml(p.nombre)} <span class="nota mono">#${p.id}</span></strong>
        <span>${chipJuegoHtml(p.juego)} ${escapeHtml(CONSERVACION[p.conservacion] || p.conservacion)}</span>
        ${extra}
        ${acciones ? `<div class="item-acciones">${acciones}</div>` : ''}
      </div>
    </div>`;
}

function listaHtml(items, vacio) {
  return `<div class="panel">${items.length ? items.join('') : `<p class="nota">${vacio}</p>`}</div>`;
}

function recepcionHtml() {
  const pendientes = datos.publicaciones.filter((p) => p.estado === 'pendiente_envio');
  return `
    <p class="nota" style="margin-bottom:1rem">Aprueba una carta solo cuando la tengas en tus manos y coincida con lo declarado. Al aprobarla sale a subasta por ${datos.config.duracion_horas} horas.</p>
    ${listaHtml(pendientes.map((p) => cartaHtml(p, `
      <span class="nota">Vendedor: ${usuarioTexto(p.vendedor_id)}</span>
      <span class="nota">Precio base ${formatCLP(p.precio_base)}${p.precio_minimo ? ` · mínimo ${formatCLP(p.precio_minimo)}` : ''} · publicada ${escapeHtml(formatFecha(p.creada))}</span>
      ${p.notas ? `<span class="nota">"${escapeHtml(p.notas)}"</span>` : ''}`,
      `<button class="btn-mini primary" type="button" data-accion="aprobar" data-id="${p.id}"><i class="fas fa-check"></i> Recibida y aprobada</button>
       <button class="btn-mini peligro" type="button" data-accion="rechazar" data-id="${p.id}"><i class="fas fa-xmark"></i> Rechazar</button>`)),
      'No hay cartas esperando recepción.')}`;
}

function subastasHtml() {
  return listaHtml(datos.subastas.map((s) => `
    <div class="item">
      ${visualHtml(s.imagen, 'item-visual')}
      <div class="item-info">
        <strong><a href="subasta.html?id=${s.id}">${escapeHtml(s.nombre)}</a> <span class="nota mono">#${s.publicacion_id}</span></strong>
        <span class="nota">Ronda ${s.ronda} · ${s.precio_actual ? `puja actual ${formatCLP(s.precio_actual)} (${s.num_pujas})` : `base ${formatCLP(s.precio_base)}, sin pujas`} · cierra en <span data-fin="${escapeHtml(s.fin)}"></span></span>
      </div>
    </div>`), 'No hay subastas activas.');
}

function ventaHtml(v) {
  const p = v.publicaciones || {};
  let acciones = '';
  let detalle = `<span class="nota">Comprador: ${usuarioTexto(v.comprador_id)}</span>`;
  if (v.estado === 'pendiente_pago') {
    detalle += `<span class="nota">Debe pagar antes de ${escapeHtml(formatFecha(v.limite_pago))}</span>`;
  } else if (v.estado === 'pagada') {
    acciones = `<button class="btn-mini primary" type="button" data-accion="despachar" data-id="${v.id}"><i class="fas fa-truck-fast"></i> Marcar despachada</button>`;
  } else if (v.estado === 'despachada') {
    detalle += `<span class="nota">Transferir al vendedor ${usuarioTexto(p.vendedor_id)}: <strong>${formatCLP(v.pago_vendedor)}</strong></span>`;
    acciones = `<button class="btn-mini primary" type="button" data-accion="liquidar" data-id="${v.id}"><i class="fas fa-money-bill-transfer"></i> Ya transferí al vendedor</button>`;
  }
  return cartaHtml({ ...p, id: v.publicacion_id }, `
    <span>${estadoHtml(ESTADO_VENTA, v.estado)} · ${formatCLP(v.monto)} → comisión ${formatCLP(v.comision)} · vendedor ${formatCLP(v.pago_vendedor)}</span>
    ${detalle}`, acciones);
}

function ventasHtml() {
  const orden = ['pagada', 'despachada', 'pendiente_pago', 'liquidada', 'impaga'];
  const ventas = datos.ventas.slice().sort((a, b) => orden.indexOf(a.estado) - orden.indexOf(b.estado));
  const liquidadas = datos.ventas.filter((v) => v.estado === 'liquidada');
  const comision = liquidadas.reduce((t, v) => t + v.comision, 0);
  return `
    <div class="cifras">
      <div class="cifra"><span>Por despachar</span><strong>${datos.ventas.filter((v) => v.estado === 'pagada').length}</strong></div>
      <div class="cifra"><span>Por liquidar</span><strong>${datos.ventas.filter((v) => v.estado === 'despachada').length}</strong></div>
      <div class="cifra"><span>Comisión liquidada</span><strong>${formatCLP(comision)}</strong></div>
    </div>
    <div class="aviso simulado"><strong>Pagos simulados:</strong> "pagada" significa que el comprador apretó el pago de prueba; no entró dinero real.</div>
    ${listaHtml(ventas.map(ventaHtml), 'Todavía no hay ventas.')}`;
}

function devolucionesHtml() {
  const lista = datos.publicaciones.filter((p) => p.estado === 'por_devolver');
  return listaHtml(lista.map((p) => cartaHtml(p, `
    <span class="nota">Devolver a: ${usuarioTexto(p.vendedor_id)}</span>
    ${p.motivo ? `<span class="nota">Motivo: ${escapeHtml(p.motivo)}</span>` : ''}`,
    `<button class="btn-mini primary" type="button" data-accion="devuelta" data-id="${p.id}"><i class="fas fa-check"></i> Ya la devolví</button>`)),
  'No hay cartas por devolver.');
}

function reglasHtml() {
  const c = datos.config;
  const pct = (v) => Math.round(Number(v) * 10000) / 100;
  const campo = (id, etiqueta, valor, ayuda, paso = '1') => `
    <div class="campo"><label for="${id}">${etiqueta}</label>
      <input type="number" id="${id}" value="${valor}" step="${paso}" min="0" required>
      <span class="ayuda">${ayuda}</span></div>`;
  return `
    <form class="panel" id="reglasForm" novalidate>
      <div class="fila-campos">
        ${campo('rDuracion', 'Duración de la subasta (horas)', c.duracion_horas, 'Entre 1 y 720.')}
        ${campo('rComision', 'Comisión de Cambalache (%)', pct(c.comision), 'Sobre el monto final pagado.', '0.01')}
        ${campo('rRecargo', 'Recargo de compra inmediata (%)', pct(c.recargo_compra_inmediata), 'Sobre la puja actual o el precio base.', '0.01')}
        ${campo('rDescuento', 'Descuento al republicar (%)', pct(c.descuento_republicacion), 'Cuando cierra sin venta.', '0.01')}
        ${campo('rIncPct', 'Incremento mínimo de puja (%)', pct(c.incremento_pct), 'Sobre la puja actual.', '0.01')}
        ${campo('rIncClp', 'Incremento mínimo de puja (CLP)', c.incremento_min_clp, 'Se usa el mayor de los dos incrementos.')}
        ${campo('rAntisniping', 'Anti-sniping (minutos)', c.antisniping_minutos, 'Una puja en los últimos N minutos alarga el cierre N minutos. 0 lo desactiva.')}
        ${campo('rPlazo', 'Plazo de pago del ganador (horas)', c.plazo_pago_horas, 'Después, la carta pasa al siguiente postor.')}
      </div>
      <p class="nota" style="margin-bottom:1rem">Los cambios aplican a las pujas y cierres desde ahora; no alteran ventas ya creadas.</p>
      <p class="verify-error" id="reglasError" role="alert"></p>
      <p class="verify-ok" id="reglasOk" style="display:none">Reglas guardadas.</p>
      <button class="btn-mini primary" type="submit"><i class="fas fa-floppy-disk"></i> Guardar reglas</button>
    </form>`;
}

function usuariosHtml() {
  const yo = getUsuarioActual().id;
  const filas = [...datos.usuarios.values()].map((u) => `
    <tr>
      <td>${escapeHtml(u.nombre)}${u.id === yo ? ' <span class="nota">(tú)</span>' : ''}</td>
      <td><a href="mailto:${escapeHtml(u.email)}">${escapeHtml(u.email)}</a></td>
      <td>${escapeHtml(formatFecha(u.creado))}</td>
      <td><label class="check" style="margin:0"><input type="checkbox" data-usuario="${u.id}" data-campo="es_admin" ${u.es_admin ? 'checked' : ''} ${u.id === yo ? 'disabled' : ''}> Admin</label></td>
      <td><label class="check" style="margin:0"><input type="checkbox" data-usuario="${u.id}" data-campo="bloqueado" ${u.bloqueado ? 'checked' : ''} ${u.id === yo ? 'disabled' : ''}> Bloqueado</label></td>
    </tr>`).join('');
  return `
    <p class="nota" style="margin-bottom:1rem">Para sumar un admin, la persona crea su cuenta en el sitio y aquí le marcas "Admin". Un usuario bloqueado no puede pujar, comprar ni publicar.</p>
    <div class="panel tabla-wrap"><table>
      <thead><tr><th>Nombre</th><th>Correo</th><th>Creado</th><th></th><th></th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>`;
}

const RENDER = {
  recepcion: recepcionHtml,
  subastas: subastasHtml,
  ventas: ventasHtml,
  devoluciones: devolucionesHtml,
  reglas: reglasHtml,
  usuarios: usuariosHtml,
};

function contadores() {
  return {
    recepcion: datos.publicaciones.filter((p) => p.estado === 'pendiente_envio').length,
    subastas: datos.subastas.length,
    ventas: datos.ventas.filter((v) => ['pagada', 'despachada'].includes(v.estado)).length,
    devoluciones: datos.publicaciones.filter((p) => p.estado === 'por_devolver').length,
  };
}

function renderPanel() {
  if (!RENDER[pestanaActual]) pestanaActual = 'recepcion';
  const n = contadores();
  document.getElementById('contenido').innerHTML = `
    <div class="pestanas" role="tablist">
      ${PESTANAS.map(([id, icono, texto]) => `
        <button class="pestana ${id === pestanaActual ? 'activa' : ''}" type="button" role="tab" aria-selected="${id === pestanaActual}" data-pestana="${id}">
          <i class="fas ${icono}"></i> ${texto}${n[id] ? `<span class="contador">${n[id]}</span>` : ''}
        </button>`).join('')}
    </div>
    <div id="panel">${RENDER[pestanaActual]()}</div>`;
}

async function cargarPanel() {
  const el = document.getElementById('contenido');
  if (!(await exigirAcceso(el, { admin: true }))) return;
  try {
    await procesarVencimientos();
    const [publicaciones, subastas, ventas, usuarios, config] = await Promise.all([
      leer(sb.from('publicaciones').select('*').order('creada', { ascending: true })),
      leer(sb.from('subastas_publicas').select('*').eq('estado', 'activa').order('fin', { ascending: true })),
      leer(sb.from('ventas').select('*, publicaciones(nombre, imagen, juego, conservacion, vendedor_id)').order('creada', { ascending: false })),
      rpc('admin_listar_usuarios'),
      leer(sb.from('configuracion').select('*').limit(1)),
    ]);
    datos = { publicaciones, subastas, ventas, usuarios: new Map((usuarios || []).map((u) => [u.id, u])), config: config[0] };
    renderPanel();
  } catch (err) {
    el.innerHTML = avisoHtml('error', 'fa-triangle-exclamation', escapeHtml(err.message));
  }
}

async function ejecutarAccion(btn) {
  const id = Number(btn.dataset.id);
  const acciones = {
    aprobar: () => rpc('admin_aprobar', { p_publicacion_id: id }),
    rechazar: () => {
      const motivo = prompt('Motivo del rechazo (lo verá el vendedor):');
      if (motivo === null) return null;
      return rpc('admin_rechazar', { p_publicacion_id: id, p_motivo: motivo });
    },
    devuelta: () => rpc('admin_marcar_devuelta', { p_publicacion_id: id }),
    despachar: () => rpc('admin_avanzar_venta', { p_venta_id: id, p_estado: 'despachada' }),
    liquidar: () => (confirm('¿Confirmas que ya transferiste el pago al vendedor?')
      ? rpc('admin_avanzar_venta', { p_venta_id: id, p_estado: 'liquidada' }) : null),
  };
  await conBoton(btn, async () => {
    try {
      const resultado = acciones[btn.dataset.accion]();
      if (resultado === null) return;
      await resultado;
      await cargarPanel();
    } catch (err) {
      alert(err.message);
    }
  });
}

async function guardarReglas(form) {
  const errEl = document.getElementById('reglasError');
  const okEl = document.getElementById('reglasOk');
  const num = (id) => Number(document.getElementById(id).value);
  const pct = (id) => num(id) / 100;
  errEl.textContent = '';
  okEl.style.display = 'none';
  await conBoton(form.querySelector('button[type="submit"]'), async () => {
    try {
      await rpc('admin_actualizar_configuracion', {
        p_duracion_horas: num('rDuracion'),
        p_incremento_pct: pct('rIncPct'),
        p_incremento_min_clp: num('rIncClp'),
        p_recargo_compra_inmediata: pct('rRecargo'),
        p_comision: pct('rComision'),
        p_descuento_republicacion: pct('rDescuento'),
        p_antisniping_minutos: num('rAntisniping'),
        p_plazo_pago_horas: num('rPlazo'),
      });
      [datos.config] = await leer(sb.from('configuracion').select('*').limit(1));
      okEl.style.display = 'block';
    } catch (err) {
      errEl.textContent = /check constraint|violates/i.test(err.message)
        ? 'Algún valor está fuera de rango. Revisa los límites de cada campo.' : err.message;
    }
  });
}

async function cambiarUsuario(input) {
  const u = datos.usuarios.get(input.dataset.usuario);
  const cambios = { es_admin: u.es_admin, bloqueado: u.bloqueado, [input.dataset.campo]: input.checked };
  input.disabled = true;
  try {
    await rpc('admin_definir_usuario', { p_usuario_id: u.id, p_es_admin: cambios.es_admin, p_bloqueado: cambios.bloqueado });
    Object.assign(u, cambios);
  } catch (err) {
    input.checked = !input.checked;
    alert(err.message);
  } finally {
    input.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('contenido');
  el.innerHTML = '<div class="vacio"><i class="fas fa-spinner fa-spin"></i>Cargando panel…</div>';
  cargarPanel();
  iniciarRelojes(el, cargarPanel);
  alCambiarUsuario(cargarPanel);

  el.addEventListener('click', (e) => {
    const pestana = e.target.closest('[data-pestana]');
    const accion = e.target.closest('[data-accion]');
    if (pestana) {
      pestanaActual = pestana.dataset.pestana;
      history.replaceState(null, '', '#' + pestanaActual);
      renderPanel();
    } else if (accion) {
      ejecutarAccion(accion);
    }
  });
  el.addEventListener('change', (e) => {
    if (e.target.matches('[data-usuario]')) cambiarUsuario(e.target);
  });
  el.addEventListener('submit', (e) => {
    if (e.target.id !== 'reglasForm') return;
    e.preventDefault();
    guardarReglas(e.target);
  });
});
