/* Quantix Prime — Adaptive Floating Navigation
 * Product-owned interaction model. The reference is used only as an interaction
 * reference; all destinations, iconography and visual tokens belong to Quantix.
 */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, LucideIcon } from 'lucide-react'

export type FloatingNavItem = {
  id: string
  label: string
  icon: LucideIcon
  disabled?: boolean
}

type Props = {
  items: FloatingNavItem[]
  activeId: string
  onChange: (id: string) => void
  className?: string
  hidden?: boolean
}

function useSpringValue(target: number, reducedMotion: boolean) {
  const [value, setValue] = useState(target)
  const valueRef = useRef(target)
  const velocityRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const targetRef = useRef(target)

  useEffect(() => {
    targetRef.current = target

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    if (reducedMotion) {
      valueRef.current = target
      velocityRef.current = 0
      setValue(target)
      return
    }

    const stiffness = 520
    const damping = 34
    const mass = 0.8
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.032)
      last = now

      const displacement = targetRef.current - valueRef.current
      const acceleration = (stiffness * displacement - damping * velocityRef.current) / mass
      velocityRef.current += acceleration * dt
      valueRef.current += velocityRef.current * dt

      if (Math.abs(displacement) < 0.001 && Math.abs(velocityRef.current) < 0.001) {
        valueRef.current = targetRef.current
        velocityRef.current = 0
        setValue(valueRef.current)
        frameRef.current = null
        return
      }

      setValue(valueRef.current)
      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [target, reducedMotion])

  return value
}

export function FloatingNavigation({
  items,
  activeId,
  onChange,
  className = '',
  hidden = false,
}: Props) {
  const activeIndex = Math.max(0, items.findIndex(item => item.id === activeId))
  const [reducedMotion, setReducedMotion] = useState(false)
  const [pressedId, setPressedId] = useState<string | null>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const gestureActive = useRef(false)
  const suppressClick = useRef(false)
  const lastGestureIndex = useRef(activeIndex)
  const activeProgress = useSpringValue(activeIndex, reducedMotion)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])

  useEffect(() => {
    lastGestureIndex.current = activeIndex
  }, [activeIndex])

  const selectedLabel = useMemo(
    () => items.find(item => item.id === activeId)?.label ?? '',
    [items, activeId],
  )

  const haptic = (duration = 8) => {
    if (reducedMotion || typeof navigator === 'undefined' || !('vibrate' in navigator)) return
    try {
      navigator.vibrate(duration)
    } catch {}
  }

  const select = (item: FloatingNavItem, tactile = true) => {
    if (item.disabled || item.id === activeId) return
    setPressedId(null)
    onChange(item.id)
    if (tactile) haptic(8)
  }

  const selectNearest = (clientX: number) => {
    let nearest = -1
    let distance = Number.POSITIVE_INFINITY

    itemRefs.current.forEach((element, index) => {
      if (!element || items[index]?.disabled) return
      const rect = element.getBoundingClientRect()
      const center = rect.left + rect.width / 2
      const nextDistance = Math.abs(clientX - center)
      if (nextDistance < distance) {
        distance = nextDistance
        nearest = index
      }
    })

    if (nearest >= 0 && nearest !== lastGestureIndex.current) {
      lastGestureIndex.current = nearest
      select(items[nearest])
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
    pointerStart.current = { x: event.clientX, y: event.clientY }
    gestureActive.current = false
    suppressClick.current = false
    setPressedId(id)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const start = pointerStart.current
    if (!start || event.pointerType === 'mouse') return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return

    gestureActive.current = true
    suppressClick.current = true
    selectNearest(event.clientX)
  }

  const clearPointer = (event?: React.PointerEvent<HTMLButtonElement>) => {
    pointerStart.current = null
    gestureActive.current = false
    setPressedId(null)

    if (
      event &&
      event.currentTarget.hasPointerCapture?.(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!items.length) return

    let nextIndex = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % items.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + items.length) % items.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = items.length - 1
    } else {
      return
    }

    event.preventDefault()
    const next = items[nextIndex]
    if (!next?.disabled) {
      select(next, false)
      itemRefs.current[nextIndex]?.focus()
    }
  }

  return (
    <nav
      className={`floating-navigation ${hidden ? 'is-hidden' : ''} ${className}`}
      aria-label="Primary navigation"
      data-active-index={activeIndex}
      data-active-label={selectedLabel}
      style={{ ['--qp-active-progress' as string]: activeProgress } as CSSProperties}
    >
      <div className="floating-navigation__surface">
        <span className="floating-navigation__ambient" aria-hidden="true" />

        {items.map((item, index) => {
          const Icon = item.icon
          const active = item.id === activeId
          const pressed = item.id === pressedId
          const distance = Math.min(1, Math.abs(activeProgress - index))
          const itemStyle = {
            ['--qp-nav-distance' as string]: distance,
          } as CSSProperties

          return (
            <button
              ref={element => {
                itemRefs.current[index] = element
              }}
              key={item.id}
              type="button"
              className={`floating-navigation__item ${active ? 'is-active' : ''} ${pressed ? 'is-pressed' : ''}`}
              style={itemStyle}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              aria-disabled={item.disabled || undefined}
              disabled={item.disabled}
              onPointerDown={event => handlePointerDown(event, item.id)}
              onPointerMove={handlePointerMove}
              onPointerCancel={event => clearPointer(event)}
              onPointerUp={event => clearPointer(event)}
              onPointerLeave={event => {
                if (event.pointerType === 'mouse') clearPointer(event)
              }}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false
                  return
                }
                select(item)
              }}
              onKeyDown={event => handleKeyDown(event, index)}
            >
              <span className="floating-navigation__item-inner">
                <span className="floating-navigation__icon-wrap" aria-hidden="true">
                  <Icon
                    className="floating-navigation__icon"
                    strokeWidth={active ? 2.15 : 1.9}
                  />
                </span>
                <span className="floating-navigation__label">{item.label}</span>
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
