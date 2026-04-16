'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import StepHeader from '@/components/StepHeader'
import BottomCta from '@/components/BottomCta'
import PageShell from '@/components/PageShell'
import { useSelectionStore } from '@/store/useSelectionStore'
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import { squareFile, loadBinaryMask, dataUrlToFile, cropToOriginalAspect } from '@/lib/segmentation'

// ── landmark indices (MediaPipe) ──────────────────────────────────
const LEFT_EYE_INDICES  = [33, 160, 158, 133, 153, 144]
const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380]
const NOSE_INDICES      = [6, 197, 195, 5, 4, 1, 98, 327]
const MOUTH_INDICES     = [13, 14, 78, 308]
const FACE_AXIS_TOP     = 10
const FACE_AXIS_BOTTOM  = 152

type Point = { x: number; y: number }
type Point3D = { x: number; y: number; z: number }

const CATEGORY_DESC: Record<string, string> = {
  '20sF': 'Korean woman in her early 20s, sharp distinct facial features, porcelain clear skin, bright expressive eyes, high nose bridge, defined lips',
  '20sM': 'Korean man in his early 20s, sharp defined jawline, high nose bridge, clear skin, intense focused eyes',
  '30sF': 'Korean woman in her early 30s, refined elegant facial structure, smooth even skin, almond-shaped eyes, well-defined nose, calm expressive lips',
  '30sM': 'Korean man in his early 30s, angular defined features, clear skin, deep-set calm eyes, strong nose bridge',
  '40sF': 'Korean woman in her early 40s, graceful mature facial structure, firm smooth skin, poised almond eyes, defined cheekbones',
  '40sM': 'Korean man in his early 40s, strong angular mature features, clear skin, deep composed eyes, prominent jawline',
  '50sF': 'Korean woman in her early 50s, dignified mature facial structure, refined skin, serene eyes, defined cheekbones and jawline',
  '50sM': 'Korean man in his early 50s, authoritative mature features, deep-set eyes, prominent nose bridge, strong defined jaw',
}

const CATEGORY_CELEBRITY_REF: Record<string, string[]> = {
  '20sF': ['Suzy', 'Karina', 'Go Youn-jung'],
  '20sM': ['Cha Eun-woo', 'Park Bo-gum', 'Byeon Woo-seok'],
  '30sF': ['Han So-hee', 'Son Ye-jin', 'Jun Ji-hyun'],
  '30sM': ['Gong Yoo', 'Hyun Bin', 'Park Seo-joon'],
  '40sF': ['Song Hye-kyo', 'Kim Hee-ae', 'Jun Ji-hyun'],
  '40sM': ['Lee Dong-wook', 'So Ji-sub', 'Jung Woo-sung'],
  '50sF': ['Kim Hye-soo', 'Go Hyun-jung', 'Lee Young-ae'],
  '50sM': ['Lee Byung-hun', 'Jung Jae-young', 'Hwang Jung-min'],
}

const EXPRESSION_CELEBRITY_REF: Record<string, string[]> = {
  '무표정': ['Go Youn-jung', 'Cha Eun-woo'],
  '옅은 미소': ['Son Ye-jin', 'Park Bo-gum'],
  '자연스러운 미소': ['Suzy', 'Park Min-young'],
}

function buildFluxCelebrityReference(category: string, facialExpression: string): string {
  const names = [
    ...(CATEGORY_CELEBRITY_REF[category] ?? []),
    ...(EXPRESSION_CELEBRITY_REF[facialExpression] ?? []),
  ]

  const uniqueNames = [...new Set(names)].slice(0, 4)
  return uniqueNames.join(', ')
}

