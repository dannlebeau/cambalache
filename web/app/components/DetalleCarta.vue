<script setup lang="ts">
import { JUEGOS, traducir, type Carta } from '~/utils/catalogo'
import { urlPublicar } from '~/utils/mercado'

// Detalle de una carta en un <dialog> nativo (Escape y foco atrapado vienen del navegador),
// con zoom de la imagen y traducción al español con MyMemory.
const props = defineProps<{ carta: Carta | null }>()
const emit = defineEmits<{ cerrar: [] }>()

const dialogo = ref<HTMLDialogElement>()
const dialogoZoom = ref<HTMLDialogElement>()
const zoom = ref(false)
const imagenFallo = ref(false)
const traduciendo = ref(false)
const fallaTraduccion = ref(false)
const verTraduccion = ref(false)
const traducciones = reactive(new Map<string, string>()) // por id de carta, mientras dure la página

const imagen = computed(() => props.carta ? (props.carta.imagenGrande || props.carta.imagen) : '')
const descripcion = computed(() => {
  const c = props.carta
  if (!c) return ''
  return verTraduccion.value ? (traducciones.get(c.id) ?? c.descripcion) : c.descripcion
})

watch(() => props.carta, (c) => {
  zoom.value = false
  imagenFallo.value = false
  fallaTraduccion.value = false
  verTraduccion.value = false
  if (c && !dialogo.value?.open) dialogo.value?.showModal()
  if (!c && dialogo.value?.open) dialogo.value.close()
})

watch(zoom, (abierto) => {
  if (abierto && !dialogoZoom.value?.open) dialogoZoom.value?.showModal()
  if (!abierto && dialogoZoom.value?.open) dialogoZoom.value.close()
})

function alHacerClic(e: MouseEvent) {
  if (e.target === dialogo.value) emit('cerrar')
}

async function alternarTraduccion() {
  const c = props.carta
  if (!c || traduciendo.value) return
  if (verTraduccion.value) {
    verTraduccion.value = false
    return
  }
  if (!traducciones.has(c.id)) {
    traduciendo.value = true
    fallaTraduccion.value = false
    try {
      traducciones.set(c.id, await traducir(c.descripcion, url => fetch(url)))
    }
    catch (err) {
      console.error(err)
      fallaTraduccion.value = true
      return
    }
    finally {
      traduciendo.value = false
    }
    // Si mientras tanto se abrió otra carta, no mostrar esta traducción allá.
    if (props.carta?.id !== c.id) return
  }
  verTraduccion.value = true
}
</script>

<template>
  <dialog
    ref="dialogo"
    class="detalle"
    aria-labelledby="detalle-nombre"
    @close="emit('cerrar')"
    @click="alHacerClic"
  >
    <div v-if="carta" class="detalle-caja">
      <div class="detalle-visual">
        <button
          v-if="imagen && !imagenFallo"
          type="button"
          class="detalle-zoom"
          aria-label="Ampliar imagen"
          @click="zoom = true"
        >
          <img :src="imagen" alt="" @error="imagenFallo = true">
        </button>
        <span v-else class="sin-imagen">Sin imagen</span>
      </div>
      <div class="detalle-info">
        <button type="button" class="detalle-cerrar" aria-label="Cerrar" @click="emit('cerrar')">✕</button>
        <span class="chip" :class="`chip-${carta.juego}`">{{ JUEGOS[carta.juego].label }}</span>
        <h2 id="detalle-nombre">{{ carta.nombre }}</h2>
        <ul class="detalle-meta">
          <li v-for="m in carta.meta" :key="m.k"><strong>{{ m.k }}:</strong> {{ m.v }}</li>
        </ul>
        <p class="detalle-desc">{{ descripcion }}</p>
        <p class="detalle-acciones">
          <NuxtLink :to="urlPublicar(carta)" class="boton">Subastar esta carta</NuxtLink>
        </p>
        <div v-if="carta.idiomaOriginal === 'en'" class="detalle-acciones">
          <button type="button" class="boton boton-secundario" :disabled="traduciendo" @click="alternarTraduccion">
            {{ traduciendo ? 'Traduciendo…' : verTraduccion ? 'Ver original (inglés)' : 'Traducir al español' }}
          </button>
          <p v-if="fallaTraduccion" class="error" role="alert">No se pudo traducir. Intenta de nuevo.</p>
        </div>
      </div>
    </div>
    <!-- Otro <dialog> modal encima: Escape cierra solo esta capa. -->
    <dialog ref="dialogoZoom" class="detalle-ampliada" aria-label="Imagen ampliada" @close="zoom = false" @click="zoom = false">
      <img v-if="zoom" :src="imagen" alt="">
    </dialog>
  </dialog>
</template>
