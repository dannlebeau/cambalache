<script setup lang="ts">
import type { Juego } from '~/utils/catalogo'
import { JUEGOS } from '~/utils/catalogo'
import { mensajeError } from '~/utils/cuenta'
import { CONSERVACION, filtrarSubastas, formatCLP, precioVisible, type SubastaPublica } from '~/utils/subastas'

// Listado de subastas activas. Se arma en el servidor (SEO: el HTML trae nombres y precios) y
// en el navegador se mantiene al día con Realtime. El filtro y la búsqueda son locales.
useSeoMeta({
  title: 'Subastas · Cambalache',
  description: 'Subastas de cartas de Yu-Gi-Oh!, Pokémon y Mitos y Leyendas en custodia de Cambalache.',
})

const supabase = useSupabaseClient()
const { cuenta } = useCuenta()

const { data: subastas, error, refresh } = await useAsyncData('subastas', async () => {
  // Cierra las vencidas antes de leer (pg_cron también lo hace cada minuto), para no mostrar
  // abierta una subasta que ya debió cerrar. Si falla, igual se lee.
  const { error: errVenc } = await supabase.rpc('procesar_vencimientos')
  if (errVenc) console.error('procesar_vencimientos:', errVenc.message)
  const { data, error: err } = await supabase
    .from('subastas_publicas')
    .select('*')
    .eq('estado', 'activa')
    .order('fin', { ascending: true })
  if (err) throw err
  return (data ?? []) as SubastaPublica[]
}, { default: () => [] })

const juego = ref<Juego | ''>('')
const texto = ref('')
const visibles = computed(() => filtrarSubastas(subastas.value, juego.value, texto.value))
const filtros: { valor: Juego | '', label: string }[] = [
  { valor: '', label: 'Todas' },
  ...(Object.keys(JUEGOS) as Juego[]).map(j => ({ valor: j, label: JUEGOS[j].label })),
]

// Si falla la imagen de una subasta, queda el fondo.
const imagenesFallidas = ref(new Set<number>())

useSubastasEnVivo(() => refresh())
</script>

<template>
  <div class="subastas">
    <header class="portada">
      <span class="antetitulo">Subastas · 3 días</span>
      <h1>Cartas en subasta</h1>
      <p>
        Cada carta ya está en custodia de Cambalache: la revisamos antes de publicarla. Puja o
        cómprala de inmediato; el ganador paga y se la despachamos.
      </p>
      <p><NuxtLink to="/publicar" class="boton boton-secundario">Publicar una carta</NuxtLink></p>
    </header>
    <p class="aviso-simulado">
      <strong>Pagos en modo prueba:</strong> las pujas y compras son reales dentro del sitio, pero el
      pago todavía es simulado y no se cobra nada.
    </p>

    <div class="pestanas" role="group" aria-label="Juego">
      <button
        v-for="f in filtros"
        :key="f.valor"
        type="button"
        class="pestana"
        :class="`pestana-${f.valor || 'todas'}`"
        :aria-pressed="juego === f.valor"
        @click="juego = f.valor"
      >
        {{ f.label }}
      </button>
    </div>
    <div class="controles">
      <input v-model="texto" class="campo" type="search" placeholder="Buscar por nombre…" aria-label="Buscar por nombre">
    </div>

    <div v-if="error" class="estado" role="alert">
      <p class="error">No pudimos cargar las subastas. {{ mensajeError(error) }}</p>
      <button type="button" class="boton boton-secundario" @click="refresh()">Reintentar</button>
    </div>
    <p v-else-if="!subastas.length" class="estado">No hay subastas abiertas en este momento.</p>
    <p v-else-if="!visibles.length" class="estado">Ninguna subasta coincide con el filtro.</p>
    <ul v-else class="grilla grilla-lotes">
      <li v-for="s in visibles" :key="s.id">
        <NuxtLink :to="`/subasta/${s.id}`" class="tarjeta lote">
          <span class="tarjeta-visual">
            <img
              v-if="s.imagen && !imagenesFallidas.has(s.id)"
              :src="s.imagen"
              alt=""
              loading="lazy"
              @error="imagenesFallidas.add(s.id)"
            >
            <span v-else class="sin-imagen" aria-hidden="true">Sin imagen</span>
            <span class="chip" :class="`chip-${s.juego}`">{{ JUEGOS[s.juego]?.corto ?? s.juego }}</span>
            <RelojSubasta class="lote-reloj" :fin="s.fin" @cerrada="refresh()" />
          </span>
          <span class="lote-cuerpo">
            <span class="tarjeta-nombre">{{ s.nombre }}</span>
            <span class="lote-nota">
              {{ CONSERVACION[s.conservacion] ?? s.conservacion }} · {{ s.num_pujas }} puja(s)<template v-if="s.ronda > 1"> · ronda {{ s.ronda }}</template>
            </span>
            <span class="lote-precio">
              {{ formatCLP(precioVisible(s).monto) }}
              <small>{{ precioVisible(s).etiqueta.toLowerCase() }}</small>
            </span>
            <span class="lote-nota">Cómprala ya: {{ formatCLP(s.precio_compra_inmediata) }}</span>
            <span v-if="cuenta && s.lider_id === cuenta.id" class="ok">Vas ganando</span>
          </span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
