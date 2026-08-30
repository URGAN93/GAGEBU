import { describe, it, expect } from 'vitest'
import * as converters from './converters.js'
import { DEFAULT_STATE } from './defaultState.js'

describe('converters module — import smoke test', () => {
  it('exports all expected converter functions', () => {
    ;[
      'rowToLivingCat',
      'livingCatToRow',
      'rowToIrregular',
      'irregularToRow',
      'rowToBudgetChange',
      'budgetChangeToRow',
      'rowToRateChange',
      'rateChangeToRow',
      'rowToIncomeCat',
      'incomeCatToRow',
      'rowToBonusCredit',
      'bonusCreditToRow',
      'rowToNotifSettings',
      'notifSettingsToRow',
      'categoryHouseholdId',
      'rowToTx',
      'txToRow',
      'rowToFixed',
      'fixedToRow',
      'rowToPay',
      'payToRow',
    ].forEach((name) => {
      expect(typeof converters[name]).toBe('function')
    })
  })
})

describe('householdId scoping (living=household-shared, personal envelope=never shared)', () => {
  const household = { id: 'hh1' }

  it('living category rows always carry household_id when a household exists', () => {
    const row = converters.livingCatToRow(DEFAULT_STATE.livingCategories[0], 0, household)
    expect(row.household_id).toBe('hh1')
  })

  it('a personal-scope irregular envelope row has no household_id', () => {
    const allowance = DEFAULT_STATE.irregularEnvelopes.find((e) => e.scope === 'personal')
    const row = converters.irregularToRow(allowance, 1, household)
    expect(row.household_id).toBeNull()
    expect(row.scope).toBe('personal')
  })

  it('a household-scope irregular envelope row carries household_id', () => {
    const shared = DEFAULT_STATE.irregularEnvelopes.find((e) => e.scope === 'household')
    const row = converters.irregularToRow(shared, 0, household)
    expect(row.household_id).toBe('hh1')
    expect(row.scope).toBe('household')
  })

  it('categoryHouseholdId returns null for a personal envelope, household id for a shared one', () => {
    const ctx = {
      household,
      irregularEnvelopes: DEFAULT_STATE.irregularEnvelopes,
      livingCategories: DEFAULT_STATE.livingCategories,
      incomeCategories: DEFAULT_STATE.incomeCategories,
    }
    expect(converters.categoryHouseholdId('allowance', ctx)).toBeNull()
    expect(converters.categoryHouseholdId('irregular1', ctx)).toBe('hh1')
    expect(converters.categoryHouseholdId('food', ctx)).toBe('hh1')
  })
})

describe('round-trip row <-> model', () => {
  it('rowToTx / txToRow preserve installment fields', () => {
    const row = {
      id: 'tx1',
      type: 'irregular',
      amount: 197000,
      merchant: '다솔선물',
      category_id: 'allowance',
      subcat: '선물',
      pay_method: '현대카드',
      from_id: null,
      to_id: null,
      date: '2026-08-13',
      is_recurring: false,
      installment_count: 3,
      installment_overrides: null,
      user_id: 'u1',
    }
    const model = converters.rowToTx(row)
    expect(model.installmentCount).toBe(3)
    const backToRow = converters.txToRow(model)
    expect(backToRow.installment_count).toBe(3)
    expect(backToRow.amount).toBe(197000)
  })
})
