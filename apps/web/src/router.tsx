import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

// Helper to check if an error is a 401 unauthorized error
function isUnauthorizedError(error: unknown): boolean {
  return error instanceof Error && 'status' in error && (error as { status: number }).status === 401
}

// Global handler for 401 responses
function handleUnauthorized() {
  // Clear any cached auth state and redirect to login
  if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
    window.location.href = '/login'
  }
}

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5000,
        refetchInterval: 10000,
        retry: (failureCount, error) => {
          // Don't retry on 401 errors
          if (isUnauthorizedError(error)) {
            handleUnauthorized()
            return false
          }
          // Default retry behavior for other errors
          return failureCount < 3
        },
      },
      mutations: {
        retry: false,
        onError: (error) => {
          // Handle 401 errors in mutations
          if (isUnauthorizedError(error)) {
            handleUnauthorized()
          }
        },
      },
    },
  })

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
