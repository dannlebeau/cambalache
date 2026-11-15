// Selector de tema Sistema / Claro / Oscuro. Se carga en <head> sin defer para aplicar el
// tema guardado antes de pintar (sin parpadeo). "Sistema" no guarda nada ni pone
// data-theme: manda prefers-color-scheme (ver assets/css/tema.css).
(function () {
  const CLAVE = 'cambalache-tema';
  const ORDEN = ['sistema', 'claro', 'oscuro'];
  const DATOS = {
    sistema: { nombre: 'Sistema', icono: 'fa-circle-half-stroke' },
    claro: { nombre: 'Claro', icono: 'fa-sun' },
    oscuro: { nombre: 'Oscuro', icono: 'fa-moon' },
  };

  function leer() {
    try {
      const guardado = localStorage.getItem(CLAVE);
      return ORDEN.includes(guardado) ? guardado : 'sistema';
    } catch {
      return 'sistema';
    }
  }

  function aplicar(tema) {
    const raiz = document.documentElement;
    if (tema === 'claro') raiz.dataset.theme = 'light';
    else if (tema === 'oscuro') raiz.dataset.theme = 'dark';
    else delete raiz.dataset.theme;
  }

  function guardar(tema) {
    try {
      if (tema === 'sistema') localStorage.removeItem(CLAVE);
      else localStorage.setItem(CLAVE, tema);
    } catch {
      // Sin localStorage (modo privado, bloqueado): el tema dura solo esta página.
    }
  }

  function pintarBoton(boton, tema) {
    const siguiente = ORDEN[(ORDEN.indexOf(tema) + 1) % ORDEN.length];
    const etiqueta = `Tema: ${DATOS[tema].nombre}. Cambiar a ${DATOS[siguiente].nombre}`;
    boton.setAttribute('aria-label', etiqueta);
    boton.title = etiqueta;
    boton.innerHTML = `<i class="fas ${DATOS[tema].icono}" aria-hidden="true"></i>`;
  }

  let actual = leer();
  aplicar(actual);

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-tema-toggle]').forEach((boton) => {
      pintarBoton(boton, actual);
      boton.addEventListener('click', () => {
        actual = ORDEN[(ORDEN.indexOf(actual) + 1) % ORDEN.length];
        aplicar(actual);
        guardar(actual);
        pintarBoton(boton, actual);
      });
    });
  });
})();
