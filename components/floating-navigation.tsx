'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'

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

function useSpringValue(target: number, stiffness = 420, damping = 32, mass = 0.85) {
  const [value, setValue] = useState(target)
  const valueRef = useRef(target)
  const velocityRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const targetRef = useRef(target)

  useEffect(() => {
    targetRef.current = target
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)

    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.032)
      last = now
      const displacement = targetRef.current - valueRef.current
      const acceleration = (stiffness * displacement - damping * velocityRef.current) / mass
      velocityRef.current += acceleration * dt
      valueRef.current += velocityRef.current * dt

      if (Math.abs(displacement) < 0.15 && Math.abs(velocityRef.current) < 0.15) {
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
  }, [target, stiffness, damping, mass])

  return value
}

export function FloatingNavigation({ items, activeId, onChange, className = '', hidden = false }: Props) {
  const activeIndex = Math.max(0, items.findIndex(item => item.id === activeId))
  const activeWidth = useSpringValue(activeIndex, 440, 34, 0.82)
  const [pressedId, setPressedId] = useState<string | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])

  const selectedLabel = useMemo(
    () => items.find(item => item.id === activeId)?.label ?? '',
    [items, activeId],
  )

  const select = (item: FloatingNavItem) => {
    if (item.disabled || item.id === activeId) return
    setPressedId(null)
    onChange(item.id)
    if (!reducedMotion && 'vibrate' in navigator) {
      try { navigator.vibrate(8) } catch {}
    }
  }

  return (
    <nav
      className={`floating-navigation ${hidden ? 'is-hidden' : ''} ${className}`}
      aria-label="Primary navigation"
      data-active-index={activeIndex}
      data-active-label={selectedLabel}
      style={{ ['--qp-active-index' as string]: activeWidth }}
    >
      <div className="floating-navigation__surface">
        <span className="floating-navigation__ambient" aria-hidden="true" />
        {items.map((item, index) => {
          const Icon = item.icon
          const active = item.id === activeId
          const pressed = item.id === pressedId

          return (
            <button
              key={item.id}
              type="button"
              className={`floating-navigation__item ${active ? 'is-active' : ''} ${pressed ? 'is-pressed' : ''}`}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              aria-pressed={active}
              aria-disabled={item.disabled || undefined}
              disabled={item.disabled}
              onPointerDown={() => setPressedId(item.id)}
              onPointerCancel={() => setPressedId(null)}
              onPointerUp={() => setPressedId(null)}
              onClick={() => select(item)}
              style={{ ['--qp-item-index' as string]: index }}
            >
              <span className="floating-navigation__item-inner">
                <span className="floating-navigation__icon-wrap" aria-hidden="true">
                  <Icon className="floating-navigation__icon" strokeWidth={active ? 2.15 : 1.9} />
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
