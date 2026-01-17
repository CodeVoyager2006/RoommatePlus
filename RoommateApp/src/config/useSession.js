import { useEffect, useState } from 'react'
import { supabaseClient } from './supabaseClient'

// Custom hook to manage Supabase authentication session
export function useSession() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabaseClient.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session ?? null)
      setLoading(false)
    })

    // On auth state change, update the session
    const { data: sub } = supabaseClient.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null)
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe()
    }
  }, [])

  return { session, loading }
}
