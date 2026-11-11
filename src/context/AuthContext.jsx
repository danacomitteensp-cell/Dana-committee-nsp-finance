import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)

  // Track the current member's auth_uid to prevent redundant fetches
  const memberUidRef = useRef(null)
  // Guard against concurrent fetches
  const fetchingRef = useRef(false)

  const fetchMember = useCallback(async (authUid) => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('auth_uid', authUid)
        .single()

      if (error) {
        // PGRST116 means no row found (user is not in members table)
        if (error.code === 'PGRST116') {
          console.warn('No member record found for auth UID:', authUid)
          setMember(null)
          memberUidRef.current = authUid // Mark as checked so we don't loop
        } else {
          // Network or transient server error
          console.error('Error fetching member:', error)
          setMember(null)
        }
      } else {
        setMember(data)
        memberUidRef.current = authUid
      }
    } catch (err) {
      console.error('Unexpected error fetching member:', err)
      setMember(null)
    } finally {
      fetchingRef.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    // Subscribe to Supabase auth state changes.
    // In supabase-js v2, onAuthStateChange emits 'INITIAL_SESSION' immediately
    // with the persisted session (if any). Using this as the single source of
    // truth avoids race conditions and duplicate initialization.
    //
    // CRITICAL: The onAuthStateChange callback MUST NOT await any async Supabase
    // operations (such as PostgREST queries or getSession). Supabase's
    // _notifyAllSubscribers awaits all listener callbacks while holding an
    // internal NavigatorLock (web lock). Executing database queries inside
    // the callback re-enters the lock queue, causing a hard circular deadlock
    // whenever browser focus or visibility changes.
    //
    // Any asynchronous data fetching must be deferred via queueMicrotask so it
    // runs after the callback returns and the internal lock is released.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return

        setSession(newSession)

        if (event === 'SIGNED_OUT' || !newSession) {
          setMember(null)
          memberUidRef.current = null
          setLoading(false)
          return
        }

        const userId = newSession.user.id

        // Re-fetch member if:
        // 1. We haven't fetched for this user yet (memberUidRef.current !== userId)
        // 2. User was explicitly updated (USER_UPDATED)
        // Do NOT re-fetch on tab visibility changes (which emit SIGNED_IN)
        // or on background token refreshes (TOKEN_REFRESHED) if we already have the member.
        const needsMemberFetch =
          memberUidRef.current !== userId || event === 'USER_UPDATED'

        if (needsMemberFetch) {
          setLoading(true)
          queueMicrotask(() => {
            if (isMounted) {
              fetchMember(userId)
            }
          })
        } else {
          setLoading(false)
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [fetchMember])

  async function signIn(email, password) {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        setLoading(false)
        throw error
      }
      return data
    } catch (err) {
      setLoading(false)
      throw err
    }
  }

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) console.error('SignOut error:', error)
    } catch (err) {
      console.error('SignOut error:', err)
    } finally {
      setMember(null)
      setSession(null)
      memberUidRef.current = null
      setLoading(false)
    }
  }

  const value = {
    session,
    user: session?.user ?? null,
    member,
    loading,
    signIn,
    signOut,
    isTreasurer: member?.is_treasurer === true,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
