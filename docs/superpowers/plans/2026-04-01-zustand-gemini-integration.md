# Zustand + Gemini AI Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Zustand global state, integrate Gemini image generation API, reorder pages (category-selection before upload), and implement face-swap on the final step.

**Architecture:** Zustand store holds all selections + generated images. Category-selection page triggers Gemini image generation (4 images) and navigates to upload while generation runs in background. Model-detail page reads generated images from store and triggers face-swap on CTA click. New page order: / → /category-selection → /upload → /model-detail.

**Tech Stack:** Zustand 5, `@google/generative-ai` SDK, Next.js 16 App Router, TypeScript

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `store/useSelectionStore.ts` | Create | Zustand store: angle, category, modelId, photo, generatedImages, resultImage, isGenerating, isSynthesizing |
| `lib/gemini.ts` | Create | Gemini API client: generateImages(), synthesizeFace() |
| `app/page.tsx` | Modify | Navigate to `/category-selection` (not `/upload`) |
| `app/category-selection/page.tsx` | Modify | Remove searchParams, use store; trigger generation on confirm; navigate to `/upload` |
| `app/upload/page.tsx` | Modify | Remove searchParams, use store; save File to store; navigate to `/model-detail` |
| `app/model-detail/page.tsx` | Modify | Read generatedImages from store; show loading; face-swap on CTA |
| `__tests__/store/useSelectionStore.test.ts` | Create | Store unit tests |
| `__tests__/lib/gemini.test.ts` | Create | Gemini client unit tests (mocked) |

---

## Task 1: Install Zustand

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Zustand and Gemini SDK**

```bash
npm install zustand @google/generative-ai
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('zustand'); require('@google/generative-ai'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install zustand and @google/generative-ai"
```

---

## Task 2: Zustand Selection Store

**Files:**
- Create: `store/useSelectionStore.ts`
- Create: `__tests__/store/useSelectionStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/store/useSelectionStore.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { useSelectionStore } from '@/store/useSelectionStore'

describe('useSelectionStore', () => {
  beforeEach(() => {
    useSelectionStore.setState({
      angle: 'center',
      category: '30sF',
      modelId: 0,
      photo: null,
      generatedImages: [],
      resultImage: null,
      isGenerating: false,
      isSynthesizing: false,
    })
  })

  it('has correct initial state', () => {
    const { result } = renderHook(() => useSelectionStore())
    expect(result.current.angle).toBe('center')
    expect(result.current.category).toBe('30sF')
    expect(result.current.modelId).toBe(0)
    expect(result.current.photo).toBeNull()
    expect(result.current.generatedImages).toEqual([])
    expect(result.current.resultImage).toBeNull()
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.isSynthesizing).toBe(false)
  })

  it('setAngle updates angle', () => {
    const { result } = renderHook(() => useSelectionStore())
    act(() => result.current.setAngle('nw'))
    expect(result.current.angle).toBe('nw')
  })

  it('setCategory updates category', () => {
    const { result } = renderHook(() => useSelectionStore())
    act(() => result.current.setCategory('20sF'))
    expect(result.current.category).toBe('20sF')
  })

  it('setModelId updates modelId', () => {
    const { result } = renderHook(() => useSelectionStore())
    act(() => result.current.setModelId(2))
    expect(result.current.modelId).toBe(2)
  })

  it('setPhoto updates photo', () => {
    const { result } = renderHook(() => useSelectionStore())
    const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
    act(() => result.current.setPhoto(file))
    expect(result.current.photo).toBe(file)
  })

  it('setGeneratedImages updates generatedImages', () => {
    const { result } = renderHook(() => useSelectionStore())
    act(() => result.current.setGeneratedImages(['url1', 'url2', 'url3', 'url4']))
    expect(result.current.generatedImages).toEqual(['url1', 'url2', 'url3', 'url4'])
  })

  it('setResultImage updates resultImage', () => {
    const { result } = renderHook(() => useSelectionStore())
    act(() => result.current.setResultImage('result-url'))
    expect(result.current.resultImage).toBe('result-url')
  })

  it('setIsGenerating updates isGenerating', () => {
    const { result } = renderHook(() => useSelectionStore())
    act(() => result.current.setIsGenerating(true))
    expect(result.current.isGenerating).toBe(true)
  })

  it('setIsSynthesizing updates isSynthesizing', () => {
    const { result } = renderHook(() => useSelectionStore())
    act(() => result.current.setIsSynthesizing(true))
    expect(result.current.isSynthesizing).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/store/useSelectionStore.test.ts
```
Expected: FAIL — `Cannot find module '@/store/useSelectionStore'`

