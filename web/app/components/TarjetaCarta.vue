<script setup lang="ts">
import { JUEGOS, type Carta } from '~/utils/catalogo'

defineProps<{ carta: Carta }>()
defineEmits<{ abrir: [] }>()

// Si la imagen no carga, queda el fondo con el nombre del juego.
const imagenFallo = ref(false)
</script>

<template>
  <button type="button" class="tarjeta" :aria-label="`Ver detalle de ${carta.nombre}`" @click="$emit('abrir')">
    <span class="tarjeta-visual">
      <img
        v-if="carta.imagen && !imagenFallo"
        :src="carta.imagen"
        alt=""
        loading="lazy"
        @error="imagenFallo = true"
      >
      <span v-else class="sin-imagen" aria-hidden="true">Sin imagen</span>
      <span class="chip" :class="`chip-${carta.juego}`">{{ JUEGOS[carta.juego].corto }}</span>
    </span>
    <span class="tarjeta-nombre">{{ carta.nombre }}</span>
  </button>
</template>
