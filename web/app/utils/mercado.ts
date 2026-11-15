// Mi cuenta y publicar: tipos, textos y reglas de presentación que no dependen de Nuxt ni de
// Supabase (se prueban con Vitest). Las reglas que importan (quién puede pagar, cancelar o
// publicar, rangos de precio) las valida Postgres en `simular_pago`, `cancelar_publicacion`,
// `publicar_carta` y en los check de las tablas; aquí solo se dan mensajes antes.
import { JUEGOS, type Carta, type Juego } from './catalogo'
import { CONSERVACION } from './subastas'

export type EstadoPublicacion = 'pendiente_envio' | 'en_subasta' | 'adjudicada' | 'vendida' | 'por_devolver' | 'devuelta' | 'cancelada'
export type EstadoVenta = 'pendiente_pago' | 'pagada' | 'despachada' | 'liquidada' | 'impaga'
export type Tono = 'warn' | 'activo' | 'ok' | ''

export const ESTADO_PUBLICACION: Record<EstadoPublicacion, { label: string, tono: Tono }> = {
  pendiente_envio: { label: 'Esperando que envíes la carta', tono: 'warn' },
  en_subasta: { label: 'En subasta', tono: 'activo' },
  adjudicada: { label: 'Adjudicada · esperando pago', tono: 'warn' },
  vendida: { label: 'Vendida', tono: 'ok' },
  por_devolver: { label: 'Por devolver', tono: 'warn' },
  devuelta: { label: 'Devuelta', tono: '' },
  cancelada: { label: 'Cancelada', tono: '' },
}

export const ESTADO_VENTA: Record<EstadoVenta, { label: string, tono: Tono }> = {
  pendiente_pago: { label: 'Pendiente de pago', tono: 'warn' },
  pagada: { label: 'Pagada · por despachar', tono: 'activo' },
  despachada: { label: 'Despachada', tono: 'activo' },
  liquidada: { label: 'Liquidada', tono: 'ok' },
  impaga: { label: 'Impaga', tono: '' },
}

// Fila de public.configuracion (una sola, id = 1). Los numeric llegan como texto o número.
export interface Configuracion {
  duracion_horas: number
  comision: number | string
  recargo_compra_inmediata: number | string
  descuento_republicacion: number | string
}

interface CartaResumen {
  nombre: string
  imagen: string | null
  juego: Juego
}

// Fila de public.ventas con su publicación (Mis compras).
export interface Compra {
  id: number
  tipo: 'puja' | 'compra_inmediata' | 'segundo_postor'
  monto: number
  estado: EstadoVenta
  limite_pago: string
  publicaciones: CartaResumen | null
}

// Fila de public.pujas con su subasta (Mis pujas).
export interface MiPuja {
  monto: number
  subastas: {
    id: number
    fin: string
    estado: 'activa' | 'cerrada'
    precio_actual: number | null
    lider_id: string | null
    publicaciones: CartaResumen | null
  } | null
}

// Fila de public.publicaciones con sus rondas y ventas (Mis cartas publicadas).
export interface MiPublicacion {
  id: number
  juego: Juego
  nombre: string
  imagen: string | null
  estado: EstadoPublicacion
  motivo: string | null
  subastas: { id: number, ronda: number, precio_base: number, precio_actual: number | null, fin: string, estado: 'activa' | 'cerrada' }[] | null
  ventas: { estado: EstadoVenta, monto: number, comision: number, pago_vendedor: number }[] | null
}

export interface GrupoPujas {
  subasta: NonNullable<MiPuja['subastas']>
  miMaxima: number
}

// Mis pujas agrupadas por subasta con mi puja más alta en cada una; primero las activas.
export function agruparPujas(pujas: readonly MiPuja[]): GrupoPujas[] {
  const porSubasta = new Map<number, GrupoPujas>()
  for (const p of pujas) {
    if (!p.subastas) continue
    const g = porSubasta.get(p.subastas.id) ?? { subasta: p.subastas, miMaxima: 0 }
    g.miMaxima = Math.max(g.miMaxima, p.monto)
    porSubasta.set(p.subastas.id, g)
  }
  const orden = (g: GrupoPujas) => (g.subasta.estado === 'activa' ? 0 : 1)
  return [...porSubasta.values()].sort((a, b) => orden(a) - orden(b))
}