// ── canvas helpers ────────────────────────────────────────────────
function averagePoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0.5, y: 0.5 }
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length }
}
function landmarkPoint(lm: Point3D | undefined): Point | null {
  if (!lm) return null
  return { x: lm.x, y: lm.y }
}
function landmarkAverage(landmarks: Point3D[], indices: number[]): Point {
  return averagePoint(
    indices.map((i) => landmarkPoint(landmarks[i])).filter((p): p is Point => p !== null)
  )
}
function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    const intersects = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || Number.EPSILON) + xi)
    if (intersects) inside = !inside
  }
  return inside
}
function projectPointInsidePolygon(point: Point | null, polygon: Point[] | null, insetRatio = 0.15): Point {
  if (!point) return { x: 0.5, y: 0.5 }
  if (!polygon || polygon.length === 0) return point
  if (pointInPolygon(point, polygon)) return point
  let minDist = Infinity
  let closest: Point = polygon[0]
  for (const v of polygon) {
    const d = Math.hypot(v.x - point.x, v.y - point.y)
    if (d < minDist) { minDist = d; closest = v }
  }
  const center = averagePoint(polygon)
  return {
    x: closest.x + (center.x - closest.x) * insetRatio,
    y: closest.y + (center.y - closest.y) * insetRatio,
  }
}
function drawMaskOverlay(
  ctx: CanvasRenderingContext2D,
  maskData: Uint8Array,
  srcW: number,
  srcH: number,
  fillColor: [number, number, number, number],
) {
  const overlay = document.createElement('canvas')
  overlay.width = srcW; overlay.height = srcH
  const oc = overlay.getContext('2d')!
  const od = oc.createImageData(srcW, srcH)
  for (let i = 0; i < maskData.length; i++) {
    if (maskData[i] !== 1) continue
    const px = i * 4
    od.data[px] = fillColor[0]; od.data[px + 1] = fillColor[1]
    od.data[px + 2] = fillColor[2]; od.data[px + 3] = fillColor[3]
  }
  oc.putImageData(od, 0, 0)
  ctx.save(); ctx.imageSmoothingEnabled = false
  ctx.drawImage(overlay, 0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.restore()
}
function drawPolygonStroke(ctx: CanvasRenderingContext2D, pts: Point[], W: number, H: number, color: string) {
  if (pts.length < 3) return
  ctx.save(); ctx.beginPath()
  pts.forEach((p, i) => {
    const x = p.x * W, y = p.y * H
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  })
  ctx.closePath(); ctx.strokeStyle = color; ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore()
}
function drawLine(ctx: CanvasRenderingContext2D, from: Point, to: Point, W: number, H: number, color: string, width = 2) {
  ctx.save(); ctx.beginPath()
  ctx.moveTo(from.x * W, from.y * H); ctx.lineTo(to.x * W, to.y * H)
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'
  ctx.stroke(); ctx.restore()
}
function drawAnchor(ctx: CanvasRenderingContext2D, point: Point, W: number, H: number, color: string, radius = 5) {
  ctx.save(); ctx.beginPath()
  ctx.arc(point.x * W, point.y * H, radius, 0, Math.PI * 2)
  ctx.fillStyle = color; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore()
}
function dilateMask(maskData: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return new Uint8Array(maskData)
  const out = new Uint8Array(maskData.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let on = false
      outer: for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy; if (ny < 0 || ny >= height) continue
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx; if (nx < 0 || nx >= width) continue
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
        const ny = y + dy; if (ny < 0 || ny >= height) { keepOn = false; break }
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx; if (nx < 0 || nx >= width) { keepOn = false; break outer }
          if (dx * dx + dy * dy > radius * radius) continue
          if (maskData[ny * width + nx] !== 1) { keepOn = false; break outer }
        }
      }
      if (keepOn) out[y * width + x] = 1
    }
  }
  return out
}
async function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img); img.onerror = reject; img.src = src
  })
}

async function createEditMaskFile(
  faceMaskData: Uint8Array,
  hairMaskData: Uint8Array | null,
  width: number,
  height: number,
): Promise<File> {
  const inset = erodeMask(faceMaskData, width, height, 10)
  const editable = dilateMask(inset, width, height, 4)
  const hairLock = hairMaskData ? dilateMask(hairMaskData, width, height, 3) : null
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(width, height)
  for (let i = 0; i < faceMaskData.length; i++) {
    const px = i * 4
    const isHairLock = hairLock ? hairLock[i] === 1 : false
    const isEditable = editable[i] === 1 && !isHairLock
    img.data[px] = img.data[px + 1] = img.data[px + 2] = 255
    img.data[px + 3] = isEditable ? 0 : 255
  }
  ctx.putImageData(img, 0, 0)
  return new Promise<File>((resolve) =>
    canvas.toBlob((blob) => resolve(new File([blob!], 'face-edit-mask.png', { type: 'image/png' })), 'image/png')
  )
}

