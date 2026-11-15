<script setup lang="ts">
import { etiquetaTema } from '~/utils/tema'

const { tema, cargar, rotar } = useTema()
onMounted(cargar)

const etiqueta = computed(() => etiquetaTema(tema.value))
</script>

<template>
  <button
    type="button"
    class="tema-toggle"
    :aria-label="etiqueta"
    :title="etiqueta"
    @click="rotar"
  >
    <!-- Íconos SVG en línea: sin depender de Font Awesome por CDN. -->
    <svg
      v-if="tema === 'sistema'"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
    </svg>
    <svg
      v-else-if="tema === 'claro'"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <svg
      v-else
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" />
    </svg>
  </button>
</template>
