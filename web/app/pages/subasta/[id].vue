<script setup lang="ts">
import { JUEGOS } from '~/utils/catalogo'
import { mensajeError } from '~/utils/cuenta'
import {
  CONSERVACION, TEXTO_RESULTADO, formatCLP, formatFecha, idSubasta, precioVisible, validarPuja,
  type PujaHistorial, type SubastaPublica,
} from '~/utils/subastas'

// Detalle de una subasta: se arma en el servidor (SEO) y en el navegador sigue en vivo con
// Realtime. Pujar y comprar los valida Postgres (`pujar`, `comprar_ahora`); aquí solo se
// evita el doble envío y se muestra el error que devuelva la base.
const route = useRoute()
const supabase = useSupabaseClient()
const { cuenta } = useCuenta()
// Sin tipos generados de la base (supabase.types: false), `rpc` no acepta argumentos tipados.
type Rpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

const id = idSubasta(route.params.id)
if (!id) throw createError({ statusCode: 404, statusMessage: 'Subasta no encontrada', fatal: true })

const { data, error: errorCarga, refresh } = await useAsyncData(`subasta-${id}`, async () => {
  const { error: errVenc } = await supabase.rpc('procesar_vencimientos')
  if (errVenc) console.error('procesar_vencimientos:', errVenc.message)
  const [sub, hist] = await Promise.all([
    supabase.from('subastas_publicas').select('*').eq('id', id).maybeSingle(),
    rpc('historial_pujas', { p_subasta_id: id }),
  ])
  if (sub.error) throw sub.error
  if (hist.error) throw hist.error
  return { subasta: sub.data as SubastaPublica | null, pujas: (hist.data ?? []) as PujaHistorial[] }
})

// Si no existe (o la publicación no es visible), 404 de verdad, también para buscadores.
if (!errorCarga.value && !data.value?.subasta) {
  throw createError({ statusCode: 404, statusMessage: 'Subasta no encontrada', fatal: true })
}

const subasta = computed(() => data.value?.subasta ?? null)
const pujas = computed(() => data.value?.pujas ?? [])
const activa = computed(() => subasta.value?.estado === 'activa')
const vasGanando = computed(() => !!cuenta.value && subasta.value?.lider_id === cuenta.value.id)

useSeoMeta({
  title: () => subasta.value ? `${subasta.value.nombre} · Subastas · Cambalache` : 'Subasta · Cambalache',
  description: () => {
    const s = subasta.value
    if (!s) return 'Detalle de una subasta de Cambalache.'
    const p = precioVisible(s)
    return `${s.nombre} (${JUEGOS[s.juego]?.label ?? s.juego}) en subasta: ${p.etiqueta.toLowerCase()} ${formatCLP(p.monto)}. Cierra el ${formatFecha(s.fin)}`
  },
  ogImage: () => subasta.value?.imagen ?? undefined,
})

const { enviando, error, enviar } = useEnvio()
const exito = ref('')
const monto = ref<number | ''>(subasta.value?.puja_minima ?? '')
const confirmando = ref(false)
const imagenFallo = ref(false)

// Si llega una puja ajena, se conserva lo escrito mientras siga alcanzando la nueva mínima.
watch(() => subasta.value?.puja_minima, (minima) => {
  if (minima && (typeof monto.value !== 'number' || monto.value < minima)) monto.value = minima
})

async function exigirSesion(): Promise<boolean> {
  if (cuenta.value) return true
  await navigateTo({ path: '/entrar', query: { volver: route.fullPath } })
  return false
}

function pujar() {
  enviar(async () => {
    exito.value = ''
    const s = subasta.value
    if (!s || !(await exigirSesion())) return
    const invalido = validarPuja(monto.value, s.puja_minima)
    if (invalido) throw new Error(invalido)
    try {
      const { error: err } = await rpc('pujar', { p_subasta_id: s.id, p_monto: monto.value })
      if (err) throw err
      exito.value = `Tu puja de ${formatCLP(monto.value as number)} quedó registrada.`
    }
    finally {
      // Con o sin error se recarga: si otra persona pujó antes, la mínima ya cambió.
      await refresh()
    }
  })
}

async function pedirConfirmacion() {
  exito.value = ''
  error.value = ''
  if (await exigirSesion()) confirmando.value = true
}

function comprar() {
  enviar(async () => {
    const s = subasta.value
    if (!s) return
    try {
      const { error: err } = await rpc('comprar_ahora', { p_subasta_id: s.id })
      if (err) throw err
      exito.value = `Compraste "${s.nombre}". Tienes un plazo para pagar (simulado) desde Mi cuenta.`
    }
    finally {
      confirmando.value = false
      await refresh()
    }
  })
}

useSubastasEnVivo(() => refresh(), { id, ms: 300 })
</script>