- [ ] **Step 3: Create `store/useSelectionStore.ts`**

```ts
import { create } from 'zustand'

interface SelectionState {
  angle: string
  category: string
  modelId: number
  photo: File | null
  generatedImages: string[]
  resultImage: string | null
  isGenerating: boolean
  isSynthesizing: boolean
  setAngle: (v: string) => void
  setCategory: (v: string) => void
  setModelId: (v: number) => void
  setPhoto: (v: File) => void
  setGeneratedImages: (v: string[]) => void
  setResultImage: (v: string) => void
  setIsGenerating: (v: boolean) => void
  setIsSynthesizing: (v: boolean) => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  angle: 'center',
  category: '30sF',
  modelId: 0,
  photo: null,
  generatedImages: [],
  resultImage: null,
  isGenerating: false,
  isSynthesizing: false,
  setAngle: (v) => set({ angle: v }),
  setCategory: (v) => set({ category: v }),
  setModelId: (v) => set({ modelId: v }),
  setPhoto: (v) => set({ photo: v }),
  setGeneratedImages: (v) => set({ generatedImages: v }),
  setResultImage: (v) => set({ resultImage: v }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  setIsSynthesizing: (v) => set({ isSynthesizing: v }),
}))
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/store/useSelectionStore.test.ts
```
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add store/useSelectionStore.ts __tests__/store/useSelectionStore.test.ts
git commit -m "feat: add Zustand selection store"
```

---

## Task 3: Gemini API Client

**Files:**
- Create: `lib/gemini.ts`
- Create: `__tests__/lib/gemini.test.ts`

The Gemini client exposes two functions:
- `generateImages(category: string, count: number): Promise<string[]>` — generates `count` base64 image data URLs using the `gemini-2.0-flash-preview-image-generation` model
- `synthesizeFace(targetPhoto: File, sourceImageDataUrl: string): Promise<string>` — face-swaps target photo onto source image, returns base64 data URL

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/gemini.test.ts`:

```ts
import { generateImages, synthesizeFace } from '@/lib/gemini'

// Mock the Google Generative AI SDK
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [
                  { inlineData: { data: 'base64imagedata1', mimeType: 'image/png' } },
                ],
              },
            },
          ],
        },
      }),
    }),
  })),
}))

describe('generateImages', () => {
  it('returns array of data URLs', async () => {
    const results = await generateImages('20sF', 1)
    expect(results).toHaveLength(1)
    expect(results[0]).toMatch(/^data:image\/png;base64,/)
  })

  it('calls generateContent with category in prompt', async () => {
    const { GoogleGenerativeAI } = require('@google/generative-ai')
    const mockGenerateContent = GoogleGenerativeAI.mock.results[0].value.getGenerativeModel().generateContent
    await generateImages('30sF', 1)
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.stringContaining('30sF')
    )
  })
})

describe('synthesizeFace', () => {
  it('returns a data URL string', async () => {
    const file = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' })
    const result = await synthesizeFace(file, 'data:image/png;base64,abc')
    expect(typeof result).toBe('string')
    expect(result).toMatch(/^data:image\/png;base64,/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/gemini.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/gemini'`

- [ ] **Step 3: Create `lib/gemini.ts`**

```ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL_ID = 'gemini-2.0-flash-preview-image-generation'

function getClient() {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? ''
  return new GoogleGenerativeAI(apiKey)
}

const CATEGORY_PROMPTS: Record<string, string> = {
  '20sF': '20대 한국 여성, 자연스러운 메이크업, 밝은 피부톤',
  '20sM': '20대 한국 남성, 깔끔한 스타일',
  '30sF': '30대 한국 여성, 세련된 분위기, 자연스러운 미소',
  '30sM': '30대 한국 남성, 지적인 분위기',
  '40sF': '40대 한국 여성, 우아하고 성숙한 분위기',
  '40sM': '40대 한국 남성, 중후한 매력',
  '50sF': '50대 한국 여성, 품위있는 아름다움',
  '50sM': '50대 한국 남성, 신뢰감 있는 분위기',
}

export async function generateImages(category: string, count: number): Promise<string[]> {
  const client = getClient()
  const model = client.getGenerativeModel({ model: MODEL_ID })
  const categoryDesc = CATEGORY_PROMPTS[category] ?? '한국인, 자연스러운 표정'
  const prompt = `정면 얼굴 사진, ${categoryDesc}, 흰 배경, 고화질 인물 사진, 클로즈업, ${category}`

  const results: string[] = []
  for (let i = 0; i < count; i++) {
    const response = await model.generateContent(prompt)
    const part = response.response.candidates?.[0]?.content?.parts?.[0]
    if (part && 'inlineData' in part && part.inlineData) {
      results.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`)
    }
  }
  return results
}

