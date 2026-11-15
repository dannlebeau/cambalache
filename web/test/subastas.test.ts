import { afterEach, describe, expect, it, vi } from 'vitest'
import { rutaVolver } from '../app/utils/cuenta'
import {
  agrupar, escucharSubastas, filtrarSubastas, formatCLP, formatFecha, idSubasta, precioVisible,
  tiempoRestante, validarPuja, type CanalRealtime, type ClienteRealtime,
} from '../app/utils/subastas'

// Normaliza espacios duros de Intl para comparar texto.
const plano = (t: string) => t.replace(/\s/g, ' ')

describe('formatos', () => {
  it('formatCLP usa pesos chilenos sin decimales', () => {
    expect(plano(formatCLP(12500))).toBe('$12.500')
  })

  it('formatFecha usa la hora de Chile, no la del servidor', () => {
    // 15:00 UTC del 15 de noviembre = 12:00 en Santiago (verano, UTC-3).
    expect(plano(formatFecha('2026-11-15T15:00:00Z'))).toMatch(/^15-11-2026, 12:00/)
  })

  it('tiempoRestante en días, horas, minutos y cerrada', () => {
    const ahora = Date.parse('2026-11-15T12:00:00Z')
    expect(tiempoRestante('2026-11-17T16:30:00Z', ahora)).toBe('2d 4h')
    expect(tiempoRestante('2026-11-15T15:12:30Z', ahora)).toBe('3h 12m')
    expect(tiempoRestante('2026-11-15T12:04:09Z', ahora)).toBe('4m 09s')
    expect(tiempoRestante('2026-11-15T12:00:00Z', ahora)).toBe('Cerrada')
    expect(tiempoRestante('no es fecha', ahora)).toBe('Cerrada')
  })

  it('precioVisible muestra la puja actual o el precio base', () => {
    expect(precioVisible({ precio_actual: null, precio_base: 1000 })).toEqual({ monto: 1000, etiqueta: 'Precio base' })
    expect(precioVisible({ precio_actual: 1500, precio_base: 1000 })).toEqual({ monto: 1500, etiqueta: 'Puja actual' })
  })
})

describe('validarPuja', () => {
  it('acepta un entero igual o mayor a la mínima', () => {
    expect(validarPuja(1000, 1000)).toBeNull()
    expect(validarPuja(5000, 1000)).toBeNull()
  })

  it('rechaza vacío, decimales, texto y montos bajos', () => {
    for (const monto of ['', null, undefined, '2000', 1000.5, Number.NaN, 999, -1]) {
      expect(validarPuja(monto, 1000)).toMatch(/puja mínima es \$1\.000/)
    }
  })
})

describe('filtrarSubastas', () => {
  const lista = [
    { juego: 'ygo' as const, nombre: 'Dragón Blanco de Ojos Azules' },
    { juego: 'poke' as const, nombre: 'Pikachu' },
    { juego: 'myl' as const, nombre: 'Dragón Dorado' },
  ]

  it('sin filtro devuelve todo', () => {
    expect(filtrarSubastas(lista, '', '  ')).toHaveLength(3)
  })

  it('filtra por juego y por texto sin tildes ni mayúsculas', () => {
    expect(filtrarSubastas(lista, 'poke', '')).toEqual([lista[1]])
    expect(filtrarSubastas(lista, '', 'DRAGON')).toEqual([lista[0], lista[2]])
    expect(filtrarSubastas(lista, 'myl', 'dragón')).toEqual([lista[2]])
    expect(filtrarSubastas(lista, 'ygo', 'pikachu')).toEqual([])
  })
})

describe('idSubasta y rutaVolver', () => {
  it('idSubasta solo acepta enteros positivos', () => {
    expect(idSubasta('12')).toBe(12)
    expect(idSubasta(['7'])).toBe(7)
    for (const v of ['0', '-1', '1.5', 'abc', '', '01', '1e3', '99999999999999999', undefined]) {
      expect(idSubasta(v)).toBeNull()
    }
  })

  it('rutaVolver solo acepta rutas internas', () => {
    expect(rutaVolver('/subasta/3')).toBe('/subasta/3')
    expect(rutaVolver(['/subastas?x=1'])).toBe('/subastas?x=1')
    for (const v of ['//malo.cl', '/\\malo.cl', 'https://malo.cl', 'javascript:alert(1)', '', undefined, 3]) {
      expect(rutaVolver(v)).toBe('/')
    }
  })
})

describe('Realtime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('agrupar hace una sola llamada por ráfaga', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const r = agrupar(fn, 300)
    r.programar()
    vi.advanceTimersByTime(200)
    r.programar()
    r.programar()
    vi.advanceTimersByTime(299)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    r.programar()
    r.cancelar()
    vi.advanceTimersByTime(1000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  function clienteFalso() {
    let cb: (() => void) | undefined
    const filtros: unknown[] = []
    const canal: CanalRealtime = {
      on(_tipo, filtro, fn) {
        filtros.push(filtro)
        cb = fn
        return canal
      },
      subscribe: vi.fn(),
    }
    const cliente: ClienteRealtime = { channel: vi.fn(() => canal), removeChannel: vi.fn() }
    return { cliente, canal, filtros, emitir: () => cb?.() }
  }

  it('escucha la fila de una subasta, agrupa los eventos y cierra el canal al terminar', () => {
    vi.useFakeTimers()
    const { cliente, canal, filtros, emitir } = clienteFalso()
    const recargar = vi.fn()
    const cerrar = escucharSubastas(cliente, recargar, { id: 5, ms: 300 })

    expect(cliente.channel).toHaveBeenCalledWith('subasta-5')
    expect(filtros).toEqual([{ event: '*', schema: 'public', table: 'subastas', filter: 'id=eq.5' }])
    expect(canal.subscribe).toHaveBeenCalledOnce()

    emitir()
    emitir()
    emitir()
    vi.advanceTimersByTime(300)
    expect(recargar).toHaveBeenCalledTimes(1)

    emitir()
    cerrar()
    vi.advanceTimersByTime(1000)
    expect(recargar).toHaveBeenCalledTimes(1)
    expect(cliente.removeChannel).toHaveBeenCalledWith(canal)
  })

  it('el listado escucha toda la tabla', () => {
    const { cliente, filtros } = clienteFalso()
    escucharSubastas(cliente, () => {})
    expect(cliente.channel).toHaveBeenCalledWith('listado-subastas')
    expect(filtros).toEqual([{ event: '*', schema: 'public', table: 'subastas' }])
  })
})
