import type { Theme } from '../theme/theme'
import { useTheme } from '../theme/useTheme'

const OPTIONS: readonly { theme: Theme; label: string }[] = [
  { theme: 'light', label: 'Hell' },
  { theme: 'dark', label: 'Dunkel' },
]

/** "Design: Hell / Dunkel". Two buttons, the active one is marked with aria-pressed. */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="theme-toggle" role="group" aria-label="Design">
      {OPTIONS.map((option) => (
        <button
          key={option.theme}
          type="button"
          className="theme-option"
          aria-pressed={theme === option.theme}
          onClick={() => setTheme(option.theme)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
