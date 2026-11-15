// Lógica de subasta.html?id=N: detalle de una subasta, pujas en vivo (Supabase Realtime sobre
// la fila de `subastas`), historial anónimo y compra inmediata. Todas las reglas (mínimo,
// cierre, anti-sniping, no pujar la propia carta) las valida la base en `pujar` y
// `comprar_ahora`; aquí solo se muestran y se informa el error si lo hay.

const subastaId = Number(new URLSearchParams(location.search).get('id'));
let subasta = null;
let recargaPendiente = null;

function cifraHtml(etiqueta, valor) {
  return `<div class="cifra"><span>${etiqueta}</span><strong>${valor}</strong></div>`;
}

function accionesHtml(s) {
  if (s.estado !== 'activa') {
    const textos = {
      vendida: 'Esta subasta cerró con un ganador.',
      compra_inmediata: 'Alguien compró esta carta de inmediato.',
      sin_pujas: 'Cerró sin pujas; la carta vuelve a subasta con un 10% de descuento.',
    };
    return avisoHtml('', 'fa-flag-checkered', textos[s.resultado] || 'Esta subasta está cerrada.');
  }
  const usuario = getUsuarioActual();
  const vasGanando = usuario && s.lider_id === usuario.id;
  return `
    ${vasGanando ? avisoHtml('ok', 'fa-trophy', 'Vas ganando esta subasta.') : ''}
    <form class="puja-form" id="pujaForm" novalidate>
      <input type="number" id="pujaMonto" min="${s.puja_minima}" step="100" value="${s.puja_minima}"
             aria-label="Monto de tu puja en pesos" ${vasGanando ? 'disabled' : ''}>
      <button class="btn-mini primary" type="submit" ${vasGanando ? 'disabled' : ''}><i class="fas fa-gavel"></i> Pujar</button>
    </form>
    <p class="nota" style="margin:.5rem 0 1.2rem">Puja mínima: ${formatCLP(s.puja_minima)}. Si alguien puja en los últimos minutos, el cierre se alarga.</p>
    <button class="btn-mini" type="button" id="comprarBtn"><i class="fas fa-bolt"></i> Comprar ya por ${formatCLP(s.precio_compra_inmediata)}</button>
    <p class="nota" style="margin-top:.5rem">Comprar ya cierra la subasta al instante. Incluye un recargo sobre la puja actual por asegurar la carta.</p>
    <p class="verify-error" id="accionError" role="alert" style="margin-top:.8rem"></p>`;
}

