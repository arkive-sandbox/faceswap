'use client'

import { useRouter } from 'next/navigation'

interface NavHeaderProps {
  title?: string
  showBack?: boolean
  showMore?: boolean
  onMoreClick?: () => void
}

export default function NavHeader({ title, showBack = false, showMore = false, onMoreClick }: NavHeaderProps) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-50 w-full bg-[#fcf9f8]/80 backdrop-blur-md border-b border-stone-200/20 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 w-full max-w-lg mx-auto">
        {showBack ? (
          <button
            onClick={() => router.back()}
            className="text-[#e4006c] hover:opacity-80 active:scale-95 transition-transform"
            aria-label="뒤로가기"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        ) : (
          <div className="w-6" />
        )}

        {title && (
          <h1 className="text-xl font-extrabold tracking-tighter text-[#e4006c]">{title}</h1>
        )}

        {showMore ? (
          <button
            onClick={onMoreClick}
            className="text-stone-400 hover:opacity-80 active:scale-95 transition-transform"
            aria-label="더 보기"
          >
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        ) : (
          <div className="w-6" />
        )}
      </div>
    </header>
  )
}
