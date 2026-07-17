import { useEffect, useMemo, useState } from 'react'
import { isBranchLikeInput, type WorkflowInput, type WorkflowSummary } from '../domain/workflowRun'
import { ConfirmActionModal, type ConfirmDetailRow } from './ConfirmActionModal'
import { SearchableSelect } from './SearchableSelect'

interface DispatchModalProps {
  open: boolean
  repos: string[]
  initialRepo: string | null
  onClose: () => void
  loadWorkflows: (repo: string) => Promise<WorkflowSummary[]>
  loadDefaultBranch: (repo: string) => Promise<string>
  loadBranches: (repo: string) => Promise<string[]>
  loadInputs: (
    repo: string,
    workflowPath: string,
    ref?: string,
  ) => Promise<WorkflowInput[] | null>
  onDispatch: (
    repo: string,
    workflowId: number,
    ref: string,
    inputs: Record<string, string>,
  ) => Promise<boolean>
  busy: boolean
}

function defaultsFromInputs(
  inputs: WorkflowInput[],
  defaultBranch: string,
  branches: string[],
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const input of inputs) {
    if (input.type === 'boolean') {
      out[input.name] =
        input.defaultValue === 'true' || input.defaultValue === 'True' ? 'true' : 'false'
    } else if (input.type === 'choice' && input.options.length > 0) {
      out[input.name] =
        input.defaultValue && input.options.includes(input.defaultValue)
          ? input.defaultValue
          : (input.options[0] ?? '')
    } else if (isBranchLikeInput(input)) {
      const preferred = input.defaultValue || defaultBranch
      out[input.name] = branches.includes(preferred)
        ? preferred
        : (branches[0] ?? preferred)
    } else {
      out[input.name] = input.defaultValue
    }
  }
  return out
}

function branchOptions(branches: string[], current: string) {
  if (!current.trim() || branches.includes(current)) {
    return branches.map((b) => ({ value: b, label: b }))
  }
  return [{ value: current, label: current }, ...branches.map((b) => ({ value: b, label: b }))]
}

