<script setup lang="ts">
import { formatFecha, tiempoRestante } from '~/utils/subastas'

// Cuenta regresiva hasta `fin`. El servidor no sabe en qué segundo se va a ver la página, así
// que manda la fecha de cierre fija; el navegador la cambia por el reloj al montar (sin
// diferencias de hidratación). Avisa `cerrada` una vez, al llegar a cero.
const props = defineProps<{ fin: string }>()
const emit = defineEmits<{ cerrada: [] }>()

const ahora = ref<number | null>(null)
let intervalo: ReturnType<typeof setInterval> | undefined
let avisado = false

const texto = computed(() => ahora.value === null ? `Cierra el ${formatFecha(props.fin)}` : tiempoRestante(props.fin, ahora.value))

function tick() {
  ahora.value = Date.now()
  const cerrada = tiempoRestante(props.fin, ahora.value) === 'Cerrada'
  if (cerrada && !avisado) emit('cerrada')
  avisado = cerrada
}

// Si el cierre se alarga (anti-sniping), vuelve a poder avisar.
watch(() => props.fin, tick)

onMounted(() => {
  tick()
  intervalo = setInterval(tick, 1000)
})
onBeforeUnmount(() => clearInterval(intervalo))
</script>

<template>
  <time :datetime="fin" :title="`Cierra el ${formatFecha(fin)}`">{{ texto }}</time>
</template>
