// Catálogo de cartas: consulta en vivo YGOPRODeck (Yu-Gi-Oh!) y Pokémon TCG API, más las cartas
// de ejemplo de Mitos y Leyendas (utils/myl.ts). Todo ordenado por ID, de a 24 cartas.
// Funciones puras con `fetch` inyectable, para probarlas sin red (test/catalogo.test.ts).
// Equivale a assets/js/app.js del sitio actual.
import { CARTAS_MYL, type CartaMyl } from './myl'

export type Juego = 'ygo' | 'poke' | 'myl'

export interface Carta {
  id: string
  juego: Juego
  nombre: string
  imagen: string
  imagenGrande: string
  descripcion: string
  idiomaOriginal: 'en' | 'es'
  meta: { k: string, v: string }[]
}

export interface Consulta {
  juego: Juego
  texto: string
  tipo: string
}

export interface Pagina {
  cartas: Carta[]
  total: number
  hayMas: boolean
}

export type Fetch = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

export const POR_PAGINA = 24

export const JUEGOS: Record<Juego, { label: string, corto: string }> = {
  ygo: { label: 'Yu-Gi-Oh!', corto: 'YGO' },
  poke: { label: 'Pokémon', corto: 'POKÉ' },
  myl: { label: 'Mitos y Leyendas', corto: 'MyL' },
}

export const TIPOS: Record<Juego, readonly string[]> = {
  ygo: ['Effect Monster', 'Normal Monster', 'Fusion Monster', 'Synchro Monster', 'XYZ Monster', 'Link Monster', 'Ritual Monster', 'Spell Card', 'Trap Card'],
  poke: ['Colorless', 'Darkness', 'Dragon', 'Fairy', 'Fighting', 'Fire', 'Grass', 'Lightning', 'Metal', 'Psychic', 'Water'],
  myl: [...new Set(CARTAS_MYL.map(c => c.mitologia))],
}

// ---- Respuestas de las APIs (solo los campos que se usan) ----

export interface CartaYgoApi {
  id: number
  name: string
  type?: string
  desc?: string
  race?: string
  attribute?: string
  atk?: number | null
  def?: number | null
  level?: number
  card_images?: { image_url?: string, image_url_small?: string }[]
}

export interface CartaPokeApi {
  id: string
  name: string
  supertype?: string
  types?: string[]
  hp?: string
  rarity?: string
  flavorText?: string
  set?: { name?: string }
  images?: { small?: string, large?: string }
}

type Meta = Carta['meta'][number]

function sinVacios(lista: (Meta | null)[]): Meta[] {
  return lista.filter((m): m is Meta => m !== null)
}

function tieneNumero(n: number | null | undefined): n is number {
  return n !== undefined && n !== null
}

// ---- Normalización por juego ----

export function normalizarYgo(c: CartaYgoApi): Carta {
  const img = c.card_images?.[0]
  return {
    id: 'ygo-' + c.id,
    juego: 'ygo',
    nombre: c.name,
    imagen: img?.image_url_small || '',
    imagenGrande: img?.image_url || img?.image_url_small || '',
    descripcion: c.desc || '(Sin descripción)',
    idiomaOriginal: 'en',
    meta: sinVacios([
      c.type ? { k: 'Tipo', v: c.type } : null,
      c.race ? { k: 'Raza/Clase', v: c.race } : null,
      c.attribute ? { k: 'Atributo', v: c.attribute } : null,
      tieneNumero(c.atk) ? { k: 'ATK', v: String(c.atk) } : null,
      tieneNumero(c.def) ? { k: 'DEF', v: String(c.def) } : null,
      c.level ? { k: 'Nivel', v: String(c.level) } : null,
    ]),
  }
}

export function normalizarPoke(c: CartaPokeApi): Carta {
  return {
    id: 'poke-' + c.id,
    juego: 'poke',
    nombre: c.name,
    imagen: c.images?.small || '',
    imagenGrande: c.images?.large || c.images?.small || '',
    descripcion: c.flavorText || '(Esta carta no tiene texto descriptivo en la API)',
    idiomaOriginal: 'en',
    meta: sinVacios([
      c.supertype ? { k: 'Tipo', v: c.supertype } : null,
      c.types?.length ? { k: 'Elemento', v: c.types.join(', ') } : null,
      c.hp ? { k: 'HP', v: c.hp } : null,
      c.set?.name ? { k: 'Set', v: c.set.name } : null,
      c.rarity ? { k: 'Rareza', v: c.rarity } : null,
    ]),
  }
}

