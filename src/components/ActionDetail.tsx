import { useEffect, useMemo, useState } from 'react'
import type { WorkflowJob, WorkflowRun } from '../domain/workflowRun'
import {
  actionNoteKey,
  canCancel,
  canRerun,
  canRerunFailed,
  runBadgeKind,
  runBadgeLabel,
} from '../domain/workflowRun'
import { hasNote } from '../storage/notes'
import { ConfirmActionModal, type ConfirmDetailRow } from './ConfirmActionModal'
import { SafeMarkdown } from './SafeMarkdown'

type PendingAction = 'cancel' | 'rerun' | 'rerun-failed'

interface ActionDetailProps {
  run: WorkflowRun | null
  jobs: WorkflowJob[]
  jobsLoading: boolean
  mutating: boolean
  note: string
  onNoteChange: (key: string, text: string) => void
  onCancel: (run: WorkflowRun) => void
  onRerun: (run: WorkflowRun) => void
  onRerunFailed: (run: WorkflowRun) => void
  onEnsureDetail: () => Promise<WorkflowRun | null>
  onClose: () => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function pickRunInput(inputs: Record<string, string>, names: string[]): string {
  const byLower = new Map(
    Object.entries(inputs).map(([key, value]) => [key.toLowerCase().replace(/-/g, '_'), value]),
  )
  for (const name of names) {
    const value = byLower.get(name.toLowerCase().replace(/-/g, '_'))?.trim()
    if (value) return value
  }
  return ''
}

export function ActionDetail({
  run,
  jobs,
  jobsLoading,
  mutating,
  note,
  onNoteChange,
  onCancel,
  onRerun,
  onRerunFailed,
  onEnsureDetail,
  onClose,
}: ActionDetailProps) {
  const [draft, setDraft] = useState(note)
  const [notesMode, setNotesMode] = useState<'edit' | 'preview'>('edit')
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  useEffect(() => {
    setDraft(note)
  }, [run?.id, run?.repo, note])

  useEffect(() => {
    setNotesMode('edit')
    setPending(null)
  }, [run?.id, run?.repo])

  const confirmMeta = useMemo(() => {
    if (!run || !pending) {
      return { title: '', subtitle: '', confirmLabel: 'Confirmar', details: [] as ConfirmDetailRow[] }
    }

    const branchRef =
      pickRunInput(run.inputs, [
        'ref',
        'branch',
        'git_ref',
        'source_branch',
        'from_branch',
        'source',
      ]) ||
      run.headBranch ||
      '—'

    const details: ConfirmDetailRow[] = [
      { label: 'Repositório', value: run.repo, mono: true },
      { label: 'Run', value: `#${run.runNumber} (id ${run.id})`, mono: true },
      { label: 'Workflow', value: run.name },
      { label: 'Branch ref', value: branchRef, mono: true },
      { label: 'Evento', value: run.event },
      { label: 'Status', value: runBadgeLabel(run) },
      { label: 'Autor', value: run.actorLogin },
      { label: 'Criado', value: formatDate(run.createdAt) },
    ]
    if (pending === 'cancel') {
      return {
        title: 'Confirmar cancelamento',
        subtitle: 'Cancela o run em andamento',
        confirmLabel: 'Confirmar e cancelar',
        details,
      }
    }
    if (pending === 'rerun-failed') {
      return {
        title: 'Confirmar rerun failed',
        subtitle: 'Reexecuta apenas os jobs que falharam',
        confirmLabel: 'Confirmar rerun failed',
        details,
      }
    }
    return {
      title: 'Confirmar rerun',
      subtitle: 'Reexecuta o workflow completo',
      confirmLabel: 'Confirmar rerun',
      details,
    }
  }, [run, pending])

  if (!run) return null

  const key = actionNoteKey(run.repo, run.id)
  const noteFilled = hasNote({ [key]: draft }, key)
  const kind = runBadgeKind(run)

  const persist = (text: string) => {
    onNoteChange(key, text)
  }

  const openConfirm = (action: PendingAction) => {
    setPending(action)
    setConfirmLoading(true)
    void onEnsureDetail().finally(() => setConfirmLoading(false))
  }

  const confirmPending = () => {
    if (!pending || confirmLoading) return
    if (pending === 'cancel') onCancel(run)
    else if (pending === 'rerun') onRerun(run)
    else onRerunFailed(run)
    setPending(null)
  }

  return (
    <>
    <aside className="detail-drawer scrollable" aria-label="Detalhe do run">
      <div className="detail-toolbar">
        <button type="button" className="detail-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </div>

      <p className="detail-eyebrow">
        {run.repo} · run #{run.runNumber}
      </p>
      <h2>{run.displayTitle}</h2>

      <div className="detail-meta-row">
        <span className={`badge badge-run-${kind}`}>{runBadgeLabel(run)}</span>
        <span className="detail-meta-muted">{run.name}</span>
      </div>

      <dl className="detail-facts">
        <div>
          <dt>Branch ref</dt>
          <dd>
            <code>
              {pickRunInput(run.inputs, [
                'ref',
                'branch',
                'git_ref',
                'source_branch',
                'from_branch',
                'source',
              ]) ||
                run.headBranch ||
                '—'}
            </code>
          </dd>
        </div>
        <div>
          <dt>Evento</dt>
          <dd>{run.event}</dd>
        </div>
        <div>
          <dt>Autor</dt>
          <dd>{run.actorLogin}</dd>
        </div>
        <div>
          <dt>Criado</dt>
          <dd>{formatDate(run.createdAt)}</dd>
        </div>
        <div>
          <dt>Atualizado</dt>
          <dd>{formatDate(run.updatedAt)}</dd>
        </div>
        {Object.keys(run.inputs).length > 0 && (
          <div className="detail-facts-inputs">
            <dt>Inputs</dt>
            <dd>
              <ul className="run-inputs-list">
                {Object.entries(run.inputs).map(([name, value]) => (
                  <li key={name}>
                    <code>{name}</code>
                    <span>{value === '' ? '(vazio)' : value}</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>

      <div className="detail-actions">
        <a className="btn btn-primary" href={run.htmlUrl} target="_blank" rel="noreferrer">
          Abrir no GitHub
        </a>
        {canCancel(run) && (
          <button
            type="button"
            className="btn"
            disabled={mutating || confirmLoading}
            onClick={() => openConfirm('cancel')}
          >
            Cancelar
          </button>
        )}
        {canRerun(run) && (
          <button
            type="button"
            className="btn"
            disabled={mutating || confirmLoading}
            onClick={() => openConfirm('rerun')}
          >
            Rerun
          </button>
        )}
        {canRerunFailed(run) && (
          <button
            type="button"
            className="btn"
            disabled={mutating || confirmLoading}
            onClick={() => openConfirm('rerun-failed')}
          >
            Rerun failed
          </button>
        )}
      </div>

      <section className="detail-jobs">
        <h3>Jobs</h3>
        {jobsLoading ? (
          <p className="detail-meta-muted">Carregando jobs…</p>
        ) : jobs.length === 0 ? (
          <p className="detail-meta-muted">Nenhum job listado.</p>
        ) : (
          <ul className="jobs-list">
            {jobs.map((job) => {
              const jobKind = runBadgeKind(job)
              return (
                <li key={job.id} className="jobs-list-item">
                  <span className={`badge badge-run-${jobKind}`}>{runBadgeLabel(job)}</span>
                  <span className="jobs-list-name">{job.name}</span>
                  <a href={job.htmlUrl} target="_blank" rel="noreferrer" className="jobs-list-link">
                    ver
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="detail-notes">
        <div className="detail-notes-heading">
          <h3>Notas</h3>
          {noteFilled && <span className="note-badge" title="Tem nota local">nota</span>}
          <div className="notes-mode-tabs" role="tablist" aria-label="Modo das notas">
            <button
              type="button"
              role="tab"
              className={notesMode === 'edit' ? 'is-active' : undefined}
              aria-selected={notesMode === 'edit'}
              onClick={() => setNotesMode('edit')}
            >
              Editar
            </button>
            <button
              type="button"
              role="tab"
              className={notesMode === 'preview' ? 'is-active' : undefined}
              aria-selected={notesMode === 'preview'}
              onClick={() => setNotesMode('preview')}
            >
              Preview
            </button>
          </div>
        </div>
        <p className="detail-notes-hint">Salvas só neste navegador</p>
        {notesMode === 'edit' ? (
          <textarea
            className="detail-notes-input"
            value={draft}
            onChange={(e) => {
              const value = e.target.value
              setDraft(value)
              persist(value)
            }}
            onBlur={() => persist(draft)}
            placeholder="Ex.: falhou por secret; re-rodar após rotacionar…"
            rows={8}
            spellCheck
          />
        ) : draft.trim() ? (
          <div className="detail-body-md detail-notes-preview scrollable">
            <SafeMarkdown>{draft}</SafeMarkdown>
          </div>
        ) : (
          <p className="detail-body-empty">Nada para pré-visualizar.</p>
        )}
      </div>
    </aside>

    <ConfirmActionModal
      open={pending != null}
      title={confirmMeta.title}
      subtitle={confirmMeta.subtitle}
      details={confirmMeta.details}
      confirmLabel={confirmMeta.confirmLabel}
      busy={mutating || confirmLoading}
      onCancel={() => {
        setPending(null)
        setConfirmLoading(false)
      }}
      onConfirm={confirmPending}
    />
    </>
  )
}