export function DispatchModal({
  open,
  repos,
  initialRepo,
  onClose,
  loadWorkflows,
  loadDefaultBranch,
  loadBranches,
  loadInputs,
  onDispatch,
  busy,
}: DispatchModalProps) {
  const [repo, setRepo] = useState('')
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
  const [workflowId, setWorkflowId] = useState<number | null>(null)
  const [ref, setRef] = useState('main')
  const [defaultBranch, setDefaultBranch] = useState('main')
  const [branches, setBranches] = useState<string[]>([])
  const [branchesFailed, setBranchesFailed] = useState(false)
  const [inputs, setInputs] = useState<WorkflowInput[] | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [loadingInputs, setLoadingInputs] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedWorkflow = useMemo(
    () => workflows.find((w) => w.id === workflowId) ?? null,
    [workflows, workflowId],
  )

  const repoOptions = useMemo(
    () => repos.map((r) => ({ value: r, label: r })),
    [repos],
  )

  const workflowOptions = useMemo(
    () => workflows.map((w) => ({ value: String(w.id), label: w.name })),
    [workflows],
  )

  useEffect(() => {
    if (!open) return
    const startRepo = initialRepo && repos.includes(initialRepo) ? initialRepo : (repos[0] ?? '')
    setRepo(startRepo)
    setWorkflows([])
    setWorkflowId(null)
    setInputs(null)
    setValues({})
    setBranches([])
    setBranchesFailed(false)
    setError(null)
  }, [open, initialRepo, repos])

  useEffect(() => {
    if (!open || !repo) return
    let cancelled = false
    setLoadingMeta(true)
    setError(null)
    setWorkflows([])
    setWorkflowId(null)
    setInputs(null)
    setValues({})
    setBranches([])
    setBranchesFailed(false)

    Promise.all([
      loadWorkflows(repo),
      loadDefaultBranch(repo),
      loadBranches(repo).then(
        (list) => ({ ok: true as const, list }),
        () => ({ ok: false as const, list: [] as string[] }),
      ),
    ])
      .then(([list, branch, branchResult]) => {
        if (cancelled) return
        setWorkflows(list)
        setDefaultBranch(branch)
        setRef(branch)
        setWorkflowId(list[0]?.id ?? null)
        if (branchResult.ok && branchResult.list.length > 0) {
          setBranches(branchResult.list)
          setBranchesFailed(false)
          if (branchResult.list.includes(branch)) setRef(branch)
          else setRef(branchResult.list[0] ?? branch)
        } else {
          setBranches([])
          setBranchesFailed(true)
          setRef(branch)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Falha ao carregar workflows.')
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, repo, loadWorkflows, loadDefaultBranch, loadBranches])

  useEffect(() => {
    if (!open || !repo || !selectedWorkflow || !ref.trim()) {
      setInputs(null)
      setValues({})
      return
    }

    let cancelled = false
    setLoadingInputs(true)
    setError(null)
    const yamlRef = ref.trim()

    loadInputs(repo, selectedWorkflow.path, yamlRef)
      .then((parsed) => {
        if (cancelled) return
        // Sucesso: sempre array (pode ser vazio). Ausência de dispatch vem como Error.
        const list = parsed ?? []
        setInputs(list)
        setValues(defaultsFromInputs(list, defaultBranch, branches))
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setInputs(null)
        setValues({})
        const msg = err instanceof Error ? err.message : 'Falha ao ler inputs do workflow.'
        setError(
          msg.includes('HTTP 404') || msg.toLowerCase().includes('não encontrado')
            ? `Arquivo do workflow não encontrado na ref “${yamlRef}”.`
            : msg,
        )
      })
      .finally(() => {
        if (!cancelled) setLoadingInputs(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, repo, selectedWorkflow, ref, loadInputs, defaultBranch, branches])

  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!open) setConfirmOpen(false)
  }, [open])

  const confirmDetails = useMemo((): ConfirmDetailRow[] => {
    const rows: ConfirmDetailRow[] = [
      { label: 'Repositório', value: repo, mono: true },
      {
        label: 'Workflow',
        value: selectedWorkflow
          ? `${selectedWorkflow.name} (${selectedWorkflow.path})`
          : workflowId != null
            ? `#${workflowId}`
            : '',
      },
      { label: 'Workflow ID', value: workflowId != null ? String(workflowId) : '', mono: true },
      { label: 'Branch / ref', value: ref.trim(), mono: true },
    ]
    for (const input of inputs ?? []) {
      const raw = values[input.name] ?? ''
      rows.push({
        label: `Input · ${input.name}${input.required ? ' *' : ''}`,
        value: raw === '' ? '(vazio)' : raw,
        mono: isBranchLikeInput(input) || input.type === 'choice',
      })
    }
    if (inputs && inputs.length === 0) {
      rows.push({ label: 'Inputs', value: '(nenhum)' })
    }
    return rows
  }, [repo, selectedWorkflow, workflowId, ref, inputs, values])

  if (!open) return null

  const canSubmit =
    Boolean(repo && workflowId && ref.trim() && inputs !== null) &&
    !loadingMeta &&
    !loadingInputs &&
    !busy &&
    !(inputs?.some((i) => i.required && !values[i.name]?.trim()) ?? false)

  const handleSubmit = async () => {
    if (!workflowId || !repo) return
    setError(null)
    const payload: Record<string, string> = {}
    for (const input of inputs ?? []) {
      payload[input.name] = values[input.name] ?? ''
    }
    const ok = await onDispatch(repo, workflowId, ref.trim(), payload)
    if (ok) {
      setConfirmOpen(false)
      onClose()
    } else {
      setConfirmOpen(false)
      setError('Falha ao disparar workflow. Veja o aviso no topo da página.')
    }
  }

  return (
    <>
    <div className="org-overlay" role="presentation" onClick={confirmOpen ? undefined : onClose}>
      <div
        className="org-modal dispatch-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispatch-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="org-header">
          <div>
            <h2 id="dispatch-title">Rodar workflow</h2>
            <p className="org-subtitle">Dispara workflow_dispatch via API</p>
          </div>
          <button type="button" className="detail-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="dispatch-body">
          {repos.length === 0 ? (
            <p className="filters-backup-hint">Selecione um repositório ou pasta com repos.</p>
          ) : (
            <>
              <label className="filter-field">
                <span>Repositório</span>
                <SearchableSelect
                  options={repoOptions}
                  value={repo}
                  onChange={setRepo}
                  disabled={busy}
                  placeholder="Buscar repositório…"
                  mono
                />
              </label>

              <label className="filter-field">
                <span>Workflow</span>
                <SearchableSelect
                  options={workflowOptions}
                  value={workflowId != null ? String(workflowId) : ''}
                  onChange={(v) => setWorkflowId(v ? Number(v) : null)}
                  disabled={busy || loadingMeta || workflows.length === 0}
                  placeholder={
                    loadingMeta
                      ? 'Carregando…'
                      : workflows.length === 0
                        ? 'Nenhum workflow'
                        : 'Buscar workflow…'
                  }
                  emptyLabel="Nenhum workflow"
                />
              </label>

              <label className="filter-field">
                <span>Branch / ref</span>
                <SearchableSelect
                  options={branchOptions(branches, ref)}
                  value={ref}
                  onChange={setRef}
                  disabled={busy || loadingMeta}
                  placeholder={defaultBranch}
                  allowCustom={branchesFailed || branches.length === 0}
                  mono
                  emptyLabel="Nenhuma branch"
                />
              </label>

              {branchesFailed && (
                <p className="filters-backup-hint">
                  Não foi possível listar branches — digite a ref manualmente.
                </p>
              )}

              {loadingInputs && <p className="filters-backup-hint">Lendo inputs do YAML…</p>}

              {inputs && inputs.length > 0 && (
                <fieldset className="dispatch-inputs">
                  <legend>Inputs</legend>
                  {inputs.map((input) => (
                    <label key={input.name} className="filter-field">
                      <span>
                        {input.name}
                        {input.required ? ' *' : ''}
                        {input.description ? (
                          <span className="dispatch-input-desc"> — {input.description}</span>
                        ) : null}
                      </span>
                      {input.type === 'boolean' ? (
                        <select
                          value={values[input.name] ?? 'false'}
                          onChange={(e) =>
                            setValues((prev) => ({ ...prev, [input.name]: e.target.value }))
                          }
                          disabled={busy}
                        >
                          <option value="false">false</option>
                          <option value="true">true</option>
                        </select>
                      ) : input.type === 'choice' && input.options.length > 0 ? (
                        <SearchableSelect
                          options={input.options.map((opt) => ({ value: opt, label: opt }))}
                          value={values[input.name] ?? ''}
                          onChange={(v) =>
                            setValues((prev) => ({ ...prev, [input.name]: v }))
                          }
                          disabled={busy}
                          placeholder="Buscar…"
                        />
                      ) : isBranchLikeInput(input) ? (
                        <SearchableSelect
                          options={branchOptions(branches, values[input.name] ?? '')}
                          value={values[input.name] ?? ''}
                          onChange={(v) =>
                            setValues((prev) => ({ ...prev, [input.name]: v }))
                          }
                          disabled={busy}
                          placeholder={defaultBranch}
                          allowCustom={branchesFailed || branches.length === 0}
                          mono
                          emptyLabel="Nenhuma branch"
                        />
                      ) : (
                        <input
                          type={input.type === 'number' ? 'number' : 'text'}
                          value={values[input.name] ?? ''}
                          onChange={(e) =>
                            setValues((prev) => ({ ...prev, [input.name]: e.target.value }))
                          }
                          disabled={busy}
                        />
                      )}
                    </label>
                  ))}
                </fieldset>
              )}

              {inputs && inputs.length === 0 && (
                <p className="filters-backup-hint">Sem inputs — o workflow será disparado na ref.</p>
              )}
            </>
          )}

          {error && <p className="filters-backup-error">{error}</p>}
        </div>

        <footer className="org-footer">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSubmit}
            onClick={() => setConfirmOpen(true)}
          >
            Disparar
          </button>
        </footer>
      </div>
    </div>

    <ConfirmActionModal
      open={confirmOpen}
      title="Confirmar disparo"
      subtitle="workflow_dispatch"
      details={confirmDetails}
      confirmLabel="Confirmar e disparar"
      busy={busy}
      onCancel={() => setConfirmOpen(false)}
      onConfirm={() => {
        void handleSubmit()
      }}
    />
    </>
  )
}
