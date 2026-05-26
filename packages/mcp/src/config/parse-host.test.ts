import { describe, expect, it } from 'bun:test'

import { parseHostHeader } from './parse-host'

describe('parseHostHeader', () => {
  it('parses host with port', () => {
    expect(parseHostHeader('localhost:3000')).toEqual({
      hostname: 'localhost',
      port: '3000',
      host: 'localhost:3000',
    })
  })

  it('rejects fake port suffix attacks', () => {
    expect(parseHostHeader('localhost:3000.evil.example')).toBeNull()
    expect(parseHostHeader('app.durabull.io:443.attacker.tld')).toBeNull()
  })

  it('parses bracketed IPv6 with port', () => {
    expect(parseHostHeader('[::1]:3000')).toEqual({
      hostname: '[::1]',
      port: '3000',
      host: '[::1]:3000',
    })
  })

  it('rejects out-of-range ports', () => {
    expect(parseHostHeader('localhost:0')).toBeNull()
    expect(parseHostHeader('localhost:70000')).toBeNull()
    expect(parseHostHeader('[::1]:0')).toBeNull()
  })
})
