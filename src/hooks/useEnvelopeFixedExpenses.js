import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { envelopeFixedExpenses } from '../lib/calc.js'

export function useEnvelopeFixedExpenses(vKey) {
  const household = useAppStore((s) => s.household)
  const householdAllocations = useAppStore((s) => s.householdAllocations)
  const irregularEnvelopes = useAppStore((s) => s.irregularEnvelopes)
  const envelopeRateChanges = useAppStore((s) => s.envelopeRateChanges)
  const myUserId = useAppStore((s) => s.myUserId)
  return useMemo(() => envelopeFixedExpenses({ household, householdAllocations, irregularEnvelopes, envelopeRateChanges, myUserId }, vKey),
    [household, householdAllocations, irregularEnvelopes, envelopeRateChanges, myUserId, vKey])
}
