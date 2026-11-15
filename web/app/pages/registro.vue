<script setup lang="ts">
import { LARGO_MINIMO_PASSWORD, validarRegistro } from '~/utils/cuenta'

useHead({ title: 'Crear cuenta · Cambalache' })

const supabase = useSupabaseClient()
const { sincronizar } = useCuenta()
const { enviando, error, enviar } = useEnvio()

const nombre = ref('')
const email = ref('')
const password = ref('')
const password2 = ref('')
const pendienteConfirmar = ref('')

function registrar() {
  enviar(async () => {
    pendienteConfirmar.value = ''
    const invalido = validarRegistro({ nombre: nombre.value, email: email.value, password: password.value, password2: password2.value })
    if (invalido) throw new Error(invalido)
    const correo = email.value.trim()
    const { data, error: errAuth } = await supabase.auth.signUp({
      email: correo,
      password: password.value,
      options: { data: { nombre: nombre.value.trim() }, emailRedirectTo: `${location.origin}/` },
    })
    if (errAuth) throw errAuth
    password.value = ''
    password2.value = ''
    if (data.session) {
      await sincronizar(true)
      await navigateTo('/')
    }
    else {
      // Con confirmación de correo activada, la cuenta queda pendiente hasta abrir el link.
      pendienteConfirmar.value = correo
    }
  })
}
</script>

<template>
  <section class="formulario-cuenta">
    <h1>Crear cuenta</h1>
    <p v-if="pendienteConfirmar" class="ok" role="status">
      Te enviamos un correo a {{ pendienteConfirmar }} para confirmar tu cuenta. Después inicia sesión.
    </p>
    <form novalidate @submit.prevent="registrar">
      <label for="nombre">Nombre</label>
      <input id="nombre" v-model="nombre" type="text" autocomplete="name" maxlength="60" required>
      <label for="email">Correo</label>
      <input id="email" v-model="email" type="email" autocomplete="email" required>
      <label for="password">Contraseña (mínimo {{ LARGO_MINIMO_PASSWORD }} caracteres)</label>
      <input id="password" v-model="password" type="password" autocomplete="new-password" :minlength="LARGO_MINIMO_PASSWORD" required>
      <label for="password2">Repetir contraseña</label>
      <input id="password2" v-model="password2" type="password" autocomplete="new-password" :minlength="LARGO_MINIMO_PASSWORD" required>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button type="submit" class="boton" :disabled="enviando">
        {{ enviando ? 'Un momento…' : 'Crear cuenta' }}
      </button>
    </form>
    <p class="nota">¿Ya tienes cuenta? <NuxtLink to="/entrar">Inicia sesión</NuxtLink>.</p>
  </section>
</template>
