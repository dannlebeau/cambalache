<script setup lang="ts">
const { cuenta, cerrarSesion } = useCuenta()
const { enviando, error, enviar } = useEnvio()

function salir() {
  enviar(async () => {
    await cerrarSesion()
    await navigateTo('/')
  })
}
</script>

<template>
  <header class="barra">
    <NuxtLink to="/" class="marca">Cambalache</NuxtLink>
    <nav class="nav-links" aria-label="Secciones">
      <NuxtLink to="/">Catálogo</NuxtLink>
      <NuxtLink to="/subastas" :aria-current="$route.path.startsWith('/subasta') ? 'page' : undefined">Subastas</NuxtLink>
    </nav>
    <nav class="nav-acciones" aria-label="Cuenta">
      <template v-if="cuenta">
        <span v-if="cuenta.esAdmin" class="etiqueta-admin">Admin</span>
        <span class="nav-usuario" :title="cuenta.email">{{ cuenta.nombre }}</span>
        <button
          type="button"
          class="boton boton-secundario"
          :disabled="enviando"
          @click="salir"
        >
          {{ enviando ? 'Saliendo…' : 'Salir' }}
        </button>
      </template>
      <template v-else>
        <NuxtLink to="/entrar" class="boton boton-secundario">Iniciar sesión</NuxtLink>
        <NuxtLink to="/registro" class="boton">Crear cuenta</NuxtLink>
      </template>
      <SelectorTema />
    </nav>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </header>
</template>
