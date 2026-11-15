<script setup lang="ts">
import { JUEGOS, type Juego } from '~/utils/catalogo'
import { mensajeError } from '~/utils/cuenta'
import {
  calcularPublicacion, cartaDesdeUrl, porcentaje, validarPublicacion, type Configuracion, type FormPublicar,
} from '~/utils/mercado'
import { CONSERVACION, formatCLP } from '~/utils/subastas'

// Publicar una carta: queda "esperando que la envíes" hasta que el admin recibe la carta física
// y la aprueba. Solo en el navegador y con sesión (nuxt.config.ts y el middleware). Las reglas
// las valida `publicar_carta` y los check de la tabla; aquí solo se dan mensajes antes.
useHead({ title: 'Publicar una carta · Cambalache' })

const route = useRoute()
const supabase = useSupabaseClient()
const llamar = useRpc()
const { enviando, error, enviar } = useEnvio()

const { data: config, error: errorConfig, refresh } = await useAsyncData('configuracion', async () => {
  const { data, error: err } = await supabase
    .from('configuracion')
    .select('duracion_horas, comision, recargo_compra_inmediata, descuento_republicacion')
    .single()
  if (err) throw err
  return data as Configuracion
})

// Desde el catálogo llega la carta por la URL; si no, se escribe a mano.
const desdeCatalogo = ref(cartaDesdeUrl(route.query))
const juegos = Object.entries(JUEGOS) as [Juego, { label: string }][]

function formularioVacio(): FormPublicar {
  return {
    juego: desdeCatalogo.value?.juego ?? '',
    nombre: desdeCatalogo.value?.nombre ?? '',
    conservacion: '',
    precioBase: '',
    precioMinimo: '',
    aceptaTerminos: false,
  }
}
const form = reactive(formularioVacio())
const notas = ref('')
const imagenFallo = ref(false)
const publicada = ref<{ id: number, nombre: string } | null>(null)

const calculo = computed(() => config.value ? calcularPublicacion(form.precioBase, config.value) : null)

function publicar() {
  enviar(async () => {
    const invalido = validarPublicacion(form)
    if (invalido) throw new Error(invalido)
    const nombre = form.nombre.trim()
    const id = await llamar<number>('publicar_carta', {
      p_juego: form.juego,
      p_carta_ref: desdeCatalogo.value?.ref ?? `${form.juego}-manual-${Date.now()}`,
      p_nombre: nombre,
      p_imagen: desdeCatalogo.value?.imagen ?? null,
      p_conservacion: form.conservacion,
      p_notas: notas.value,
      p_precio_base: form.precioBase,
      p_precio_minimo: form.precioMinimo === '' ? null : form.precioMinimo,
    })
    publicada.value = { id, nombre }
  })
}

// "Publicar otra": formulario limpio y sin la carta del catálogo en la URL.
async function publicarOtra() {
  await navigateTo('/publicar', { replace: true })
  desdeCatalogo.value = null
  publicada.value = null
  Object.assign(form, formularioVacio())
  notas.value = ''
}
</script>

