<script setup lang="ts">
import type { NuxtError } from '#app'

// Página de error (404 de una subasta que no existe, o un error del servidor), en español y
// con la barra de siempre.
const props = defineProps<{ error: NuxtError }>()
const noEncontrada = computed(() => props.error.statusCode === 404)

useSeoMeta({ title: () => noEncontrada.value ? 'No encontrada · Cambalache' : 'Error · Cambalache' })
</script>

<template>
  <div class="contenedor">
    <BarraNavegacion />
    <main class="estado">
      <h1>{{ noEncontrada ? 'No encontramos esta página' : 'Algo salió mal' }}</h1>
      <p>
        {{ noEncontrada
          ? 'La subasta o la página que buscas no existe o ya no está disponible.'
          : 'Ocurrió un error inesperado. Vuelve a intentar en un momento.' }}
      </p>
      <button type="button" class="boton" @click="clearError({ redirect: '/subastas' })">Ver subastas</button>
    </main>
  </div>
</template>
