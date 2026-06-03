interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  variant?: 'checkbox' | 'switch'
}

// A labeled checkbox (Random toggles) or switch (Auto update). Plain and
// keyboard-accessible.
export function Toggle({ checked, onChange, label, variant = 'checkbox' }: Props) {
  return (
    <label class={`lp-toggle lp-toggle-${variant}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <span class="lp-toggle-box" aria-hidden="true" />
      <span class="lp-toggle-label">{label}</span>
    </label>
  )
}
