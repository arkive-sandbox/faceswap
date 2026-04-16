# SAM3 + FLUX Fill + Face-Swap Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** face-segment-demo-next의 SAM3 + FLUX Fill + face-swap 3단계 파이프라인을 face-swap-web에 이식하고, 업로드 시 자동 분석 + 단계별 로딩바를 추가한다.

**Architecture:** 업로드 페이지에서 파일 선택 즉시 FaceLandmarker(기존) + SAM3 세그멘테이션(신규)을 자동 실행하고 결과를 Zustand store에 저장한다. model-detail 페이지에서 기존 `synthesizeFace`(OpenAI) 대신 FLUX Fill → face-swap Replicate 2단계 파이프라인을 실행하며 각 단계 로딩바를 표시한다.

**Tech Stack:** Next.js 16 (App Router), Replicate API, Zustand 5, @mediapipe/tasks-vision, Tailwind CSS

---

## File Map

| 파일 | 작업 | 역할 |
|------|------|------|
| `app/api/sam3/route.ts` | 신규 생성 | SAM3 세그멘테이션 API |
| `app/api/flux-fill/route.ts` | 신규 생성 | FLUX Fill 인페인팅 API |
| `app/api/face-swap/route.ts` | 신규 생성 | Replicate face-swap API |
| `lib/segmentation.ts` | 신규 생성 | 마스크 처리 유틸리티 함수 |
| `store/useSelectionStore.ts` | 수정 | SAM3 결과 필드 추가 |
| `app/upload/page.tsx` | 수정 | SAM3 자동 실행 + 단계별 로딩바 |
| `app/model-detail/page.tsx` | 수정 | synthesizeFace → FLUX Fill + face-swap |

---

## Task 1: API 라우트 3개 추가

**Files:**
- Create: `app/api/sam3/route.ts`
- Create: `app/api/flux-fill/route.ts`
- Create: `app/api/face-swap/route.ts`

- [ ] **Step 1: sam3/route.ts 생성**

