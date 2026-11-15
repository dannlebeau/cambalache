import { describe, expect, it } from 'vitest'
import { aCuenta, mensajeError, validarLogin, validarPasswordNueva, validarRegistro } from '../app/utils/cuenta'

const registroValido = { nombre: 'Ana', email: 'ana@ejemplo.cl', password: '12345678', password2: '12345678' }

describe('validarRegistro', () => {
  it('acepta datos completos', () => {
    expect(validarRegistro(registroValido)).toBeNull()
  })

  it('rechaza entrada vacía o solo espacios', () => {
    expect(validarRegistro({ nombre: '', email: '', password: '', password2: '' })).toBe('Escribe tu nombre.')
    expect(validarRegistro({ ...registroValido, nombre: '   ' })).toBe('Escribe tu nombre.')
    expect(validarRegistro({ ...registroValido, email: '' })).toBe('Escribe un correo válido.')
  })

  it('rechaza nombres de más de 60 caracteres (límite de perfiles.nombre)', () => {
    expect(validarRegistro({ ...registroValido, nombre: 'a'.repeat(61) })).toMatch(/60 caracteres/)
    expect(validarRegistro({ ...registroValido, nombre: 'a'.repeat(60) })).toBeNull()
  })

  it('rechaza correos mal escritos', () => {
    expect(validarRegistro({ ...registroValido, email: 'ana@' })).toBe('Escribe un correo válido.')
    expect(validarRegistro({ ...registroValido, email: 'ana ejemplo@cl.cl' })).toBe('Escribe un correo válido.')
  })
})

describe('validarPasswordNueva', () => {
  it('exige 8 caracteres y que coincidan', () => {
    expect(validarPasswordNueva('1234567', '1234567')).toMatch(/al menos 8/)
    expect(validarPasswordNueva('12345678', '12345679')).toBe('Las contraseñas no coinciden.')
    expect(validarPasswordNueva('12345678', '12345678')).toBeNull()
  })
})

describe('validarLogin', () => {
  it('pide correo y contraseña', () => {
    expect(validarLogin('', '')).toMatch(/correo y tu contraseña/)
    expect(validarLogin('  ', 'x')).toMatch(/correo y tu contraseña/)
    expect(validarLogin('ana@ejemplo.cl', 'x')).toBeNull()
  })
})

describe('mensajeError', () => {
  it('traduce los errores de Auth y de red', () => {
    expect(mensajeError({ message: 'Invalid login credentials' })).toBe('Correo o contraseña incorrectos.')
    expect(mensajeError(new TypeError('Failed to fetch'))).toMatch(/No pudimos conectar/)
    expect(mensajeError({ message: 'User already registered' })).toBe('Ya existe una cuenta con ese correo.')
  })

  it('deja tal cual los errores en español de la base', () => {
    expect(mensajeError({ message: 'Tu cuenta está bloqueada. Escríbenos para revisarla.' }))
      .toBe('Tu cuenta está bloqueada. Escríbenos para revisarla.')
  })

  it('da un mensaje genérico si no hay texto', () => {
    expect(mensajeError(null)).toBe('Ocurrió un error inesperado.')
    expect(mensajeError({ message: '' })).toBe('Ocurrió un error inesperado.')
  })
})

describe('aCuenta', () => {
  it('usa el correo como nombre si no hay perfil', () => {
    expect(aCuenta('u1', 'ana@ejemplo.cl', null)).toEqual({
      id: 'u1', email: 'ana@ejemplo.cl', nombre: 'ana@ejemplo.cl', esAdmin: false, bloqueado: false, debeCambiarPassword: false,
    })
  })

  it('copia los permisos del perfil', () => {
    const cuenta = aCuenta('u1', 'a@b.cl', { id: 'u1', nombre: 'Ana', es_admin: true, bloqueado: true, debe_cambiar_password: true })
    expect(cuenta).toMatchObject({ nombre: 'Ana', esAdmin: true, bloqueado: true, debeCambiarPassword: true })
  })
})