export function normalizarMyl(c: CartaMyl): Carta {
  return {
    id: c.id,
    juego: 'myl',
    nombre: c.nombre,
    imagen: '',
    imagenGrande: '',
    descripcion: c.descripcion,
    idiomaOriginal: 'es',
    meta: [{ k: 'Mitología', v: c.mitologia }],
  }
}

// ---- URL de cada API (pagina empieza en 1) ----

export function urlYgo(c: Consulta, pagina: number): string {
  const p = new URLSearchParams({ num: String(POR_PAGINA), offset: String((pagina - 1) * POR_PAGINA), sort: 'id' })
  if (c.texto) p.set('fname', c.texto)
  if (c.tipo) p.set('type', c.tipo)
  return `https://db.ygoprodeck.com/api/v7/cardinfo.php?${p}`
}

export function urlPoke(c: Consulta, pagina: number): string {
  const p = new URLSearchParams({ page: String(pagina), pageSize: String(POR_PAGINA), orderBy: 'id' })
  const q: string[] = []
  if (c.texto) q.push(`name:${c.texto}*`)
  if (c.tipo) q.push(`types:${c.tipo}`)
  if (q.length) p.set('q', q.join(' '))
  return `https://api.pokemontcg.io/v2/cards?${p}`
}

// ---- Carga de una página ----

export class ErrorCatalogo extends Error {}

// `cargadasAntes`: cuántas cartas ya se muestran, para saber si quedan más.
export async function cargarPagina(c: Consulta, pagina: number, cargadasAntes: number, fetchFn: Fetch): Promise<Pagina> {
  if (c.juego === 'myl') {
    const texto = c.texto.trim().toLowerCase()
    const lista = [...CARTAS_MYL]
      .sort((a, b) => a.id.localeCompare(b.id))
      .filter(m => (!texto || m.nombre.toLowerCase().includes(texto)) && (!c.tipo || m.mitologia === c.tipo))
    return { cartas: lista.map(normalizarMyl), total: lista.length, hayMas: false }
  }

  const url = c.juego === 'ygo' ? urlYgo(c, pagina) : urlPoke(c, pagina)
  let resp: Awaited<ReturnType<Fetch>>
  try {
    resp = await fetchFn(url)
  }
  catch {
    throw new ErrorCatalogo(`Error de red consultando ${JUEGOS[c.juego].label}`)
  }
  // YGOPRODeck responde 400 cuando ninguna carta coincide con la búsqueda.
  if (!resp.ok) {
    if (c.juego === 'ygo' && resp.status === 400) return { cartas: [], total: 0, hayMas: false }
    throw new ErrorCatalogo(`${JUEGOS[c.juego].label} respondió ${resp.status}`)
  }

  let cartas: Carta[]
  let total: number
  try {
    if (c.juego === 'ygo') {
      const data = await resp.json() as { data?: CartaYgoApi[], meta?: { total_rows?: number } }
      cartas = (data.data ?? []).map(normalizarYgo)
      total = data.meta?.total_rows ?? cargadasAntes + cartas.length
    }
    else {
      const data = await resp.json() as { data?: CartaPokeApi[], totalCount?: number }
      cartas = (data.data ?? []).map(normalizarPoke)
      total = data.totalCount ?? 0
    }
  }
  catch {
    throw new ErrorCatalogo(`Respuesta inválida de ${JUEGOS[c.juego].label}`)
  }

  // Una página vacía corta la paginación aunque el total diga otra cosa.
  return { cartas, total, hayMas: cartas.length > 0 && cargadasAntes + cartas.length < total }
}

// ---- Traducción al español (MyMemory, gratis y sin clave) ----

export const AVISO_TRADUCCION = '\n\n(traducción automática, puede tener errores)'

export async function traducir(texto: string, fetchFn: Fetch): Promise<string> {
  // 480 caracteres: límite razonable de la API gratuita.
  const q = encodeURIComponent(texto.slice(0, 480))
  const resp = await fetchFn(`https://api.mymemory.translated.net/get?q=${q}&langpair=en|es`)
  if (!resp.ok) throw new ErrorCatalogo('Error de red al traducir')
  const data = await resp.json() as { responseData?: { translatedText?: string } }
  const traducido = data.responseData?.translatedText
  if (!traducido) throw new ErrorCatalogo('Sin traducción disponible')
  return traducido + AVISO_TRADUCCION
}
