// Mantiene la cuenta al día cuando la sesión cambia fuera de una navegación (por ejemplo,
// al salir en otra pestaña o al refrescarse el token).
export default defineNuxtPlugin(() => {
  const supabase = useSupabaseClient()
  const { sincronizar } = useCuenta()

  supabase.auth.onAuthStateChange((evento) => {
    if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(evento)) return
    // Supabase pide no llamar a otros métodos de auth dentro del callback: se difiere.
    setTimeout(() => {
      sincronizar(evento === 'USER_UPDATED').catch(err => console.error('No se pudo cargar la cuenta:', err))
    }, 0)
  })
})
