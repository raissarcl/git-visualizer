/**
 * Estado dos filtros da sidebar + helper para aplicar na lista carregada.
 * Inclui filtros de API (mineOnly, state) e locais (query, notes, conflito, idade).
 */

import { useCallback, useState } from 'react'
import {
  filterPullRequests,
  sortPinnedFirst,
  type AgeFilterDays,
  type PinSet,
  type PrNotesMap,
} from '../domain/filters'
import type { PullRequest, StateFilter } from '../domain/pullRequest'

export function usePrFilters() {
  const [mineOnly, setMineOnly] = useState(false)
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')

  const [query, setQuery] = useState('')
  const [notesOnly, setNotesOnly] = useState(false)
  const [conflictOnly, setConflictOnly] = useState(false)
  const [minOpenDays, setMinOpenDays] = useState<AgeFilterDays>(0)

  const applyFilters = useCallback(
    (prs: PullRequest[], notes: PrNotesMap, pins: PinSet) => {
      const local = filterPullRequests(
        prs,
        { query, notesOnly, conflictOnly, minOpenDays },
        notes,
      )

      return sortPinnedFirst(local, pins)
    },
    [query, notesOnly, conflictOnly, minOpenDays],
  )

  return {
    mineOnly,
    setMineOnly,
    stateFilter,
    setStateFilter,
    query,
    setQuery,
    notesOnly,
    setNotesOnly,
    conflictOnly,
    setConflictOnly,
    minOpenDays,
    setMinOpenDays,
    applyFilters,
  }
}
