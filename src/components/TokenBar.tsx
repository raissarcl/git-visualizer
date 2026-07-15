interface TokenBarProps {
  tokenInput: string
  onTokenInputChange: (value: string) => void
  onSave: () => void
  onRefresh: () => void
  onClearToken: () => void
  hasToken: boolean
  loading: boolean
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

export function TokenBar({
  tokenInput,
  onTokenInputChange,
  onSave,
  onRefresh,
  onClearToken,
  hasToken,
  loading,
  theme,
  onToggleTheme,
}: TokenBarProps) {
  const handleClearToken = () => {
    const ok = window.confirm('Remover o token deste navegador?')
    if (!ok) return
    onClearToken()
  }

  return (
    <div className="token-bar">
      {hasToken ? (
        <div className="token-field">
          <span>GitHub PAT</span>
          <div className="token-input-wrap">
            <p className="token-saved">Salvo neste navegador</p>
            <button
              type="button"
              className="token-clear"
              onClick={handleClearToken}
              title="Limpar token"
              aria-label="Limpar token"
            >
              ×
            </button>
          </div>
        </div>
      ) : (
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
        </>
      )}
      <button
        type="button"
        className="btn btn-theme"
        onClick={onToggleTheme}
        title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      >
        {theme === 'dark' ? 'Claro' : 'Escuro'}
      </button>
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
