import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AVISO_TRADUCCION, cargarPagina, ErrorCatalogo, normalizarPoke, normalizarYgo,
  POR_PAGINA, traducir, urlPoke, urlYgo, type Consulta, type Fetch,
} from '../app/utils/catalogo'
import { ESPERA_BUSQUEDA_MS, useCatalogo } from '../app/composables/useCatalogo'

// Respuesta falsa de fetch.
function respuesta(status: number, cuerpo: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo }
}

function fetchFijo(status: number, cuerpo: unknown = {}) {
  return vi.fn<Fetch>(async () => respuesta(status, cuerpo))
}

function ygoApi(desde: number, cuantas: number, total: number) {
  return {
    data: Array.from({ length: cuantas }, (_, i) => ({ id: desde + i, name: `Carta ${desde + i}`, type: 'Spell Card' })),
    meta: { total_rows: total },
  }
}

const ygo: Consulta = { juego: 'ygo', texto: '', tipo: '' }
const poke: Consulta = { juego: 'poke', texto: '', tipo: '' }

describe('normalización', () => {
  it('YGO conserva ATK/DEF en 0 y omite lo que no viene', () => {
    const c = normalizarYgo({ id: 1, name: 'X', type: 'Effect Monster', atk: 0, def: null, card_images: [{ image_url: 'g.jpg', image_url_small: 'p.jpg' }] })
    expect(c).toMatchObject({ id: 'ygo-1', imagen: 'p.jpg', imagenGrande: 'g.jpg', descripcion: '(Sin descripción)', idiomaOriginal: 'en' })
    expect(c.meta).toEqual([{ k: 'Tipo', v: 'Effect Monster' }, { k: 'ATK', v: '0' }])
  })

  it('Pokémon sin imagen grande usa la chica y une los elementos', () => {
    const c = normalizarPoke({ id: 'base1-4', name: 'Charizard', types: ['Fire', 'Dragon'], images: { small: 's.png' } })
    expect(c).toMatchObject({ id: 'poke-base1-4', imagenGrande: 's.png' })
    expect(c.meta).toEqual([{ k: 'Elemento', v: 'Fire, Dragon' }])
  })
})

describe('URL de las APIs', () => {
  it('YGO pagina por offset y agrega búsqueda y tipo', () => {
    const u = new URL(urlYgo({ juego: 'ygo', texto: 'dragón azul', tipo: 'Spell Card' }, 3))
    expect(u.searchParams.get('offset')).toBe(String(2 * POR_PAGINA))
    expect(u.searchParams.get('fname')).toBe('dragón azul')
    expect(u.searchParams.get('type')).toBe('Spell Card')
  })

  it('Pokémon pagina por número y arma q', () => {
    const u = new URL(urlPoke({ juego: 'poke', texto: 'pika', tipo: 'Lightning' }, 2))
    expect(u.searchParams.get('page')).toBe('2')
    expect(u.searchParams.get('q')).toBe('name:pika* types:Lightning')
    expect(new URL(urlPoke(poke, 1)).searchParams.has('q')).toBe(false)
  })
})

