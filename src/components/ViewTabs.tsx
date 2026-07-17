export type AppView = 'prs' | 'actions'

interface ViewTabsProps {
  view: AppView
  onChange: (view: AppView) => void
}

export function ViewTabs({ view, onChange }: ViewTabsProps) {
  return (
    <div className="view-tabs" role="tablist" aria-label="Visão">
      <button
        type="button"
        role="tab"
        aria-selected={view === 'prs'}
        className={`view-tab${view === 'prs' ? ' is-active' : ''}`}
        onClick={() => onChange('prs')}
      >
        PRs
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'actions'}
        className={`view-tab${view === 'actions' ? ' is-active' : ''}`}
        onClick={() => onChange('actions')}
      >
        Actions
      </button>
    </div>
  )
}
