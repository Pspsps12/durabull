import { identifyUser, resetIdentity } from '@durabull/analytics/client'
import { authClient } from '@durabull/auth/client'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { appConfigQueryKey } from './use-app-config'
import { useAppMode } from './use-app-mode'

/**
 * Auth hooks and utilities for the frontend
 * Re-exports from the auth client for convenient usage
 */

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  // Account linking functions
  linkSocial,
  unlinkAccount,
  listAccounts,
} = authClient

/**
 * Type for better-auth error response
 */
export interface AuthError {
  message?: string
  code?: string
  status?: number
}

/**
 * Type for better-auth API response
 */
export interface AuthResponse<T = unknown> {
  data?: T
  error?: AuthError
}

/**
 * Extract a user-friendly error message from better-auth response.
 * Also shows a toast for rate limit errors.
 */
export function getAuthErrorMessage(
  result: AuthResponse,
  defaultMessage = 'An error occurred'
): string {
  if (!result.error) return defaultMessage

  const error = result.error

  // Show toast for rate limit errors
  if (error.status === 429 || error.code === 'TOO_MANY_REQUESTS') {
    toast.error('Too many requests', {
      description: error.message || 'Please slow down and try again in a moment.',
    })
  }

  // Handle common error codes with friendly messages
  if (error.code) {
    switch (error.code) {
      case 'USER_NOT_FOUND':
        return 'No account found with this email address'
      case 'INVALID_PASSWORD':
        return 'Invalid password'
      case 'INVALID_EMAIL':
        return 'Please enter a valid email address'
      case 'USER_ALREADY_EXISTS':
        return 'An account with this email already exists'
      case 'EMAIL_NOT_VERIFIED':
        return 'Please verify your email address'
      case 'TOO_MANY_REQUESTS':
        return 'Too many attempts. Please try again later'
      case 'INVALID_TOKEN':
        return 'Invalid or expired token'
      // Account linking error codes
      case 'ACCOUNT_ALREADY_EXISTS':
      case 'OAUTH_ACCOUNT_ALREADY_EXISTS':
      case 'REGISTRATION_DISABLED':
        return 'ACCOUNT_EXISTS' // Special return value for redirect handling
      case 'SOCIAL_ACCOUNT_ALREADY_LINKED':
        return 'This social account is already linked to your profile'
      default:
        break
    }
  }

  // Fall back to the error message or default
  return error.message || defaultMessage
}

/**
 * Check if a better-auth response has an error
 */
export function hasAuthError(result: AuthResponse): boolean {
  return !!result.error
}

/**
 * Convenience hook that provides the session with loading state
 * and auth methods with proper typing.
 */
export function useAuth() {
  const { isLoading: modeLoading } = useAppMode()
  const session = useSession()
  const queryClient = useQueryClient()
  const identifiedUserIdRef = useRef<string | null>(null)
  const appConfigSyncUserIdRef = useRef<string | null>(null)

  const user = session.data?.user ?? null
  const sessionData = session.data?.session ?? null

  // Identify user in PostHog when they sign in
  useEffect(() => {
    if (user && user.id !== identifiedUserIdRef.current) {
      identifyUser({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt ? new Date(user.createdAt) : undefined,
      })
      identifiedUserIdRef.current = user.id
    } else if (!user && identifiedUserIdRef.current) {
      // User logged out - reset PostHog identity
      resetIdentity()
      identifiedUserIdRef.current = null
    }
  }, [user])

  // Ensure /api/app/config refetches once per signed-in user.
  // The server updates user.lastSignInAt during this request.
  useEffect(() => {
    if (!user) {
      appConfigSyncUserIdRef.current = null
      return
    }

    if (appConfigSyncUserIdRef.current === user.id) {
      return
    }

    appConfigSyncUserIdRef.current = user.id
    void queryClient.invalidateQueries({ queryKey: appConfigQueryKey })
  }, [queryClient, user])

  return {
    // Session data
    user,
    session: sessionData,

    // Loading and auth state
    isLoading: modeLoading || session.isPending,
    isAuthenticated: !!user,

    // Auth methods
    signIn,
    signUp,
    signOut,

    // Account linking methods
    linkSocial,
    unlinkAccount,
    listAccounts,

    // Session refresh
    refetch: session.refetch,

    // Helper to get error messages
    getErrorMessage: getAuthErrorMessage,
  }
}
