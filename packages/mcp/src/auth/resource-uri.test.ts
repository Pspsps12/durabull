import { describe, expect, it } from 'bun:test'

import { getCanonicalMcpResourceUri, getMcpProtectedResourceMetadataUrl } from './resource-uri'

describe('resource-uri', () => {
  it('preserves path prefix from app base URL', () => {
    expect(getCanonicalMcpResourceUri('https://host/api')).toBe('https://host/api/mcp')
    expect(getMcpProtectedResourceMetadataUrl('https://host/api')).toBe(
      'https://host/api/.well-known/oauth-protected-resource'
    )
  })

  it('handles origin-only base URLs', () => {
    expect(getCanonicalMcpResourceUri('https://app.example.com')).toBe(
      'https://app.example.com/mcp'
    )
  })
})
