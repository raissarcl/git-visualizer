import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import {
  linkBadgeLabel,
  normalizeTags,
  noteLinkRepo,
  noteListTitle,
  remoteStatusLabel,
  workspaceNotesContentEqual,
  type NoteLink,
  type WorkspaceNote,
} from '../domain/workspaceNote'
import { ConfirmActionModal, type ConfirmDetailRow } from './ConfirmActionModal'
import { CopyableCode } from './CopyableCode'
import { CopyMarkdownButton } from './CopyMarkdownButton'
import { DetailDrawer } from './DetailDrawer'
import { SafeMarkdown } from './SafeMarkdown'
import { SearchableSelect } from './SearchableSelect'

function noteAsMarkdown(title: string, body: string): string {
  const t = title.trim()
  const b = body.trim()
  if (t && b) return `# ${t}\n\n${body}`
  if (t) return `# ${t}`
  return body
}

interface NoteDetailProps {
  note: WorkspaceNote | null
  repos: string[]
  token: string
  suggestedPr: { repo: string; number: number } | null
  loadBranches: (repo: string) => Promise<string[]>
  checkBranch: (
    repo: string,
    branch: string,
  ) => Promise<'verified' | 'missing'>
  onChange: (note: WorkspaceNote) => void
  onDelete: (id: string) => void
  onClose: () => void
  onDirtyChange?: (dirty: boolean) => void
  /** Expõe save síncrono para o App ao trocar seleção. */
  saveHandlerRef?: MutableRefObject<(() => void) | null>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function withUpdatedAt(note: WorkspaceNote): WorkspaceNote {
  return { ...note, updatedAt: new Date().toISOString() }
}

function patchDraft(draft: WorkspaceNote, patch: Partial<WorkspaceNote>): WorkspaceNote {
  return { ...draft, ...patch }
}

export function NoteDetail({
  note,
  repos,
  token,
  suggestedPr,
  loadBranches,
  checkBranch,
  onChange,
  onDelete,
  onClose,
  onDirtyChange,
  saveHandlerRef,
}: NoteDetailProps) {
  const [draft, setDraft] = useState<WorkspaceNote | null>(note)
  const [bodyMode, setBodyMode] = useState<'edit' | 'preview'>('edit')
  const [tagDraft, setTagDraft] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [confirmKind, setConfirmKind] = useState<'delete' | 'save-close' | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    setDraft(note)
    setBodyMode('edit')
    setTagDraft('')
    setCheckError(null)
    setConfirmKind(null)
  }, [note?.id])

  const dirty = Boolean(
    note && draft && note.id === draft.id && !workspaceNotesContentEqual(note, draft),
  )

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const persist = (next: WorkspaceNote) => {
    const saved = withUpdatedAt(next)
    setDraft(saved)
    onChange(saved)
  }

  const handleSave = () => {
    if (!draft) return
    persist(draft)
  }

  useEffect(() => {
    if (!saveHandlerRef) return
    saveHandlerRef.current = () => {
      const current = draftRef.current
      if (!current) return
      const saved = withUpdatedAt(current)
      draftRef.current = saved
      setDraft(saved)
      onChange(saved)
    }
    return () => {
      saveHandlerRef.current = null
    }
  }, [saveHandlerRef, onChange])

  const linkRepo = draft?.link.type === 'none' ? '' : (draft?.link.repo ?? '')
  const linkBranch = draft?.link.type === 'branch' ? draft.link.branch : ''

  useEffect(() => {
    if (!draft || !token || !linkRepo) {
      setBranches([])
      return
    }
    let cancelled = false
    setBranchesLoading(true)
    void loadBranches(linkRepo)
      .then((list) => {
        if (!cancelled) setBranches(list)
      })
      .catch(() => {
        if (!cancelled) setBranches([])
      })
      .finally(() => {
        if (!cancelled) setBranchesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [draft?.id, linkRepo, token, loadBranches])

  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: b, label: b })),
    [branches],
  )

  const repoOptions = useMemo(() => {
    const linked = noteLinkRepo(draft?.link ?? { type: 'none' })
    const list = [...repos]
    if (linked && !list.includes(linked)) list.unshift(linked)
    return list.map((r) => ({ value: r, label: r }))
  }, [repos, draft?.link])

  const confirmDetails: ConfirmDetailRow[] = useMemo(() => {
    if (!draft) return []
    return [
      { label: 'Título', value: noteListTitle(draft) },
      { label: 'Vínculo', value: linkBadgeLabel(draft.link), mono: true },
      {
        label: 'Status',
        value: draft.status === 'archived' ? 'arquivada' : 'aberta',
      },
    ]
  }, [draft])

  if (!note || !draft) return null

  const applyLink = (link: NoteLink) => {
    setDraft((d) => (d ? patchDraft(d, { link, linkedPr: null }) : d))
  }

  const setLinkType = (type: NoteLink['type']) => {
    if (type === 'none') {
      applyLink({ type: 'none' })
      return
    }
    const repo = linkRepo || repos[0] || ''
    if (type === 'repo') {
      applyLink({ type: 'repo', repo })
      return
    }
    applyLink({
      type: 'branch',
      repo,
      branch: linkBranch || '',
      remoteStatus: 'manual',
    })
  }

  const setRepo = (repo: string) => {
    if (draft.link.type === 'repo') {
      applyLink({ type: 'repo', repo })
      return
    }
    if (draft.link.type === 'branch') {
      applyLink({
        type: 'branch',
        repo,
        branch: draft.link.branch,
        remoteStatus: 'manual',
      })
    }
  }

  const setBranch = (branch: string, fromRemote: boolean) => {
    if (draft.link.type !== 'branch') return
    applyLink({
      type: 'branch',
      repo: draft.link.repo,
      branch,
      remoteStatus: fromRemote ? 'verified' : 'manual',
      lastCheckedAt: fromRemote ? new Date().toISOString() : undefined,
    })
  }

  const addTag = () => {
    const next = normalizeTags([...draft.tags, tagDraft])
    setTagDraft('')
    setDraft((d) => (d ? patchDraft(d, { tags: next }) : d))
  }

  const removeTag = (tag: string) => {
    setDraft((d) =>
      d
        ? patchDraft(d, {
            tags: d.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()),
          })
        : d,
    )
  }

  const handleCheck = async () => {
    if (draft.link.type !== 'branch' || !draft.link.branch.trim() || !token) return
    setChecking(true)
    setCheckError(null)
    try {
      const status = await checkBranch(draft.link.repo, draft.link.branch)
      const next = patchDraft(draft, {
        link: {
          ...draft.link,
          remoteStatus: status,
          lastCheckedAt: new Date().toISOString(),
        },
      })
      persist(next)
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Falha ao verificar branch.')
    } finally {
      setChecking(false)
    }
  }

  const handleDelete = () => {
    setConfirmKind('delete')
  }

  const handleClose = () => {
    if (dirty) {
      setConfirmKind('save-close')
      return
    }
    onDirtyChange?.(false)
    onClose()
  }

  const confirmModal = () => {
    if (!draft || !confirmKind) return
    if (confirmKind === 'delete') {
      setConfirmKind(null)
      onDelete(draft.id)
      return
    }
    // save-close
    handleSave()
    setConfirmKind(null)
    onDirtyChange?.(false)
    onClose()
  }

  const discardAndClose = () => {
    setConfirmKind(null)
    setDraft(note)
    onDirtyChange?.(false)
    onClose()
  }

  const linkSuggestedPr = () => {
    if (!suggestedPr) return
    persist(patchDraft(draft, { linkedPr: suggestedPr }))
  }

  return (
    <>
    <DetailDrawer aria-label="Detalhe da nota" onClose={handleClose}>
      <div className="detail-toolbar">
        <button
          type="button"
          className={`btn-pin${draft.pinned ? ' is-pinned' : ''}`}
          onClick={() =>
            setDraft((d) => (d ? patchDraft(d, { pinned: !d.pinned }) : d))
          }
          title={draft.pinned ? 'Desafixar nota' : 'Fixar nota'}
          aria-pressed={draft.pinned}
        >
          {draft.pinned ? 'Fixada' : 'Fixar'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() =>
            setDraft((d) =>
              d
                ? patchDraft(d, {
                    status: d.status === 'open' ? 'archived' : 'open',
                  })
                : d,
            )
          }
        >
          {draft.status === 'open' ? 'Arquivar' : 'Reabrir'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!dirty}
          onClick={handleSave}
        >
          Salvar
        </button>
        <button type="button" className="detail-close" onClick={handleClose} aria-label="Fechar">
          ×
        </button>
      </div>

      <p className="detail-eyebrow">
        Nota local
        {draft.status === 'archived' ? ' · arquivada' : ''}
        {dirty ? ' · alterações não salvas' : ''}
      </p>

      <label className="note-title-field">
        <span className="sr-only">Título</span>
        <input
          type="text"
          className="note-title-input"
          value={draft.title}
          placeholder="Título da nota"
          onChange={(e) =>
            setDraft((d) => (d ? patchDraft(d, { title: e.target.value }) : d))
          }
        />
      </label>

      <div className="note-link-block">
        <h3>Vínculo</h3>
        <div className="note-link-type" role="group" aria-label="Tipo de vínculo">
          {(
            [
              ['none', 'Geral'],
              ['repo', 'Repo'],
              ['branch', 'Branch'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`filter-chip${draft.link.type === value ? ' is-on' : ''}`}
            >
              <input
                type="radio"
                name={`note-link-${draft.id}`}
                checked={draft.link.type === value}
                onChange={() => setLinkType(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {draft.link.type !== 'none' && (
          <label className="filter-field note-link-repo">
            <span>Repositório</span>
            <SearchableSelect
              options={repoOptions}
              value={linkRepo}
              onChange={setRepo}
              mono
              placeholder="owner/repo"
              emptyLabel="Nenhum repo"
            />
          </label>
        )}

        {draft.link.type === 'branch' && (
          <>
            <label className="filter-field note-link-branch">
              <span>Branch</span>
              <SearchableSelect
                options={branchOptions}
                value={linkBranch}
                onChange={(value) => {
                  const fromRemote = branches.includes(value)
                  setBranch(value, fromRemote)
                }}
                allowCustom
                mono
                disabled={!linkRepo || branchesLoading}
                placeholder={
                  branchesLoading
                    ? 'Carregando branches…'
                    : 'Digite ou escolha (mesmo sem push)'
                }
                emptyLabel="Digite o nome da branch"
              />
            </label>
            {linkBranch.trim() ? (
              <div className="note-copy-row">
                <CopyableCode value={linkBranch} className="note-link-branch" />
              </div>
            ) : null}
            <div className="note-branch-check">
              <span
                className={`badge badge-note-remote-${draft.link.remoteStatus}`}
                title={
                  draft.link.lastCheckedAt
                    ? `Checado em ${formatDate(draft.link.lastCheckedAt)}`
                    : undefined
                }
              >
                {remoteStatusLabel(draft.link.remoteStatus)}
              </span>
              <button
                type="button"
                className="btn"
                disabled={!token || !linkBranch.trim() || checking}
                onClick={() => {
                  void handleCheck()
                }}
              >
                {checking ? 'Verificando…' : 'Verificar no GitHub'}
              </button>
            </div>
            {checkError && <p className="filters-backup-error">{checkError}</p>}
            <p className="detail-notes-hint">
              Branch ainda sem push? Digite o nome e verifique depois.
            </p>
          </>
        )}
      </div>

      {suggestedPr && !draft.linkedPr && (
        <div className="note-pr-suggest" role="status">
          <span>
            PR #{suggestedPr.number} aberto em <code>{suggestedPr.repo}</code>
          </span>
          <button type="button" className="btn btn-primary" onClick={linkSuggestedPr}>
            Vincular
          </button>
        </div>
      )}

      {draft.linkedPr && (
        <div className="note-pr-linked">
          <span>
            Vinculada ao PR #{draft.linkedPr.number} · <code>{draft.linkedPr.repo}</code>
          </span>
          <button
            type="button"
            className="btn"
            onClick={() =>
              setDraft((d) => (d ? patchDraft(d, { linkedPr: null }) : d))
            }
          >
            Desvincular
          </button>
        </div>
      )}

      <div className="note-tags-block">
        <h3>Tags</h3>
        <div className="note-tags-list">
          {draft.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="note-tag-chip"
              onClick={() => removeTag(tag)}
              title="Remover tag"
            >
              {tag} ×
            </button>
          ))}
        </div>
        <div className="note-tag-add">
          <input
            type="text"
            value={tagDraft}
            placeholder="Nova tag"
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
          />
          <button type="button" className="btn" onClick={addTag} disabled={!tagDraft.trim()}>
            Adicionar
          </button>
        </div>
      </div>

      <div className="detail-notes">
        <div className="detail-notes-heading">
          <h3>Corpo</h3>
          <CopyMarkdownButton
            value={noteAsMarkdown(draft.title, draft.body)}
            title="Copiar nota em markdown"
          />
          <div className="notes-mode-tabs" role="tablist" aria-label="Modo do corpo">
            <button
              type="button"
              role="tab"
              className={bodyMode === 'edit' ? 'is-active' : undefined}
              aria-selected={bodyMode === 'edit'}
              onClick={() => setBodyMode('edit')}
            >
              Editar
            </button>
            <button
              type="button"
              role="tab"
              className={bodyMode === 'preview' ? 'is-active' : undefined}
              aria-selected={bodyMode === 'preview'}
              onClick={() => setBodyMode('preview')}
            >
              Preview
            </button>
          </div>
        </div>
        <p className="detail-notes-hint">Markdown · só neste navegador · use Salvar</p>
        {bodyMode === 'edit' ? (
          <textarea
            className="detail-notes-input"
            value={draft.body}
            onChange={(e) =>
              setDraft((d) => (d ? patchDraft(d, { body: e.target.value }) : d))
            }
            placeholder="Ideias, WIP, lembretes…"
            rows={12}
            spellCheck
          />
        ) : draft.body.trim() ? (
          <div className="detail-body-md detail-notes-preview scrollable">
            <SafeMarkdown>{draft.body}</SafeMarkdown>
          </div>
        ) : (
          <p className="detail-body-empty">Nada para pré-visualizar.</p>
        )}
      </div>

      <dl className="detail-meta">
        <div>
          <dt>Criada</dt>
          <dd>{formatDate(draft.createdAt)}</dd>
        </div>
        <div>
          <dt>Atualizada</dt>
          <dd>{formatDate(note.updatedAt)}</dd>
        </div>
      </dl>

      <div className="detail-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!dirty}
          onClick={handleSave}
        >
          Salvar
        </button>
        <button type="button" className="btn btn-backup-danger" onClick={handleDelete}>
          Excluir nota
        </button>
      </div>
    </DetailDrawer>

      <ConfirmActionModal
        open={confirmKind != null}
        title={confirmKind === 'delete' ? 'Excluir nota?' : 'Salvar e fechar'}
        subtitle={
          confirmKind === 'delete'
            ? 'Esta ação não pode ser desfeita. A nota some só deste navegador.'
            : 'Há alterações não salvas nesta nota.'
        }
        lead={confirmKind === 'delete' ? null : 'Revise antes de continuar:'}
        details={confirmDetails}
        confirmLabel={confirmKind === 'delete' ? 'Excluir nota' : 'Salvar e fechar'}
        cancelLabel={confirmKind === 'delete' ? 'Manter nota' : 'Continuar editando'}
        secondaryLabel={confirmKind === 'save-close' ? 'Fechar sem salvar' : undefined}
        onSecondary={confirmKind === 'save-close' ? discardAndClose : undefined}
        tone={confirmKind === 'delete' ? 'danger' : 'default'}
        onConfirm={confirmModal}
        onCancel={() => setConfirmKind(null)}
      />
    </>
  )
}
