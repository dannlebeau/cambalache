// Modal de "Iniciar sesión" / "Crear cuenta", compartido por index.html y canasto.html.
// Usa las funciones de cuentas de assets/js/shared.js. Después de loguear o registrar,
// refresca el indicador de cuenta en el nav y, si existe (en canasto.html), vuelve a
// renderizar el resto de la página.

function openAuthModal(tab) {
  document.getElementById('authOverlay').classList.add('open');
  switchAuthTab(tab || 'login');
}

function closeAuthModal() {
  document.getElementById('authOverlay').classList.remove('open');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('loginForm').style.display = tab === 'login' ? 'flex' : 'none';
  document.getElementById('registroForm').style.display = tab === 'registro' ? 'flex' : 'none';
  document.getElementById('loginError').textContent = '';
  document.getElementById('registroError').textContent = '';
}

document.addEventListener('DOMContentLoaded', () => {
  renderNavAccount();

  document.getElementById('authClose').addEventListener('click', closeAuthModal);
  document.getElementById('authOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'authOverlay') closeAuthModal();
  });
  document.querySelectorAll('.auth-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
  });

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const res = await iniciarSesion(email, password);
    if (!res.ok) {
      document.getElementById('loginError').textContent = res.error;
      return;
    }
    closeAuthModal();
    renderNavAccount();
    if (typeof renderAll === 'function') renderAll();
  });

  document.getElementById('registroForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('registroNombre').value.trim();
    const email = document.getElementById('registroEmail').value;
    const p1 = document.getElementById('registroPassword').value;
    const p2 = document.getElementById('registroPassword2').value;
    const errEl = document.getElementById('registroError');

    if (!nombre) { errEl.textContent = 'Poné tu nombre.'; return; }
    if (p1.length < 6) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
    if (p1 !== p2) { errEl.textContent = 'Las contraseñas no coinciden.'; return; }

    const res = await registrarUsuario(nombre, email, p1);
    if (!res.ok) { errEl.textContent = res.error; return; }
    closeAuthModal();
    renderNavAccount();
    if (typeof renderAll === 'function') renderAll();
  });
});
