<script setup lang="ts">
import { JUEGOS, TIPOS, type Carta, type Juego } from '~/utils/catalogo'

// Catálogo de la portada. El servidor manda la estructura y las cartas se cargan en el
// navegador (ver PLAN.md, 4.3): así el SSR no espera a las APIs externas.
useHead({ title: 'Cambalache · Cartas para ver, cartas para cambiar' })

const cat = useCatalogo()
const busqueda = ref('')
const montado = ref(false)
const seleccionada = shallowRef<Carta | null>(null)

const juegos = Object.keys(JUEGOS) as Juego[]
const formato = new Intl.NumberFormat('es-CL')

const nota = computed(() => {
  if (cat.juego.value === 'myl') return `${cat.total.value} carta(s) de ejemplo, sin API pública oficial · orden por ID`
  if (!cat.cartas.value.length) return ''
  return `Mostrando ${formato.format(cat.cartas.value.length)} de ${formato.format(cat.total.value)} cartas · orden por ID`
})

// Antes de montar (HTML del servidor) se muestra "Cargando", no "sin resultados".
const estado = computed<'cargando' | 'error' | 'vacio' | null>(() => {
  if (cat.cartas.value.length) return null
  if (!montado.value || cat.cargando.value) return 'cargando'
  if (cat.error.value) return 'error'
  return 'vacio'
})

function elegirJuego(j: Juego) {
  busqueda.value = ''
  cat.cambiarJuego(j)
}

onMounted(() => {
  montado.value = true
  cat.iniciar()
})
</script>

<template>
  <div class="catalogo">
    <section class="portada">
      <p class="antetitulo">Yu-Gi-Oh! · Pokémon · Mitos y Leyendas</p>
      <h1>Cartas para ver, cartas para <em>cambiar</em></h1>
      <p>Busca entre miles de cartas reales de tres juegos distintos, ordenadas por ID.</p>
    </section>

    <div class="pestanas" role="group" aria-label="Juego">
      <button
        v-for="j in juegos"
        :key="j"
        type="button"
        class="pestana"
        :class="`pestana-${j}`"
        :aria-pressed="cat.juego.value === j"
        @click="elegirJuego(j)"
      >
        {{ JUEGOS[j].label }}
      </button>
    </div>

    <div class="controles">
      <input
        v-model="busqueda"
        type="search"
        class="campo"
        placeholder="Buscar por nombre..."
        aria-label="Buscar por nombre"
        maxlength="100"
        @input="cat.buscar(busqueda)"
      >
      <select
        class="campo"
        aria-label="Filtrar por tipo"
        :value="cat.tipo.value"
        @change="cat.cambiarTipo(($event.target as HTMLSelectElement).value)"
      >
        <option value="">Todos los tipos</option>
        <option v-for="t in TIPOS[cat.juego.value]" :key="t" :value="t">{{ t }}</option>
      </select>
    </div>

    <p class="nota-resultados" aria-live="polite">{{ nota }}</p>

    <ul v-if="cat.cartas.value.length" class="grilla">
      <li v-for="c in cat.cartas.value" :key="c.id">
        <TarjetaCarta :carta="c" @abrir="seleccionada = c" />
      </li>
    </ul>

    <div v-if="estado" class="estado" role="status">
      <p v-if="estado === 'cargando'">Cargando cartas…</p>
      <p v-else-if="estado === 'vacio'">No encontramos cartas con esa búsqueda.</p>
      <template v-else>
        <p class="error">No pudimos consultar la API en este momento. Intenta de nuevo en unos segundos.</p>
        <button type="button" class="boton boton-secundario" @click="cat.iniciar()">Reintentar</button>
      </template>
    </div>

    <div v-if="cat.cartas.value.length && (cat.hayMas.value || cat.error.value)" class="cargar-mas">
      <p v-if="cat.error.value" class="error" role="alert">No pudimos cargar más cartas. Intenta de nuevo.</p>
      <button type="button" class="boton boton-secundario" :disabled="cat.cargando.value" @click="cat.cargarMas()">
        {{ cat.cargando.value ? 'Cargando…' : 'Cargar más cartas' }}
      </button>
    </div>

    <DetalleCarta :carta="seleccionada" @cerrar="seleccionada = null" />

    <p class="aviso-legal">
      Cambalache es un proyecto de fans, sin afiliación con Konami (Yu-Gi-Oh!), The Pokémon
      Company/Nintendo/Game Freak (Pokémon) ni Onirica Studios/Toro Studios (Mitos y Leyendas).
      Nombres, imágenes y textos de las cartas son propiedad de sus respectivos dueños; los datos
      de Yu-Gi-Oh! y Pokémon se obtienen en vivo de sus APIs públicas para fans (YGOPRODeck y
      Pokémon TCG API).
    </p>
  </div>
</template>
