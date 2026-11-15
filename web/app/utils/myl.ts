// MITOS Y LEYENDAS: a diferencia de Yu-Gi-Oh! y Pokémon, este juego chileno no tiene una API
// pública para consultar su catálogo. Esto NO es un catálogo real ni completo: son unos pocos
// nombres de ejemplo (figuras mitológicas de dominio público, no texto de carta copiado de
// ningún lado) para que la pestaña no quede vacía. Sin imágenes: usar las reales sin permiso de
// Onirica/Toro Studios no corresponde. Copia de assets/js/myl-data.js del sitio actual.

export interface CartaMyl {
  id: string
  nombre: string
  mitologia: string
  descripcion: string
}

export const CARTAS_MYL: readonly CartaMyl[] = [
  {
    id: 'myl-odin',
    nombre: 'Odín',
    mitologia: 'Nórdica',
    descripcion: 'Carta de ejemplo, no oficial. En la mitología nórdica, Odín es el padre de los dioses de Asgard, asociado a la sabiduría y la guerra.',
  },
  {
    id: 'myl-zeus',
    nombre: 'Zeus',
    mitologia: 'Griega',
    descripcion: 'Carta de ejemplo, no oficial. Zeus es el rey de los dioses del Olimpo en la mitología griega, señor del rayo y el trueno.',
  },
  {
    id: 'myl-anubis',
    nombre: 'Anubis',
    mitologia: 'Egipcia',
    descripcion: 'Carta de ejemplo, no oficial. Anubis es el dios egipcio de la momificación y el más allá, representado con cabeza de chacal.',
  },
  {
    id: 'myl-quetzalcoatl',
    nombre: 'Quetzalcóatl',
    mitologia: 'Mesoamericana',
    descripcion: 'Carta de ejemplo, no oficial. La Serpiente Emplumada, una de las principales deidades del panteón mesoamericano.',
  },
  {
    id: 'myl-amaterasu',
    nombre: 'Amaterasu',
    mitologia: 'Japonesa',
    descripcion: 'Carta de ejemplo, no oficial. Diosa del sol en el sintoísmo japonés, considerada ancestro de la línea imperial.',
  },
  {
    id: 'myl-morrigan',
    nombre: 'Morrígan',
    mitologia: 'Celta',
    descripcion: 'Carta de ejemplo, no oficial. Diosa celta asociada a la guerra y el destino, a menudo representada junto a cuervos.',
  },
]
