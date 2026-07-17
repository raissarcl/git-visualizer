import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'

export interface SearchableOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  options: SearchableOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  /** Permite confirmar texto digitado que não está na lista (blur/Enter). */
  allowCustom?: boolean
  /** Fonte monoespaçada (repos / branches). */
  mono?: boolean
  emptyLabel?: string
  id?: string
}

const LIST_MAX_HEIGHT = 192 // 12rem

export function SearchableSelect({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = 'Buscar…',
  allowCustom = false,
  mono = false,
  emptyLabel = 'Nenhuma opção',
  id,
}: SearchableSelectProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const blurTimer = useRef<number | null>(null)

  const selectedLabel = useMemo(() => {
    const hit = options.find((o) => o.value === value)
    return hit?.label ?? value
  }, [options, value])

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(selectedLabel)
  const [highlight, setHighlight] = useState(0)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  useEffect(() => {
    if (!open) setQuery(selectedLabel)
  }, [selectedLabel, open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    )
  }, [options, query])

  useEffect(() => {
    setHighlight(0)
  }, [query, open])

  useEffect(() => {
    return () => {
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current)
    }
  }, [])

  const updateMenuPosition = () => {
    const el = inputRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    const openUp = spaceBelow < Math.min(LIST_MAX_HEIGHT, 160) && spaceAbove > spaceBelow
    const maxHeight = Math.max(120, Math.min(LIST_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow))

    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      maxHeight,
      zIndex: 80,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
    const onReposition = () => updateMenuPosition()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, filtered.length])

  useEffect(() => {
    if (!open || !listRef.current) return
    const active = listRef.current.querySelector<HTMLElement>('.search-select-option.is-active')
    active?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  const openList = () => {
    // Limpa o filtro ao abrir — senão a lista só mostra o item já selecionado.
    setQuery('')
    const selectedIndex = options.findIndex((o) => o.value === value)
    setHighlight(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  const commitValue = (next: string) => {
    onChange(next)
    const label = options.find((o) => o.value === next)?.label ?? next
    setQuery(label)
    setOpen(false)
  }

  const commitTyped = () => {
    const q = query.trim()
    if (!q) {
      setQuery(selectedLabel)
      setOpen(false)
      return
    }

    const exact = options.find(
      (o) => o.value === q || o.label.toLowerCase() === q.toLowerCase(),
    )
    if (exact) {
      commitValue(exact.value)
      return
    }

    if (filtered.length === 1) {
      commitValue(filtered[0]!.value)
      return
    }

    if (allowCustom) {
      commitValue(q)
      return
    }

    setQuery(selectedLabel)
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) openList()
      else setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) openList()
      else setHighlight((h) => Math.max(h - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && filtered[highlight]) commitValue(filtered[highlight]!.value)
      else commitTyped()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setQuery(selectedLabel)
      setOpen(false)
    }
  }

  const list = open && !disabled && (
    <ul
      id={listId}
      ref={listRef}
      className={`search-select-list${mono ? ' is-mono' : ''}`}
      role="listbox"
      style={menuStyle}
    >
      {filtered.length === 0 ? (
        <li className="search-select-empty" role="presentation">
          {allowCustom && query.trim() ? `Usar “${query.trim()}”` : emptyLabel}
        </li>
      ) : (
        filtered.map((opt, i) => (
          <li key={opt.value} role="option" aria-selected={opt.value === value}>
            <button
              type="button"
              className={`search-select-option${i === highlight ? ' is-active' : ''}${
                opt.value === value ? ' is-selected' : ''
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => commitValue(opt.value)}
            >
              {opt.label}
            </button>
          </li>
        ))
      )}
    </ul>
  )

  return (
    <div
      className={`search-select${mono ? ' is-mono' : ''}${open ? ' is-open' : ''}`}
      ref={rootRef}
    >
      <input
        ref={inputRef}
        id={id}
        type="text"
        className="search-select-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        placeholder={open ? placeholder : selectedLabel || placeholder}
        value={open ? query : selectedLabel}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          if (blurTimer.current !== null) {
            window.clearTimeout(blurTimer.current)
            blurTimer.current = null
          }
          openList()
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => {
            commitTyped()
          }, 120)
        }}
        onKeyDown={onKeyDown}
      />

      {list ? createPortal(list, document.body) : null}
    </div>
  )
}
