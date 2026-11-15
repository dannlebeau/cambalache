import { CLAVE_TEMA, atributoTema, esTema, siguienteTema, type Tema } from '~/utils/tema'

// Estado del tema compartido por toda la app. En el servidor siempre es "sistema"
// (no conoce localStorage); en el navegador se lee al montar, después de hidratar.
export function useTema() {
  const tema = useState<Tema>('tema', () => 'sistema')

  function leer(): Tema {
    try {
      const guardado = localStorage.getItem(CLAVE_TEMA)
      return esTema(guardado) ? guardado : 'sistema'
    }
    catch {
      return 'sistema'
    }
  }

  function aplicar(nuevo: Tema) {
    const valor = atributoTema(nuevo)
    if (valor) document.documentElement.dataset.theme = valor
    else delete document.documentElement.dataset.theme
  }

  function guardar(nuevo: Tema) {
    try {
      if (nuevo === 'sistema') localStorage.removeItem(CLAVE_TEMA)
      else localStorage.setItem(CLAVE_TEMA, nuevo)
    }
    catch {
      // Sin localStorage (modo privado, bloqueado): el tema dura solo esta página.
    }
  }

  function cargar() {
    tema.value = leer()
  }

  function rotar() {
    const nuevo = siguienteTema(tema.value)
    tema.value = nuevo
    aplicar(nuevo)
    guardar(nuevo)
  }

  return { tema, cargar, rotar }
}