describe('cargarPagina', () => {
  it('YGO: hay más mientras no se llegue al total', async () => {
    const p = await cargarPagina(ygo, 1, 0, fetchFijo(200, ygoApi(1, 24, 50)))
    expect(p).toMatchObject({ total: 50, hayMas: true })
    expect(p.cartas).toHaveLength(24)
    const ultima = await cargarPagina(ygo, 3, 48, fetchFijo(200, ygoApi(49, 2, 50)))
    expect(ultima.hayMas).toBe(false)
  })

  it('YGO: 400 es "sin resultados", no un error', async () => {
    await expect(cargarPagina({ ...ygo, texto: 'zzzz' }, 1, 0, fetchFijo(400))).resolves.toEqual({ cartas: [], total: 0, hayMas: false })
  })

  it('500, red caída o JSON inválido son errores', async () => {
    await expect(cargarPagina(ygo, 1, 0, fetchFijo(500))).rejects.toBeInstanceOf(ErrorCatalogo)
    await expect(cargarPagina(poke, 1, 0, fetchFijo(400))).rejects.toBeInstanceOf(ErrorCatalogo)
    await expect(cargarPagina(poke, 1, 0, vi.fn<Fetch>(async () => { throw new TypeError('Failed to fetch') }))).rejects.toBeInstanceOf(ErrorCatalogo)
    const roto = vi.fn<Fetch>(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x') } }))
    await expect(cargarPagina(poke, 1, 0, roto)).rejects.toBeInstanceOf(ErrorCatalogo)
  })

  it('Pokémon: una página vacía corta aunque el total diga que hay más', async () => {
    const p = await cargarPagina(poke, 5, 96, fetchFijo(200, { data: [], totalCount: 500 }))
    expect(p.hayMas).toBe(false)
  })

  it('MyL: filtra localmente sin red, sin distinguir mayúsculas', async () => {
    const f = fetchFijo(200)
    const todas = await cargarPagina({ juego: 'myl', texto: '', tipo: '' }, 1, 0, f)
    expect(todas.cartas.map(c => c.id)).toEqual([...todas.cartas.map(c => c.id)].sort())
    expect((await cargarPagina({ juego: 'myl', texto: '  ZEU ', tipo: '' }, 1, 0, f)).cartas.map(c => c.nombre)).toEqual(['Zeus'])
    expect((await cargarPagina({ juego: 'myl', texto: '', tipo: 'Celta' }, 1, 0, f)).total).toBe(1)
    expect(f).not.toHaveBeenCalled()
  })
})

describe('traducir', () => {
  it('agrega el aviso y falla si la API no traduce', async () => {
    await expect(traducir('Hello', fetchFijo(200, { responseData: { translatedText: 'Hola' } }))).resolves.toBe('Hola' + AVISO_TRADUCCION)
    await expect(traducir('Hello', fetchFijo(200, { responseData: {} }))).rejects.toThrow()
    await expect(traducir('Hello', fetchFijo(503))).rejects.toThrow()
  })
})

describe('useCatalogo', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('doble "Cargar más" hace un solo pedido', async () => {
    const f = vi.fn<Fetch>(async url => {
      const offset = Number(new URL(url).searchParams.get('offset'))
      return respuesta(200, ygoApi(offset + 1, 24, 100))
    })
    const cat = useCatalogo({ fetch: f })
    await cat.iniciar()
    const a = cat.cargarMas()
    const b = cat.cargarMas()
    await Promise.all([a, b])
    expect(f).toHaveBeenCalledTimes(2)
    expect(cat.cartas.value).toHaveLength(48)
    expect(new Set(cat.cartas.value.map(c => c.id)).size).toBe(48)
  })

  it('la respuesta de una consulta vieja no pisa la nueva', async () => {
    let soltarVieja: () => void = () => {}
    const f = vi.fn<Fetch>(url => {
      if (new URL(url).hostname.includes('ygoprodeck')) {
        return new Promise(resolve => { soltarVieja = () => resolve(respuesta(200, ygoApi(1, 24, 100))) })
      }
      return Promise.resolve(respuesta(200, { data: [{ id: 'a-1', name: 'Pikachu' }], totalCount: 1 }))
    })
    const cat = useCatalogo({ fetch: f })
    const vieja = cat.iniciar()
    await cat.cambiarJuego('poke')
    soltarVieja()
    await vieja
    expect(cat.cartas.value.map(c => c.nombre)).toEqual(['Pikachu'])
    expect(cat.cargando.value).toBe(false)
  })

  it('la búsqueda espera a que se deje de escribir', async () => {
    vi.useFakeTimers()
    const f = fetchFijo(200, ygoApi(1, 1, 1))
    const cat = useCatalogo({ fetch: f })
    cat.buscar('d')
    cat.buscar('dr')
    cat.buscar('dra ')
    expect(f).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(ESPERA_BUSQUEDA_MS)
    expect(f).toHaveBeenCalledTimes(1)
    expect(new URL(f.mock.calls[0]![0]).searchParams.get('fname')).toBe('dra')
  })

  it('un error deja la lista vacía con el aviso, y reintentar lo limpia', async () => {
    const f = vi.fn<Fetch>()
      .mockResolvedValueOnce(respuesta(500))
      .mockResolvedValueOnce(respuesta(200, ygoApi(1, 3, 3)))
    const cat = useCatalogo({ fetch: f })
    await cat.iniciar()
    expect(cat.error.value).toBe(true)
    expect(cat.cartas.value).toEqual([])
    await cat.iniciar()
    expect(cat.error.value).toBe(false)
    expect(cat.cartas.value).toHaveLength(3)
    expect(cat.hayMas.value).toBe(false)
  })
})