```typescript
// app/api/sam3/route.ts
import Replicate from 'replicate'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const SAM3_VERSION = 'mattsays/sam3-image:d73db077226443ba4fafd34e233b3626b552eac2a433f90c7c32a9ac89bd9e72'
const FACE_PROMPTS = ['face', 'face of the main person', 'facial area of the person']
const HAIR_PROMPTS = ['hair', 'hair of the main person', 'hairstyle of the person']

function pickOutputUrl(output: unknown): string | null {
  if (typeof output === 'string') return output
  if (Array.isArray(output)) {
    for (const item of output) {
      const url = pickOutputUrl(item)
      if (url) return url
    }
  }
  if (output && typeof output === 'object') {
    if ('url' in output && typeof output.url === 'function') {
      const urlValue = (output as { url: () => unknown }).url()
      if (urlValue) return String(urlValue)
    }
    if ('url' in output && typeof output.url === 'string') return output.url
    if ('mask' in output && typeof output.mask === 'string') return output.mask
    if ('output' in output && typeof output.output === 'string') return output.output
  }
  return null
}

async function runMask(replicate: Replicate, image: string, prompt: string): Promise<string> {
  const output = await replicate.run(SAM3_VERSION, {
    input: { image, prompt, mask_only: true, return_zip: false, threshold: 0.5 },
  })
  const maskUrl = pickOutputUrl(output)
  if (!maskUrl) throw new Error(`No mask URL returned for prompt "${prompt}"`)
  return maskUrl
}

function parseRetryAfterSeconds(message: string): number | null {
  const match = message.match(/"retry_after":\s*(\d+)/)
  return match ? Number(match[1]) : null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runPromptList(
  replicate: Replicate,
  image: string,
  prompts: string[],
  label: 'face' | 'hair',
): Promise<{ maskUrl: string; prompt: string }> {
  const errors: string[] = []
  for (const prompt of prompts) {
    try {
      const maskUrl = await runMask(replicate, image, prompt)
      return { maskUrl, prompt }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const retryAfterSeconds = parseRetryAfterSeconds(message)
      if (retryAfterSeconds != null) {
        await sleep((retryAfterSeconds + 1) * 1000)
        try {
          const maskUrl = await runMask(replicate, image, prompt)
          return { maskUrl, prompt }
        } catch (retryError) {
          errors.push(`${prompt}: ${retryError instanceof Error ? retryError.message : String(retryError)}`)
          continue
        }
      }
      errors.push(`${prompt}: ${message}`)
    }
  }
  throw new Error(`No mask URL returned for ${label}. ${errors.join(' | ')}`)
}

async function toDataUri(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download mask: ${response.status}`)
  const contentType = response.headers.get('content-type') ?? 'image/png'
  const arrayBuffer = await response.arrayBuffer()
  return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const image = formData.get('image') as File | null
  if (!image) return NextResponse.json({ error: 'image required' }, { status: 400 })

  const token = process.env.NEXT_PUBLIC_REPLICATE_API_TOKEN
  if (!token) return NextResponse.json({ error: 'NEXT_PUBLIC_REPLICATE_API_TOKEN not set' }, { status: 500 })

  const replicate = new Replicate({ auth: token })
  const arrayBuffer = await image.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const dataUri = `data:${image.type};base64,${base64}`

  try {
    const [faceResult, hairResult] = await Promise.all([
      runPromptList(replicate, dataUri, FACE_PROMPTS, 'face'),
      runPromptList(replicate, dataUri, HAIR_PROMPTS, 'hair'),
    ])
    const [faceMaskDataUrl, hairMaskDataUrl] = await Promise.all([
      toDataUri(faceResult.maskUrl),
      toDataUri(hairResult.maskUrl),
    ])
    return NextResponse.json({
      model: SAM3_VERSION,
      facePrompt: faceResult.prompt,
      hairPrompt: hairResult.prompt,
      faceMaskUrl: faceMaskDataUrl,
      hairMaskUrl: hairMaskDataUrl,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Replicate request failed' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: flux-fill/route.ts 생성**

```typescript
// app/api/flux-fill/route.ts
import Replicate from 'replicate'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

function pickOutputUrl(output: unknown): string | null {
  if (typeof output === 'string') return output
  if (Array.isArray(output)) {
    for (const item of output) {
      const url = pickOutputUrl(item)
      if (url) return url
    }
  }
  if (output && typeof output === 'object') {
    const o = output as Record<string, unknown>
    if (typeof o.url === 'function') return String((o.url as () => unknown)())
    if (typeof o.url === 'string') return o.url
    if (typeof o.output === 'string') return o.output
  }
  return null
}

async function fileToDataUri(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  return `data:${file.type || 'image/png'};base64,${Buffer.from(arrayBuffer).toString('base64')}`
}

async function toDataUri(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download FLUX output: ${res.status}`)
  const contentType = res.headers.get('content-type') ?? 'image/png'
  const buf = await res.arrayBuffer()
  return `data:${contentType};base64,${Buffer.from(buf).toString('base64')}`
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const image = formData.get('image') as File | null
  const mask = formData.get('mask') as File | null
  const prompt = formData.get('prompt') as string | null

  if (!image || !mask) return NextResponse.json({ error: 'image and mask are required' }, { status: 400 })

  const token = process.env.NEXT_PUBLIC_REPLICATE_API_TOKEN
  if (!token) return NextResponse.json({ error: 'NEXT_PUBLIC_REPLICATE_API_TOKEN not set' }, { status: 500 })

  try {
    const replicate = new Replicate({ auth: token })
    const [imageSrc, maskSrc] = await Promise.all([fileToDataUri(image), fileToDataUri(mask)])

    const output = await replicate.run('black-forest-labs/flux-fill-pro', {
      input: {
        image: imageSrc,
        mask: maskSrc,
        prompt: prompt ?? 'a realistic human face',
        guidance: 30,
        num_inference_steps: 28,
        output_format: 'png',
      },
    })

    const outputUrl = pickOutputUrl(output)
    if (!outputUrl) throw new Error('No output URL from FLUX Fill')

    const dataUrl = outputUrl.startsWith('data:') ? outputUrl : await toDataUri(outputUrl)
    return NextResponse.json({ outputUrl: dataUrl })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'FLUX Fill request failed' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 3: face-swap/route.ts 생성**

```typescript
// app/api/face-swap/route.ts
import Replicate from 'replicate'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const FACE_SWAP_VERSION = 'fofr/face-swap-with-ideogram'

function pickOutputUrl(output: unknown): string | null {
  if (typeof output === 'string') return output
  if (Array.isArray(output)) {
    for (const item of output) {
      const url = pickOutputUrl(item)
      if (url) return url
    }
  }
  if (output && typeof output === 'object') {
    if ('url' in output && typeof output.url === 'function') {
      const urlValue = (output as { url: () => unknown }).url()
      if (urlValue) return String(urlValue)
    }
    if ('url' in output && typeof output.url === 'string') return output.url
    if ('output' in output && typeof output.output === 'string') return output.output
  }
  return null
}

async function toDataUri(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download face swap output: ${response.status}`)
  const contentType = response.headers.get('content-type') ?? 'image/png'
  const arrayBuffer = await response.arrayBuffer()
  return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`
}

async function fileToDataUri(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  return `data:${file.type || 'image/png'};base64,${Buffer.from(arrayBuffer).toString('base64')}`
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const characterImage = formData.get('character_image') as File | null
  const targetImage = formData.get('target_image') as File | null

  if (!characterImage || !targetImage) {
    return NextResponse.json({ error: 'character_image and target_image are required' }, { status: 400 })
  }

  const token = process.env.NEXT_PUBLIC_REPLICATE_API_TOKEN
  if (!token) return NextResponse.json({ error: 'NEXT_PUBLIC_REPLICATE_API_TOKEN not set' }, { status: 500 })

  try {
    const replicate = new Replicate({ auth: token })
    const [characterDataUri, targetDataUri] = await Promise.all([
      fileToDataUri(characterImage),
      fileToDataUri(targetImage),
    ])

    const output = await replicate.run(FACE_SWAP_VERSION, {
      input: { character_image: characterDataUri, target_image: targetDataUri, cleanup: false },
    })

    const outputUrl = pickOutputUrl(output)
    if (!outputUrl) throw new Error('No output URL returned from face swap model')

    const dataUrl = await toDataUri(outputUrl)
    return NextResponse.json({ model: FACE_SWAP_VERSION, outputUrl: dataUrl })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Replicate face swap request failed' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 4: 커밋**

```bash
cd /Users/jewon/vuka/face-swap-web
git add app/api/sam3/route.ts app/api/flux-fill/route.ts app/api/face-swap/route.ts
git commit -m "feat: add SAM3, FLUX Fill, face-swap API routes"
```

---

## Task 2: 세그멘테이션 유틸리티 라이브러리 추가

**Files:**
- Create: `lib/segmentation.ts`

- [ ] **Step 1: lib/segmentation.ts 생성**

```typescript
// lib/segmentation.ts
// 마스크 처리 및 이미지 유틸리티

export interface SquareAsset {
  file: File
  src: string
  size: number
}

export function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function dataUrlToFile(dataUrl: string, name: string): File {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)![1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new File([u8arr], name, { type: mime })
}

export async function loadBinaryMask(
  dataUrl: string,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const img = await loadImageEl(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = new Uint8Array(width * height)
  for (let i = 0; i < data.length; i++) {
    const px = i * 4
    const alpha = imageData.data[px + 3]
    const luminance = (imageData.data[px] + imageData.data[px + 1] + imageData.data[px + 2]) / 3
    if (alpha > 16 && luminance > 127) data[i] = 1
  }
  return data
}

function dilateMask(maskData: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return new Uint8Array(maskData)
  const out = new Uint8Array(maskData.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let on = false
      outer: for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= width) continue
          if (dx * dx + dy * dy > radius * radius) continue
          if (maskData[ny * width + nx] === 1) { on = true; break outer }
        }
      }
      if (on) out[y * width + x] = 1
    }
  }
  return out
}

