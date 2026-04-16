'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import StepHeader from '@/components/StepHeader'
import BottomCta from '@/components/BottomCta'
import PageShell from '@/components/PageShell'
import { useSelectionStore } from '@/store/useSelectionStore'
import { removeBackground, getFaceLandmarkPoints, getFaceLandmarks3D, extractHairLayer } from '@/lib/faceBlur'
import { loadBinaryMask, createFluxFillMaskDataUrl, extractClassBoundaryPolygon, loadImageEl } from '@/lib/segmentation'

type AnalysisStep = 'idle' | 'landmarks' | 'sam3' | 'done' | 'error'
const MIN_FACE_OVAL_POINTS = 10
const LOADING_PHASE_2_MS = 3000
const LOADING_PHASE_3_MS = 6000
const LOADING_MIN_COMPLETE_MS = 8000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const {
    photo, setPhoto, setOriginalPhoto, setFaceOvalPoints,
    setGeneratedImages, setIsGenerating,
    setFaceMaskDataUrl, setHairMaskDataUrl, setFluxMaskDataUrl, setSegW, setSegH,
    setLandmarks, setSegPolygon, setHairPolygon,
  } = useSelectionStore()
  const originalUrlRef = useRef<string | null>(null)
  const analysisIdRef = useRef(0)
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle')
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const analysisMessages = ['얼굴 특징 분석 중', '영역 구조 분석 중', '생성 기준 정리 중']

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const myId = ++analysisIdRef.current
    const loadingStartedAt = Date.now()

    setPhoto(file)
    setOriginalPhoto(file)
    setGeneratedImages([])
    setIsGenerating(false)
    setAnalysisError(null)
    setFaceMaskDataUrl(null)
    setHairMaskDataUrl(null)
    setFluxMaskDataUrl(null)

    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current)
    const originalUrl = URL.createObjectURL(file)
    originalUrlRef.current = originalUrl

    // ── Step 1: FaceLandmarker + 배경제거 + 헤어 (클라이언트) ──────
    setAnalysisStep('landmarks')
    try {
      const [, , points, landmarks3D] = await Promise.all([
        removeBackground(originalUrl),
        extractHairLayer(originalUrl).catch(() => null),
        getFaceLandmarkPoints(originalUrl),
        getFaceLandmarks3D(originalUrl).catch(() => [] as { x: number; y: number; z: number }[]),
      ])
      if (myId !== analysisIdRef.current) return
      if (points.length < MIN_FACE_OVAL_POINTS) {
        setFaceOvalPoints([])
        await sleep(Math.max(0, LOADING_MIN_COMPLETE_MS - (Date.now() - loadingStartedAt)))
        if (myId !== analysisIdRef.current) return
        setAnalysisError('눈, 코, 입이 명확하게 보이는 사진으로 다시 업로드해 주세요')
        setAnalysisStep('error')
        return
      }
      setFaceOvalPoints(points)
      setLandmarks(landmarks3D)
    } catch {
      if (myId !== analysisIdRef.current) return
      setFaceOvalPoints([])
      await sleep(Math.max(0, LOADING_MIN_COMPLETE_MS - (Date.now() - loadingStartedAt)))
      if (myId !== analysisIdRef.current) return
      setAnalysisError('얼굴을 인식할 수 없습니다. 눈, 코, 입이 잘 보이는 사진을 사용해 주세요')
      setAnalysisStep('error')
      return
    }

    // ── Step 2: SAM3 세그멘테이션 (서버) ──────────────────────────
    setAnalysisStep('sam3')
    try {
      const img = await loadImageEl(originalUrl)
      if (myId !== analysisIdRef.current) return
      const W = img.naturalWidth
      const H = img.naturalHeight
      setSegW(W)
      setSegH(H)

      const formData = new FormData()
      formData.append('image', file)
      const response = await fetch('/api/sam3', { method: 'POST', body: formData })
      if (myId !== analysisIdRef.current) return
      const payload = await response.json() as Record<string, unknown>
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'SAM3 실패')

      const faceMaskUrl = typeof payload.faceMaskUrl === 'string' ? payload.faceMaskUrl : null
      const hairMaskUrl = typeof payload.hairMaskUrl === 'string' ? payload.hairMaskUrl : null
      setFaceMaskDataUrl(faceMaskUrl)
      setHairMaskDataUrl(hairMaskUrl)

      if (faceMaskUrl) {
        const [faceMaskData, hairMaskData] = await Promise.all([
          loadBinaryMask(faceMaskUrl, W, H),
          hairMaskUrl ? loadBinaryMask(hairMaskUrl, W, H) : Promise.resolve(null),
        ])
        if (myId !== analysisIdRef.current) return
        const fluxMask = await createFluxFillMaskDataUrl(faceMaskData, hairMaskData, W, H)
        if (myId !== analysisIdRef.current) return
        setFluxMaskDataUrl(fluxMask)
        setSegPolygon(extractClassBoundaryPolygon(faceMaskData, W, H))
        setHairPolygon(hairMaskData ? extractClassBoundaryPolygon(hairMaskData, W, H) : null)
      }
    } catch (err) {
      if (myId !== analysisIdRef.current) return
      await sleep(Math.max(0, LOADING_MIN_COMPLETE_MS - (Date.now() - loadingStartedAt)))
      if (myId !== analysisIdRef.current) return
      setAnalysisError(err instanceof Error ? err.message : 'SAM3 분석에 실패했습니다')
      setAnalysisStep('error')
      return
    }

    if (myId !== analysisIdRef.current) return
    await sleep(Math.max(0, LOADING_MIN_COMPLETE_MS - (Date.now() - loadingStartedAt)))
    if (myId !== analysisIdRef.current) return
    setAnalysisStep('done')
  }

  const isAnalyzing = analysisStep === 'landmarks' || analysisStep === 'sam3'

  useEffect(() => {
    document.body.style.overflow = isAnalyzing ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isAnalyzing])

  useEffect(() => {
    if (!isAnalyzing) { setLoadingProgress(0); return }
    setLoadingProgress(0)
    const id = setInterval(() => {
      setLoadingProgress(p => Math.min(90, p + Math.max(0.4, (90 - p) * 0.025)))
    }, 150)
    return () => clearInterval(id)
  }, [isAnalyzing])

  useEffect(() => {
    if (!isAnalyzing) { setLoadingMessageIndex(0); return }
    setLoadingMessageIndex(0)
    const t1 = window.setTimeout(() => setLoadingMessageIndex(1), LOADING_PHASE_2_MS)
    const t2 = window.setTimeout(() => setLoadingMessageIndex(2), LOADING_PHASE_3_MS)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [isAnalyzing, analysisMessages.length])

  return (
    <PageShell>
      {/* 분석 로딩 오버레이 */}
      {isAnalyzing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-8">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl flex flex-col gap-4">
            <p className="text-sm font-bold text-stone-900 text-center">AI 초안 생성 중</p>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary animate-spin" style={{ fontSize: 20 }}>progress_activity</span>
              <span className="text-sm text-stone-600">{analysisMessages[loadingMessageIndex]}</span>
            </div>
            <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 pt-10 pb-32 px-6 flex flex-col gap-4">
        <StepHeader step={1} total={4} label="STEP 01" />

        <section className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-stone-950">
            원본 사진을
            <br />
            업로드합니다
          </h1>
        </section>

        {/* 분석 오류 배너 */}
        {analysisStep === 'error' && analysisError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs font-bold text-red-600">사진 분석 실패: {analysisError}</p>
            <p className="text-xs text-red-500 mt-1">얼굴이 정면에 가깝고 이목구비가 잘 보이는 사진으로 다시 시도해 주세요.</p>
          </div>
        )}

        <section className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className={`w-full aspect-[2/3] rounded-[2rem] border transition-all flex flex-col items-center justify-center gap-4 relative overflow-hidden ${
            photo
              ? 'border-primary/30 bg-primary/[0.04] shadow-[0_18px_40px_rgba(3,199,90,0.08)]'
              : 'border-stone-200 bg-white hover:border-primary/30 hover:shadow-[0_18px_40px_rgba(24,24,27,0.06)]'
          }`}>
            {!photo && (
              <div className="absolute inset-x-6 top-6 flex items-center justify-between">
                <span className="rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary">
                  원본 업로드
                </span>
                <span className="text-[11px] font-medium text-stone-400">
                  탭해서 선택
                </span>
              </div>
            )}
            {photo ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="uploaded preview"
                  className="w-full h-full object-cover absolute inset-0 bg-stone-100"
                  src={originalUrlRef.current ?? ''}
                />
                <div className="absolute inset-0 bg-black/24 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check_circle
                  </span>
                </div>
                <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-stone-700">
                  업로드 완료
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent px-5 pb-5 pt-16 text-white">
                  <p className="text-xs font-semibold text-white/80">선택된 원본 사진</p>
                  <p className="mt-1 text-sm font-bold">
                    이 사진을 기준으로 다음 단계 이미지가 생성됩니다.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                </div>
                <div className="absolute inset-x-6 bottom-6 rounded-[1.25rem] bg-stone-50 px-4 py-3">
                  <p className="text-[11px] font-semibold text-stone-700">권장 사진</p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    얼굴이 중앙에 있고, 배경과 구분되며, 이목구비가 선명한 사진
                  </p>
                </div>
              </>
            )}
          </div>
        </section>


        {photo && originalUrlRef.current && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-stone-900">네이버 노출 미리보기</h2>
              <span className="text-[11px] font-medium text-stone-400">업로드 사진 기준</span>
            </div>

            <div className="space-y-5">
              <div>
                <div className="mb-3 flex items-center justify-between">
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
                      {[
                        {
                          title: '단미) 태슬컷',
                          tags: ['애쉬브라운', '일반스타일', '여성 단발', '매직스트레이트펌', '태슬컷'],
                          badge: '인기',
                        },
                        {
                          title: '영현) 슬릭펌',
                          tags: ['일반스타일', '여성 롱', '볼륨매직', '뿌리볼륨펌', '슬릭컷'],
                        },
                        {
                          title: '영현) 보더펌',
                          tags: ['레이어드컷', '일반스타일', '여성 미디움', 'C컬펌'],
                          badge: '인기',
                        },
                        {
                          title: '윤지) 태슬컷',
                          tags: ['일반스타일', '여성 단발', '볼륨매직', '태슬컷'],
                          count: '2',
                        },
                      ].map((item) => (
                        <div key={item.title} className="overflow-hidden rounded-[1.1rem]">
                          <div className="relative aspect-[2/3] overflow-hidden rounded-[1rem] bg-stone-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              alt={`${item.title} 리스트 미리보기`}
                              className="h-full w-full object-cover"
                              src={originalUrlRef.current ?? ''}
                            />
                            {item.badge && (
                              <div className="absolute left-2 top-2 rounded-full bg-[#da5cc7] px-2.5 py-1 text-[10px] font-semibold text-white">
                                {item.badge}
                              </div>
                            )}
                            {item.count && (
                              <div className="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white">
                                {item.count}
                              </div>
                            )}
                          </div>

                          <div className="px-1 pb-1 pt-3">
                            <p className="text-[13px] font-semibold leading-5 tracking-tight text-stone-900">
                              {item.title}
                            </p>
                            <p className="mt-1 text-[11px] leading-5 text-stone-500">
                              {item.tags.join(', ')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
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
                        <img
                          alt="네이버 스타일 상세 미리보기"
                          className="h-full w-full object-cover bg-stone-100"
                          src={originalUrlRef.current ?? ''}
                        />
                        <div className="absolute left-3 top-3 inline-flex items-center rounded-full bg-[#da5cc7] px-3 py-1 text-[11px] font-semibold text-white">
                          인기스타일
                        </div>
                      </div>

                      <div className="px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[1.05rem] font-bold tracking-tight text-stone-900">
                            영현) 보더펌
                            <span className="ml-1 text-[12px] font-medium text-stone-400">레이어드컷 30건</span>
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-1 gap-y-1 text-[12px] text-stone-500">
                          <span>레이어드컷,</span>
                          <span>일반스타일,</span>
                          <span>여성 미디움,</span>
                          <span>C컬펌</span>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {!photo && (
          <div className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5">
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-stone-500">lightbulb</span>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-stone-900">촬영 안내</p>
                <p className="text-xs leading-6 text-stone-500">
                  밝은 환경에서 얼굴이 정면에 가깝게 보이도록 촬영한 사진이 적합합니다.
                  눈, 코, 입이 가려지거나 프레임 밖에 있으면 분석이 중단될 수 있습니다.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="rounded-full border border-stone-200 px-3 py-1 text-[11px] text-stone-500">
                    안경, 마스크, 손 가림 피하기
                  </span>
                  <span className="rounded-full border border-stone-200 px-3 py-1 text-[11px] text-stone-500">
                    과한 필터 사용 피하기
                  </span>
                  <span className="rounded-full border border-stone-200 px-3 py-1 text-[11px] text-stone-500">
                    얼굴 일부 잘림 피하기
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {!isAnalyzing && (
        <BottomCta
          label="세부사항 조정하기"
          onClick={() => router.push('/category-selection')}
          secondary={{ label: '이전', onClick: () => router.back() }}
          disabled={!photo || analysisStep !== 'done'}
        />
      )}
    </PageShell>
  )
}
