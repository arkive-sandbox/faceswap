'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomCta from '@/components/BottomCta'

const BEFORE_IMG = '/before_demo.png'
const AFTER_IMG = '/after_demo.png'
const INTRO_DURATION_MS = 1600
const LABEL_SWITCH_OFFSET_MS = 100
const INTRO_SCROLL_TRIGGER_PX = 250

export default function AngleSelectionPage() {
  const router = useRouter()
  const [showBefore, setShowBefore] = useState(true)
  const [introComplete, setIntroComplete] = useState(false)
  const [introStarted, setIntroStarted] = useState(false)
  const previewRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (introStarted) return

    const handleScroll = () => {
      if (window.scrollY < INTRO_SCROLL_TRIGGER_PX) return
      setIntroStarted(true)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [introStarted])

  useEffect(() => {
    if (!introStarted || introComplete) return

    const switchTimer = setTimeout(
      () => setShowBefore(false),
      Math.max(0, INTRO_DURATION_MS - LABEL_SWITCH_OFFSET_MS)
    )
    const completeTimer = setTimeout(() => setIntroComplete(true), INTRO_DURATION_MS)

    return () => {
      clearTimeout(switchTimer)
      clearTimeout(completeTimer)
    }
  }, [introStarted, introComplete])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 px-6 pt-10 pb-32 max-w-lg mx-auto w-full">

        {/* 헤더 */}
        <section className="mb-8">
          <h2 className="text-[2.05rem] leading-[1.12] font-extrabold tracking-tight text-stone-950">
            스타일 사진을
            <br />
            더 쉽게 올릴 수 있게
            <br />
            준비해드려요
          </h2>
        </section>

        {/* Before / After 이미지 */}
        <section ref={previewRef} className="mb-5">
          <button
            type="button"
            onClick={() => { if (introComplete) setShowBefore(prev => !prev) }}
            className="relative block w-full overflow-hidden rounded-[2rem] aspect-square border border-stone-200 bg-stone-100 text-left shadow-[0_14px_30px_rgba(24,24,27,0.08)]"
            aria-label="원본과 결과 이미지 전환"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="후기 이미지 결과 예시"
              src={AFTER_IMG}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity ${introComplete ? 'duration-200' : 'duration-[1600ms]'} ${showBefore ? 'opacity-0' : 'opacity-100'}`}
              draggable={false}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="리뷰 원본 예시"
              src={BEFORE_IMG}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity ${introComplete ? 'duration-200' : 'duration-[1600ms]'} ${showBefore ? 'opacity-100' : 'opacity-0'}`}
              draggable={false}
            />

            {/* 상태 라벨 */}
            {introComplete && (
              <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-stone-700 backdrop-blur-sm">
                {showBefore ? '원본 사진' : '변경 사진'}
              </div>
            )}

            {/* 하단 오버레이 */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent px-5 pb-5 pt-16 text-white">
              <p className="text-xs font-semibold text-white/70">
                {showBefore ? '원본 사진' : '생성 결과'}
              </p>
              <p className="mt-0.5 text-sm font-bold">
                {showBefore ? '업로드한 기준 사진입니다' : '네이버 메뉴 등록용 이미지입니다'}
              </p>
            </div>

          </button>
        </section>

        {/* 사용 흐름 */}
        <section className="grid gap-4">
          {[
            {
              step: '01',
              title: '원본 사진 업로드',
              desc: '메뉴에 올릴 기준 사진을 먼저 선택합니다.',
              caution: '눈, 코, 입이 가려지거나 프레임 밖에 있으면 분석이 중단될 수 있습니다.',
            },
            {
              step: '02',
              title: '얼굴 표현 옵션 선택',
              desc: '피부 표현, 메이크업 강도, 표정을 정합니다.',
              caution: '머리 스타일은 유지되고 얼굴 표현 옵션만 조정됩니다.',
            },
            {
              step: '03',
              title: '얼굴 이미지 생성',
              desc: '업로드한 사진과 선택한 옵션을 기준으로 얼굴 이미지를 생성합니다.',
              caution: '결과가 맞지 않으면 옵션을 조정해 다시 생성할 수 있습니다.',
            },
            {
              step: '04',
              title: '최종 합성 후 등록',
              desc: '생성 결과를 확인한 뒤 최종 이미지를 정리합니다.',
              caution: '모자이크, 합성 이미지, 얼굴을 사물이나 스티커로 가린 사진, 뒷머리만 있는 사진은 등록 불가 대상이 될 수 있습니다.',
            },
          ].map(({ step, title, desc, caution }) => (
            <div
              key={step}
              className="relative overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5 shadow-[0_12px_28px_rgba(24,24,27,0.05)]"
            >
              <div className="absolute right-4 top-4 text-[42px] font-black leading-none tracking-[-0.08em] text-[#03c75a]/10">
                {step}
              </div>
              <div className="relative">
                <span className="inline-flex rounded-full bg-[#03c75a]/10 px-3 py-1 text-[11px] font-black tracking-[0.18em] text-[#03c75a]">
                  STEP {step}
                </span>
                <p className="mt-4 text-lg font-bold tracking-tight text-stone-900">{title}</p>
                <p className="mt-2 text-sm leading-6 text-stone-600">{desc}</p>
                {caution && (
                  <div className="mt-4 rounded-[1rem] bg-stone-50 px-3 py-3">
                    <p className="flex items-start gap-2 text-xs leading-5 text-stone-600">
                      <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-stone-200 text-[10px] font-bold text-stone-600">
                        !
                      </span>
                      <span>{caution}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>

      </main>

      <BottomCta label="생성하기" onClick={() => router.push('/upload')} variant="glow" />
    </div>
  )
}