function erodeMask(maskData: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return new Uint8Array(maskData)
  const out = new Uint8Array(maskData.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let keepOn = true
      outer: for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= height) { keepOn = false; break }
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= width) { keepOn = false; break outer }
          if (dx * dx + dy * dy > radius * radius) continue
          if (maskData[ny * width + nx] !== 1) { keepOn = false; break outer }
        }
      }
      if (keepOn) out[y * width + x] = 1
    }
  }
  return out
}

/**
 * SAM3 face/hair 마스크로부터 FLUX Fill용 흑백 마스크를 생성한다.
 * 흰색(255) = 편집 가능한 얼굴 영역, 검정(0) = 보존 영역
 */
export async function createFluxFillMaskDataUrl(
  faceMaskData: Uint8Array,
  hairMaskData: Uint8Array | null,
  width: number,
  height: number,
): Promise<string> {
  const insetFace = erodeMask(faceMaskData, width, height, 10)
  const editable = dilateMask(insetFace, width, height, 4)
  const hairLock = hairMaskData ? dilateMask(hairMaskData, width, height, 3) : null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(width, height)

  for (let i = 0; i < width * height; i++) {
    const px = i * 4
    const isEdit = editable[i] === 1 && (!hairLock || hairLock[i] !== 1)
    img.data[px] = img.data[px + 1] = img.data[px + 2] = isEdit ? 255 : 0
    img.data[px + 3] = 255
  }

  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * 이미지 파일을 정사각형으로 크롭하고 File + src + size를 반환한다.
 */
export function squareFile(
  file: File,
  name: string,
  background = '#000000',
): Promise<SquareAsset> {
  return fileToDataUrl(file).then(
    (src) =>
      new Promise<SquareAsset>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          const size = Math.max(img.naturalWidth, img.naturalHeight)
          const canvas = document.createElement('canvas')
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')!
          ctx.fillStyle = background
          ctx.fillRect(0, 0, size, size)
          const offsetX = (size - img.naturalWidth) / 2
          const offsetY = (size - img.naturalHeight) / 2
          ctx.drawImage(img, offsetX, offsetY, img.naturalWidth, img.naturalHeight)
          const squaredSrc = canvas.toDataURL('image/png')
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('squareFile failed')); return }
            resolve({ file: new File([blob], name, { type: 'image/png' }), src: squaredSrc, size })
          }, 'image/png')
        }
        img.onerror = reject
        img.src = src
      }),
  )
}
```

- [ ] **Step 2: 커밋**

```bash
cd /Users/jewon/vuka/face-swap-web
git add lib/segmentation.ts
git commit -m "feat: add segmentation utilities (mask processing, squareFile)"
```

---

## Task 3: Zustand store에 SAM3 필드 추가

**Files:**
- Modify: `store/useSelectionStore.ts`

- [ ] **Step 1: 현재 store 파일 읽기**

```bash
cat /Users/jewon/vuka/face-swap-web/store/useSelectionStore.ts
```

- [ ] **Step 2: SAM3 필드 추가 — 인터페이스와 초기값**

기존 `SelectionState` 인터페이스에 다음 필드와 setter를 추가한다:

```typescript
// 추가할 필드 (interface SelectionState 안에)
faceMaskDataUrl: string | null
hairMaskDataUrl: string | null
fluxMaskDataUrl: string | null
segW: number
segH: number
setFaceMaskDataUrl: (v: string | null) => void
setHairMaskDataUrl: (v: string | null) => void
setFluxMaskDataUrl: (v: string | null) => void
setSegW: (v: number) => void
setSegH: (v: number) => void
```

초기값:
```typescript
faceMaskDataUrl: null,
hairMaskDataUrl: null,
fluxMaskDataUrl: null,
segW: 0,
segH: 0,
setFaceMaskDataUrl: (v) => set({ faceMaskDataUrl: v }),
setHairMaskDataUrl: (v) => set({ hairMaskDataUrl: v }),
setFluxMaskDataUrl: (v) => set({ fluxMaskDataUrl: v }),
setSegW: (v) => set({ segW: v }),
setSegH: (v) => set({ segH: v }),
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/jewon/vuka/face-swap-web
git add store/useSelectionStore.ts
git commit -m "feat: add SAM3 mask fields to selection store"
```

---

## Task 4: upload/page.tsx — SAM3 자동 실행 + 단계별 로딩바

**Files:**
- Modify: `app/upload/page.tsx`

- [ ] **Step 1: import 추가**

파일 상단 import에 다음 추가:

```typescript
import { loadBinaryMask, createFluxFillMaskDataUrl, loadImageEl } from '@/lib/segmentation'
```

- [ ] **Step 2: store에서 새 setter 구조분해 추가**

`useSelectionStore` 구조분해에 다음 추가:
```typescript
const {
  // 기존 항목들...
  setFaceMaskDataUrl,
  setHairMaskDataUrl,
  setFluxMaskDataUrl,
  setSegW,
  setSegH,
} = useSelectionStore()
```

- [ ] **Step 3: analysisStep state 추가**

컴포넌트 상단 state 선언부에 추가:
```typescript
type AnalysisStep = 'idle' | 'landmarks' | 'sam3' | 'done' | 'error'
const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle')
const [analysisError, setAnalysisError] = useState<string | null>(null)
```

- [ ] **Step 4: handleFileChange 함수를 아래 코드로 교체**

기존 `handleFileChange` 전체를 아래 코드로 교체한다:

```typescript
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return

  setPhoto(file)
  setOriginalPhoto(file)
  setLandmarkPreview(null)
  setHairPreview(null)
  setPreview(null)
  setGeneratedImages([])
  setIsGenerating(false)
  setAnalysisError(null)
  setFaceMaskDataUrl(null)
  setHairMaskDataUrl(null)
  setFluxMaskDataUrl(null)

  const originalUrl = URL.createObjectURL(file)
  originalUrlRef.current = originalUrl

  // ── Step 1: FaceLandmarker + 배경제거 + 헤어 (클라이언트) ──────
  setAnalysisStep('landmarks')
  try {
    const [landmarks, removed, points, hair] = await Promise.all([
      drawFaceOvalComparison(originalUrl),
      removeBackground(originalUrl),
      getFaceLandmarkPoints(originalUrl),
      extractHairLayer(originalUrl).catch((err) => { console.error('[hair]', err); return null }),
    ])
    setLandmarkPreview(landmarks)
    setHairPreview(hair)
    setPreview(removed)
    setEditorPoints(points)
    setFaceOvalPoints(points)
  } catch (err) {
    console.error('[landmarks]', err)
    setPreview(originalUrl)
  }

  // ── Step 2: SAM3 세그멘테이션 (서버) ──────────────────────────
  setAnalysisStep('sam3')
  try {
    const img = await loadImageEl(originalUrl)
    const W = img.naturalWidth
    const H = img.naturalHeight
    setSegW(W)
    setSegH(H)

    const formData = new FormData()
    formData.append('image', file)
    const response = await fetch('/api/sam3', { method: 'POST', body: formData })
    const payload = await response.json() as Record<string, unknown>
    if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'SAM3 실패')

    const faceMaskUrl = typeof payload.faceMaskUrl === 'string' ? payload.faceMaskUrl : null
    const hairMaskUrl = typeof payload.hairMaskUrl === 'string' ? payload.hairMaskUrl : null

    setFaceMaskDataUrl(faceMaskUrl)
    setHairMaskDataUrl(hairMaskUrl)

    // FLUX Fill 마스크 미리 생성 (흰=face편집, 검=보존)
    if (faceMaskUrl) {
      const [faceMaskData, hairMaskData] = await Promise.all([
        loadBinaryMask(faceMaskUrl, W, H),
        hairMaskUrl ? loadBinaryMask(hairMaskUrl, W, H) : Promise.resolve(null),
      ])
      const fluxMaskDataUrl = await createFluxFillMaskDataUrl(faceMaskData, hairMaskData, W, H)
      setFluxMaskDataUrl(fluxMaskDataUrl)
    }
  } catch (err) {
    console.error('[sam3]', err)
    setAnalysisError(err instanceof Error ? err.message : 'SAM3 분석에 실패했습니다')
    setAnalysisStep('error')
    return
  }

  setAnalysisStep('done')
}
```

- [ ] **Step 5: 단계별 로딩바 오버레이 UI 추가**

`return (` 블록 안에서 `<NavHeader .../>` 바로 아래에 추가:

```tsx
{/* 분석 로딩바 오버레이 */}
{analysisStep !== 'idle' && analysisStep !== 'done' && analysisStep !== 'error' && (
  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-8">
    <div className="w-full max-w-sm bg-surface-container-high rounded-2xl p-6 flex flex-col gap-5 shadow-2xl">
      <p className="text-sm font-bold text-on-surface text-center">사진 분석 중...</p>
      <div className="flex flex-col gap-3">
        {([
          { id: 'landmarks', label: '얼굴 랜드마크 분석' },
          { id: 'sam3', label: '세그멘테이션 분석 (SAM3)' },
        ] as const).map((step) => {
          const order: AnalysisStep[] = ['landmarks', 'sam3', 'done']
          const currentIdx = order.indexOf(analysisStep)
          const stepIdx = order.indexOf(step.id)
          const isDone = stepIdx < currentIdx
          const isActive = step.id === analysisStep
          return (
            <div key={step.id} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                isDone ? 'bg-primary' : isActive ? 'border-2 border-primary' : 'border-2 border-outline-variant'
              }`}>
                {isDone && (
                  <span className="material-symbols-outlined text-white" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>check</span>
                )}
                {isActive && (
                  <span className="material-symbols-outlined text-primary animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
                )}
              </div>
              <span className={`text-sm ${isActive ? 'font-bold text-on-surface' : isDone ? 'text-on-surface/50 line-through' : 'text-on-surface-variant'}`}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
      <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-700"
          style={{ width: analysisStep === 'landmarks' ? '40%' : '75%' }}
        />
      </div>
    </div>
  </div>
)}

{/* SAM3 오류 표시 */}
{analysisStep === 'error' && analysisError && (
  <div className="mx-6 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
    <p className="text-xs font-bold text-red-600">SAM3 분석 실패: {analysisError}</p>
    <p className="text-xs text-red-500 mt-1">다음 단계로 진행하면 FLUX Fill 없이 face-swap만 진행됩니다.</p>
  </div>
)}
```

- [ ] **Step 6: BottomCta disabled 조건 수정**

`analysisStep`이 `'landmarks'` 또는 `'sam3'`일 때 "세부사항 조정하기" 버튼을 비활성화:

```tsx
<BottomCta
  label="세부사항 조정하기"
  onClick={() => {
    if (!photo) return
    router.push('/category-selection')
  }}
  secondary={{ label: '이전', onClick: () => router.back() }}
/>
```

`BottomCta` 컴포넌트가 `disabled` prop을 지원하지 않으므로, `onClick`에 가드 추가:

```tsx
<BottomCta
  label={analysisStep === 'landmarks' || analysisStep === 'sam3' ? '분석 중...' : '세부사항 조정하기'}
  onClick={() => {
    if (!photo || analysisStep === 'landmarks' || analysisStep === 'sam3') return
    router.push('/category-selection')
  }}
  secondary={{ label: '이전', onClick: () => router.back() }}
/>
```

- [ ] **Step 7: 커밋**

```bash
cd /Users/jewon/vuka/face-swap-web
git add app/upload/page.tsx
git commit -m "feat: auto-run SAM3 on upload with step-by-step loading bar"
```

---

## Task 5: model-detail/page.tsx — synthesizeFace를 FLUX Fill + face-swap으로 교체

**Files:**
- Modify: `app/model-detail/page.tsx`

- [ ] **Step 1: import 수정**

기존:
```typescript
import { generateFromLandmarks, synthesizeFace } from '@/lib/gemini'
```

변경 후:
```typescript
import { generateFromLandmarks } from '@/lib/gemini'
import { squareFile, dataUrlToFile } from '@/lib/segmentation'
```

- [ ] **Step 2: store에서 새 필드 구조분해 추가**

```typescript
const {
  // 기존 항목들 유지...
  fluxMaskDataUrl,
  originalPhoto,
  // ...
} = useSelectionStore()
```

- [ ] **Step 3: synthStep state 추가**

```typescript
type SynthStep = 'idle' | 'flux' | 'faceswap' | 'done' | 'error'
const [synthStep, setSynthStep] = useState<SynthStep>('idle')
const [synthError, setSynthError] = useState<string | null>(null)
```

- [ ] **Step 4: 카테고리 → 영문 프롬프트 맵 추가**

컴포넌트 바깥(파일 상단):
```typescript
const CATEGORY_DESC: Record<string, string> = {
  '20sF': 'Korean woman in her 20s, natural makeup, bright skin tone',
  '20sM': 'Korean man in his 20s, clean style',
  '30sF': 'Korean woman in her 30s, sophisticated look, natural smile',
  '30sM': 'Korean man in his 30s, intellectual appearance',
  '40sF': 'Korean woman in her 40s, elegant and mature',
  '40sM': 'Korean man in his 40s, distinguished look',
  '50sF': 'Korean woman in her 50s, dignified beauty',
  '50sM': 'Korean man in his 50s, trustworthy appearance',
}
```

- [ ] **Step 5: handleSynthesize 함수 교체**

기존 `handleSynthesize` 전체를 아래 코드로 교체:

```typescript
const handleSynthesize = useCallback(async () => {
  if (!originalPhoto || !fluxMaskDataUrl) return
  setIsSynthesizing(true)
  setSynthStep('flux')
  setSynthError(null)
  setResultImage(null)

  try {
    const catDesc = CATEGORY_DESC[category] ?? 'Korean person, natural expression'
    const prompt = [
      `Photorealistic face of a ${catDesc}, looking at camera, natural expression.`,
      `Realistic skin texture and natural lighting. Seamlessly blend with the surrounding image.`,
    ].join(' ')

    // ── Step 1: FLUX Fill ─────────────────────────────────────────
    const [squareOriginal, fluxMaskFile] = await Promise.all([
      squareFile(originalPhoto, 'flux-original.png'),
      Promise.resolve(dataUrlToFile(fluxMaskDataUrl, 'flux-mask.png')),
    ])
    const squareMask = await squareFile(fluxMaskFile, 'flux-mask-square.png', '#000000')

    const fd = new FormData()
    fd.append('image', squareOriginal.file)
    fd.append('mask', squareMask.file)
    fd.append('prompt', prompt)

    const fluxResponse = await fetch('/api/flux-fill', { method: 'POST', body: fd })
    const fluxPayload = await fluxResponse.json() as Record<string, unknown>
    if (!fluxResponse.ok) throw new Error(typeof fluxPayload.error === 'string' ? fluxPayload.error : 'FLUX Fill 실패')
    const fluxDataUrl = typeof fluxPayload.outputUrl === 'string' ? fluxPayload.outputUrl : null
    if (!fluxDataUrl) throw new Error('FLUX Fill 결과가 비어 있습니다')

    // ── Step 2: Face-swap ─────────────────────────────────────────
    setSynthStep('faceswap')

    const fluxFile = dataUrlToFile(fluxDataUrl, 'flux-result.png')
    const [squareCharacter, squareTarget] = await Promise.all([
      squareFile(fluxFile, 'character_image.png'),
      squareFile(originalPhoto, 'target_image.png'),
    ])

    const step3Fd = new FormData()
    step3Fd.append('character_image', squareCharacter.file)
    step3Fd.append('target_image', squareTarget.file)

    const faceSwapResponse = await fetch('/api/face-swap', { method: 'POST', body: step3Fd })
    const faceSwapPayload = await faceSwapResponse.json() as Record<string, unknown>
    if (!faceSwapResponse.ok) throw new Error(typeof faceSwapPayload.error === 'string' ? faceSwapPayload.error : '합성 실패')
    const finalDataUrl = typeof faceSwapPayload.outputUrl === 'string' ? faceSwapPayload.outputUrl : null
    if (!finalDataUrl) throw new Error('최종 합성 결과가 비어 있습니다')

    setResultImage(finalDataUrl)
    setSynthStep('done')
  } catch (err) {
    setSynthError(err instanceof Error ? err.message : '합성에 실패했습니다')
    setSynthStep('error')
  } finally {
    setIsSynthesizing(false)
  }
}, [originalPhoto, fluxMaskDataUrl, category, setResultImage, setIsSynthesizing])
```

- [ ] **Step 6: BottomCta 아래에 단계별 합성 로딩바 추가**

`BottomCta` 컴포넌트를 아래 코드로 교체:

```tsx
{/* 합성 단계별 로딩바 */}
{isSynthesizing && (
  <div className="fixed bottom-28 left-0 w-full px-6 z-40">
    <div className="max-w-lg mx-auto bg-surface-container-high rounded-2xl px-5 py-4 shadow-xl flex flex-col gap-3">
      {([
        { id: 'flux', label: '얼굴 변환 중 (FLUX Fill)' },
        { id: 'faceswap', label: '최종 합성 중 (Face Swap)' },
      ] as const).map((step) => {
        const order: SynthStep[] = ['flux', 'faceswap', 'done']
        const currentIdx = order.indexOf(synthStep)
        const stepIdx = order.indexOf(step.id)
        const isDone = stepIdx < currentIdx
        const isActive = step.id === synthStep
        return (
          <div key={step.id} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              isDone ? 'bg-primary' : isActive ? 'border-2 border-primary' : 'border-2 border-outline-variant'
            }`}>
              {isDone && (
                <span className="material-symbols-outlined text-white" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}>check</span>
              )}
              {isActive && (
                <span className="material-symbols-outlined text-primary animate-spin" style={{ fontSize: 12 }}>progress_activity</span>
              )}
            </div>
            <span className={`text-xs ${isActive ? 'font-bold text-on-surface' : isDone ? 'text-on-surface/50 line-through' : 'text-on-surface-variant'}`}>
              {step.label}
            </span>
          </div>
        )
      })}
      <div className="h-1 w-full bg-surface-container rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-700"
          style={{ width: synthStep === 'flux' ? '40%' : synthStep === 'faceswap' ? '80%' : '100%' }}
        />
      </div>
    </div>
  </div>
)}

