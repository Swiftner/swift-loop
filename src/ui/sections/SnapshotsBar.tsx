import { HeaderLink } from '../components/HeaderLink'

interface Props {
  onReset: () => void
  appliedName: string | null
  onOpenLibrary: () => void
}

export function SnapshotsBar({ onReset, appliedName, onOpenLibrary }: Props) {
  return (
    <div class="snapshots-bar">
      <button
        class="snapshots-reset"
        type="button"
        onClick={onReset}
        title="Reset everything to defaults"
      >
        Reset
      </button>
      <button
        type="button"
        class="section-chip-source"
        onClick={onOpenLibrary}
        title={appliedName ? 'Pick a different pattern' : 'Browse patterns'}
      >
        {appliedName ?? 'library →'}
      </button>
      <HeaderLink />
    </div>
  )
}