function historialHtml(pujas) {
  if (!pujas.length) return '<div class="vacio">Todavía nadie puja. ¡Sé el primero!</div>';
  return `<div class="tabla-wrap"><table>
    <thead><tr><th>Postor</th><th>Monto</th><th>Cuándo</th></tr></thead>
    <tbody>${pujas.map((p) => `<tr><td>${escapeHtml(p.postor)}</td><td>${formatCLP(p.monto)}</td><td>${escapeHtml(formatFecha(p.creada))}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

function renderSubasta(s, pujas) {
  // Si llega una puja ajena mientras alguien escribe, se conserva su monto si sigue sirviendo.
  const escrito = Number(document.getElementById('pujaMonto')?.value);
  document.title = `${s.nombre} | Cambalache`;
  document.getElementById('contenido').innerHTML = `
    <div class="detalle">
      ${visualHtml(s.imagen, 'detalle-visual')}
      <div>
        ${chipJuegoHtml(s.juego)}
        <h1 style="margin:.6rem 0 .3rem">${escapeHtml(s.nombre)}</h1>
        <p class="nota">Estado: ${escapeHtml(CONSERVACION[s.conservacion] || s.conservacion)} · Ronda ${s.ronda} · En custodia de Cambalache</p>
        ${s.notas ? `<p style="margin-top:.6rem">${escapeHtml(s.notas)}</p>` : ''}
        <div class="cifras">
          ${cifraHtml(s.precio_actual ? 'Puja actual' : 'Precio base', formatCLP(s.precio_actual ?? s.precio_base))}
          ${cifraHtml('Pujas', s.num_pujas)}
          ${cifraHtml(s.estado === 'activa' ? 'Cierra en' : 'Cerró', s.estado === 'activa' ? `<span data-fin="${escapeHtml(s.fin)}"></span>` : escapeHtml(formatFecha(s.fin)))}
        </div>
        <div class="aviso simulado"><strong>Pago simulado:</strong> si ganas, el pago todavía es una simulación y no se cobra nada real.</div>
        ${accionesHtml(s)}
      </div>
    </div>
    <h2 class="seccion"><i class="fas fa-list-ol"></i> Historial de pujas</h2>
    ${historialHtml(pujas)}`;
  const input = document.getElementById('pujaMonto');
  if (input && !input.disabled && escrito > s.puja_minima) input.value = escrito;
  conectarAcciones();
}

async function cargarSubasta() {
  const el = document.getElementById('contenido');
  try {
    await procesarVencimientos();
    const filas = await leer(sb.from('subastas_publicas').select('*').eq('id', subastaId).limit(1));
    if (!filas.length) {
      el.innerHTML = '<div class="vacio"><i class="fas fa-circle-question"></i>Esta subasta no existe o ya no está disponible.</div>';
      return;
    }
    subasta = filas[0];
    const pujas = await rpc('historial_pujas', { p_subasta_id: subastaId });
    renderSubasta(subasta, pujas || []);
  } catch (err) {
    el.innerHTML = avisoHtml('error', 'fa-triangle-exclamation', escapeHtml(err.message));
  }
}

function programarRecarga() {
  clearTimeout(recargaPendiente);
  recargaPendiente = setTimeout(cargarSubasta, 300);
}

function conectarAcciones() {
  const form = document.getElementById('pujaForm');
  const comprarBtn = document.getElementById('comprarBtn');
  const errEl = document.getElementById('accionError');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!estaLogueado()) { openAuthModal('login'); return; }
    const monto = Number(document.getElementById('pujaMonto').value);
    if (!Number.isInteger(monto) || monto < subasta.puja_minima) {
      errEl.textContent = `La puja mínima es ${formatCLP(subasta.puja_minima)}.`;
      return;
    }
    errEl.textContent = '';
    await conBoton(form.querySelector('button'), async () => {
      try {
        await rpc('pujar', { p_subasta_id: subastaId, p_monto: monto });
        await cargarSubasta();
      } catch (err) {
        errEl.textContent = err.message;
        programarRecarga();
      }
    });
  });

  comprarBtn.addEventListener('click', async () => {
    if (!estaLogueado()) { openAuthModal('login'); return; }
    const precio = subasta.precio_compra_inmediata;
    if (!confirm(`¿Comprar "${subasta.nombre}" ahora por ${formatCLP(precio)}? La subasta se cierra y tendrás que pagar dentro del plazo.`)) return;
    errEl.textContent = '';
    await conBoton(comprarBtn, async () => {
      try {
        await rpc('comprar_ahora', { p_subasta_id: subastaId });
        location.href = 'mi-cuenta.html#compras';
      } catch (err) {
        errEl.textContent = err.message;
        programarRecarga();
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const el = document.getElementById('contenido');
  el.innerHTML = '<div class="vacio"><i class="fas fa-spinner fa-spin"></i>Cargando subasta…</div>';
  if (!(await exigirAcceso(el))) return;
  if (!Number.isInteger(subastaId) || subastaId <= 0) {
    el.innerHTML = '<div class="vacio"><i class="fas fa-circle-question"></i>Falta indicar qué subasta ver. <a href="subastas.html">Ver todas</a>.</div>';
    return;
  }

  await cargarSubasta();
  iniciarRelojes(el, programarRecarga);
  document.addEventListener('cuenta:cambio', cargarSubasta);

  sb.channel(`subasta-${subastaId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'subastas', filter: `id=eq.${subastaId}` }, programarRecarga)
    .subscribe();
});
