// Reglas de las cuentas que no dependen de Nuxt ni de Supabase (se prueban con Vitest).
// Las reglas que importan de verdad (bloqueo, permisos) viven en Postgres; esto es solo
// para dar mensajes claros en la UI antes de llamar al servidor.

export const LARGO_MINIMO_PASSWORD = 8

// Fila de public.perfiles que lee la app.
export interface Perfil {
  id: string
  nombre: string
  es_admin: boolean
  bloqueado: boolean
  debe_cambiar_password: boolean
}

// Cuenta con sesión, como la usa la UI.
export interface Cuenta {
  id: string
  email: string
  nombre: string
  esAdmin: boolean
  bloqueado: boolean
  debeCambiarPassword: boolean
}

export const MENSAJE_CUENTA_BLOQUEADA = 'Tu cuenta está bloqueada. Escríbenos para revisarla.'

export function aCuenta(id: string, email: string, perfil: Perfil | null): Cuenta {
  return {
    id,
    email,
    nombre: perfil?.nombre || email,
    esAdmin: !!perfil?.es_admin,
    bloqueado: !!perfil?.bloqueado,
    debeCambiarPassword: !!perfil?.debe_cambiar_password,
  }
}

// Devuelve el error en español o null si la contraseña nueva sirve.
export function validarPasswordNueva(p1: string, p2: string): string | null {
  if (p1.length < LARGO_MINIMO_PASSWORD) return `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`
  if (p1 !== p2) return 'Las contraseñas no coinciden.'
  return null
}

export function validarRegistro(datos: { nombre: string, email: string, password: string, password2: string }): string | null {
  const nombre = datos.nombre.trim()
  if (!nombre) return 'Escribe tu nombre.'
  if (nombre.length > 60) return 'El nombre puede tener hasta 60 caracteres.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) return 'Escribe un correo válido.'
  return validarPasswordNueva(datos.password, datos.password2)
}

export function validarLogin(email: string, password: string): string | null {
  if (!email.trim() || !password) return 'Escribe tu correo y tu contraseña.'
  return null
}

// Ruta a la que volver tras iniciar sesión (?volver=). Solo rutas internas: "/algo", nunca
// "//otro.sitio" ni "/\otro.sitio" (los navegadores los tratan como otro dominio).
export function rutaVolver(valor: unknown): string {
  const texto = Array.isArray(valor) ? valor[0] : valor
  if (typeof texto !== 'string' || !texto.startsWith('/') || /^\/[/\\]/.test(texto)) return '/'
  return texto
}

// Rutas que solo tienen sentido con sesión: sin ella, el middleware manda a /entrar?volver=.
export const RUTAS_CON_SESION = ['/mi-cuenta', '/publicar']

export function requiereSesion(path: string): boolean {
  return RUTAS_CON_SESION.some(r => path === r || path.startsWith(`${r}/`))
}

// Mensaje en español para errores de Supabase. Los de las funciones de la base ya vienen
// en español (raise exception); los de Auth y de red se traducen aquí.
export function mensajeError(err: unknown): string {
  const msg = (err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err ?? '')).trim()
  const traducciones: [RegExp, string][] = [
    [/Invalid login credentials/i, 'Correo o contraseña incorrectos.'],
    [/User already registered/i, 'Ya existe una cuenta con ese correo.'],
    [/Email not confirmed/i, 'Confirma tu correo antes de iniciar sesión (revisa tu bandeja de entrada).'],
    [/Password should be at least/i, `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`],
    [/New password should be different/i, 'La contraseña nueva debe ser distinta de la anterior.'],
    [/rate limit|too many/i, 'Demasiados intentos. Espera un momento y vuelve a intentar.'],
    [/Failed to fetch|NetworkError|Load failed/i, 'No pudimos conectar con el servidor. Revisa tu conexión.'],
    [/JWT|not authorized|permission denied/i, 'Tu sesión expiró o no tienes permiso. Vuelve a iniciar sesión.'],
  ]
  for (const [patron, texto] of traducciones) if (patron.test(msg)) return texto
  return msg && msg !== 'undefined' && msg !== 'null' ? msg : 'Ocurrió un error inesperado.'
}
