import { useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { retirarSuscripcionAjena } from '../dispositivoPush'

// Efecto sobre una API externa del navegador; no sincroniza datos SWR con estado local.
export function useSeguridadDispositivoPush() {
  useEffect(() => {
    const limpiar = (id: string | null) => {
      void retirarSuscripcionAjena(id).catch(() => {
        console.warn('La desvinculación del navegador quedó pendiente. Reintenta desde Configuración.')
      })
    }
    void supabase.auth.getSession().then(({ data }) => limpiar(data.session?.user.id ?? null))
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => limpiar(sesion?.user.id ?? null))
    return () => data.subscription.unsubscribe()
  }, [])
}
