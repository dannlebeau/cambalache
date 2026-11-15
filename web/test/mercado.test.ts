import { describe, expect, it } from 'vitest'
import { requiereSesion } from '../app/utils/cuenta'
import {
  agruparPujas, calcularPublicacion, cartaDesdeUrl, resumenPublicacion, urlPublicar, validarPublicacion,
  type FormPublicar, type MiPublicacion, type MiPuja,
} from '../app/utils/mercado'

const config = { duracion_horas: 72, comision: '0.1000', recargo_compra_inmediata: '0.2000', descuento_republicacion: '0.1000' }

describe('calcularPublicacion', () => {
  it('calcula comisión, lo que recibe el vendedor y comprar ya redondeado a la centena', () => {
    expect(calcularPublicacion(12_350, config)).toEqual({ base: 12_350, comision: 1235, recibes: 11_115, compraYa: 14_800 })
  })

  it('null si el precio no sirve', () => {
    for (const v of ['', 99, 150.5, Number.NaN, null]) expect(calcularPublicacion(v, config)).toBeNull()
  })
})

describe('validarPublicacion', () => {
  const ok: FormPublicar = { juego: 'ygo', nombre: 'Dark Magician', conservacion: 'buena', precioBase: 5000, precioMinimo: '', aceptaTerminos: true }

  it('acepta un formulario completo, con o sin mínimo', () => {
    expect(validarPublicacion(ok)).toBeNull()
    expect(validarPublicacion({ ...ok, precioMinimo: 5000 })).toBeNull()
  })

  it('pide cada campo', () => {
    expect(validarPublicacion({ ...ok, juego: '' })).toBe('Elige el juego.')
    expect(validarPublicacion({ ...ok, nombre: '   ' })).toBe('Escribe el nombre de la carta.')
    expect(validarPublicacion({ ...ok, nombre: 'x'.repeat(121) })).toMatch(/120/)
    expect(validarPublicacion({ ...ok, conservacion: 'otra' })).toBe('Indica el estado de la carta.')
    expect(validarPublicacion({ ...ok, precioBase: '' })).toMatch(/precio base/)
    expect(validarPublicacion({ ...ok, precioBase: 99 })).toMatch(/precio base/)
    expect(validarPublicacion({ ...ok, aceptaTerminos: false })).toMatch(/Términos/)
  })

  it('el mínimo va entre $100 y el precio base', () => {
    expect(validarPublicacion({ ...ok, precioMinimo: 5100 })).toMatch(/mínimo/)
    expect(validarPublicacion({ ...ok, precioMinimo: 50 })).toMatch(/mínimo/)
  })
})

describe('carta desde la URL', () => {
  it('lee juego, ref, nombre e imagen https', () => {
    expect(cartaDesdeUrl({ juego: 'poke', ref: 'xy1-1', nombre: ' Pikachu ', imagen: 'https://img/x.png' }))
      .toEqual({ juego: 'poke', ref: 'xy1-1', nombre: 'Pikachu', imagen: 'https://img/x.png' })
  })

  it('descarta imágenes que no son https', () => {
    expect(cartaDesdeUrl({ juego: 'poke', ref: '1', nombre: 'P', imagen: 'javascript:alert(1)' })?.imagen).toBeNull()
    expect(cartaDesdeUrl({ juego: 'poke', ref: '1', nombre: 'P', imagen: 'http://img/x.png' })?.imagen).toBeNull()
  })

  it('null si falta algo o el juego no existe', () => {
    expect(cartaDesdeUrl({})).toBeNull()
    expect(cartaDesdeUrl({ juego: 'magic', ref: '1', nombre: 'X' })).toBeNull()
    expect(cartaDesdeUrl({ juego: 'toString', ref: '1', nombre: 'X' })).toBeNull()
    expect(cartaDesdeUrl({ juego: 'ygo', ref: 'r'.repeat(81), nombre: 'X' })).toBeNull()
    expect(cartaDesdeUrl({ juego: 'ygo', ref: '1', nombre: '' })).toBeNull()
  })

  it('urlPublicar hace el camino de vuelta, con la imagen grande si hay', () => {
    const carta = { id: '46986414', juego: 'ygo' as const, nombre: 'Dark Magician', imagen: 'https://a/s.jpg', imagenGrande: 'https://a/l.jpg' }
    const url = urlPublicar(carta)
    expect(url).toEqual({ path: '/publicar', query: { juego: 'ygo', ref: '46986414', nombre: 'Dark Magician', imagen: 'https://a/l.jpg' } })
    expect(cartaDesdeUrl(url.query)?.imagen).toBe('https://a/l.jpg')
    expect(urlPublicar({ ...carta, imagen: '', imagenGrande: '' }).query.imagen).toBeUndefined()
  })
})

describe('agruparPujas', () => {
  const subasta = (id: number, estado: 'activa' | 'cerrada') => ({ id, fin: '2026-11-18T00:00:00Z', estado, precio_actual: 9000, lider_id: null, publicaciones: null })

  it('una fila por subasta con mi puja más alta; primero las activas', () => {
    const pujas: MiPuja[] = [
      { monto: 3000, subastas: subasta(1, 'cerrada') },
      { monto: 7000, subastas: subasta(2, 'activa') },
      { monto: 5000, subastas: subasta(1, 'cerrada') },
      { monto: 6000, subastas: subasta(2, 'activa') },
      { monto: 1000, subastas: null },
    ]
    expect(agruparPujas(pujas).map(g => [g.subasta.id, g.miMaxima])).toEqual([[2, 7000], [1, 5000]])
  })

  it('sin pujas, lista vacía', () => {
    expect(agruparPujas([])).toEqual([])
  })
})

describe('resumenPublicacion', () => {
  const base: MiPublicacion = { id: 1, juego: 'ygo', nombre: 'X', imagen: null, estado: 'en_subasta', motivo: null, subastas: null, ventas: null }

  it('toma la ronda más reciente y la venta que no está impaga', () => {
    const r = resumenPublicacion({
      ...base,
      subastas: [
        { id: 10, ronda: 1, precio_base: 5000, precio_actual: null, fin: 'a', estado: 'cerrada' },
        { id: 11, ronda: 2, precio_base: 4500, precio_actual: null, fin: 'b', estado: 'activa' },
      ],
      ventas: [
        { estado: 'impaga', monto: 6000, comision: 600, pago_vendedor: 5400 },
        { estado: 'pagada', monto: 5500, comision: 550, pago_vendedor: 4950 },
      ],
    })
    expect(r.actual?.id).toBe(11)
    expect(r.venta?.estado).toBe('pagada')
  })

  it('sin rondas ni ventas, null', () => {
    expect(resumenPublicacion(base)).toEqual({ actual: null, venta: null })
  })
})

describe('requiereSesion', () => {
  it('pide sesión en Mi cuenta y Publicar, no en las públicas', () => {
    expect(requiereSesion('/mi-cuenta')).toBe(true)
    expect(requiereSesion('/publicar')).toBe(true)
    expect(requiereSesion('/publicar/otra')).toBe(true)
    expect(requiereSesion('/publicarla')).toBe(false)
    expect(requiereSesion('/subastas')).toBe(false)
    expect(requiereSesion('/')).toBe(false)
  })
})
