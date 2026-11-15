// Configuración pública del proyecto Supabase de Cambalache. La publishable key es pública
// por diseño (la seguridad la ponen la RLS y las funciones de supabase/migrations); nunca
// pongas aquí la service_role key ni otro secreto.
//
// Mientras esté vacío, el catálogo y los intercambios funcionan, pero las cuentas y el
// mercado de subastas muestran "Mercado no configurado".
const CAMBALACHE_CONFIG = {
  supabaseUrl: '',
  supabaseKey: '',
};
