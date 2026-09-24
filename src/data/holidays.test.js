import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadHolidays, normalizeHolidayPreset } from './holidays.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('normalizeHolidayPreset', () => {
  it('설날과 추석 전후 날짜를 연휴로 표시한다', () => {
    expect(normalizeHolidayPreset({
      '2027-02-05': ['설날 전날'],
      '2027-02-06': ['설날'],
      '2027-09-16': ['추석 다음 날'],
    })).toEqual({
      '2027-02-05': '설날 연휴',
      '2027-02-06': '설날',
      '2027-09-16': '추석 연휴',
    })
  })

  it('대체공휴일과 같은 날의 복수 명칭을 읽기 쉽게 바꾼다', () => {
    expect(normalizeHolidayPreset({
      '2026-03-02': ['대체공휴일(3ㆍ1절)'],
      '2026-05-24': ['어린이날', '부처님 오신 날'],
    })).toEqual({
      '2026-03-02': '삼일절 대체공휴일',
      '2026-05-24': '어린이날 · 부처님오신날',
    })
  })

  it('공개 데이터에서 새 연도 공휴일을 자동으로 불러온다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ '2099-09-30': ['추석 전날'] }),
    }))
    await expect(loadHolidays(2099)).resolves.toEqual({ '2099-09-30': '추석 연휴' })
  })

  it('네트워크가 끊기면 설치된 연도 데이터로 대체한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const holidays = await loadHolidays(2026)
    expect(holidays['2026-09-24']).toBe('추석 연휴')
    expect(holidays['2026-09-25']).toBe('추석')
  })
})