async function createConstraintImageFile(
  originalFile: File,
  landmarks: Point3D[],
  faceMaskData: Uint8Array | null,
  hairMaskData: Uint8Array | null,
  segW: number,
  segH: number,
  facePolygon: Point[] | null,
  hairPolygon: Point[] | null,
): Promise<File> {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(originalFile)
  })
  const originalImg = await loadImageEl(src)
  const width = originalImg.naturalWidth
  const height = originalImg.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height)

  if (faceMaskData && faceMaskData.length > 0 && segW > 0 && segH > 0)
    drawMaskOverlay(ctx, faceMaskData, segW, segH, [56, 189, 248, 64])
  if (hairMaskData && hairMaskData.length > 0 && segW > 0 && segH > 0)
    drawMaskOverlay(ctx, hairMaskData, segW, segH, [249, 115, 22, 64])

  if (facePolygon && facePolygon.length >= 3) {
    drawPolygonStroke(ctx, facePolygon, width, height, '#38bdf8')
    drawPolygonStroke(ctx, facePolygon, width, height, '#38bdf8')
    drawPolygonStroke(ctx, facePolygon, width, height, '#38bdf8')
  }
  if (hairPolygon && hairPolygon.length >= 3) {
    drawPolygonStroke(ctx, hairPolygon, width, height, '#f97316')
    drawPolygonStroke(ctx, hairPolygon, width, height, '#f97316')
  }

  if (landmarks.length > 0) {
    const leftEye   = landmarkAverage(landmarks, LEFT_EYE_INDICES)
    const rightEye  = landmarkAverage(landmarks, RIGHT_EYE_INDICES)
    const nose      = landmarkAverage(landmarks, NOSE_INDICES)
    const mouth     = landmarkAverage(landmarks, MOUTH_INDICES)
    const faceTop    = landmarkPoint(landmarks[FACE_AXIS_TOP]) ?? nose
    const faceBottom = landmarkPoint(landmarks[FACE_AXIS_BOTTOM]) ?? mouth
    const cLE  = projectPointInsidePolygon(leftEye, facePolygon)
    const cRE  = projectPointInsidePolygon(rightEye, facePolygon)
    const cN   = projectPointInsidePolygon(nose, facePolygon)
    const cM   = projectPointInsidePolygon(mouth, facePolygon)
    const cFT  = projectPointInsidePolygon(faceTop, facePolygon)
    const cFB  = projectPointInsidePolygon(faceBottom, facePolygon)

    drawLine(ctx, cLE, cRE, width, height, '#ffffff', 3)
    drawLine(ctx, cFT, cFB, width, height, '#22d3ee', 3)
    drawLine(ctx, cLE, cN, width, height, '#a3e635', 2.5)
    drawLine(ctx, cRE, cN, width, height, '#a3e635', 2.5)
    drawLine(ctx, cN, cM, width, height, '#f472b6', 2.5)
    drawAnchor(ctx, cLE, width, height, '#00e5ff', 6)
    drawAnchor(ctx, cRE, width, height, '#ff9800', 6)
    drawAnchor(ctx, cN, width, height, '#ffffff', 6)
    drawAnchor(ctx, cM, width, height, '#e040fb', 6)
  }

  return new Promise<File>((resolve) =>
    canvas.toBlob((blob) => resolve(new File([blob!], 'face-constraint.png', { type: 'image/png' })), 'image/png')
  )
}

// ── component ──────────────────────────────────────────────────────
type SynthStatus = 'idle' | 'running' | 'done' | 'error'
const LOADING_PHASE_2_MS = 3000
const LOADING_PHASE_3_MS = 6000

async function getOrigDims(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.src = url
  })
}

