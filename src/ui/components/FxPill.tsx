interface Props {
  active: boolean
  onToggle: () => void
}

export function FxPill({ active, onToggle }: Props) {
  return (
    <button
      class={`fx-pill ${active ? 'is-active' : ''}`}
      onClick={onToggle}
      type="button"
      aria-label={active ? 'Switch to simple inputs' : 'Switch to formulas'}
    >
      fx
    </button>
  )
}
