interface BottomCtaProps {
  label: string
  onClick: () => void
  secondary?: {
    label: string
    onClick: () => void
  }
  icon?: string
  variant?: 'primary' | 'glow' | 'naver'
  disabled?: boolean
}

export default function BottomCta({ label, onClick, secondary, icon, variant = 'primary', disabled = false }: BottomCtaProps) {
  const activeClass =
    variant === 'glow'
      ? 'flex-1 h-12 bg-[#03c75a] text-white rounded-full flex items-center justify-center gap-3 hover:brightness-110 transition-all active:scale-[0.98] duration-200 font-bold text-lg tracking-tight'
      : variant === 'naver'
        ? 'flex-1 h-12 rounded-full bg-[#03c75a] text-white font-bold hover:brightness-95 transition-all active:scale-95'
        : 'flex-1 h-12 rounded-full bg-primary text-white font-bold hover:opacity-90 transition-all active:scale-95'

  const disabledClass = 'flex-1 h-12 rounded-full bg-stone-200 text-stone-400 font-bold cursor-not-allowed transition-all flex items-center justify-center gap-3'

  const primaryClass = disabled ? disabledClass : activeClass

  return (
    <footer className="fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-md px-6 py-4 border-t border-stone-100 z-50">
      <div className="max-w-lg mx-auto flex gap-3">
        {secondary && (
          <button
            onClick={secondary.onClick}
            className="flex-1 h-12 rounded-full border border-outline-variant font-bold text-secondary hover:bg-surface-container transition-colors active:scale-95"
          >
            {secondary.label}
          </button>
        )}
        <button onClick={disabled ? undefined : onClick} disabled={disabled} className={primaryClass}>
          {icon && (
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              {icon}
            </span>
          )}
          {label}
        </button>
      </div>
    </footer>
  )
}
