// En cada navegación (servidor y navegador): carga la cuenta y aplica las reglas de acceso.
// - Cuenta bloqueada: se cierra la sesión y se manda a /entrar con el aviso.
// - Contraseña temporal: solo puede ir a /cambiar-password hasta cambiarla.
// - Con sesión, /entrar y /registro no tienen sentido: se vuelve a `volver` o al inicio.
// - Sin sesión, /mi-cuenta y /publicar mandan a /entrar y vuelven tras entrar.
// Esto es la UI; las funciones de Postgres y la RLS rechazan igual lo que no corresponde.
import { requiereSesion, rutaVolver } from '~/utils/cuenta'

const SOLO_SIN_SESION = ['/entrar', '/registro']

export default defineNuxtRouteMiddleware(async (to) => {
  const { sincronizar, cerrarSesion } = useCuenta()

  let cuenta
  try {
    cuenta = await sincronizar()
  }
  catch (err) {
    // Sin perfil (Supabase caído) la página igual se muestra; las acciones fallarán con su error.
    console.error('No se pudo cargar la cuenta:', err)
    return
  }
  if (!cuenta) {
    if (requiereSesion(to.path)) return navigateTo({ path: '/entrar', query: { volver: to.fullPath } })
    return
  }

  if (cuenta.bloqueado) {
    await cerrarSesion()
    if (to.path !== '/entrar' || to.query.motivo !== 'bloqueada') {
      return navigateTo({ path: '/entrar', query: { motivo: 'bloqueada' } })
    }
    return
  }
  if (cuenta.debeCambiarPassword) {
    if (to.path !== '/cambiar-password') return navigateTo('/cambiar-password')
    return
  }
  if (SOLO_SIN_SESION.includes(to.path)) return navigateTo(rutaVolver(to.query.volver))
})
