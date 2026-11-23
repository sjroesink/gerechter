import { Link, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { formatCalendarDay } from '~/domain/calendar'
import type { PlanSummary } from '~/domain/planning'
import { movePlannedMealFn, removePlannedMealFn } from '~/server/planning.functions'
import { ArrowDownIcon, ArrowUpIcon, DotsVerticalIcon, GripVerticalIcon, PlusIcon, TrashIcon } from './icons'
import { dayOfMonth, weekdayShort } from './planning-dates'
import { RecipeThumb } from './recipe-thumb'
import { Button, Notice, cx } from './ui'

export type WeekDay = { date: string; items: PlanSummary[] }

type OptimisticOp =
  | { id: string; type: 'move'; mealId: string; toDate: string }
  | { id: string; type: 'remove'; mealId: string }

type DragState = {
  item: PlanSummary
  fromDate: string
  x: number
  y: number
  overDate: string | null
}

type SwipeState = {
  mealId: string
  offset: number
  ready: boolean
}

type OpenMenu = {
  item: PlanSummary
  dayIndex: number
  top: number
  left: number
}

const SWIPE_THRESHOLD = 72
const LONG_PRESS_MS = 220
const MENU_WIDTH = 224
const MENU_HEIGHT = 172

function clampSwipe(dx: number) {
  const sign = Math.sign(dx)
  const abs = Math.abs(dx)
  if (abs <= 104) return dx
  return sign * Math.min(136, 104 + (abs - 104) * 0.35)
}

function findDropDate(x: number, y: number): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const target = el.closest<HTMLElement>('[data-drop-date]')
    if (target?.dataset.dropDate) return target.dataset.dropDate
  }
  return null
}

function applyOptimisticOps(days: WeekDay[], ops: OptimisticOp[]): WeekDay[] {
  if (ops.length === 0) return days
  const byDate = new Map<string, PlanSummary[]>(days.map((day) => [day.date, [...day.items]]))
  for (const op of ops) {
    let found: PlanSummary | undefined
    for (const [date, list] of byDate) {
      const idx = list.findIndex((item) => item.id === op.mealId)
      if (idx !== -1) {
        ;[found] = list.splice(idx, 1)
        byDate.set(date, list)
        break
      }
    }
    if (op.type === 'move' && found) {
      const target = byDate.get(op.toDate)
      if (target) target.push({ ...found, date: op.toDate })
    }
  }
  return days.map((day) => ({ date: day.date, items: byDate.get(day.date) ?? [] }))
}

