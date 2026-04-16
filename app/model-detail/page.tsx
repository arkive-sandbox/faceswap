'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import StepHeader from '@/components/StepHeader'
import BottomCta from '@/components/BottomCta'
import PageShell from '@/components/PageShell'
import { useSelectionStore } from '@/store/useSelectionStore'
import { squareFile, dataUrlToFile, cropToOriginalAspect } from '@/lib/segmentation'
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel'

type SynthStatus = 'idle' | 'running' | 'done' | 'error'
type PreviewMode = 'natural' | 'vivid' | 'original'
const LOADING_PHASE_2_MS = 3000
const LOADING_PHASE_3_MS = 6000
const LOADING_MIN_COMPLETE_MS = 8000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const LIST_ITEMS: { title: string; tags: string[]; badge?: string; count?: string }[] = [
  { title: '단미) 태슬컷', tags: ['애쉬브라운', '일반스타일', '여성 단발', '매직스트레이트펌', '태슬컷'], badge: '인기' },
  { title: '영현) 슬릭펌', tags: ['일반스타일', '여성 롱', '볼륨매직', '뿌리볼륨펌', '슬릭컷'] },
  { title: '영현) 보더펌', tags: ['레이어드컷', '일반스타일', '여성 미디움', 'C컬펌'], badge: '인기' },
  { title: '윤지) 태슬컷', tags: ['일반스타일', '여성 단발', '볼륨매직', '태슬컷'], count: '2' },
]

