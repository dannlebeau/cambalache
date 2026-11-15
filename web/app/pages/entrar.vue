<script setup lang="ts">
import { MENSAJE_CUENTA_BLOQUEADA, validarLogin } from '~/utils/cuenta'

useHead({ title: 'Iniciar sesión · Cambalache' })

const route = useRoute()
const supabase = useSupabaseClient()
const { sincronizar, cerrarSesion } = useCuenta()
const { enviando, error, enviar } = useEnvio()

const email = ref('')
const password = ref('')
const bloqueada = computed(() => route.query.motivo === 'bloqueada')

function entrar() {
  enviar(async () => {
    const invalido = validarLogin(email.value, password.value)
    if (invalido) throw new Error(invalido)
    const { error: errAuth } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value,
    })
    if (errAuth) throw errAuth
    const cuenta = await sincronizar(true)
    if (cuenta?.bloqueado) {
      await cerrarSesion()
      throw new Error(MENSAJE_CUENTA_BLOQUEADA)
    }
    password.value = ''
    await navigateTo(cuenta?.debeCambiarPassword ? '/cambiar-password' : '/')
  })
}
</script>

<template>
  <section class="formulario-cuenta">
    <h1>Iniciar sesión</h1>
    <p v-if="bloqueada && !error" class="error" role="alert">{{ MENSAJE_CUENTA_BLOQUEADA }}</p>
    <form novalidate @submit.prevent="entrar">
      <label for="email">Correo</label>
      <input id="email" v-model="email" type="email" autocomplete="email" required>
      <label for="password">Contraseña</label>
      <input id="password" v-model="password" type="password" autocomplete="current-password" required>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button type="submit" class="boton" :disabled="enviando">
        {{ enviando ? 'Un momento…' : 'Iniciar sesión' }}
      </button>
    </form>
    <p class="nota">¿No tienes cuenta? <NuxtLink to="/registro">Crea una</NuxtLink>.</p>
  </section>
</template>