<template>
  <div class="publicar">
    <header class="portada">
      <span class="antetitulo">Vender</span>
      <h1>Publicar una carta</h1>
      <p>
        Nos envías la carta, la revisamos y queda en custodia; recién entonces sale a subasta. Cuando
        se vende, Cambalache se queda con una comisión y tú recibes el resto.
      </p>
    </header>

    <div v-if="errorConfig" class="estado" role="alert">
      <p class="error">No pudimos cargar las reglas de publicación. {{ mensajeError(errorConfig) }}</p>
      <button type="button" class="boton boton-secundario" @click="refresh()">Reintentar</button>
    </div>
    <p v-else-if="!config" class="estado">Cargando…</p>

    <section v-else-if="publicada" class="panel" aria-live="polite">
      <p class="ok">
        Publicaste <strong>{{ publicada.nombre }}</strong>. Código de envío: <strong class="mono">#{{ publicada.id }}</strong>.
      </p>
      <h2 class="seccion">Siguiente paso: envíanos la carta</h2>
      <ol class="pasos">
        <li>Te escribiremos al correo de tu cuenta con la dirección de envío.</li>
        <li>Envía la carta protegida (funda + toploader) y anota el código <strong class="mono">#{{ publicada.id }}</strong> en el paquete.</li>
        <li>Cuando la recibamos y revisemos, sale a subasta y lo verás en <NuxtLink to="/mi-cuenta#publicaciones">Mi cuenta</NuxtLink>.</li>
      </ol>
      <p class="acciones">
        <NuxtLink to="/mi-cuenta#publicaciones" class="boton">Ir a Mi cuenta</NuxtLink>
        <button type="button" class="boton boton-secundario" @click="publicarOtra">Publicar otra</button>
      </p>
    </section>

    <form v-else class="panel formulario-publicar" novalidate @submit.prevent="publicar">
      <div v-if="desdeCatalogo?.imagen && !imagenFallo" class="publicar-visual">
        <img :src="desdeCatalogo.imagen" alt="" @error="imagenFallo = true">
      </div>

      <div class="fila-campos">
        <div class="grupo">
          <label for="juego">Juego</label>
          <select id="juego" v-model="form.juego" class="campo" required :disabled="!!desdeCatalogo">
            <option value="">Elige…</option>
            <option v-for="[clave, meta] in juegos" :key="clave" :value="clave">{{ meta.label }}</option>
          </select>
        </div>
        <div class="grupo">
          <label for="nombre">Carta</label>
          <input id="nombre" v-model="form.nombre" class="campo" maxlength="120" required :readonly="!!desdeCatalogo">
          <span v-if="!desdeCatalogo" class="ayuda">
            ¿Es de Yu-Gi-Oh! o Pokémon? Mejor elígela en el <NuxtLink to="/">catálogo</NuxtLink> y aprieta "Subastar esta carta".
          </span>
        </div>
      </div>

      <div class="fila-campos">
        <div class="grupo">
          <label for="conservacion">Estado de la carta</label>
          <select id="conservacion" v-model="form.conservacion" class="campo" required>
            <option value="">Elige…</option>
            <option v-for="(label, clave) in CONSERVACION" :key="clave" :value="clave">{{ label }}</option>
          </select>
          <span class="ayuda">Lo confirmamos al recibirla; si no coincide, te la devolvemos.</span>
        </div>
        <div class="grupo">
          <label for="precioBase">Precio base (CLP)</label>
          <input id="precioBase" v-model.number="form.precioBase" class="campo" type="number" min="100" step="100" inputmode="numeric" required>
          <span class="ayuda">La primera puja parte desde aquí.</span>
        </div>
        <div class="grupo">
          <label for="precioMinimo">Precio mínimo (opcional)</label>
          <input id="precioMinimo" v-model.number="form.precioMinimo" class="campo" type="number" min="100" step="100" inputmode="numeric">
          <span class="ayuda">
            Si no se vende, se republica con −{{ porcentaje(config.descuento_republicacion) }}% cada vez. Bajo este precio, te la devolvemos.
          </span>
        </div>
      </div>

      <div class="grupo">
        <label for="notas">Notas para los compradores (opcional)</label>
        <textarea id="notas" v-model="notas" class="campo" maxlength="500" placeholder="Edición, idioma, detalles del estado…" />
      </div>

      <div class="calculo" aria-live="polite">
        <template v-if="calculo">
          <strong>Si se vende al precio base ({{ formatCLP(calculo.base) }}):</strong>
          recibes <strong>{{ formatCLP(calculo.recibes) }}</strong> y Cambalache {{ formatCLP(calculo.comision) }}
          ({{ porcentaje(config.comision) }}%).
          <span class="ayuda">
            Las pujas pueden subir el precio. Mientras nadie puje, cualquiera puede comprarla de inmediato por
            {{ formatCLP(calculo.compraYa) }}. La subasta dura {{ config.duracion_horas }} horas.
          </span>
        </template>
        <span v-else class="ayuda">Escribe un precio base para ver cuánto recibirías.</span>
      </div>

      <label class="check">
        <input v-model="form.aceptaTerminos" type="checkbox">
        <span>
          Acepto los Términos y Condiciones: envío la carta a Cambalache para que quede en custodia, y si se
          vende, Cambalache se queda con el {{ porcentaje(config.comision) }}% del monto final.
        </span>
      </label>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button type="submit" class="boton" :disabled="enviando">
        {{ enviando ? 'Publicando…' : 'Publicar y enviar la carta' }}
      </button>
    </form>
  </div>
</template>
