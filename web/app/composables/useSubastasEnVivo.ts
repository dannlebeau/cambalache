import { escucharSubastas, type ClienteRealtime } from '~/utils/subastas'

// Recarga los datos cuando cambia public.subastas (alguien puja, compra o cierra), solo en el
// navegador. Sin `id` escucha todas; con `id`, solo esa fila. El canal se cierra al salir.
export function useSubastasEnVivo(recargar: () => void, opciones: { id?: number, ms?: number } = {}) {
  const supabase = useSupabaseClient()
  let cerrar: (() => void) | undefined

  onMounted(() => {
    cerrar = escucharSubastas(supabase as unknown as ClienteRealtime, recargar, opciones)
  })
  onBeforeUnmount(() => cerrar?.())
}
