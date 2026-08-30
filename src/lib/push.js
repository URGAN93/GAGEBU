export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

// sw.js는 fetch/캐시 가로채기가 전혀 없는, 순수 푸시 알림 핸들러라 알림을 켤 때만 등록한다
// (앱 로드 시 무조건 등록하지 않음 — 원본과 동일한 동작).
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('./sw.js')
  } catch (err) {
    console.warn('service worker 등록 실패', err)
    return null
  }
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window
}