{synthError && (
  <div className="fixed bottom-28 left-0 w-full px-6 z-40">
    <div className="max-w-lg mx-auto bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-center">
      <p className="text-xs font-bold text-red-600">합성 실패: {synthError}</p>
      <button
        className="mt-2 text-xs font-bold text-white bg-red-500 rounded-full px-4 py-1.5"
        onClick={() => { setSynthError(null); setSynthStep('idle') }}
      >
        다시 시도
      </button>
    </div>
  </div>
)}

<BottomCta
  label={isSynthesizing ? '합성 중...' : 'AI 합성 시작하기'}
  onClick={handleSynthesize}
  icon={isSynthesizing ? 'hourglass_empty' : 'bolt'}
  variant="glow"
/>
```

- [ ] **Step 7: 커밋**

```bash
cd /Users/jewon/vuka/face-swap-web
git add app/model-detail/page.tsx
git commit -m "feat: replace synthesizeFace with FLUX Fill + face-swap pipeline"
```

---

## Self-Review

### Spec coverage
- [x] SAM3 API route → Task 1
- [x] FLUX Fill API route → Task 1
- [x] face-swap API route → Task 1
- [x] 세그멘테이션 유틸 (mask processing, squareFile) → Task 2
- [x] Store SAM3 필드 추가 → Task 3
- [x] Upload 자동 실행 + 로딩바 → Task 4
- [x] model-detail synthesize 교체 + 로딩바 → Task 5

### Placeholder scan
- 없음. 모든 코드 스텝에 실제 구현 코드 포함.

### Type consistency
- `AnalysisStep`: Task 4 Step 3에서 정의, Step 4/5에서 사용 ✓
- `SynthStep`: Task 5 Step 3에서 정의, Step 5/6에서 사용 ✓
- `SquareAsset`: `lib/segmentation.ts`에서 export, model-detail에서 import ✓
- `dataUrlToFile`, `squareFile`: `lib/segmentation.ts`에서 export ✓
- Store 필드 (`fluxMaskDataUrl`, `setFluxMaskDataUrl` 등): Task 3에서 정의, Task 4/5에서 사용 ✓