export async function synthesizeFace(targetPhoto: File, sourceImageDataUrl: string): Promise<string> {
  const client = getClient()
  const model = client.getGenerativeModel({ model: MODEL_ID })

  // Convert File to base64
  const targetBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(targetPhoto)
  })

  // Extract base64 from source data URL
  const sourceBase64 = sourceImageDataUrl.split(',')[1]
  const sourceMime = sourceImageDataUrl.split(';')[0].replace('data:', '')

  const prompt = '두 사진에서 왼쪽 인물의 얼굴을 오른쪽 인물의 얼굴에 자연스럽게 합성해주세요. 피부톤, 조명, 각도를 맞춰 자연스럽게 합성하세요.'

  const response = await model.generateContent([
    prompt,
    { inlineData: { data: targetBase64, mimeType: targetPhoto.type } },
    { inlineData: { data: sourceBase64, mimeType: sourceMime } },
  ])

  const part = response.response.candidates?.[0]?.content?.parts?.[0]
  if (part && 'inlineData' in part && part.inlineData) {
    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
  }
  throw new Error('Gemini returned no image')
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/gemini.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/gemini.ts __tests__/lib/gemini.test.ts
git commit -m "feat: add Gemini API client for image generation and face synthesis"
```

---

## Task 4: Update Angle Selection Page (new route: → /category-selection)

**Files:**
- Modify: `app/page.tsx`

The only change: BottomCta now navigates to `/category-selection` instead of `/upload`, and uses the store's `setAngle` instead of local state for the BottomCta onClick. The angle grid UI stays identical.

- [ ] **Step 1: Update `app/page.tsx`**

Replace the import block and BottomCta onClick. Full updated file:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NavHeader from '@/components/NavHeader'
import BottomCta from '@/components/BottomCta'
import { useSelectionStore } from '@/store/useSelectionStore'

const ANGLES = [
  { id: 'nw', icon: 'north_west', label: '좌측 상단' },
  { id: 'n', icon: 'north', label: '상단' },
  { id: 'ne', icon: 'north_east', label: '우측 상단' },
  { id: 'w', icon: 'west', label: '좌측' },
  { id: 'center', icon: 'face', label: '정면', special: true },
  { id: 'e', icon: 'east', label: '우측' },
  { id: 'sw', icon: 'south_west', label: '좌측 하단' },
  { id: 's', icon: 'south', label: '하단' },
  { id: 'se', icon: 'south_east', label: '우측 하단' },
] as const

export default function AngleSelectionPage() {
  const router = useRouter()
  const { setAngle } = useSelectionStore()
  const [selectedAngle, setSelectedAngle] = useState('center')

  const handleNext = () => {
    setAngle(selectedAngle)
    router.push('/category-selection')
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavHeader title="Vuka Clinical Aesthetic" showBack />

      <main className="flex-1 px-6 pt-8 pb-32 max-w-lg mx-auto w-full">
        <section className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-on-surface tracking-tight mb-3">촬영 각도 선택</h2>
          <p className="text-on-surface-variant leading-relaxed px-4">
            정확한 분석을 위해 가이드에 맞춰<br />각도를 선택해 주세요.
          </p>
        </section>

        <section className="grid grid-cols-3 gap-4 mb-8">
          {ANGLES.map((angle) => (
            <button
              key={angle.id}
              onClick={() => setSelectedAngle(angle.id)}
              className={`aspect-square rounded-2xl transition-all flex flex-col items-center justify-center p-2 relative ${
                selectedAngle === angle.id
                  ? 'bg-primary-container text-on-primary-container shadow-lg shadow-primary/20 scale-105 z-10 border-2 border-primary'
                  : 'bg-surface-container-low hover:bg-surface-container-high'
              }`}
            >
              {selectedAngle === angle.id && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-[12px] text-primary font-bold" style={{ fontVariationSettings: "'wght' 700" }}>
                    check
                  </span>
                </div>
              )}
              <span
                className={`material-symbols-outlined mb-2 ${selectedAngle === angle.id ? 'text-3xl' : 'text-stone-400'}`}
                style={'special' in angle ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {angle.icon}
              </span>
              <span className={`text-xs font-semibold ${selectedAngle === angle.id ? 'text-white' : 'text-stone-500'}`}>
                {angle.label}
              </span>
            </button>
          ))}
        </section>

        <div className="flex items-center gap-2 mb-4 bg-primary/5 text-primary text-xs font-medium px-4 py-2.5 rounded-full w-fit mx-auto">
          <span className="material-symbols-outlined text-sm">info</span>
          <span>격자에 맞춰 촬영하면 인식이 더 잘됩니다</span>
        </div>

        <div className="relative rounded-[2rem] overflow-hidden aspect-square shadow-2xl">
          <div className="absolute inset-0 z-10 grid grid-cols-3 grid-rows-3 pointer-events-none">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className={[
                  i % 3 !== 2 ? 'border-r' : '',
                  i < 6 ? 'border-b' : '',
                  'border-white/30',
                ].join(' ')}
              />
            ))}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="Skin Analysis Preview"
            className="w-full h-full object-cover brightness-95"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdUVDBWrNRJCmpsWZw0WvphGxlDOVR8LLlMOAEBsBq7YVszZav7_ngY9xFHKNOz82Krb5XHumOnQLAXbSclT7Kxf8jL4HvMO8tzJnWZtfihN0Ny8R-y4YYT4Nzhs4j6cikijg9CgDLbW0ujc18G6tchiUoQhE1IzxMgszmxBBr_FNpdMvtZBcUys9tpdbN_IyK2lpzlrVKyIqOEkn352vfI_przkQgSwmwSm23a5aXh8pZKTUtp18WiKQMlDD9d3B-rvC2HMEwpGDd"
          />
          <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none" viewBox="0 0 400 400">
            <g fill="#FF007A" stroke="#FF007A">
              <circle cx="160" cy="170" r="2" />
              <circle cx="185" cy="170" r="2" />
              <path d="M150,170 Q172,160 195,170" fill="none" opacity="0.6" strokeWidth="1" />
              <circle cx="215" cy="170" r="2" />
              <circle cx="240" cy="170" r="2" />
              <path d="M205,170 Q227,160 250,170" fill="none" opacity="0.6" strokeWidth="1" />
              <circle cx="200" cy="200" r="2" />
              <circle cx="200" cy="235" r="2" />
              <path d="M200,200 L200,235" fill="none" opacity="0.6" strokeWidth="1" />
              <path d="M175,285 Q200,270 225,285 Q200,310 175,285 Z" fill="none" opacity="0.6" strokeWidth="1" />
              <path d="M130,200 Q140,300 200,350 Q260,300 270,200" fill="none" opacity="0.4" strokeWidth="1" />
            </g>
            <rect fill="#FF007A" height="1.5" opacity="0.5" width="200" x="100" y="140">
              <animate attributeName="y" dur="4s" repeatCount="indefinite" values="140;350;140" />
            </rect>
          </svg>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-6 flex justify-between items-end">
            <span className="text-white text-xs font-bold bg-vuka-pink px-3 py-1.5 rounded-full shadow-lg">
              정밀 스캔 모드 활성화
            </span>
            <span className="text-white/80 text-[10px] uppercase tracking-widest font-bold">AI Analytics</span>
          </div>
        </div>
      </main>

      <BottomCta label="다음 단계" onClick={handleNext} />
    </div>
  )
}
```

