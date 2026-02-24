# @durabull/auth

Authentication package using [Better Auth](https://www.better-auth.com/) with Drizzle ORM integration.

## Features

- **Email/Password Authentication** - Traditional sign-up and sign-in with email and password
- **Social Login** - Google and GitHub OAuth providers
- **Session Management** - Secure session handling with automatic token refresh
- **Drizzle ORM Integration** - Uses the shared DAL package for database operations

## Setup

### 1. Environment Variables

Create a `.env` file at the repo root. See [`.env.example`](../../.env.example) for the complete list of environment variables.

### 2. OAuth Provider Setup

#### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Configure the consent screen if prompted
6. Select "Web application" as the application type
7. Add authorized redirect URIs:
   - `http://localhost:3001/api/auth/callback/google` (development)
8. Copy the Client ID and Client Secret

#### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - Homepage URL: `http://localhost:3001`
   - Authorization callback URL: `http://localhost:3001/api/auth/callback/github`
4. Copy the Client ID and generate a Client Secret

### 3. Database Migrations

The auth tables are automatically created when the API server starts. The migration creates:

- `user` - User profiles
- `session` - Active sessions
- `account` - OAuth provider accounts and credentials
- `verification` - Email verification tokens

## Usage

### Server-side (API)

```typescript
import { createAuth } from '@durabull/auth'

const auth = await createAuth({
  baseURL: 'http://localhost:3001',
})

// Use auth.handler for handling auth requests
app.all('/api/auth/*', (c) => auth.handler(c.req.raw))
```

### Client-side (React)

```typescript
import { useAuth } from '@/hooks/use-auth'

function MyComponent() {
  const { user, isAuthenticated, signIn, signOut } = useAuth()

  if (!isAuthenticated) {
    return <button onClick={() => signIn.social({ provider: 'google' })}>Sign In</button>
  }

  return (
    <div>
      <p>Welcome, {user.name}!</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  )
}
```

## API Endpoints

Better Auth provides the following endpoints under `/api/auth/`:

- `POST /api/auth/sign-up/email` - Email/password registration
- `POST /api/auth/sign-in/email` - Email/password login
- `POST /api/auth/sign-out` - Sign out
- `GET /api/auth/session` - Get current session
- `GET /api/auth/sign-in/social?provider=google` - Google OAuth
- `GET /api/auth/sign-in/social?provider=github` - GitHub OAuth
- `GET /api/auth/callback/:provider` - OAuth callbacks

## Architecture

```
packages/auth/
├── src/
│   ├── index.ts    # Server-side auth configuration
│   └── client.ts   # Client-side auth hooks (React)
├── package.json
└── tsconfig.json
```

The auth package depends on:
- `@durabull/dal` - Database schema and client
- `better-auth` - Authentication library

## Security Notes

1. **BETTER_AUTH_SECRET**: Always use a strong, random secret in production
2. **HTTPS**: Use HTTPS in production for secure cookie handling
3. **Email Verification**: Currently disabled for development; enable in production
4. **CORS**: Configure trusted origins appropriately for your deployment
