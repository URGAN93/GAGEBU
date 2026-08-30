import { useEffect, useRef } from 'react'

const DIR_LOCK = 10 // 이 이상 움직여야 좌우/상하 스와이프 방향을 확정
const COMMIT = 60 // 이 이상 밀어야 월 이동으로 인정

// 캘린더 그리드를 좌우로 스와이프하면 달을 이동시키는 훅 (터치/마우스/펜 모두 지원 - Pointer Events).
// 반환된 ref를 스와이프를 감지할 컨테이너에, dragRef를 실제로 밀리는 비주얼 요소(칸 그리드)에 붙인다.
export function useSwipeMonth(onSwipe) {
  const areaRef = useRef(null)
  const dragRef = useRef(null)

  useEffect(() => {
    const swipeArea = areaRef.current
    const dragEl = dragRef.current
    if (!swipeArea || !dragEl) return

    let startX = 0
    let startY = 0
    let lastX = 0
    let dragging = false
    let isHorizontal = null
    let maxDrag = 0
    let activePointerId = null

    function onPointerDown(e) {
      if (activePointerId !== null) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      activePointerId = e.pointerId
      startX = lastX = e.clientX
      startY = e.clientY
      dragging = true
      isHorizontal = null
      maxDrag = dragEl.clientWidth || swipeArea.clientWidth
      dragEl.style.transition = 'none'
    }

    function onPointerMove(e) {
      if (!dragging || e.pointerId !== activePointerId) return
      const x = e.clientX
      const y = e.clientY
      const dx = x - startX
      const dy = y - startY
      lastX = x
      if (isHorizontal === null) {
        if (Math.abs(dx) > DIR_LOCK || Math.abs(dy) > DIR_LOCK) isHorizontal = Math.abs(dx) > Math.abs(dy)
      }
      if (isHorizontal) {
        e.preventDefault()
        // 끝까지 밀어도 화면 폭(maxDrag) 이상은 넘어가지 않도록 고정
        const clamped = Math.max(-maxDrag, Math.min(maxDrag, dx))
        dragEl.style.transform = `translateX(${clamped}px)`
      }
    }

    function endDrag(e) {
      if (!dragging || (e && e.pointerId !== activePointerId)) return
      dragging = false
      activePointerId = null
      const dx = lastX - startX
      if (isHorizontal && (dx <= -COMMIT || dx >= COMMIT)) {
        const dir = dx < 0 ? 1 : -1 // 1: 다음 달, -1: 이전 달
        dragEl.style.transition = 'transform 0.18s ease'
        dragEl.style.transform = `translateX(${-dir * maxDrag}px)`
        setTimeout(() => {
          dragEl.style.transition = 'none'
          dragEl.style.transform = 'translateX(0)'
          onSwipe(dir)
        }, 180)
      } else {
        dragEl.style.transition = 'transform 0.2s ease'
        dragEl.style.transform = 'translateX(0)'
      }
      isHorizontal = null
    }

    swipeArea.addEventListener('pointerdown', onPointerDown)
    swipeArea.addEventListener('pointermove', onPointerMove)
    swipeArea.addEventListener('pointerup', endDrag)
    swipeArea.addEventListener('pointercancel', endDrag)
    return () => {
      swipeArea.removeEventListener('pointerdown', onPointerDown)
      swipeArea.removeEventListener('pointermove', onPointerMove)
      swipeArea.removeEventListener('pointerup', endDrag)
      swipeArea.removeEventListener('pointercancel', endDrag)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSwipe])

  return { areaRef, dragRef }
}
