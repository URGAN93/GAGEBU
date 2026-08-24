import { useEffect, useRef } from 'react'

// 꾹 눌러서(롱프레스) 드래그로 순서 바꾸기 — .mr-drag 핸들에서만 시작됨.
// 원본 enableDragReorder()를 그대로 포팅: 드래그 중에는 실제 DOM 노드를 직접 옮기고 형제
// 요소들에 FLIP 애니메이션을 걸어준다 (React state를 매 프레임 갱신하기엔 과할 뿐더러,
// 원본의 손맛 나는 애니메이션을 그대로 유지하려면 이 방식이 맞다). 드롭이 끝나야만
// onReorder(orderedIds)를 호출해서 React state(스토어)에 최종 순서를 반영한다.
export function useDragReorder(onReorder) {
  const containerRef = useRef(null)

  useEffect(() => {
    const containerEl = containerRef.current
    if (!containerEl) return

    let dragEl = null
    let startY = 0
    let startX = 0
    let longPressTimer = null
    let dragging = false
    let pointerId = null
    let dragStartTop = 0

    function clearTimer() {
      if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }
    }

    // 잡은 카드가 "손가락이 잡은 지점"이 아니라 "카드 자신의 기준"으로 항상 dragStartTop+이동거리 위치에 오도록 보정
    function positionDragEl(clientY) {
      const desiredTop = dragStartTop + (clientY - startY)
      dragEl.style.transform = 'none'
      const naturalTop = dragEl.getBoundingClientRect().top
      dragEl.style.transform = `translateY(${desiredTop - naturalTop}px)`
      return desiredTop
    }

    function onPointerDown(e) {
      const handle = e.target.closest('.mr-drag')
      if (!handle) return
      const row = handle.closest('.manage-row')
      if (!row) return
      startY = e.clientY
      startX = e.clientX
      pointerId = e.pointerId
      longPressTimer = setTimeout(() => {
        dragging = true
        dragEl = row
        dragStartTop = row.getBoundingClientRect().top
        row.classList.add('dragging')
        row.style.transition = 'none'
        try {
          row.setPointerCapture(pointerId)
        } catch {
          /* ignore */
        }
      }, 300)
    }

    function onPointerMove(e) {
      if (longPressTimer && !dragging && (Math.abs(e.clientY - startY) > 8 || Math.abs(e.clientX - startX) > 8)) {
        clearTimer()
      }
      if (!dragging || !dragEl) return
      e.preventDefault()
      const desiredTop = positionDragEl(e.clientY)
      const dragCenterY = desiredTop + dragEl.offsetHeight / 2

      const rows = [...containerEl.querySelectorAll('.manage-row')].filter((r) => r !== dragEl)
      for (const r of rows) {
        const rect = r.getBoundingClientRect()
        const mid = rect.top + rect.height / 2
        const dragIsAfter = !!(r.compareDocumentPosition(dragEl) & Node.DOCUMENT_POSITION_FOLLOWING)
        if ((dragCenterY < mid && dragIsAfter) || (dragCenterY > mid && !dragIsAfter)) {
          const others = [...containerEl.querySelectorAll('.manage-row')].filter((x) => x !== dragEl)
          const firstTops = new Map(others.map((o) => [o, o.getBoundingClientRect().top]))
          if (dragCenterY < mid) containerEl.insertBefore(dragEl, r)
          else containerEl.insertBefore(dragEl, r.nextSibling)
          others.forEach((o) => {
            const dy = firstTops.get(o) - o.getBoundingClientRect().top
            if (dy) {
              o.style.transition = 'none'
              o.style.transform = `translateY(${dy}px)`
              requestAnimationFrame(() => {
                o.style.transition = 'transform .22s ease'
                o.style.transform = ''
              })
            }
          })
          positionDragEl(e.clientY)
          break
        }
      }
    }

    function endDrag() {
      clearTimer()
      if (!dragging) return
      dragging = false
      dragEl.style.transition = 'transform .18s ease'
      dragEl.style.transform = ''
      dragEl.classList.remove('dragging')
      try {
        dragEl.releasePointerCapture(pointerId)
      } catch {
        /* ignore */
      }
      const ids = [...containerEl.querySelectorAll('.manage-row')].map((r) => r.dataset.id)
      dragEl = null
      onReorder(ids)
    }

    containerEl.addEventListener('pointerdown', onPointerDown)
    containerEl.addEventListener('pointermove', onPointerMove)
    containerEl.addEventListener('pointerup', endDrag)
    containerEl.addEventListener('pointercancel', endDrag)
    return () => {
      clearTimer()
      containerEl.removeEventListener('pointerdown', onPointerDown)
      containerEl.removeEventListener('pointermove', onPointerMove)
      containerEl.removeEventListener('pointerup', endDrag)
      containerEl.removeEventListener('pointercancel', endDrag)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReorder])

  return containerRef
}
