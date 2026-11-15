<script setup lang="ts">
import { JUEGOS } from '~/utils/catalogo'
import { LARGO_MINIMO_PASSWORD, mensajeError, validarPasswordNueva } from '~/utils/cuenta'
import {
  ESTADO_PUBLICACION, ESTADO_VENTA, agruparPujas, resumenPublicacion,
  type Compra, type MiPublicacion, type MiPuja,
} from '~/utils/mercado'
import { formatCLP, formatFecha } from '~/utils/subastas'

// Mi cuenta: compras (con pago simulado dentro del plazo), pujas, cartas publicadas y cambio de
// contraseña. Solo en el navegador y con sesión (nuxt.config.ts y el middleware). Lo que se ve
// lo filtra la RLS: cada usuario lee solo sus pujas, sus compras y sus publicaciones.
useHead({ title: 'Mi cuenta · Cambalache' })

const route = useRoute()
const supabase = useSupabaseClient()
const llamar = useRpc()
const { cuenta } = useCuenta()

const { data, error: errorCarga, refresh } = await useAsyncData('mi-cuenta', async () => {
  const id = cuenta.value?.id
  if (!id) return null
  const { error: errVenc } = await supabase.rpc('procesar_vencimientos')
  if (errVenc) console.error('procesar_vencimientos:', errVenc.message)
  const [compras, pujas, publicaciones] = await Promise.all([
    supabase.from('ventas').select('id, tipo, monto, estado, limite_pago, publicaciones(nombre, imagen, juego)')
      .eq('comprador_id', id).neq('estado', 'impaga').order('creada', { ascending: false }),
    supabase.from('pujas').select('monto, subastas(id, fin, estado, precio_actual, lider_id, publicaciones(nombre, imagen, juego))')
      .eq('usuario_id', id).order('creada', { ascending: false }).limit(200),
    supabase.from('publicaciones').select('id, juego, nombre, imagen, estado, motivo, subastas(id, ronda, precio_base, precio_actual, fin, estado), ventas(estado, monto, comision, pago_vendedor)')
      .eq('vendedor_id', id).order('creada', { ascending: false }),
  ])
  for (const r of [compras, pujas, publicaciones]) if (r.error) throw r.error
  return {
    compras: (compras.data ?? []) as unknown as Compra[],
    pujas: agruparPujas((pujas.data ?? []) as unknown as MiPuja[]),
    publicaciones: (publicaciones.data ?? []) as unknown as MiPublicacion[],
  }
}, { watch: [() => cuenta.value?.id] })

// Cada publicación con su ronda más reciente y su venta viva.
const publicaciones = computed(() => (data.value?.publicaciones ?? []).map(p => ({ ...p, ...resumenPublicacion(p) })))

// Al llegar con #compras, #pujas, … se baja a la sección una sola vez, cuando ya está pintada
// (los datos pueden llegar antes o después de montar; las recargas tras pagar no vuelven a saltar).
let bajado = false
function bajarAlAncla() {
  const el = route.hash && data.value ? document.getElementById(route.hash.slice(1)) : null
  if (bajado || !el) return
  bajado = true
  el.scrollIntoView()
}
onMounted(bajarAlAncla)
watch(data, bajarAlAncla, { flush: 'post' })

// Pagar y cancelar piden confirmación dentro de la página: una a la vez.
const confirmando = ref<{ accion: 'pagar' | 'cancelar', id: number } | null>(null)
const { enviando, error: errorAccion, enviar } = useEnvio()
const avisoAccion = ref('')

function pedir(accion: 'pagar' | 'cancelar', id: number) {
  errorAccion.value = ''
  avisoAccion.value = ''
  confirmando.value = { accion, id }
}
const pidiendo = (accion: 'pagar' | 'cancelar', id: number) => confirmando.value?.accion === accion && confirmando.value.id === id

function confirmar() {
  enviar(async () => {
    const c = confirmando.value
    if (!c) return
    try {
      if (c.accion === 'pagar') await llamar('simular_pago', { p_venta_id: c.id })
      else await llamar('cancelar_publicacion', { p_publicacion_id: c.id })
      avisoAccion.value = c.accion === 'pagar' ? 'Pago simulado registrado.' : 'Publicación cancelada.'
    }
    finally {
      confirmando.value = null
      await refresh()
    }
  })
}

// Imágenes que no cargaron (quedan con el fondo).
const imagenesFallidas = ref(new Set<string>())

// Cambio de contraseña.
const password = ref('')
const password2 = ref('')
const passwordOk = ref(false)
const envioPassword = useEnvio()

function guardarPassword() {
  passwordOk.value = false
  envioPassword.enviar(async () => {
    const invalido = validarPasswordNueva(password.value, password2.value)
    if (invalido) throw new Error(invalido)
    const { error: err } = await supabase.auth.updateUser({ password: password.value })
    if (err) throw err
    password.value = ''
    password2.value = ''
    passwordOk.value = true
  })
}
</script>

