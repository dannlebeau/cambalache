// Llama una función de Postgres con argumentos. Sin tipos generados de la base
// (supabase.types: false), `supabase.rpc` no acepta argumentos tipados; esto lo encapsula.
export function useRpc() {
  const supabase = useSupabaseClient()
  type Rpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>
  const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

  // Devuelve `data` o lanza el error de la base (ya viene en español).
  return async function llamar<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await rpc(fn, args)
    if (error) throw error
    return data as T
  }
}