export default function GeneratePage() {
  const router = useRouter()
  const {
    originalPhoto,
    category,
    skinExpression,
    facialExpression,
    fluxMaskDataUrl,
    faceMaskDataUrl,
    hairMaskDataUrl,
    segW,
    segH,
    landmarks,
    segPolygon,
    hairPolygon,
    setCharacterDataUrl,
    setGptCharacterDataUrl,
    setResultImage,
    totalRegenCount,
    incrementRegenCount,
    resetRegenCount,
  } = useSelectionStore()

  const [fluxStatus, setFluxStatus] = useState<SynthStatus>('idle')
  const [gptStatus, setGptStatus] = useState<SynthStatus>('idle')
  const [fluxResult, setFluxResult] = useState<string | null>(null)
  const [gptResult, setGptResult] = useState<string | null>(null)
  const [fluxHistory, setFluxHistory] = useState<string[]>([])
  const [gptHistory, setGptHistory] = useState<string[]>([])
  const [showPaywall, setShowPaywall] = useState(false)
  const [selectedFluxUrl, setSelectedFluxUrl] = useState<string | null>(null)
  const [selectedGptUrl, setSelectedGptUrl] = useState<string | null>(null)
  const [fluxError, setFluxError] = useState<string | null>(null)
  const [gptError, setGptError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'natural' | 'vivid'>('vivid')
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const hasAutoStartedRef = useRef(false)

  useEffect(() => {
    if (!originalPhoto || !fluxMaskDataUrl) router.replace('/')
  }, [originalPhoto, fluxMaskDataUrl, router])

  const isRunning = fluxStatus === 'running' || gptStatus === 'running'
  const isDone = !isRunning && fluxStatus !== 'idle' && gptStatus !== 'idle'
  const isInitialLoading = (fluxHistory.length === 0 || gptHistory.length === 0) && isRunning
  const activeStatus = activeTab === 'natural' ? fluxStatus : gptStatus
  const activeResult = activeTab === 'natural' ? fluxResult : gptResult
  const activeError = activeTab === 'natural' ? fluxError : gptError
  const activeHistory = activeTab === 'natural' ? fluxHistory : gptHistory
  const activeIsRunning = activeStatus === 'running'
  const activeSelectedUrl = activeTab === 'natural' ? selectedFluxUrl : selectedGptUrl
  const regenCount = totalRegenCount ?? 0
  const regenRemaining = Math.max(0, 3 - regenCount)

  const loadingMessages = ['닮은 얼굴 탐색 중', 'AI 초안 생성 중', '디테일 정리 중']

  // ── Natural: FLUX.2 klein 9B (독립 실행 가능) ─────────────────────
  const runFlux = useCallback(async () => {
    if (!originalPhoto || !fluxMaskDataUrl) return
    setFluxStatus('running')
    setFluxResult(null)
    setFluxError(null)
    setCharacterDataUrl(null)
    try {
      const origDims = await getOrigDims(originalPhoto)
      const SKIN_EN: Record<string, string> = { '맑은': 'porcelain clear skin texture', '보송한': 'matte soft skin texture', '윤기 있는': 'glossy luminous skin texture', '매끈한': 'smooth even skin texture' }
      const EXPR_EN: Record<string, string> = { '무표정': 'neutral relaxed expression', '옅은 미소': 'slight gentle smile', '자연스러운 미소': 'natural relaxed smile' }
      const catDesc = CATEGORY_DESC[category] ?? 'Korean person'
      const celebrityRef = buildFluxCelebrityReference(category, facialExpression)
      const styleTokens = [SKIN_EN[skinExpression] ?? skinExpression, EXPR_EN[facialExpression] ?? facialExpression].filter(Boolean).join(', ')
      const fluxPrompt = [
        `Use the first image as the original composition reference.`,
        `Use the second image as the masked face editing guide.`,
        `Replace only the masked facial region with a hyper-realistic close-up portrait of ${catDesc}, with facial identity inspired by ${celebrityRef}.`,
        `The edited face should have ${styleTokens}.`,
        `Keep the original hair, hairline, background, camera angle, framing, and lighting direction.`,
        `Preserve realistic skin texture, visible pores, seamless blending, and natural facial detail.`,
      ].join(' ')
      const [squareOriginal, squareMaskGuide] = await Promise.all([
        squareFile(originalPhoto, 'step3-original.png'),
        squareFile(dataUrlToFile(fluxMaskDataUrl, 'step3-flux-mask-guide.png'), 'step3-flux-mask-guide.png', '#000000'),
      ])
      const fd = new FormData()
      fd.append('image', squareOriginal.file)
      fd.append('original_ref', squareMaskGuide.file)
      fd.append('prompt', fluxPrompt)
      const response = await fetch('/api/flux-fill', { method: 'POST', body: fd })
      const payload = await response.json() as Record<string, unknown>
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'FLUX 합성 실패')
      const outputUrl = typeof payload.outputUrl === 'string' ? payload.outputUrl : null
      if (!outputUrl) throw new Error('FLUX 생성 결과가 비어 있습니다')
      const cropped = await cropToOriginalAspect(outputUrl, origDims.w, origDims.h)
      setFluxResult(cropped)
      setFluxHistory(prev => [...prev, cropped])
      setSelectedFluxUrl(cropped)
      setCharacterDataUrl(cropped)
      setFluxStatus('done')
    } catch (e) {
      setFluxStatus('error')
      setFluxError(e instanceof Error ? e.message : 'FLUX 합성 실패')
    }
  }, [originalPhoto, fluxMaskDataUrl, category, skinExpression, facialExpression, setCharacterDataUrl])

  // ── Vivid: GPT image-1.5 (독립 실행 가능) ────────────────────────
  const runGpt = useCallback(async () => {
    if (!originalPhoto || !faceMaskDataUrl || !landmarks || landmarks.length === 0) return
    setGptStatus('running')
    setGptResult(null)
    setGptError(null)
    setGptCharacterDataUrl(null)
    try {
      const origDims = await getOrigDims(originalPhoto)
      const catDesc = CATEGORY_DESC[category] ?? 'Korean person, natural expression'
      const faceMaskData = await loadBinaryMask(faceMaskDataUrl, segW, segH)
      const hairMaskData = hairMaskDataUrl ? await loadBinaryMask(hairMaskDataUrl, segW, segH) : null
      const [maskFile, constraintFile] = await Promise.all([
        createEditMaskFile(faceMaskData, hairMaskData, segW, segH),
        createConstraintImageFile(originalPhoto, landmarks, faceMaskData, hairMaskData, segW, segH, segPolygon, hairPolygon),
      ])
      const [squareOriginal, squareConstraint, squareMask] = await Promise.all([
        squareFile(originalPhoto, 'step3-original-square.png'),
        squareFile(constraintFile, 'step3-constraint-square.png'),
        squareFile(maskFile, 'step3-mask-square.png', '#ffffff'),
      ])
      const guidePrompt = [
        `CRITICAL RULE — hair lock: The orange region in image 2 is a hard pixel-level boundary. The generated face must not touch, overlap, or bleed into any orange pixel.`,
        `Image 1 is the original photo. Image 2 is a geometry constraint map. Edit only the transparent masked face region in image 1 and transform the person's identity into a distinctly different photorealistic ${catDesc} face.`,
        `The cyan region in image 2 is the permitted face area. All generated facial features must stay fully inside the cyan boundary and must not cross into the orange hair region.`,
        `Make the identity clearly and noticeably different. Change age impression, eye shape, nose shape, mouth shape, and overall facial character.`,
        `Image 2 is a non-visible guide only. Do not render any cyan or orange fills, contours, dots, or guide marks in the final image.`,
        `Preserve the existing hair silhouette, hairline, neck, ears, skin tone, camera perspective, and background exactly.`,
      ].join(' ')
      const fd = new FormData()
      fd.append('original', squareOriginal.file)
      fd.append('constraint', squareConstraint.file)
      fd.append('mask', squareMask.file)
      fd.append('prompt', guidePrompt)
      const response = await fetch('/api/gpt-synth', { method: 'POST', body: fd })
      const payload = await response.json() as Record<string, unknown>
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'GPT 합성 실패')
      const b64 = typeof payload.b64 === 'string' ? payload.b64 : null
      if (!b64) throw new Error('GPT 생성 결과가 비어 있습니다')
      const dataUrl = `data:image/png;base64,${b64}`
      const cropped = await cropToOriginalAspect(dataUrl, origDims.w, origDims.h)
      setGptResult(cropped)
      setGptHistory(prev => [...prev, cropped])
      setSelectedGptUrl(cropped)
      setGptCharacterDataUrl(cropped)
      setGptStatus('done')
    } catch (e) {
      setGptStatus('error')
      setGptError(e instanceof Error ? e.message : 'GPT 합성 실패')
    }
  }, [originalPhoto, faceMaskDataUrl, hairMaskDataUrl, segW, segH, landmarks, segPolygon, hairPolygon, category, setGptCharacterDataUrl])

  const runBothSyntheses = useCallback(async () => {
    if (!originalPhoto) return
    setResultImage(null)
    await Promise.all([runFlux(), runGpt()])
  }, [originalPhoto, runFlux, runGpt, setResultImage])

  useEffect(() => {
    if (hasAutoStartedRef.current || !originalPhoto) return
    hasAutoStartedRef.current = true
    void runBothSyntheses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    document.body.style.overflow = isInitialLoading ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isInitialLoading])

  useEffect(() => {
    if (!isInitialLoading) { setLoadingProgress(0); return }
    setLoadingProgress(0)
    const id = setInterval(() => {
      setLoadingProgress(p => Math.min(90, p + Math.max(0.4, (90 - p) * 0.025)))
    }, 150)
    return () => clearInterval(id)
  }, [isInitialLoading])

  useEffect(() => {
    if (!isInitialLoading) { setLoadingMessageIndex(0); return }
    setLoadingMessageIndex(0)
    const t1 = window.setTimeout(() => setLoadingMessageIndex(1), LOADING_PHASE_2_MS)
    const t2 = window.setTimeout(() => setLoadingMessageIndex(2), LOADING_PHASE_3_MS)
    return () => { window.clearTimeout(t1); window.clearTimeout(t2) }
  }, [isInitialLoading])

  const handleRegenFlux = useCallback(() => {
    if (totalRegenCount >= 3) { setShowPaywall(true); return }
    incrementRegenCount()
    void runFlux()
  }, [totalRegenCount, incrementRegenCount, runFlux])

  const handleRegenGpt = useCallback(() => {
    if (totalRegenCount >= 3) { setShowPaywall(true); return }
    incrementRegenCount()
    void runGpt()
  }, [totalRegenCount, incrementRegenCount, runGpt])

  const handleActiveRegen = activeTab === 'natural' ? handleRegenFlux : handleRegenGpt

  const handleNext = () => router.push('/model-detail')

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
              AI 초안 재설정을 3회 모두 사용했어요.<br />
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

      {/* 초기 로딩 오버레이 */}
      {isInitialLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-8">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl flex flex-col gap-4">
            <p className="text-sm font-bold text-stone-900 text-center">AI 초안 생성 중</p>
            <p className="text-xs text-stone-400 text-center">{loadingMessages[loadingMessageIndex]}</p>
            <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${loadingProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 pt-10 pb-32 px-6 flex flex-col gap-6">
        <StepHeader step={3} total={4} label="STEP 03" />
        <h1 className="text-2xl font-bold tracking-tight text-stone-950">AI 초안을<br />확인합니다</h1>

        {(isRunning || isDone) && (
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
              <span className="text-sm font-bold text-stone-900">AI 초안</span>
              <span className="text-xs font-medium text-stone-400">재설정 {regenCount}/3</span>
            </div>

            {/* 메인 이미지 */}
            {activeSelectedUrl ? (
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[8px] bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="AI 초안" className="h-full w-full object-cover" src={activeSelectedUrl} />
                <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold text-stone-700 backdrop-blur-sm">
                  AI 초안
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
                        onClick={() => activeTab === 'natural' ? setSelectedFluxUrl(url) : setSelectedGptUrl(url)}
                        className={`relative block w-full overflow-hidden rounded-[8px] transition-all ${
                          url === activeSelectedUrl ? 'opacity-100' : 'opacity-40'
                        }`}
                        style={{ aspectRatio: '2/3' }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={`AI 초안 ${i + 1}`} className="h-full w-full object-cover" src={url} />
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
          </>
        )}
      </main>

      {!isInitialLoading && !showPaywall && (
        <BottomCta
          label="최종이미지 만들기"
          onClick={handleNext}
          secondary={{ label: '이전', onClick: () => router.back() }}
          variant="primary"
          disabled={!isDone || (!fluxResult && !gptResult)}
        />
      )}
    </PageShell>
  )
}
