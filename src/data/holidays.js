import { getHolidayPreset } from '@hyunbinseo/holidays-kr'

const REMOTE_BASE = 'https://holidays.hyunbin.page'
const yearCache = new Map()

function normalizeHolidayName(name) {
  const aliases = {
    '1월 1일': '신정',
    '3ㆍ1절': '삼일절',
    '부처님 오신 날': '부처님오신날',
    기독탄신일: '성탄절',
    '설날 전날': '설날 연휴',
    '설날 다음 날': '설날 연휴',
    '추석 전날': '추석 연휴',
    '추석 다음 날': '추석 연휴',
  }
  if (aliases[name]) return aliases[name]
  const substitute = name.match(/^대체공휴일\((.+)\)$/)
  if (substitute) return normalizeHolidayName(substitute[1]) + ' 대체공휴일'
  return name
}

export function normalizeHolidayPreset(preset) {
  return Object.fromEntries(Object.entries(preset).map(([date, names]) => {
    const list = Array.isArray(names) ? names : [names]
    return [date, [...new Set(list.map(normalizeHolidayName))].join(' · ')]
  }))
}

function fixedHolidayFallback(year) {
  return {
    [year + '-01-01']: '신정',
    [year + '-03-01']: '삼일절',
    [year + '-05-05']: '어린이날',
    [year + '-06-06']: '현충일',
    [year + '-08-15']: '광복절',
    [year + '-10-03']: '개천절',
    [year + '-10-09']: '한글날',
    [year + '-12-25']: '성탄절',
  }
}

async function fetchRemotePreset(year) {
  const response = await fetch(REMOTE_BASE + '/' + year + '.json')
  if (!response.ok) throw new Error('공휴일 데이터 응답 오류: ' + response.status)
  return response.json()
}

// 공개 월력요항 데이터가 갱신되면 앱 코드 수정 없이 새 연도 공휴일을 불러온다.
// 네트워크가 끊겼거나 제공처에 장애가 있으면 패키지에 포함된 연도 데이터로 대체한다.
export function loadHolidays(year) {
  const key = String(year)
  if (!yearCache.has(key)) {
    const request = fetchRemotePreset(key)
      .catch(() => getHolidayPreset(key))
      .then(normalizeHolidayPreset)
      .catch(() => fixedHolidayFallback(key))
    yearCache.set(key, request)
  }
  return yearCache.get(key)
}

export function holidayName(dateStr, holidays) {
  return holidays[dateStr] || null
}