<template>
  <div class="subasta">
    <p class="volver"><NuxtLink to="/subastas">← Todas las subastas</NuxtLink></p>

    <div v-if="errorCarga" class="estado" role="alert">
      <p class="error">No pudimos cargar la subasta. {{ mensajeError(errorCarga) }}</p>
      <button type="button" class="boton boton-secundario" @click="refresh()">Reintentar</button>
    </div>

    <template v-else-if="subasta">
      <article class="ficha">
        <div class="ficha-visual">
          <img v-if="subasta.imagen && !imagenFallo" :src="subasta.imagen" alt="" @error="imagenFallo = true">
          <span v-else class="sin-imagen" aria-hidden="true">Sin imagen</span>
        </div>
        <div class="ficha-info">
          <span class="chip" :class="`chip-${subasta.juego}`">{{ JUEGOS[subasta.juego]?.corto ?? subasta.juego }}</span>
          <h1>{{ subasta.nombre }}</h1>
          <p class="lote-nota">
            Estado: {{ CONSERVACION[subasta.conservacion] ?? subasta.conservacion }} · Ronda {{ subasta.ronda }} · En custodia de Cambalache
          </p>
          <p v-if="subasta.notas" class="ficha-notas">{{ subasta.notas }}</p>

          <dl class="cifras">
            <div>
              <dt>{{ precioVisible(subasta).etiqueta }}</dt>
              <dd>{{ formatCLP(precioVisible(subasta).monto) }}</dd>
            </div>
            <div>
              <dt>Pujas</dt>
              <dd>{{ subasta.num_pujas }}</dd>
            </div>
            <div>
              <dt>{{ activa ? 'Cierra en' : 'Cerró' }}</dt>
              <dd>
                <RelojSubasta v-if="activa" :fin="subasta.fin" @cerrada="refresh()" />
                <time v-else :datetime="subasta.fin">{{ formatFecha(subasta.fin) }}</time>
              </dd>
            </div>
          </dl>

          <p class="aviso-simulado">
            <strong>Pago simulado:</strong> si ganas, el pago todavía es una simulación y no se cobra nada real.
          </p>

          <p v-if="exito" class="ok" role="status">{{ exito }}</p>

          <template v-if="activa">
            <p v-if="vasGanando" class="ok">Vas ganando esta subasta.</p>
            <form class="puja-form" novalidate @submit.prevent="pujar">
              <label for="monto" class="sr-only">Monto de tu puja en pesos</label>
              <input
                id="monto"
                v-model.number="monto"
                class="campo"
                type="number"
                inputmode="numeric"
                :min="subasta.puja_minima"
                step="100"
                :disabled="vasGanando"
              >
              <button type="submit" class="boton" :disabled="enviando || vasGanando">
                {{ enviando ? 'Un momento…' : 'Pujar' }}
              </button>
            </form>
            <p class="lote-nota">
              Puja mínima: {{ formatCLP(subasta.puja_minima) }}. Si alguien puja en los últimos minutos, el cierre se alarga.
            </p>

            <div class="comprar">
              <button v-if="!confirmando" type="button" class="boton boton-secundario" :disabled="enviando" @click="pedirConfirmacion">
                Comprar ya por {{ formatCLP(subasta.precio_compra_inmediata) }}
              </button>
              <div v-else class="confirmar" role="group" aria-label="Confirmar compra">
                <p>
                  ¿Comprar "{{ subasta.nombre }}" ahora por {{ formatCLP(subasta.precio_compra_inmediata) }}? La subasta
                  se cierra y tendrás que pagar dentro del plazo.
                </p>
                <button type="button" class="boton" :disabled="enviando" @click="comprar">
                  {{ enviando ? 'Un momento…' : 'Sí, comprar' }}
                </button>
                <button type="button" class="boton boton-secundario" :disabled="enviando" @click="confirmando = false">Cancelar</button>
              </div>
              <p class="lote-nota">Comprar ya cierra la subasta al instante. Incluye un recargo sobre la puja actual por asegurar la carta.</p>
            </div>
          </template>
          <p v-else class="cerrada">{{ TEXTO_RESULTADO[subasta.resultado ?? ''] ?? 'Esta subasta está cerrada.' }}</p>

          <p v-if="error" class="error" role="alert">{{ error }}</p>
        </div>
      </article>

      <h2 class="seccion">Historial de pujas</h2>
      <p v-if="!pujas.length" class="estado">Todavía nadie puja. ¡Sé el primero!</p>
      <div v-else class="tabla-wrap">
        <table>
          <thead><tr><th scope="col">Postor</th><th scope="col">Monto</th><th scope="col">Cuándo</th></tr></thead>
          <tbody>
            <tr v-for="(p, i) in pujas" :key="`${p.creada}-${i}`">
              <td>{{ p.postor }}</td>
              <td>{{ formatCLP(p.monto) }}</td>
              <td><time :datetime="p.creada">{{ formatFecha(p.creada) }}</time></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
