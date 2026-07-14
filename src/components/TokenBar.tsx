interface TokenBarProps {
  tokenInput: string
  onTokenInputChange: (value: string) => void
  onSave: () => void
  onRefresh: () => void
  onChangeToken: () => void
  onCancelEdit: () => void
  hasToken: boolean
  editingToken: boolean
  loading: boolean
}

export function TokenBar({
  tokenInput,
  onTokenInputChange,
  onSave,
  onRefresh,
  onChangeToken,
  onCancelEdit,
  hasToken,
  editingToken,
  loading,
}: TokenBarProps) {
  const showForm = editingToken || !hasToken

  return (
    <div className="token-bar">
      {showForm ? (
        <>
          <label className="token-field">
            <span>GitHub PAT</span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="ghp_… ou github_pat_…"
              value={tokenInput}
              onChange={(e) => onTokenInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave()
              }}
            />
          </label>
          <button type="button" className="btn" onClick={onSave}>
            Salvar
          </button>
          {hasToken && (
            <button type="button" className="btn" onClick={onCancelEdit}>
              Cancelar
            </button>
          )}
        </>
      ) : (
        <>
          <div className="token-field">
            <span>GitHub PAT</span>
            <p className="token-saved">Salvo neste navegador</p>
          </div>
          <button type="button" className="btn" onClick={onChangeToken}>
            Trocar
          </button>
        </>
      )}
      <button
        type="button"
        className="btn btn-primary"
        onClick={onRefresh}
        disabled={!hasToken || loading}
      >
        {loading ? 'Carregando…' : 'Refresh'}
      </button>
    </div>
  )
}
