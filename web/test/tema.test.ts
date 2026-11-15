import { describe, expect, it } from 'vitest'
import { atributoTema, esTema, etiquetaTema, scriptTema, siguienteTema } from '../app/utils/tema'

describe('tema', () => {
  it('rota sistema → claro → oscuro → sistema', () => {
    expect(siguienteTema('sistema')).toBe('claro')
    expect(siguienteTema('claro')).toBe('oscuro')
    expect(siguienteTema('oscuro')).toBe('sistema')
  })

  it('solo acepta los tres temas', () => {
    expect(esTema('claro')).toBe(true)
    expect(esTema('dark')).toBe(false)
    expect(esTema(null)).toBe(false)
  })

  it('sistema no pone data-theme', () => {
    expect(atributoTema('sistema')).toBeUndefined()
    expect(atributoTema('claro')).toBe('light')
    expect(atributoTema('oscuro')).toBe('dark')
  })

  it('la etiqueta nombra el tema actual y el siguiente', () => {
    expect(etiquetaTema('oscuro')).toBe('Tema: Oscuro. Cambiar a Sistema')
  })

  it('el script de <head> aplica el tema guardado y no falla sin localStorage', () => {
    const dataset: Record<string, string> = {}
    const ejecutar = (localStorage: unknown) =>
      new Function('localStorage', 'document', scriptTema)(localStorage, { documentElement: { dataset } })

    ejecutar({ getItem: () => 'oscuro' })
    expect(dataset.theme).toBe('dark')

    expect(() => ejecutar({ getItem: () => { throw new Error('bloqueado') } })).not.toThrow()
  })
})
