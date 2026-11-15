<script setup lang="ts">
import { LARGO_MINIMO_PASSWORD, validarPasswordNueva } from '~/utils/cuenta'

useHead({ title: 'Cambiar contraseña · Cambalache' })

const supabase = useSupabaseClient()
const { cuenta, sincronizar } = useCuenta()
const { enviando, error, enviar } = useEnvio()

// Sin sesión no hay contraseña que cambiar.
if (!cuenta.value) await navigateTo('/entrar')

const password = ref('')
const password2 = ref('')

function guardar() {
  enviar(async () => {
    const invalido = validarPasswordNueva(password.value, password2.value)
    if (invalido) throw new Error(invalido)
    const { error: errAuth } = await supabase.auth.updateUser({ password: password.value })
    if (errAuth) throw errAuth
    const { error: errRpc } = await supabase.rpc('confirmar_cambio_password')
    if (errRpc) throw errRpc
    password.value = ''
    password2.value = ''
    await sincronizar(true)
    await navigateTo('/')
  })
}
</script>

<template>
  <section class="formulario-cuenta">
    <h1>Cambia tu contraseña</h1>
    <p v-if="cuenta?.debeCambiarPassword">Tu cuenta tiene una contraseña temporal. Elige una nueva para seguir.</p>
    <form novalidate @submit.prevent="guardar">
      <!-- Para que el gestor de contraseñas asocie la nueva al correo correcto. -->
      <input type="email" autocomplete="username" :value="cuenta?.email" hidden>
      <label for="password">Contraseña nueva (mínimo {{ LARGO_MINIMO_PASSWORD }} caracteres)</label>
      <input id="password" v-model="password" type="password" autocomplete="new-password" :minlength="LARGO_MINIMO_PASSWORD" required>
      <label for="password2">Repetir contraseña</label>
      <input id="password2" v-model="password2" type="password" autocomplete="new-password" :minlength="LARGO_MINIMO_PASSWORD" required>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button type="submit" class="boton" :disabled="enviando">
        {{ enviando ? 'Guardando…' : 'Guardar contraseña' }}
      </button>
    </form>
  </section>
</template>
