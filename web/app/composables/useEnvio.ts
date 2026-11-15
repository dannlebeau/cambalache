import { mensajeError } from '~/utils/cuenta'

// Estado de un formulario que envía algo: evita el doble envío (ignora el segundo mientras
// corre el primero) y deja el error en español listo para mostrar.
export function useEnvio() {
  const enviando = ref(false)
  const error = ref('')

  async function enviar(accion: () => Promise<void>) {
    if (enviando.value) return
    enviando.value = true
    error.value = ''
    try {
      await accion()
    }
    catch (err) {
      error.value = mensajeError(err)
    }
    finally {
      enviando.value = false
    }
  }

  return { enviando, error, enviar }
}
