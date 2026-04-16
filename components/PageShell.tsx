interface PageShellProps {
  children: React.ReactNode
  className?: string
}

export default function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={`bg-background min-h-screen flex flex-col max-w-md mx-auto${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  )
}
