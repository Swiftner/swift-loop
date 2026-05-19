import { useState } from 'preact/hooks'

interface Props {
  label: string
  formula: string
  error?: string | null
  onChange: (next: string) => void
}

export function FormulaRow({ label, formula, error, onChange }: Props) {
  const [draft, setDraft] = useState(formula)
  return (
    <div class={`formula-row ${error ? 'formula-row-error' : ''}`}>
      <div class="formula-row-label">{label}</div>
      <textarea
        class="formula-row-input"
        rows={1}
        value={draft}
        spellcheck={false}
        onInput={(e) => {
          const v = (e.target as HTMLTextAreaElement).value
          setDraft(v)
          onChange(v)
        }}
      />
      {error && <div class="formula-row-error-message">{error}</div>}
    </div>
  )
}
