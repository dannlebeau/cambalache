import { aCuenta, type Cuenta, type Perfil } from '~/utils/cuenta'

// Cuenta con sesión compartida por toda la app (nav, middleware, páginas). Se llena en el
// servidor desde la cookie de sesión, así que el HTML ya trae el nombre del usuario.
export function useCuenta() {
  const supabase = useSupabaseClient()
  const cuenta = useState<Cuenta | null>('cuenta', () => null)
  // Se toman aquí, de forma síncrona: después de un await el contexto de Nuxt puede no estar.
  const claims = useSupabaseUser()
  const sesion = useSupabaseSession()

  // Quién tiene sesión. En el servidor, el módulo ya validó el JWT de la cookie; en el
  // navegador se lee la sesión guardada (sin red). La RLS de Postgres es la que protege.
  async function usuarioConSesion(): Promise<{ id: string, email: string } | null> {
    if (import.meta.server) {
      const datos = claims.value
      return datos?.sub ? { id: datos.sub, email: String(datos.email ?? '') } : null
    }
    const { data } = await supabase.auth.getSession()
    const usuario = data.session?.user
    return usuario ? { id: usuario.id, email: usuario.email ?? '' } : null
  }

  // Lee el perfil de public.perfiles. Con `forzar` vuelve a leerlo aunque ya esté cargado.
  async function sincronizar(forzar = false): Promise<Cuenta | null> {
    const usuario = await usuarioConSesion()
    if (!usuario) {
      cuenta.value = null
      return null
    }
    if (!forzar && cuenta.value?.id === usuario.id) return cuenta.value
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre, es_admin, bloqueado, debe_cambiar_password')
      .eq('id', usuario.id)
      .maybeSingle()
    if (error) throw error
    cuenta.value = aCuenta(usuario.id, usuario.email, data as Perfil | null)
    return cuenta.value
  }

  async function cerrarSesion() {
    // scope 'local': cierra esta sesión sin tocar las de otros dispositivos.
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    // En el servidor el módulo no limpia estos estados al salir: si quedan, la siguiente
    // pasada del middleware (tras redirigir) creería que todavía hay sesión.
    claims.value = null
    sesion.value = null
    cuenta.value = null
    if (error) throw error
  }

  return { cuenta, sincronizar, cerrarSesion }
}
