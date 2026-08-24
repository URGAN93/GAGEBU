import { describe, it, expect } from 'vitest'
import * as loadStateModule from './loadState.js'

describe('loadState module — import smoke test', () => {
  it('exports the expected functions and error class', () => {
    expect(typeof loadStateModule.resolveHousehold).toBe('function')
    expect(typeof loadStateModule.loadState).toBe('function')
    expect(typeof loadStateModule.migratePersonalAllowance).toBe('function')
    expect(typeof loadStateModule.SupabaseUnreachableError).toBe('function')
  })
})