export function WeekPlanBoard({ days, today }: { days: WeekDay[]; today: string }) {
  const router = useRouter()
  const [ops, setOps] = useState<OptimisticOp[]>([])
  const [busyMeals, setBusyMeals] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [swipe, setSwipe] = useState<SwipeState | null>(null)
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null)
  const [pendingRemove, setPendingRemove] = useState<PlanSummary | null>(null)
  const [removing, setRemoving] = useState(false)

  const suppressClickRef = useRef(false)
  const activeGestureCleanupRef = useRef<(() => void) | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const visibleDays = useMemo(() => applyOptimisticOps(days, ops), [days, ops])

  // Clean up any active pointer listeners on unmount.
  useEffect(() => () => activeGestureCleanupRef.current?.(), [])

  // Keep native modal dialog in sync with pendingRemove state.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (pendingRemove && !dialog.open) dialog.showModal()
    else if (!pendingRemove && dialog.open) dialog.close()
  }, [pendingRemove])

  // Close popover menu on outside click, Escape, scroll, or resize.
  useEffect(() => {
    if (!openMenu) return
    requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')?.focus()
    })
    const close = (restoreFocus = false) => {
      setOpenMenu(null)
      if (restoreFocus) requestAnimationFrame(() => menuTriggerRef.current?.focus())
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (menuRef.current?.contains(target) || menuTriggerRef.current?.contains(target)) return
      close(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(true)
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const items = [
          ...(menuRef.current?.querySelectorAll<HTMLButtonElement>(
            'button[role="menuitem"]:not(:disabled)',
          ) ?? []),
        ]
        if (items.length === 0) return
        event.preventDefault()
        const current = items.indexOf(document.activeElement as HTMLButtonElement)
        const next =
          event.key === 'ArrowDown'
            ? items[(current + 1) % items.length]
            : items[(current - 1 + items.length) % items.length]
        next?.focus()
      }
    }
    const onViewportChange = () => close(false)
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onViewportChange, true)
      window.removeEventListener('resize', onViewportChange)
    }
  }, [openMenu])

  // Auto-scroll the window gently when dragging near viewport top/bottom edges.
  const isDraggingAny = drag !== null
  const dragPointerRef = useRef<{ y: number } | null>(null)
  useEffect(() => {
    dragPointerRef.current = drag ? { y: drag.y } : null
  }, [drag])

  useEffect(() => {
    if (!isDraggingAny) return
    let raf = 0
    const tick = () => {
      const pointer = dragPointerRef.current
      if (pointer) {
        const edge = 88
        if (pointer.y < edge) {
          window.scrollBy(0, -Math.max(4, Math.round((edge - pointer.y) / 6)))
        } else if (pointer.y > window.innerHeight - edge) {
          window.scrollBy(0, Math.max(4, Math.round((pointer.y - (window.innerHeight - edge)) / 6)))
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isDraggingAny])

  function markSuppressClick() {
    suppressClickRef.current = true
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 80)
  }

  async function moveMeal(item: PlanSummary, toDate: string) {
    if (toDate === item.date || busyMeals.has(item.id)) return
    setError(null)
    const opId = crypto.randomUUID()
    setOps((prev) => [...prev, { id: opId, type: 'move', mealId: item.id, toDate }])
    setBusyMeals((prev) => new Set(prev).add(item.id))
    try {
      const saved = await movePlannedMealFn({
        data: { mealId: item.id, input: { date: toDate, version: item.version } },
      })
      if (!saved.ok) {
        setError(saved.message)
      }
      await router.invalidate()
    } catch {
      setError('Verplaatsen is niet gelukt. Controleer je verbinding en probeer opnieuw.')
    } finally {
      setOps((prev) => prev.filter((op) => op.id !== opId))
      setBusyMeals((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  async function confirmRemove() {
    if (!pendingRemove || removing) return
    const item = pendingRemove
    setError(null)
    setRemoving(true)
    const opId = crypto.randomUUID()
    setOps((prev) => [...prev, { id: opId, type: 'remove', mealId: item.id }])
    setBusyMeals((prev) => new Set(prev).add(item.id))
    try {
      const removed = await removePlannedMealFn({ data: { mealId: item.id, version: item.version } })
      setPendingRemove(null)
      if (!removed.ok) {
        setError(removed.message)
      }
      await router.invalidate()
    } catch {
      setPendingRemove(null)
      setError('Verwijderen is niet gelukt. Controleer je verbinding en probeer opnieuw.')
    } finally {
      setRemoving(false)
      setOps((prev) => prev.filter((op) => op.id !== opId))
      setBusyMeals((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  function toggleMenu(item: PlanSummary, dayIndex: number, button: HTMLButtonElement) {
    if (openMenu?.item.id === item.id) {
      setOpenMenu(null)
      return
    }
    menuTriggerRef.current = button
    const rect = button.getBoundingClientRect()
    const left = Math.min(Math.max(12, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 12)
    const spaceBelow = window.innerHeight - rect.bottom - 76
    const top = spaceBelow >= MENU_HEIGHT ? rect.bottom + 6 : Math.max(12, rect.top - MENU_HEIGHT - 6)
    setOpenMenu({ item, dayIndex, top, left })
  }

  function startGesture(
    event: ReactPointerEvent<HTMLElement>,
    item: PlanSummary,
    fromDate: string,
    fromHandle: boolean,
  ) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (busyMeals.has(item.id) || pendingRemove) return

    activeGestureCleanupRef.current?.()
    setOpenMenu(null)

    const pointerId = event.pointerId
    const pointerType = event.pointerType
    const startX = event.clientX
    const startY = event.clientY
    const isDesktopGrid = window.innerWidth >= 1024

    let mode: 'pending' | 'drag' | 'swipe' | 'scroll' = 'pending'
    let lastSwipeOffset = 0
    let lastOverDate: string | null = fromDate
    let longPressTimer: number | null = null

    const enterDrag = (x: number, y: number) => {
      mode = 'drag'
      if (longPressTimer !== null) {
        window.clearTimeout(longPressTimer)
        longPressTimer = null
      }
      document.body.style.userSelect = 'none'
      lastOverDate = findDropDate(x, y)
      setDrag({ item, fromDate, x, y, overDate: lastOverDate })
      if (pointerType !== 'mouse') navigator.vibrate?.(15)
    }

    if (!fromHandle && pointerType !== 'mouse') {
      longPressTimer = window.setTimeout(() => {
        if (mode === 'pending') enterDrag(startX, startY)
      }, LONG_PRESS_MS)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (mode === 'drag' || mode === 'swipe' || fromHandle) {
        if (e.cancelable) e.preventDefault()
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY

      if (mode === 'scroll') return

      if (mode === 'pending') {
        const dist = Math.hypot(dx, dy)
        if (fromHandle) {
          if (dist >= 4) enterDrag(e.clientX, e.clientY)
          return
        }
        if (pointerType === 'mouse') {
          if (!isDesktopGrid && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            mode = 'swipe'
            document.body.style.userSelect = 'none'
          } else if (dist >= 6) {
            enterDrag(e.clientX, e.clientY)
            return
          } else {
            return
          }
        } else {
          // Touch on meal body: horizontal locks swipe, vertical yields to page scroll.
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.15) {
            if (longPressTimer !== null) {
              window.clearTimeout(longPressTimer)
              longPressTimer = null
            }
            mode = 'swipe'
            document.body.style.userSelect = 'none'
          } else if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
            if (longPressTimer !== null) {
              window.clearTimeout(longPressTimer)
              longPressTimer = null
            }
            mode = 'scroll'
            return
          } else {
            return
          }
        }
      }

      if (mode === 'drag') {
        lastOverDate = findDropDate(e.clientX, e.clientY)
        setDrag({ item, fromDate, x: e.clientX, y: e.clientY, overDate: lastOverDate })
      } else if (mode === 'swipe') {
        const clamped = clampSwipe(dx)
        lastSwipeOffset = clamped
        setSwipe({ mealId: item.id, offset: clamped, ready: Math.abs(clamped) >= SWIPE_THRESHOLD })
      }
    }

    const cleanup = () => {
      if (longPressTimer !== null) {
        window.clearTimeout(longPressTimer)
        longPressTimer = null
      }
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerEnd)
      window.removeEventListener('pointercancel', onPointerCancel)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKeyDown)
      activeGestureCleanupRef.current = null
    }

    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      const finalMode = mode
      const dropDate = finalMode === 'drag' ? (findDropDate(e.clientX, e.clientY) ?? lastOverDate) : null
      const finalSwipe = lastSwipeOffset
      cleanup()
      setDrag(null)
      setSwipe(null)
      if (finalMode === 'drag') {
        markSuppressClick()
        if (dropDate && dropDate !== fromDate) void moveMeal(item, dropDate)
      } else if (finalMode === 'swipe') {
        markSuppressClick()
        if (Math.abs(finalSwipe) >= SWIPE_THRESHOLD) setPendingRemove(item)
      }
    }

    const onPointerCancel = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      cleanup()
      setDrag(null)
      setSwipe(null)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (mode === 'drag' || mode === 'swipe')) {
        cleanup()
        setDrag(null)
        setSwipe(null)
      }
    }

    activeGestureCleanupRef.current = cleanup
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerEnd)
    window.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('keydown', onKeyDown)
  }

  const prevDayDate = openMenu && openMenu.dayIndex > 0 ? visibleDays[openMenu.dayIndex - 1]?.date : null
  const nextDayDate =
    openMenu && openMenu.dayIndex < visibleDays.length - 1 ? visibleDays[openMenu.dayIndex + 1]?.date : null

  return (
    <>
      {error && <Notice tone="error">{error}</Notice>}
      <ul
        aria-label="Dagen"
        data-busy={busyMeals.size > 0 ? 'true' : undefined}
        className="flex flex-col gap-2 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(148px,1fr))] lg:gap-3"
      >
        {visibleDays.map((day, dayIndex) => {
          const isToday = day.date === today
          const isDropTarget = drag !== null && drag.overDate === day.date && drag.fromDate !== day.date
          return (
            <li key={day.date} className="flex">
              <DayCard
                date={day.date}
                items={day.items}
                today={isToday}
                isDropTarget={isDropTarget}
                draggingMealId={drag?.item.id ?? null}
                swipe={swipe}
                openMenuMealId={openMenu?.item.id ?? null}
                busyMeals={busyMeals}
                suppressClickRef={suppressClickRef}
                onStartGesture={(event, item, fromHandle) => startGesture(event, item, day.date, fromHandle)}
                onToggleMenu={(item, button) => toggleMenu(item, dayIndex, button)}
              />
            </li>
          )
        })}
      </ul>

      {drag && (
        <div
          aria-hidden="true"
          style={{ transform: `translate3d(${drag.x}px, ${drag.y}px, 0) translate(-50%, -65%)` }}
          className="pointer-events-none fixed top-0 left-0 z-50 flex max-w-[260px] items-center gap-2.5 rounded-2xl border border-tomato/40 bg-surface px-3.5 py-2.5 text-ink shadow-xl ring-2 ring-tomato/30"
        >
          {drag.item.kind === 'recipe' && (
            <RecipeThumb
              name={drag.item.title}
              photoUrl={drag.item.imageUrl}
              className="size-10 rounded-lg text-base"
            />
          )}
          <span
            className={cx(
              'truncate text-[15px]',
              drag.item.kind === 'free' ? 'font-medium text-ink-2 italic' : 'font-semibold',
            )}
          >
            {drag.item.title}
          </span>
        </div>
      )}

      {openMenu && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Acties voor ${openMenu.item.title}`}
          style={{ top: openMenu.top, left: openMenu.left, width: MENU_WIDTH }}
          className="fixed z-40 flex flex-col gap-0.5 rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            disabled={!prevDayDate || busyMeals.has(openMenu.item.id)}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] font-medium text-ink transition-colors hover:bg-ground focus-visible:outline-2 focus-visible:outline-tomato disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              const target = prevDayDate
              const meal = openMenu.item
              setOpenMenu(null)
              if (target) void moveMeal(meal, target)
            }}
          >
            <ArrowUpIcon size={18} className="shrink-0 text-ink-2" />
            <span className="flex-1">Omhoog plaatsen</span>
            {prevDayDate && (
              <span className="text-xs font-semibold text-ink-3 lowercase">{weekdayShort(prevDayDate)}</span>
            )}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!nextDayDate || busyMeals.has(openMenu.item.id)}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] font-medium text-ink transition-colors hover:bg-ground focus-visible:outline-2 focus-visible:outline-tomato disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              const target = nextDayDate
              const meal = openMenu.item
              setOpenMenu(null)
              if (target) void moveMeal(meal, target)
            }}
          >
            <ArrowDownIcon size={18} className="shrink-0 text-ink-2" />
            <span className="flex-1">Omlaag plaatsen</span>
            {nextDayDate && (
              <span className="text-xs font-semibold text-ink-3 lowercase">{weekdayShort(nextDayDate)}</span>
            )}
          </button>
          <div role="separator" className="my-0.5 border-t border-line-soft" />
          <button
            type="button"
            role="menuitem"
            disabled={busyMeals.has(openMenu.item.id)}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] font-medium text-tomato-dark transition-colors hover:bg-tomato-soft focus-visible:outline-2 focus-visible:outline-tomato disabled:opacity-40"
            onClick={() => {
              const meal = openMenu.item
              setOpenMenu(null)
              setPendingRemove(meal)
            }}
          >
            <TrashIcon size={18} className="shrink-0" />
            <span className="flex-1">Uit planning verwijderen</span>
          </button>
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="remove-planned-meal-title"
        onCancel={(event) => {
          event.preventDefault()
          if (!removing) setPendingRemove(null)
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current && !removing) setPendingRemove(null)
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-black/40"
      >
        {pendingRemove && (
          <>
            <h2 id="remove-planned-meal-title" className="font-display text-xl font-bold">
              Uit planning verwijderen?
            </h2>
            <p className="mt-2 text-[15px] text-ink-2">
              Weet je zeker dat je <strong className="text-ink">{pendingRemove.title}</strong> van{' '}
              {formatCalendarDay(pendingRemove.date)} uit de planning wilt verwijderen?
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <Button variant="secondary" disabled={removing} onClick={() => setPendingRemove(null)}>
                Annuleren
              </Button>
              <Button variant="primary" disabled={removing} onClick={() => void confirmRemove()}>
                {removing ? 'Verwijderen…' : 'Verwijderen'}
              </Button>
            </div>
          </>
        )}
      </dialog>
    </>
  )
}

function DayCard({
  date,
  items,
  today,
  isDropTarget,
  draggingMealId,
  swipe,
  openMenuMealId,
  busyMeals,
  suppressClickRef,
  onStartGesture,
  onToggleMenu,
}: {
  date: string
  items: PlanSummary[]
  today: boolean
  isDropTarget: boolean
  draggingMealId: string | null
  swipe: SwipeState | null
  openMenuMealId: string | null
  busyMeals: Set<string>
  suppressClickRef: { current: boolean }
  onStartGesture: (event: ReactPointerEvent<HTMLElement>, item: PlanSummary, fromHandle: boolean) => void
  onToggleMenu: (item: PlanSummary, button: HTMLButtonElement) => void
}) {
  const dayLabelText = `${formatCalendarDay(date)}${today ? ', vandaag' : ''}: `
  const dateBlock = (
    <span
      aria-hidden="true"
      className={cx(
        'flex w-10 shrink-0 flex-col items-center justify-center text-center lg:w-auto lg:flex-row lg:justify-start lg:gap-1 lg:text-xs lg:font-bold',
        today
          ? 'h-12 rounded-xl bg-tomato text-surface lg:h-auto lg:rounded-none lg:bg-transparent lg:text-tomato'
          : 'lg:text-ink-3',
      )}
    >
      <span className={cx('text-xs font-semibold lg:font-bold', !today && 'text-ink-3')}>
        {weekdayShort(date)}
      </span>
      <span className="text-lg leading-tight font-bold lg:text-xs">{dayOfMonth(date)}</span>
      {today && <span className="hidden lg:inline">· VANDAAG</span>}
    </span>
  )

  if (items.length === 0)
    return (
      <Link
        to="/week/nieuw"
        search={{ date }}
        data-drop-date={date}
        className={cx(
          'flex min-h-16 w-full items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed px-3.5 py-2 text-ink-2 transition-colors hover:bg-surface lg:min-h-36 lg:flex-col lg:justify-center lg:gap-2',
          isDropTarget
            ? 'border-solid border-tomato bg-tomato-soft/60 text-tomato-dark ring-2 ring-tomato/30'
            : today
              ? 'border-tomato'
              : 'border-line',
        )}
      >
        <span className="sr-only">{dayLabelText}</span>
        {dateBlock}
        <span className="flex flex-1 items-center gap-1.5 text-[15px] font-medium lg:flex-none lg:font-semibold">
          <PlusIcon size={18} />
          {isDropTarget ? 'Hier neerzetten' : 'Plan iets'}
        </span>
      </Link>
    )

  return (
    <div
      data-drop-date={date}
      className={cx(
        'flex min-h-16 w-full items-center gap-2 rounded-2xl py-2 pr-1 pl-3 text-ink transition-colors lg:min-h-36 lg:flex-col lg:items-stretch lg:justify-start lg:gap-2 lg:px-3 lg:py-3',
        items.length > 1 && 'items-start',
        isDropTarget
          ? 'bg-tomato-soft/50 ring-2 ring-tomato'
          : cx('bg-surface', today && 'min-h-18 ring-2 ring-tomato'),
      )}
    >
      <div className={cx('flex shrink-0 items-center', items.length > 1 && 'pt-1 lg:pt-0')}>{dateBlock}</div>
      <div className="flex min-w-0 flex-1 flex-col lg:flex-none">
        {today && (
          <span aria-hidden="true" className="px-1 text-[13px] font-bold text-tomato lg:hidden">
            Vandaag
          </span>
        )}
        <div className="flex min-w-0 flex-col divide-y divide-line-soft">
          {items.map((item) => {
            const target =
              items.length === 1
                ? ({ to: '/week/maaltijd/$mealId', params: { mealId: item.id } } as const)
                : ({ to: '/week/dag/$date', params: { date } } as const)
            const isDragging = draggingMealId === item.id
            const itemSwipe = swipe?.mealId === item.id ? swipe : null
            const offset = itemSwipe?.offset ?? 0
            const isBusy = busyMeals.has(item.id)
            const menuOpen = openMenuMealId === item.id

            return (
              <div
                key={item.id}
                data-meal-id={item.id}
                onDragStart={(event) => event.preventDefault()}
                className={cx(
                  'relative overflow-hidden rounded-xl py-0.5 first:pt-0 last:pb-0 lg:py-1.5',
                  isDragging && 'opacity-35',
                  isBusy && 'opacity-70',
                )}
              >
                {offset !== 0 && (
                  <div
                    aria-hidden="true"
                    className={cx(
                      'absolute inset-0 flex items-center gap-1.5 rounded-xl bg-tomato px-3 text-xs font-bold text-surface',
                      offset < 0 ? 'justify-end' : 'justify-start',
                    )}
                  >
                    <TrashIcon size={16} />
                    <span>{itemSwipe?.ready ? 'Loslaten' : 'Verwijderen'}</span>
                  </div>
                )}
                <div
                  style={{
                    transform: offset !== 0 ? `translate3d(${offset}px, 0, 0)` : undefined,
                    WebkitTouchCallout: 'none',
                  }}
                  onPointerDown={(event) => onStartGesture(event, item, false)}
                  onClickCapture={(event) => {
                    if (suppressClickRef.current) {
                      event.preventDefault()
                      event.stopPropagation()
                    }
                  }}
                  className={cx(
                    'relative flex min-w-0 items-center gap-1 rounded-xl select-none touch-pan-y lg:block lg:cursor-grab lg:active:cursor-grabbing',
                    offset !== 0 ? 'bg-surface' : 'transition-transform duration-200 ease-out',
                  )}
                >
                  <span
                    data-drag-handle
                    aria-hidden="true"
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      onStartGesture(event, item, true)
                    }}
                    className="flex min-h-11 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-ink-3/65 hover:text-ink active:cursor-grabbing lg:hidden"
                  >
                    <GripVerticalIcon size={16} />
                  </span>
                  <Link
                    {...target}
                    draggable={false}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl py-1 pr-1 text-ink transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tomato lg:flex-col lg:items-start lg:gap-1.5 lg:p-1"
                  >
                    <span className="sr-only">{dayLabelText}</span>
                    {item.kind === 'recipe' && (
                      <RecipeThumb
                        name={item.title}
                        photoUrl={item.imageUrl}
                        className="size-11 rounded-xl text-base lg:size-10 lg:rounded-lg"
                      />
                    )}
                    <span
                      className={cx(
                        'flex min-w-0 flex-1 flex-col lg:w-full',
                        item.kind === 'free' && 'lg:pr-9',
                      )}
                    >
                      <span
                        className={cx(
                          'text-base leading-snug break-words lg:text-[15px]',
                          item.kind === 'free' ? 'font-medium text-ink-2 italic' : 'font-semibold',
                        )}
                      >
                        {item.title}
                      </span>
                      {item.kind === 'recipe' && (
                        <span className="text-[13px] text-ink-3">
                          {item.effectiveServings} personen{item.recipeArchivedAt ? ' · gearchiveerd' : ''}
                        </span>
                      )}
                    </span>
                  </Link>
                  <button
                    type="button"
                    aria-label={`Opties voor ${item.title}`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    disabled={isBusy}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleMenu(item, event.currentTarget)
                    }}
                    className={cx(
                      'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tomato disabled:opacity-40 lg:absolute lg:top-0.5 lg:right-0.5 lg:size-9',
                      menuOpen && 'bg-muted text-ink',
                    )}
                  >
                    <DotsVerticalIcon size={18} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
