// Subastas: tipos y reglas de presentación que no dependen de Nuxt ni de Supabase (se prueban
// con Vitest). Las reglas que importan (puja mínima, cierre, anti-sniping, no pujar la propia
// carta) las valida Postgres en `pujar` y `comprar_ahora`; aquí solo se muestran.
import type { Juego } from './catalogo'

// Fila de la vista public.subastas_publicas.
export interface SubastaPublica {
  id: number
  publicacion_id: number
  ronda: number
  precio_base: number
  inicio: string
  fin: string
  estado: 'activa' | 'cerrada'
  resultado: 'vendida' | 'compra_inmediata' | 'sin_pujas' | null
  precio_actual: number | null
  num_pujas: number
  lider_id: string | null
  juego: Juego
  carta_ref: string
  nombre: string
  imagen: string | null
  conservacion: string
  notas: string | null
  puja_minima: number
  precio_compra_inmediata: number
}

// Fila de public.historial_pujas: el postor es "Tú" o "Postor N", nunca quién es.
export interface PujaHistorial {
  monto: number
  creada: string
  postor: string
}

export const CONSERVACION: Record<string, string> = {
  nueva: 'Nueva',
  casi_nueva: 'Casi nueva',
  buena: 'Buena',
  jugada: 'Jugada',
  danada: 'Dañada',
}

export const TEXTO_RESULTADO: Record<string, string> = {
  vendida: 'Esta subasta cerró con un ganador.',
  compra_inmediata: 'Alguien compró esta carta de inmediato.',
  sin_pujas: 'Cerró sin pujas; la carta vuelve a subasta con un 10% de descuento.',
}

// Zona fija para que el servidor y el navegador escriban la misma fecha (sin errores de
// hidratación) y para que la hora sea la de Chile aunque el servidor esté en UTC.
export const ZONA_HORARIA = 'America/Santiago'

const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: ZONA_HORARIA })

export function formatCLP(valor: number): string {
  return clp.format(valor)
}

export function formatFecha(valor: string): string {
  return fecha.format(new Date(valor))
}

// "2d 4h", "3h 12m", "4m 09s" o "Cerrada".
export function tiempoRestante(fin: string, ahora: number): string {
  const ms = new Date(fin).getTime() - ahora
  if (!(ms > 0)) return 'Cerrada'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${String(s % 60).padStart(2, '0')}s`
}

// Precio que se muestra en grande y su etiqueta.
export function precioVisible(s: Pick<SubastaPublica, 'precio_actual' | 'precio_base'>): { monto: number, etiqueta: string } {
  return s.precio_actual != null
    ? { monto: s.precio_actual, etiqueta: 'Puja actual' }
    : { monto: s.precio_base, etiqueta: 'Precio base' }
}

// Error en español o null si el monto se puede enviar. `monto` llega del <input type=number>
// (vacío es '' o null).
export function validarPuja(monto: unknown, minima: number): string | null {
  const n = typeof monto === 'number' ? monto : Number.NaN
  if (!Number.isInteger(n) || n < minima) return `La puja mínima es ${formatCLP(minima)}.`
  return null
}

// Filtro del listado por juego ('' = todos) y por texto en el nombre (sin mayúsculas ni tildes).
export function filtrarSubastas<T extends Pick<SubastaPublica, 'juego' | 'nombre'>>(lista: readonly T[], juego: Juego | '', texto: string): T[] {
  const normalizar = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const buscado = normalizar(texto.trim())
  return lista.filter(s => (!juego || s.juego === juego) && (!buscado || normalizar(s.nombre).includes(buscado)))
}

// Id de /subasta/[id]: entero positivo o null.
export function idSubasta(valor: unknown): number | null {
  const texto = Array.isArray(valor) ? valor[0] : valor
  if (typeof texto !== 'string' || !/^[1-9]\d{0,15}$/.test(texto)) return null
  const n = Number(texto)
  return Number.isSafeInteger(n) ? n : null
}

// Junta varias llamadas seguidas en una sola, `ms` después de la última (los eventos de
// Realtime llegan en ráfagas: una puja cambia la fila y a veces otra puja llega enseguida).
export function agrupar(fn: () => void, ms: number): { programar: () => void, cancelar: () => void } {
  let pendiente: ReturnType<typeof setTimeout> | undefined
  return {
    programar() {
      clearTimeout(pendiente)
      pendiente = setTimeout(fn, ms)
    },
    cancelar() {
      clearTimeout(pendiente)
      pendiente = undefined
    },
  }
}

// Cliente mínimo de Realtime que se usa (el de supabase-js lo cumple); permite probarlo.
export interface CanalRealtime {
  on(tipo: 'postgres_changes', filtro: { event: '*', schema: string, table: string, filter?: string }, cb: () => void): CanalRealtime
  subscribe(): unknown
}
export interface ClienteRealtime {
  channel(nombre: string): CanalRealtime
  removeChannel(canal: CanalRealtime): unknown
}

// Escucha los cambios de public.subastas (todas o solo `id`) y llama `recargar` agrupado.
// Devuelve la función que cierra el canal.
export function escucharSubastas(cliente: ClienteRealtime, recargar: () => void, opciones: { id?: number, ms?: number } = {}): () => void {
  const { id, ms = 400 } = opciones
  const recarga = agrupar(recargar, ms)
  const canal = cliente
    .channel(id ? `subasta-${id}` : 'listado-subastas')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'subastas', ...(id ? { filter: `id=eq.${id}` } : {}) }, recarga.programar)
  canal.subscribe()
  return () => {
    recarga.cancelar()
    cliente.removeChannel(canal)
  }
}
