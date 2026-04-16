interface StepHeaderProps {
  step: number
  total: number
  label: string
  variant?: 'default' | 'naver'
}

export default function StepHeader({ step, total, label, variant = 'default' }: StepHeaderProps) {
  const progress = (step / total) * 100
  const accentClass = variant === 'naver' ? 'text-primary' : 'text-[#03c75a]'
  const barClass = variant === 'naver' ? 'bg-primary' : 'bg-[#03c75a]'

  return (
    <div className="mb-8">
      <div className="flex justify-between items-end mb-2">
        <span className={`${accentClass} font-extrabold tracking-widest text-xs uppercase`}>{label}</span>
        <span className="text-stone-500 text-[10px] font-semibold">{step} / {total}</span>
      </div>
      <div className="h-1 w-full bg-stone-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${barClass} rounded-full transition-all duration-300`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