// Ronda más reciente y venta viva de una publicación (las impagas quedan como historial).
export function resumenPublicacion(p: MiPublicacion) {
  const rondas = [...(p.subastas ?? [])].sort((a, b) => b.ronda - a.ronda)
  return {
    actual: rondas[0] ?? null,
    venta: (p.ventas ?? []).find(v => v.estado !== 'impaga') ?? null,
  }
}

// Datos de la carta que llegan por la URL desde el catálogo (?juego=&ref=&nombre=&imagen=).
export interface CartaDesdeUrl {
  juego: Juego | ''
  ref: string
  nombre: string
  imagen: string | null
}

function texto(valor: unknown): string {
  const v = Array.isArray(valor) ? valor[0] : valor
  return typeof v === 'string' ? v.trim() : ''
}

export function esJuego(valor: unknown): valor is Juego {
  return typeof valor === 'string' && Object.hasOwn(JUEGOS, valor)
}

// Lee la carta de la URL. Solo vale si trae juego y ref válidos; la imagen solo si es https
// (la base también lo exige).
export function cartaDesdeUrl(query: Record<string, unknown>): CartaDesdeUrl | null {
  const juego = texto(query.juego)
  const ref = texto(query.ref)
  const nombre = texto(query.nombre)
  if (!esJuego(juego) || !ref || ref.length > 80 || !nombre) return null
  const imagen = texto(query.imagen)
  return { juego, ref, nombre: nombre.slice(0, 120), imagen: imagen.startsWith('https://') ? imagen : null }
}

// Link a /publicar desde una carta del catálogo.
export function urlPublicar(carta: Pick<Carta, 'id' | 'juego' | 'nombre' | 'imagen' | 'imagenGrande'>): { path: string, query: Record<string, string> } {
  const query: Record<string, string> = { juego: carta.juego, ref: carta.id, nombre: carta.nombre }
  const imagen = carta.imagenGrande || carta.imagen
  if (imagen) query.imagen = imagen
  return { path: '/publicar', query }
}

export interface FormPublicar {
  juego: Juego | ''
  nombre: string
  conservacion: string
  precioBase: number | ''
  precioMinimo: number | ''
  aceptaTerminos: boolean
}

const esPrecio = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 100

// Error en español o null si se puede enviar.
export function validarPublicacion(f: FormPublicar): string | null {
  if (!f.juego) return 'Elige el juego.'
  if (!f.nombre.trim()) return 'Escribe el nombre de la carta.'
  if (f.nombre.trim().length > 120) return 'El nombre puede tener hasta 120 caracteres.'
  if (!Object.hasOwn(CONSERVACION, f.conservacion)) return 'Indica el estado de la carta.'
  if (!esPrecio(f.precioBase)) return 'El precio base debe ser un número entero de al menos $100.'
  if (f.precioMinimo !== '' && (!esPrecio(f.precioMinimo) || f.precioMinimo > f.precioBase)) {
    return 'El precio mínimo debe estar entre $100 y el precio base.'
  }
  if (!f.aceptaTerminos) return 'Tienes que aceptar los Términos y Condiciones.'
  return null
}

export const porcentaje = (v: number | string) => Math.round(Number(v) * 100)

// Lo que recibiría el vendedor si se vende al precio base, y el precio de "comprar ya" mientras
// nadie puje (misma fórmula que la base: redondeo a la centena). null si el precio no sirve.
export function calcularPublicacion(base: unknown, config: Configuracion) {
  if (!esPrecio(base)) return null
  const comision = Math.round(base * Number(config.comision))
  return {
    base,
    comision,
    recibes: base - comision,
    compraYa: Math.round((base * (1 + Number(config.recargo_compra_inmediata))) / 100) * 100,
  }
}
