// Selector de tema Sistema / Claro / Oscuro. "Sistema" no guarda nada ni pone data-theme:
// manda prefers-color-scheme (ver app/assets/css/tema.css).

export const CLAVE_TEMA = 'cambalache-tema'

export const ORDEN_TEMAS = ['sistema', 'claro', 'oscuro'] as const

export type Tema = (typeof ORDEN_TEMAS)[number]

export const NOMBRE_TEMA: Record<Tema, string> = {
  sistema: 'Sistema',
  claro: 'Claro',
  oscuro: 'Oscuro',
}

export function esTema(valor: unknown): valor is Tema {
  return typeof valor === 'string' && (ORDEN_TEMAS as readonly string[]).includes(valor)
}

export function siguienteTema(tema: Tema): Tema {
  return ORDEN_TEMAS[(ORDEN_TEMAS.indexOf(tema) + 1) % ORDEN_TEMAS.length]!
}

// Valor de <html data-theme> para cada tema ("sistema" no lo pone).
export function atributoTema(tema: Tema): 'light' | 'dark' | undefined {
  if (tema === 'claro') return 'light'
  if (tema === 'oscuro') return 'dark'
  return undefined
}

export function etiquetaTema(tema: Tema): string {
  return `Tema: ${NOMBRE_TEMA[tema]}. Cambiar a ${NOMBRE_TEMA[siguienteTema(tema)]}`
}

// Script en línea para <head>: corre antes de pintar y antes de que Vue hidrate.
// Debe ser autosuficiente (no puede importar nada) y no fallar sin localStorage.
export const scriptTema = `(function(){try{var t=localStorage.getItem(${JSON.stringify(CLAVE_TEMA)});if(t==='claro')document.documentElement.dataset.theme='light';else if(t==='oscuro')document.documentElement.dataset.theme='dark';}catch(e){}})();`