<template>
  <div class="mi-cuenta">
    <header class="portada">
      <h1>Mi cuenta</h1>
      <p>Hola, {{ cuenta?.nombre }}. Tus compras, tus pujas y tus cartas publicadas.</p>
    </header>

    <p class="aviso-simulado">
      <strong>Pagos en modo prueba:</strong> el botón "Pagar" simula el pago; no se cobra nada real.
    </p>
    <p v-if="avisoAccion" class="ok" role="status">{{ avisoAccion }}</p>
    <p v-if="errorAccion" class="error" role="alert">{{ errorAccion }}</p>

    <div v-if="errorCarga" class="estado" role="alert">
      <p class="error">No pudimos cargar tu cuenta. {{ mensajeError(errorCarga) }}</p>
      <button type="button" class="boton boton-secundario" @click="refresh()">Reintentar</button>
    </div>
    <p v-else-if="!data" class="estado">Cargando tu cuenta…</p>

    <template v-else>
      <h2 id="compras" class="seccion">Mis compras</h2>
      <p v-if="!data.compras.length" class="estado">Todavía no ganas ni compras ninguna carta.</p>
      <ul v-else class="items">
        <li v-for="v in data.compras" :key="v.id" class="item">
          <span class="item-visual">
            <img v-if="v.publicaciones?.imagen && !imagenesFallidas.has(`v${v.id}`)" :src="v.publicaciones.imagen" alt="" loading="lazy" @error="imagenesFallidas.add(`v${v.id}`)">
          </span>
          <div class="item-info">
            <strong>{{ v.publicaciones?.nombre ?? 'Carta' }}</strong>
            <span>
              <span class="estado-chip" :class="ESTADO_VENTA[v.estado].tono">{{ ESTADO_VENTA[v.estado].label }}</span>
              · {{ formatCLP(v.monto) }}<template v-if="v.tipo === 'compra_inmediata'"> · compra inmediata</template>
            </span>
            <template v-if="v.estado === 'pendiente_pago'">
              <span class="lote-nota">
                Paga antes del {{ formatFecha(v.limite_pago) }} (<RelojSubasta :fin="v.limite_pago" @cerrada="refresh()" />).
                Si no pagas a tiempo, la carta pasa al siguiente postor y tu cuenta se bloquea.
              </span>
              <div v-if="pidiendo('pagar', v.id)" class="confirmar" role="group" aria-label="Confirmar pago">
                <p>Esto SIMULA el pago de {{ formatCLP(v.monto) }}: no se cobra nada real. ¿Continuar?</p>
                <button type="button" class="boton" :disabled="enviando" @click="confirmar">{{ enviando ? 'Un momento…' : 'Sí, pagar (simulado)' }}</button>
                <button type="button" class="boton boton-secundario" :disabled="enviando" @click="confirmando = null">Cancelar</button>
              </div>
              <div v-else class="item-acciones">
                <button type="button" class="boton" :disabled="enviando" @click="pedir('pagar', v.id)">Pagar {{ formatCLP(v.monto) }} (simulado)</button>
              </div>
            </template>
            <span v-if="v.estado === 'despachada'" class="lote-nota">Ya te despachamos la carta.</span>
          </div>
        </li>
      </ul>

      <h2 id="pujas" class="seccion">Mis pujas</h2>
      <p v-if="!data.pujas.length" class="estado">
        Todavía no pujas en ninguna subasta. <NuxtLink to="/subastas">Ver subastas</NuxtLink>.
      </p>
      <ul v-else class="items">
        <li v-for="g in data.pujas" :key="g.subasta.id" class="item">
          <span class="item-visual">
            <img v-if="g.subasta.publicaciones?.imagen && !imagenesFallidas.has(`s${g.subasta.id}`)" :src="g.subasta.publicaciones.imagen" alt="" loading="lazy" @error="imagenesFallidas.add(`s${g.subasta.id}`)">
          </span>
          <div class="item-info">
            <strong><NuxtLink :to="`/subasta/${g.subasta.id}`">{{ g.subasta.publicaciones?.nombre ?? 'Carta' }}</NuxtLink></strong>
            <span>
              <span v-if="g.subasta.estado === 'activa'" class="estado-chip" :class="g.subasta.lider_id === cuenta?.id ? 'ok' : 'warn'">
                {{ g.subasta.lider_id === cuenta?.id ? 'Vas ganando' : 'Te superaron' }}
              </span>
              <span v-else class="estado-chip">{{ g.subasta.lider_id === cuenta?.id ? 'Cerrada · ganaste' : 'Cerrada' }}</span>
              · tu puja: {{ formatCLP(g.miMaxima) }} · actual: {{ formatCLP(g.subasta.precio_actual ?? g.miMaxima) }}
            </span>
            <span v-if="g.subasta.estado === 'activa'" class="lote-nota">Cierra en <RelojSubasta :fin="g.subasta.fin" @cerrada="refresh()" /></span>
          </div>
        </li>
      </ul>

      <h2 id="publicaciones" class="seccion">Mis cartas publicadas</h2>
      <p v-if="!publicaciones.length" class="estado">
        No publicaste cartas. <NuxtLink to="/publicar">Publicar una carta</NuxtLink>.
      </p>
      <template v-else>
        <p><NuxtLink to="/publicar" class="boton boton-secundario">Publicar otra carta</NuxtLink></p>
        <ul class="items">
          <li v-for="p in publicaciones" :key="p.id" class="item">
            <span class="item-visual">
              <img v-if="p.imagen && !imagenesFallidas.has(`p${p.id}`)" :src="p.imagen" alt="" loading="lazy" @error="imagenesFallidas.add(`p${p.id}`)">
            </span>
            <div class="item-info">
              <strong>
                <NuxtLink v-if="p.estado === 'en_subasta' && p.actual" :to="`/subasta/${p.actual.id}`">{{ p.nombre }}</NuxtLink>
                <template v-else>{{ p.nombre }}</template>
              </strong>
              <span>
                <span class="estado-chip" :class="ESTADO_PUBLICACION[p.estado].tono">{{ ESTADO_PUBLICACION[p.estado].label }}</span>
                · <span class="chip" :class="`chip-${p.juego}`">{{ JUEGOS[p.juego]?.corto ?? p.juego }}</span>
              </span>
              <span v-if="p.estado === 'pendiente_envio'" class="lote-nota">
                Envíanos la carta con el código <strong class="mono">#{{ p.id }}</strong>. Te escribimos con la dirección.
              </span>
              <span v-else-if="p.estado === 'en_subasta' && p.actual" class="lote-nota">
                Ronda {{ p.actual.ronda }} ·
                {{ p.actual.precio_actual ? `puja actual ${formatCLP(p.actual.precio_actual)}` : `precio base ${formatCLP(p.actual.precio_base)}, sin pujas` }}
                · cierra en <RelojSubasta :fin="p.actual.fin" @cerrada="refresh()" />
              </span>
              <span v-else-if="p.venta" class="lote-nota">
                Vendida en {{ formatCLP(p.venta.monto) }} · recibes {{ formatCLP(p.venta.pago_vendedor) }} (comisión {{ formatCLP(p.venta.comision) }})
                · {{ ESTADO_VENTA[p.venta.estado].label }}
              </span>
              <span v-else-if="p.motivo" class="lote-nota">{{ p.motivo }}</span>

              <template v-if="p.estado === 'pendiente_envio'">
                <div v-if="pidiendo('cancelar', p.id)" class="confirmar" role="group" aria-label="Confirmar cancelación">
                  <p>¿Cancelar esta publicación? Solo se puede mientras no hayas enviado la carta.</p>
                  <button type="button" class="boton" :disabled="enviando" @click="confirmar">{{ enviando ? 'Un momento…' : 'Sí, cancelar' }}</button>
                  <button type="button" class="boton boton-secundario" :disabled="enviando" @click="confirmando = null">No</button>
                </div>
                <div v-else class="item-acciones">
                  <button type="button" class="boton boton-secundario" :disabled="enviando" @click="pedir('cancelar', p.id)">Cancelar publicación</button>
                </div>
              </template>
            </div>
          </li>
        </ul>
      </template>
    </template>

    <h2 id="seguridad" class="seccion">Cambiar contraseña</h2>
    <form class="panel formulario-password" novalidate @submit.prevent="guardarPassword">
      <!-- Para que el gestor de contraseñas asocie la nueva al correo correcto. -->
      <input type="email" autocomplete="username" :value="cuenta?.email" hidden>
      <label for="password">Contraseña nueva (mínimo {{ LARGO_MINIMO_PASSWORD }} caracteres)</label>
      <input id="password" v-model="password" class="campo" type="password" autocomplete="new-password" :minlength="LARGO_MINIMO_PASSWORD" required>
      <label for="password2">Repetir contraseña</label>
      <input id="password2" v-model="password2" class="campo" type="password" autocomplete="new-password" :minlength="LARGO_MINIMO_PASSWORD" required>
      <p v-if="envioPassword.error.value" class="error" role="alert">{{ envioPassword.error.value }}</p>
      <p v-if="passwordOk" class="ok" role="status">Contraseña actualizada.</p>
      <button type="submit" class="boton" :disabled="envioPassword.enviando.value">
        {{ envioPassword.enviando.value ? 'Guardando…' : 'Guardar' }}
      </button>
    </form>
  </div>
</template>