- [ ] **Step 2: Verify dev server still starts**

```bash
npm run build 2>&1 | tail -5
```
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: angle selection saves to store, routes to /category-selection"
```

---

## Task 5: Update Category Selection Page (trigger generation, route → /upload)

**Files:**
- Modify: `app/category-selection/page.tsx`

Key changes:
- Remove `useSearchParams` (angle comes from store)
- On "분석 시작하기": call `generateImages(category, 4)` async (fire and forget — store `isGenerating=true`), then immediately navigate to `/upload`
- StepHeader updated to step 2/4 (was 3/4 — page order changed)

- [ ] **Step 1: Replace `app/category-selection/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NavHeader from '@/components/NavHeader'
import StepHeader from '@/components/StepHeader'
import BottomCta from '@/components/BottomCta'
import { useSelectionStore } from '@/store/useSelectionStore'
import { generateImages } from '@/lib/gemini'

const MODELS = [
  { id: '20sF', label: '20s F', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAdY4FCKfW1rm19HQre2n8R2uWwgshQomUNHF-eBI9xms-j8-Q9kFwbTbNdJp4oz4ZBsv9168ppc4Nb8EpZRqfl4NflzcCMzPkkmHgBvFm3UX8_VU4UzRmPR3GXm_TvnZ3U0t5x49PqV2N86Sqih4qEfCt1r1fTrcwg3OfKGCm4_1STT2nsdQ3ijd8M0tQ7B_R_t48fI_c7WMN8ebbvbIVw7ZhuoLys7B4uuwvVCfTTXBzRKjYpj0AfbQVHxX4pEkP0uc4UC13BB6LJ' },
  { id: '20sM', label: '20s M', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBD9C8hvLe6GgUy7nsjmUOcUeX5wvJ6ioigiBUbcFtbqrfpbnGvgxhHwRwjarCdRGHst0KPwex2LmqRRPkdCbcC1cDPInedDg-bItgHxt7ukh_YzEDoI6k0YSTAuVyJEWapwCr0HCppbJuVnQj29Pbexz11mdRBt7t3cq4zClxnxby_tLCZIRHg64P2rdeCMkiy8tPFpnxbo9gVdXH0HDhu-EyV7TLx1TlWgsvsmKK97ZkFDR2XLyVUEtdlgZXRcP4M6mdQqrBBBFLA' },
  { id: '30sF', label: '30s F', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBS2IVeOxmKwvp80outBTE6oWljSJl_NKOkPtBLskUtuM7DNuvSO_KSTKcwRIsYXPCS-SYs3Vo-Mm7caOBVjUz5u07bVFIXnlJ2pqTnHE0e7EXajQF4dw60udfSbxp9gR7zhgPGoh_ueHtpGC7ST-OndBEUk-vSeYNWbWPzF2r72OAEvbXkMT-XHq5lQ_tZew3A9pAKIqKVtREnKHpl48LR-Xb3HwLGSrY4BTt2zCSNR_9kKvyi1sMqf-NieUthM_pWS3ctHVYICNJH' },
  { id: '30sM', label: '30s M', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCevDoQm4dxHzIg9SQWXbRXJUkVv9Y_YX8xaYEjaMVcdwUZ41C8rm1VqWb2pSqaP6GFj7klKsvqi3DKIOmQbYL16tBwyxXA2jp8jQWgyTg6dS2LyGWr4K21fd9ZgPon_p0pVz6HDXdEXsN87ANcQH2FjG5BaU9p5MTXL9rj0XaWeqnnNsqOaFCRBvhs5Eg81LimS4egmSHwptWSR4vVThJJ_d_tWTrFTTmC84vHv_kLbQbaND5FZZWLkt_Y894g8eGDbvWbWn8WDb20' },
  { id: '40sF', label: '40s F', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAflBETqNv5q66iQopTcilqRrlIfWHmCr1jWZaaFUyO_ibeNuVYOhBwV6qzyBlu0WI5b2lZL7g8r8pIhtJyIUkNNMbW9PGk29nzDlaG-7mE4ltTUBgG1X9ykKKK_GBolN9cLKlxIHFszmVA4gjICcyHUDHKEIbRZIEfWHLxelaTEzb2Zk1huJ2QYfIQdFuNWPcUdL7zNz86peyUIcYajBaxdiIMHqaqzqnJNzwFNS7fZpVyWR3kkxPR6HepY_TITwR-yMb2m7BGokmE' },
  { id: '40sM', label: '40s M', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD_wI-I0pQ8mDQeahgQ-hViRZ9bnusrscH6V0cwlD-tj0uIErveX1E6nuADsy9csWtysECGonkvbXvh9JP3peZpyLJy1_y5CNEk9CdlY0Y3t5tl6DrVRqdgXoZvKsFWf_dcbkO5YkeLoJ20Ego0yuHXmHaHTFME1GA3w-4eaJ4fKX5zHykXM58vrxxLbLIgz07Ny31_UMqzmKwjV2rIycpgScSfniTPHuTJ5EB8lBveqT_VoXAWsEhFFgCcgcb-K5KKLuY54FQ5_jut' },
  { id: '50sF', label: '50s F', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHGW_485MIRoP_dAxoK_XorID-MLrvfW2IX11fZoOBQ1h3W0NDRIPn7f089mECQ-0UbS1IDjsoT5sCCHMs6YrzeQVvTgC9rAtpy5ZlnT78B4rbS6NK3eIehiPqQpvu1hPMF7T7s7UEZ1P9R4DWWPrS9h_M1tRIDX3WDb7EtmaU6qgpW7itsKQ4tifxANsaDksWvDuORCE9Je0R30E-H7yOYQ_T40aF7GZkz1FZ9AOUV7Mpey7ZD4tiqYgYV6wkW0pI8cJy3CaxdWMb' },
  { id: '50sM', label: '50s M', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAw-ws3aZHxzXJL0hlmn0IQt4tnMVimikxR7TfAYKNBfeOBxzXnIVuuQJPvECJbSXMMNj24xMkWxb90BpgwoAS8vJ9dB435CLe3u564fFQ6jj6P3VIsCA336RZ4JV7oJWQgRE7tgt7ViOvpdnpfe35g5QfXXZ-qWovh_j57vX900Ofjp1miLmz18eLSrPEejiXbnEAdBINdV5Pccu2H6TUnvE4RHHK2crMjVHw6hnwilinIoaXpe4W6HssQ6lJT7W5umSU3u8Dn53_Z' },
]

export default function CategorySelectionPage() {
  const router = useRouter()
  const { setCategory, setGeneratedImages, setIsGenerating } = useSelectionStore()
  const [selected, setSelected] = useState('30sF')

  const handleNext = () => {
    setCategory(selected)
    // Fire generation in background — don't await
    setIsGenerating(true)
    generateImages(selected, 4)
      .then((images) => {
        setGeneratedImages(images)
        setIsGenerating(false)
      })
      .catch(() => {
        setIsGenerating(false)
      })
    router.push('/upload')
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col max-w-md mx-auto relative overflow-x-hidden">
      <NavHeader showBack showMore />

      <main className="flex-1 pt-24 pb-32 px-6">
        <StepHeader step={2} total={4} label="STEP 02" />

        <div className="mb-10">
          <h1 className="text-[2rem] leading-tight font-headline font-bold text-on-surface tracking-tight mb-3">
            원하시는 모델/<br />스타일을 선택해 주세요
          </h1>
          <p className="text-on-surface-variant text-sm font-medium opacity-80">
            선택하신 모델은 AI 정밀 분석의 기준점이 되어 <br />가장 이상적인 밸런스를 제안합니다.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-12">
          {MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => setSelected(model.id)}
              className={`group relative aspect-square rounded-lg overflow-hidden bg-surface-container-lowest transition-all duration-300 active:scale-95 hover:shadow-xl ${
                selected === model.id ? 'border-[3px] border-primary-container' : ''
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={model.label} className="w-full h-full object-cover transition-transform group-hover:scale-110" src={model.img} />
              <div className="absolute inset-0 bg-gradient-to-t from-on-surface/60 to-transparent" />
              <span className="absolute bottom-2 left-0 w-full text-center text-white text-[10px] font-bold uppercase tracking-widest">
                {model.label}
              </span>
              {selected === model.id && (
                <div className="absolute top-2 right-2 bg-primary-container text-white rounded-full p-0.5 shadow-md">
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 700" }}>
                    check
                  </span>
                </div>
              )}
            </button>
          ))}
          <button
            disabled
            className="group relative aspect-square rounded-lg overflow-hidden bg-surface-container-high transition-all duration-300 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-outline-variant/30 opacity-50 cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '28px' }}>blur_on</span>
            <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Neutral</span>
          </button>
        </div>
      </main>

      <BottomCta label="분석 시작하기" onClick={handleNext} icon="bolt" variant="primary" />

      <div className="fixed top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -z-10 translate-x-1/2 -translate-y-1/2" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-tertiary/5 rounded-full blur-[100px] -z-10 -translate-x-1/2 translate-y-1/2" />
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```
Expected: all existing tests pass (11+)

- [ ] **Step 3: Commit**

```bash
git add app/category-selection/page.tsx
git commit -m "feat: category selection triggers Gemini generation, routes to /upload"
```

---

## Task 6: Update Upload Page (reads from store, saves photo)

**Files:**
- Modify: `app/upload/page.tsx`

Key changes:
- Remove `useSearchParams` — angle comes from store
- Upload area opens a real `<input type="file">` and saves the File to store on select
- StepHeader updated to step 3/4
- Navigate to `/model-detail` on next

- [ ] **Step 1: Replace `app/upload/page.tsx`**

```tsx
'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import NavHeader from '@/components/NavHeader'
import StepHeader from '@/components/StepHeader'
import BottomCta from '@/components/BottomCta'
import { useSelectionStore } from '@/store/useSelectionStore'

const ANGLE_LABELS: Record<string, string> = {
  nw: '좌측 상단', n: '상단', ne: '우측 상단',
  w: '좌측', center: '정면 (Frontal View)', e: '우측',
  sw: '좌측 하단', s: '하단', se: '우측 하단',
}

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { angle, photo, setPhoto } = useSelectionStore()
  const angleLabel = ANGLE_LABELS[angle] ?? '정면 (Frontal View)'

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setPhoto(file)
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col max-w-md mx-auto">
      <NavHeader showBack showMore />

      <main className="flex-1 pt-20 pb-32 px-6 flex flex-col gap-8">
        <StepHeader step={3} total={4} label="STEP 03" />

        <section className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">
            고화질 원본 사진을<br />업로드해 주세요
          </h1>
          <p className="text-on-surface-variant text-sm">AI 정밀 분석을 위해 보정되지 않은 원본이 필요합니다.</p>
        </section>

        <section className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className={`w-full aspect-square rounded-lg border-2 border-dashed transition-all flex flex-col items-center justify-center gap-4 ${
            photo
              ? 'border-primary bg-primary/5'
              : 'border-outline-variant bg-surface-container-low hover:bg-surface-container-high hover:border-primary/40'
          }`}>
            {photo ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="uploaded preview"
                  className="w-full h-full object-cover rounded-lg absolute inset-0"
                  src={URL.createObjectURL(photo)}
                />
                <div className="absolute inset-0 bg-black/30 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check_circle
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                </div>
                <div className="text-center">
                  <p className="font-bold text-on-surface">사진 선택하기</p>
                  <p className="text-xs text-on-surface-variant mt-1">JPG, PNG (최대 10MB)</p>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider">선택한 각도 확인</h2>
          <div className="bg-surface-container-lowest p-4 rounded-lg flex items-center gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-surface-container">
            <div className="relative w-20 h-20 rounded-md overflow-hidden bg-surface-container">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="selected face preview"
                className="w-full h-full object-cover grayscale-[0.3]"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAVLmcp2sERbg_OmoDF6qtfHfduL49EUlt9f4zTozLT47n6Mig17J27t4M9S0BSN0iVD5RxL06qSHdqvE7b3nNfhVtgEMLJsWNyg1BZ4-39FCLry8PdzcVxph7J5WNbFfvWlUSIM5Zv-aBB74punGpd5vch95RVR9KYeG3n6la2I4S-EptUFk7urPSd7JwLVEd2JwoH9nNv-FV3uaKY7MmICd-NmjjDgvm5xZxzrzNiCbYd8LDNYY-XqJkdsb0Fuo14D5yIxh50S73L"
              />
              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-primary mb-1 uppercase tracking-tighter">Selected View</span>
              <span className="text-base font-bold text-on-surface">{angleLabel}</span>
              <span className="text-xs text-on-surface-variant mt-1 leading-relaxed">이전 단계에서 선택한 분석 각도입니다.</span>
            </div>
          </div>
        </section>

        <div className="bg-tertiary-container/5 rounded-lg p-5 flex gap-4 items-start border border-tertiary-container/10">
          <span className="material-symbols-outlined text-tertiary">lightbulb</span>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-tertiary">촬영 팁</p>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              밝은 자연광 아래에서 안경이나 액세서리를 제거하고 촬영하시면 더 정확한 AI 결과를 얻을 수 있습니다
            </p>
          </div>
        </div>
      </main>

      <BottomCta
        label="다음 단계"
        onClick={() => router.push('/model-detail')}
        secondary={{ label: '이전', onClick: () => router.back() }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```
Expected: all existing tests pass

- [ ] **Step 3: Commit**

```bash
git add app/upload/page.tsx
git commit -m "feat: upload page reads angle from store, saves File on select"
```

---

## Task 7: Update Model Detail Page (AI-generated images + face swap)

**Files:**
- Modify: `app/model-detail/page.tsx`

Key changes:
- Remove hardcoded `FINAL_MODELS` — shows `generatedImages` from store
- Shows loading skeleton while `isGenerating === true`
- On "AI 합성 시작하기": calls `synthesizeFace(photo, generatedImages[modelId])`, sets `isSynthesizing=true`, shows result
- StepHeader step 4/4

- [ ] **Step 1: Replace `app/model-detail/page.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import NavHeader from '@/components/NavHeader'
import BottomCta from '@/components/BottomCta'
import { useSelectionStore } from '@/store/useSelectionStore'
import { synthesizeFace } from '@/lib/gemini'

export default function ModelDetailPage() {
  const router = useRouter()
  const {
    generatedImages,
    isGenerating,
    modelId,
    photo,
    resultImage,
    isSynthesizing,
    setModelId,
    setResultImage,
    setIsSynthesizing,
  } = useSelectionStore()

  const handleSynthesize = async () => {
    if (!photo || generatedImages.length === 0) return
    setIsSynthesizing(true)
    try {
      const result = await synthesizeFace(photo, generatedImages[modelId])
      setResultImage(result)
    } finally {
      setIsSynthesizing(false)
    }
  }

  return (
    <div className="bg-background min-h-screen">
      <NavHeader showBack />

      <main className="pt-24 pb-48 px-6 max-w-screen-md mx-auto">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center space-x-2 bg-surface-container-high px-4 py-1.5 rounded-full mb-4">
            <span className="text-[10px] font-extrabold tracking-widest text-primary uppercase">Step 04</span>
            <div className="w-1 h-1 rounded-full bg-outline-variant" />
            <span className="text-[10px] font-bold tracking-widest text-secondary uppercase">Final Model Selection</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-on-surface">
            원하시는 AI 모델을 <br className="md:hidden" /> 선택해 주세요
          </h1>
          <p className="mt-3 text-secondary text-sm font-medium opacity-80">
            고객님의 이미지와 가장 잘 어울리는 페이스 모델을 제안합니다.
          </p>
        </div>

        {/* Result image */}
        {resultImage && (
          <div className="mb-8 rounded-[2rem] overflow-hidden shadow-2xl vuka-glow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="AI synthesis result" className="w-full object-cover" src={resultImage} />
          </div>
        )}

        {/* 4 generated image grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:gap-12">
          {isGenerating
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="relative aspect-[4/5] rounded-[2rem] overflow-hidden bg-surface-container animate-pulse" />
              ))
            : generatedImages.slice(0, 4).map((imgUrl, i) => (
                <button
                  key={i}
                  className="relative group cursor-pointer text-left w-full"
                  onClick={() => setModelId(i)}
                >
                  <div
                    className={`relative aspect-[4/5] rounded-[2rem] overflow-hidden transition-all duration-300 ${
                      modelId === i
                        ? 'model-selected-ring scale-[1.02]'
                        : 'border-2 border-transparent hover:border-outline-variant'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={`Generated model ${i + 1}`}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      src={imgUrl}
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t ${modelId === i ? 'from-primary/40' : 'from-black/20'} to-transparent`} />
                    {modelId === i && (
                      <div className="absolute top-4 right-4 z-20 bg-primary text-white p-1.5 rounded-full shadow-lg">
                        <span className="material-symbols-outlined text-sm font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 text-center">
                    <p className={`text-xs font-black tracking-widest uppercase ${modelId === i ? 'text-primary' : 'text-on-surface/60'}`}>
                      Model 0{i + 1}
                    </p>
                  </div>
                </button>
              ))}
        </div>
      </main>

      <BottomCta
        label={isSynthesizing ? '합성 중...' : 'AI 합성 시작하기'}
        onClick={handleSynthesize}
        icon={isSynthesizing ? 'hourglass_empty' : 'bolt'}
        variant="glow"
      />
    </div>
  )
}
```

- [ ] **Step 2: Run tests + build**

```bash
npm test && npm run build 2>&1 | tail -10
```
Expected: 20+ tests pass, build exits 0

- [ ] **Step 3: Commit**

```bash
git add app/model-detail/page.tsx
git commit -m "feat: model detail shows AI-generated images and triggers face synthesis"
```

---

## Task 8: Add NEXT_PUBLIC_GEMINI_API_KEY to env

**Files:**
- Create: `.env.local.example`

- [ ] **Step 1: Create `.env.local.example`**

```bash
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

- [ ] **Step 2: Verify `.env.local` is in `.gitignore`**

```bash
grep ".env.local" .gitignore
```
Expected: `.env.local` appears in output (create-next-app adds it by default)

- [ ] **Step 3: Commit**

```bash
git add .env.local.example
git commit -m "chore: add .env.local.example for Gemini API key"
```

---

## Task 9: Run full test suite + build verification

- [ ] **Step 1: Run all tests**

```bash
npm test
```
Expected:
```
Test Suites: 5 passed, 5 total
Tests:       23 passed, 23 total
```
(11 component tests + 9 store tests + 3 gemini tests)

- [ ] **Step 2: Run production build**

```bash
npm run build
```
Expected: exit 0, all routes compiled

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix: final build and test fixes"
```