export default function ModelDetailPage() {
  const router = useRouter()
  const {
    originalPhoto,
    characterDataUrl,
    gptCharacterDataUrl,
    setCharacterDataUrl,
    setGptCharacterDataUrl,
    setResultImage,
    setIsSynthesizing,
    totalRegenCount,
    incrementRegenCount,
    resetRegenCount,
  } = useSelectionStore()

  // 마운트 시점에 스토어 값 캡처 — 이후 스토어는 비움
  const localCharUrlRef = useRef<string | null>(characterDataUrl)
  const localGptCharUrlRef = useRef<string | null>(gptCharacterDataUrl)

  const [naturalStatus, setNaturalStatus] = useState<SynthStatus>('idle')
  const [vividStatus, setVividStatus] = useState<SynthStatus>('idle')
  const [naturalResult, setNaturalResult] = useState<string | null>(null)
  const [vividResult, setVividResult] = useState<string | null>(null)
  const [naturalHistory, setNaturalHistory] = useState<string[]>([])
  const [vividHistory, setVividHistory] = useState<string[]>([])
  const [showPaywall, setShowPaywall] = useState(false)
  const [selectedNaturalUrl, setSelectedNaturalUrl] = useState<string | null>(null)
  const [selectedVividUrl, setSelectedVividUrl] = useState<string | null>(null)
  const [naturalError, setNaturalError] = useState<string | null>(null)
  const [vividError, setVividError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'natural' | 'vivid'>('vivid')
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('natural')
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const hasAutoStartedRef = useRef(false)

  const isRunning = naturalStatus === 'running' || vividStatus === 'running'
  const isDone = !isRunning && naturalStatus !== 'idle' && vividStatus !== 'idle'
  const isInitialLoading = (naturalHistory.length === 0 || vividHistory.length === 0) && isRunning
  const activeHistory = activeTab === 'natural' ? naturalHistory : vividHistory
  const activeIsRunning = activeTab === 'natural' ? naturalStatus === 'running' : vividStatus === 'running'
  const activeError = activeTab === 'natural' ? naturalError : vividError
  const activeSelectedUrl = activeTab === 'natural' ? selectedNaturalUrl : selectedVividUrl
  const regenCount = totalRegenCount ?? 0
  const regenRemaining = Math.max(0, 3 - regenCount)

  const loadingMessages = ['얼굴 위치 맞추는 중', '최종 합성 중', '결과 정리 중']

  const runNatural = useCallback(async () => {
    const charUrl = localCharUrlRef.current
    if (!charUrl) return
    setNaturalStatus('running')
    setNaturalResult(null)
    setNaturalError(null)
    setNaturalResult(charUrl)
    setNaturalHistory(prev => [...prev, charUrl])
    setSelectedNaturalUrl(charUrl)
    setNaturalStatus('done')
  }, [])

  const runVivid = useCallback(async () => {
    const gptCharUrl = localGptCharUrlRef.current
    if (!originalPhoto || !gptCharUrl) return
    setVividStatus('running')
    setVividResult(null)
    setVividError(null)
    const loadingStartedAt = Date.now()
    try {
      const characterFile = dataUrlToFile(gptCharUrl, 'character_image.png')
      const [squareCharacter, squareTarget] = await Promise.all([
        squareFile(characterFile, 'character_image.png', '#ffffff', 'pad'),
        squareFile(originalPhoto, 'target_image.png', '#ffffff', 'pad'),
      ])

      const fd = new FormData()
      fd.append('character_image', squareCharacter.file)
      fd.append('target_image', squareTarget.file)

      const response = await fetch('/api/face-swap', { method: 'POST', body: fd })
      const payload = await response.json() as Record<string, unknown>
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : '최종 합성 실패')
      const outputUrl = typeof payload.outputUrl === 'string' ? payload.outputUrl : null
      if (!outputUrl) throw new Error('최종 합성 결과가 비어 있습니다')

      const origDims = await new Promise<{ w: number; h: number }>((resolve) => {
        const url = URL.createObjectURL(originalPhoto)
        const img = new Image()
        img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url) }
        img.src = url
      })
      const cropped = await cropToOriginalAspect(outputUrl, origDims.w, origDims.h)
      await sleep(Math.max(0, LOADING_MIN_COMPLETE_MS - (Date.now() - loadingStartedAt)))
      setVividResult(cropped)
      setVividHistory(prev => [...prev, cropped])
      setSelectedVividUrl(cropped)
      setVividStatus('done')
    } catch (e) {
      await sleep(Math.max(0, LOADING_MIN_COMPLETE_MS - (Date.now() - loadingStartedAt)))
      setVividStatus('error')
      setVividError(e instanceof Error ? e.message : 'Vivid 합성 실패')
    }
  }, [originalPhoto])

  const runBothSyntheses = useCallback(async () => {
    if (!originalPhoto) return
    setResultImage(null)
    setIsSynthesizing(true)
    await Promise.all([runNatural(), runVivid()])
    setIsSynthesizing(false)
  }, [originalPhoto, runNatural, runVivid, setResultImage, setIsSynthesizing])

  useEffect(() => {
    // 가드: 필요한 값 없으면 메인으로
    if (!originalPhoto || !localCharUrlRef.current || !localGptCharUrlRef.current) {
      router.replace('/')
      return
    }
    // 스토어에서 날리기
    setCharacterDataUrl(null)
    setGptCharacterDataUrl(null)
    // 최초 합성 시작
    hasAutoStartedRef.current = true
    void runBothSyntheses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!originalPhoto) return
    const url = URL.createObjectURL(originalPhoto)
    setOriginalUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [originalPhoto])

  useEffect(() => {
    document.body.style.overflow = isInitialLoading ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isInitialLoading])

  useEffect(() => {
    if (!isInitialLoading) { setLoadingProgress(0); return }
    setLoadingProgress(0)
    const id = setInterval(() => {
      setLoadingProgress((p) => Math.min(90, p + Math.max(0.4, (90 - p) * 0.025)))
    }, 150)
    return () => clearInterval(id)
  }, [isInitialLoading])

  useEffect(() => {
    if (!isInitialLoading) { setLoadingMessageIndex(0); return }
    setLoadingMessageIndex(0)
    const t1 = window.setTimeout(() => setLoadingMessageIndex(1), LOADING_PHASE_2_MS)
    const t2 = window.setTimeout(() => setLoadingMessageIndex(2), LOADING_PHASE_3_MS)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [isInitialLoading])

  const activeResult = activeTab === 'natural' ? naturalResult : vividResult
  const activeStatus = activeTab === 'natural' ? naturalStatus : vividStatus

  const handleRegenNatural = useCallback(() => {
    if (totalRegenCount >= 3) { setShowPaywall(true); return }
    incrementRegenCount()
    void runNatural()
  }, [totalRegenCount, incrementRegenCount, runNatural])

  const handleRegenVivid = useCallback(() => {
    if (totalRegenCount >= 3) { setShowPaywall(true); return }
    incrementRegenCount()
    void runVivid()
  }, [totalRegenCount, incrementRegenCount, runVivid])

  const handleActiveRegen = activeTab === 'natural' ? handleRegenNatural : handleRegenVivid

  const previewSrc =
    previewMode === 'natural' ? (naturalResult ?? '') :
    previewMode === 'vivid' ? (vividResult ?? '') :
    (originalUrl ?? '')

  return (
    <PageShell>
      {/* 페이월 모달 */}
      {showPaywall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-8"
          onClick={() => setShowPaywall(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white px-6 pb-8 pt-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900">무료 재설정 횟수 소진</h2>
              <button onClick={() => setShowPaywall(false)}>
                <span className="material-symbols-outlined text-stone-400" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-stone-500">
              최종 시안 재설정을 3회 모두 사용했어요.<br />
              추가 재설정은 결제 후 이용할 수 있습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPaywall(false)}
                className="flex-1 rounded-2xl border border-stone-200 py-4 text-sm font-semibold text-stone-500"
              >
                다음에 하기
              </button>
              <button
                onClick={() => { resetRegenCount(); setShowPaywall(false) }}
                className="flex-1 rounded-2xl bg-primary py-4 text-sm font-bold text-white"
              >
                결제하고 계속하기
              </button>
            </div>
          </div>
        </div>
      )}

      {isInitialLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-8 backdrop-blur-sm">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-center text-sm font-bold text-stone-900">최종 시안 생성 중</p>
            <p className="text-center text-xs text-stone-400">{loadingMessages[loadingMessageIndex]}</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${loadingProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      <main className="flex flex-1 flex-col gap-6 px-6 pb-32 pt-10">
        <StepHeader step={4} total={4} label="STEP 04" />

        <div className="flex items-end justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-stone-950">
            최종 이미지를
            <br />
            확인합니다
          </h1>
        </div>

        {naturalStatus !== 'idle' && (
          <>
            {/* 탭 바 */}
            <div className="flex gap-2">
              {(['natural', 'vivid'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors ${
                    activeTab === tab ? 'bg-stone-900 text-white' : 'border border-stone-200 text-stone-500'
                  }`}
                >
                  {tab === 'natural' ? 'Natural' : 'Vivid'}
                </button>
              ))}
            </div>

            {/* 섹션 헤더 */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-stone-900">최종 시안</span>
              <span className="text-xs font-medium text-stone-400">재설정 {regenCount}/3</span>
            </div>

            {/* 메인 이미지 */}
            {activeSelectedUrl ? (
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[8px] bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="최종 시안" className="h-full w-full object-cover" src={activeSelectedUrl} />
                <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold text-stone-700 backdrop-blur-sm">
                  {activeTab === 'natural' ? 'Natural' : 'Vivid'}
                </div>
              </div>
            ) : activeStatus === 'error' ? (
              <div className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-3 rounded-[8px] bg-red-50">
                <span className="material-symbols-outlined text-red-400" style={{ fontSize: 32 }}>error</span>
                <p className="text-xs text-red-400">{activeError ?? '생성 실패'}</p>
              </div>
            ) : (
              <div className="relative aspect-[2/3] w-full animate-pulse overflow-hidden rounded-[8px] bg-stone-300" />
            )}

            {/* 썸네일 캐러셀 */}
            {activeHistory.length > 0 && (
              <Carousel opts={{ align: 'start', dragFree: true }}>
                <CarouselContent className="-ml-2">
                  {activeHistory.map((url, i) => (
                    <CarouselItem key={i} className="basis-[calc(100%/3.5)] pl-2">
                      <button
                        onClick={() => activeTab === 'natural' ? setSelectedNaturalUrl(url) : setSelectedVividUrl(url)}
                        className={`relative block w-full overflow-hidden rounded-[8px] transition-all ${
                          url === activeSelectedUrl ? 'opacity-100' : 'opacity-40'
                        }`}
                        style={{ aspectRatio: '2/3' }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={`최종 시안 ${i + 1}`} className="h-full w-full object-cover" src={url} />
                        {i === activeHistory.length - 1 && !activeIsRunning && (
                          <div className="absolute left-1 top-1 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-bold leading-none text-white">
                            최신
                          </div>
                        )}
                      </button>
                    </CarouselItem>
                  ))}
                  {activeIsRunning && (
                    <CarouselItem className="basis-[calc(100%/3.5)] pl-2">
                      <div className="w-full animate-pulse rounded-[8px] bg-stone-300" style={{ aspectRatio: '2/3' }} />
                    </CarouselItem>
                  )}
                  {!activeIsRunning && regenCount < 3 && (
                    <CarouselItem className="basis-[calc(100%/3.5)] pl-2">
                      <div className="flex w-full items-center justify-center rounded-[8px] border-2 border-dashed border-stone-200 bg-stone-50" style={{ aspectRatio: '2/3' }}>
                        <span className="material-symbols-outlined text-stone-300" style={{ fontSize: 18 }}>add</span>
                      </div>
                    </CarouselItem>
                  )}
                </CarouselContent>
              </Carousel>
            )}

            {/* 재설정 버튼 */}
            <button
              onClick={handleActiveRegen}
              disabled={activeIsRunning}
              className="flex w-full items-center justify-center gap-1.5 rounded-[8px] border border-stone-200 py-3 text-sm font-semibold text-stone-700 transition-opacity disabled:opacity-40"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {regenCount >= 3 ? 'lock' : 'refresh'}
              </span>
              {regenCount >= 3
                ? '재설정 (유료)'
                : `재설정 · 무료 ${regenRemaining}회 남음`}
            </button>

            <section className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-stone-900">네이버 노출 미리보기</h2>
                <div className="flex overflow-hidden rounded-full border border-stone-200 text-[11px] font-bold">
                  {(['natural', 'vivid', 'original'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setPreviewMode(mode)}
                      className={`px-3 py-1.5 transition-colors ${previewMode === mode ? 'bg-stone-900 text-white' : 'text-stone-500'}`}
                    >
                      {mode === 'natural' ? 'Natural' : mode === 'vivid' ? 'Vivid' : 'Original'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-stone-900">리스트 노출</p>
                  <span className="text-[11px] text-stone-400">스타일 탭 카드</span>
                </div>
                <div className="overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-[0_10px_30px_rgba(24,24,27,0.05)]">
                  <div className="border-b border-stone-100 bg-stone-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-stone-300" />
                      <span className="h-2 w-2 rounded-full bg-stone-300" />
                      <span className="h-2 w-2 rounded-full bg-stone-300" />
                      <span className="ml-2 text-[11px] font-medium text-stone-500">m.place.naver.com hairshop styleTab</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-3">
                      {LIST_ITEMS.map((item) => (
                        <div key={item.title} className="overflow-hidden rounded-[1.1rem]">
                          <div className="relative aspect-[2/3] overflow-hidden rounded-[1rem] bg-stone-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img alt={`${item.title} 리스트 미리보기`} className="h-full w-full object-cover" src={previewSrc} />
                            {item.badge && (
                              <div className="absolute left-2 top-2 rounded-full bg-[#da5cc7] px-2.5 py-1 text-[10px] font-semibold text-white">{item.badge}</div>
                            )}
                            {item.count && (
                              <div className="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white">{item.count}</div>
                            )}
                          </div>
                          <div className="px-1 pb-1 pt-3">
                            <p className="text-[13px] font-semibold leading-5 tracking-tight text-stone-900">{item.title}</p>
                            <p className="mt-1 text-[11px] leading-5 text-stone-500">{item.tags.join(', ')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-stone-900">상세 노출</p>
                  <span className="text-[11px] text-stone-400">스타일 상세 화면</span>
                </div>
                <div className="overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-[0_10px_30px_rgba(24,24,27,0.05)]">
                  <div className="border-b border-stone-100 bg-stone-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-stone-300" />
                      <span className="h-2 w-2 rounded-full bg-stone-300" />
                      <span className="h-2 w-2 rounded-full bg-stone-300" />
                      <span className="ml-2 text-[11px] font-medium text-stone-500">m.place.naver.com hairshop styleInfo</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="overflow-hidden rounded-[1.25rem] border border-stone-200 bg-white">
                      <div className="relative aspect-square w-full overflow-hidden bg-stone-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt="네이버 스타일 상세 미리보기" className="h-full w-full bg-stone-100 object-cover" src={previewSrc} />
                        <div className="absolute left-3 top-3 inline-flex items-center rounded-full bg-[#da5cc7] px-3 py-1 text-[11px] font-semibold text-white">인기스타일</div>
                      </div>
                      <div className="px-4 py-4">
                        <p className="text-[1.05rem] font-bold tracking-tight text-stone-900">
                          영현) 보더펌
                          <span className="ml-1 text-[12px] font-medium text-stone-400">레이어드컷 30건</span>
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-1 gap-y-1 text-[12px] text-stone-500">
                          <span>레이어드컷,</span><span>일반스타일,</span><span>여성 미디움,</span><span>C컬펌</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {!showPaywall && (
        <BottomCta
          label="완료"
          onClick={() => window.history.back()}
          variant="primary"
          disabled={!isDone}
        />
      )}
    </PageShell>
  )
}
