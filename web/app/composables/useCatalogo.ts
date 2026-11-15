import { getCurrentScope, onScopeDispose, readonly, ref, shallowRef } from 'vue'
import { cargarPagina, type Carta, type Fetch, type Juego } from '../utils/catalogo'

export const ESPERA_BUSQUEDA_MS = 350

// Estado del catálogo de la portada. Solo se usa en el navegador (la página llama a `iniciar`
// en onMounted). Diferencias con assets/js/app.js:
// - Cambiar de pestaña, filtro o búsqueda mientras carga no se pierde: la respuesta vieja se
//   descarta y gana la última consulta.
// - "Cargar más" mientras ya carga no hace un segundo pedido.
export function useCatalogo(opciones: { fetch?: Fetch } = {}) {
  const fetchFn: Fetch = opciones.fetch ?? (url => fetch(url))

  const juego = ref<Juego>('ygo')
  const texto = ref('')
  const tipo = ref('')
  const cartas = shallowRef<Carta[]>([])
  const total = ref(0)
  const hayMas = ref(false)
  const cargando = ref(false)
  const error = ref(false)

  let pagina = 1
  let consultaActual = 0 // sube con cada reinicio; una respuesta de una consulta vieja se ignora
  let temporizador: ReturnType<typeof setTimeout> | undefined

  async function cargar(reiniciar: boolean) {
    if (reiniciar) {
      consultaActual++
      pagina = 1
      cartas.value = []
      total.value = 0
      hayMas.value = false
    }
    else if (cargando.value || !hayMas.value) {
      return
    }
    const estaConsulta = consultaActual
    cargando.value = true
    error.value = false
    try {
      const resultado = await cargarPagina(
        { juego: juego.value, texto: texto.value, tipo: tipo.value },
        pagina,
        cartas.value.length,
        fetchFn,
      )
      if (estaConsulta !== consultaActual) return
      cartas.value = [...cartas.value, ...resultado.cartas]
      total.value = resultado.total
      hayMas.value = resultado.hayMas
      pagina++
    }
    catch (err) {
      if (estaConsulta !== consultaActual) return
      console.error(err)
      error.value = true
    }
    finally {
      if (estaConsulta === consultaActual) cargando.value = false
    }
  }

  function cancelarEspera() {
    if (temporizador) clearTimeout(temporizador)
    temporizador = undefined
  }

  function iniciar() {
    return cargar(true)
  }

  function cambiarJuego(nuevo: Juego) {
    if (nuevo === juego.value) return
    cancelarEspera()
    juego.value = nuevo
    texto.value = ''
    tipo.value = ''
    return cargar(true)
  }

  function cambiarTipo(nuevo: string) {
    cancelarEspera()
    tipo.value = nuevo
    return cargar(true)
  }

  // Espera a que la persona deje de escribir antes de consultar la API.
  function buscar(nuevo: string) {
    cancelarEspera()
    temporizador = setTimeout(() => {
      temporizador = undefined
      const limpio = nuevo.trim()
      if (limpio === texto.value) return
      texto.value = limpio
      void cargar(true)
    }, ESPERA_BUSQUEDA_MS)
  }

  function cargarMas() {
    return cargar(false)
  }

  if (getCurrentScope()) onScopeDispose(cancelarEspera)

  return {
    juego: readonly(juego),
    texto: readonly(texto),
    tipo: readonly(tipo),
    cartas,
    total: readonly(total),
    hayMas: readonly(hayMas),
    cargando: readonly(cargando),
    error: readonly(error),
    iniciar,
    cambiarJuego,
    cambiarTipo,
    buscar,
    cargarMas,
  }
}
