import OpenAI from 'openai'
import { createFaceLandmarkSkeletonFile, createFaceMask, createHairlineGuideFile, extractHairMask, getFaceLandmarkPoints, insetFaceOvalPoints } from '@/lib/faceBlur'
import { trimDataUrlPadding } from '@/lib/segmentation'

function getClient() {
  return new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? '', dangerouslyAllowBrowser: true })
}

const CATEGORY_PROMPTS_EN: Record<string, string> = {
  '20sF': 'Korean woman in her 20s, natural makeup, bright skin tone',
  '20sM': 'Korean man in his 20s, clean style',
  '30sF': 'Korean woman in her 30s, sophisticated, natural smile',
  '30sM': 'Korean man in his 30s, intellectual look',
  '40sF': 'Korean woman in her 40s, elegant and mature',
  '40sM': 'Korean man in his 40s, distinguished look',
  '50sF': 'Korean woman in her 50s, dignified beauty',
  '50sM': 'Korean man in his 50s, trustworthy appearance',
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

const ANGLE_PROMPTS: Record<string, string> = {
  center: '카메라를 정면으로 바라보는, 정면 시선',
  n:      '고개를 살짝 위로 들어 위를 바라보는',
  s:      '고개를 살짝 아래로 내려 아래를 바라보는',
  e:      '오른쪽을 바라보는 측면 시선',
  w:      '왼쪽을 바라보는 측면 시선',
  ne:     '오른쪽 위를 바라보는 시선',
  nw:     '왼쪽 위를 바라보는 시선',
  se:     '오른쪽 아래를 바라보는 시선',
  sw:     '왼쪽 아래를 바라보는 시선',
}

const ANGLE_VIEW_HINTS_EN: Record<string, string> = {
  center: 'a frontal face view',
  n: 'a frontal face view with the chin slightly raised',
  s: 'a frontal face view with the chin slightly lowered',
  e: 'a right-facing side profile',
  w: 'a left-facing side profile',
  ne: 'a right-facing three-quarter view angled upward',
  nw: 'a left-facing three-quarter view angled upward',
  se: 'a right-facing three-quarter view angled downward',
  sw: 'a left-facing three-quarter view angled downward',
}

function buildFaceStylePromptEn(skinExpression?: string, makeupIntensity?: string, facialExpression?: string) {
  const parts = [
    skinExpression ? `${skinExpression.toLowerCase()} skin expression` : null,
    makeupIntensity ? `${makeupIntensity.toLowerCase()} makeup` : null,
    facialExpression ? facialExpression.toLowerCase() : null,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(', ') : null
}

async function resizeToSquare(file: File, size = 512): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight)
      const drawWidth = img.naturalWidth * scale
      const drawHeight = img.naturalHeight * scale
      const dx = (size - drawWidth) / 2
      const dy = (size - drawHeight) / 2

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, dx, dy, drawWidth, drawHeight)
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('resize failed')); return }
        resolve(new File([blob], 'resized.png', { type: 'image/png' }))
      }, 'image/png')
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

async function createFullMask(size = 512): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    // 빈 캔버스 = 완전 투명 = 전체 영역 regenerate
    canvas.toBlob((blob) => {
      resolve(new File([blob!], 'mask.png', { type: 'image/png' }))
    }, 'image/png')
  })
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function restoreOriginalHairTexture(
  originalPhoto: File,
  editedImageDataUrl: string,
  blurPx = 10
): Promise<string> {
  const originalSrc = await fileToDataUrl(originalPhoto)
  const hairMaskSrc = await extractHairMask(originalSrc)
  const [originalImg, editedImg, hairMaskImg] = await Promise.all([
    loadImage(originalSrc),
    loadImage(editedImageDataUrl),
    loadImage(hairMaskSrc),
  ])

  const width = originalImg.naturalWidth
  const height = originalImg.naturalHeight

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = width
  outputCanvas.height = height
  const outputCtx = outputCanvas.getContext('2d')!
  outputCtx.drawImage(editedImg, 0, 0, width, height)

  const blurredMaskCanvas = document.createElement('canvas')
  blurredMaskCanvas.width = width
  blurredMaskCanvas.height = height
  const blurredMaskCtx = blurredMaskCanvas.getContext('2d')!
  blurredMaskCtx.filter = `blur(${blurPx}px)`
  blurredMaskCtx.drawImage(hairMaskImg, 0, 0, width, height)

  const restoredHairCanvas = document.createElement('canvas')
  restoredHairCanvas.width = width
  restoredHairCanvas.height = height
  const restoredHairCtx = restoredHairCanvas.getContext('2d')!
  restoredHairCtx.drawImage(originalImg, 0, 0, width, height)
  restoredHairCtx.globalCompositeOperation = 'destination-in'
  restoredHairCtx.drawImage(blurredMaskCanvas, 0, 0, width, height)

  outputCtx.drawImage(restoredHairCanvas, 0, 0)
  return outputCanvas.toDataURL('image/png')
}

function getBounds(points: { x: number; y: number }[]) {
  if (points.length === 0) return null
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
    centerY: (Math.min(...ys) + Math.max(...ys)) / 2,
  }
}

async function alignReferenceFaceToOriginalCanvas(
  sourceImageDataUrl: string,
  originalPhoto: File,
  originalFacePoints: { x: number; y: number }[]
): Promise<File | null> {
  const originalBounds = getBounds(originalFacePoints)
  if (!originalBounds) return null

  const [sourceFacePoints, originalSrc] = await Promise.all([
    getFaceLandmarkPoints(sourceImageDataUrl),
    fileToDataUrl(originalPhoto),
  ])
  const sourceBounds = getBounds(sourceFacePoints)
  if (!sourceBounds) return null

  const [sourceImg, originalImg] = await Promise.all([
    loadImage(sourceImageDataUrl),
    loadImage(originalSrc),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = originalImg.naturalWidth
  canvas.height = originalImg.naturalHeight
  const ctx = canvas.getContext('2d')!

  const scaleX = originalBounds.width / sourceBounds.width
  const scaleY = originalBounds.height / sourceBounds.height
  const destWidth = sourceImg.naturalWidth * scaleX
  const destHeight = sourceImg.naturalHeight * scaleY
  const destX = originalBounds.centerX * canvas.width - sourceBounds.centerX * destWidth
  const destY = originalBounds.centerY * canvas.height - sourceBounds.centerY * destHeight

  ctx.drawImage(sourceImg, destX, destY, destWidth, destHeight)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('reference align failed'))
        return
      }
      resolve(new File([blob], 'reference-face-aligned.png', { type: 'image/png' }))
    }, 'image/png')
  })
}

// landmark 이미지를 pose reference로 사용해 AI 모델 이미지 생성
export async function generateFromLandmarks(
  category: string,
  landmarkFile: File,
  count = 1,
  guideType: 'skeleton' | 'hairline' = 'skeleton',
  referencePhoto?: File,
  angleHint = 'center',
  faceStyleOptions?: {
    skinExpression?: string
    makeupIntensity?: string
    facialExpression?: string
  }
): Promise<string[]> {
  const client = getClient()
  const categoryDesc = CATEGORY_PROMPTS_EN[category] ?? 'Korean person, natural expression'
  const viewHint = ANGLE_VIEW_HINTS_EN[angleHint] ?? ANGLE_VIEW_HINTS_EN.center
  const faceStylePrompt = buildFaceStylePromptEn(
    faceStyleOptions?.skinExpression,
    faceStyleOptions?.makeupIntensity,
    faceStyleOptions?.facialExpression
  )
  const combinedCategoryDesc = faceStylePrompt ? `${categoryDesc}, ${faceStylePrompt}` : categoryDesc

  const [squareLandmark, mask, squareReference] = await Promise.all([
    resizeToSquare(landmarkFile),
    createFullMask(),
    referencePhoto ? resizeToSquare(referencePhoto) : Promise.resolve(null),
  ])

  const prompt = guideType === 'hairline'
    ? `Create a photorealistic portrait of the same person shown in the first image, transformed into a ${combinedCategoryDesc}. Preserve the first image as the base identity: keep the same face proportions, head size, pose, camera angle, gaze direction, overall framing, and general facial layout. The output should keep ${viewHint}. Use the second image only as a hairline guide and match the outer head silhouette, forehead boundary, and hairline direction shown there. Keep a clean white background.`
    : `Create a photorealistic portrait of the same person shown in the first image, transformed into a ${combinedCategoryDesc}. Preserve the first image as the base identity: keep the same face proportions, head size, pose, camera angle, gaze direction, overall framing, and general facial layout. The output should keep ${viewHint}. Use the second image only as a facial landmark skeleton guide and match the face angle and facial feature placement shown there. Keep a clean white background.`

  const response = await client.images.edit({
    model: 'gpt-image-1',
    image: squareReference ? [squareReference, squareLandmark] : squareLandmark,
    mask,
    prompt,
    n: count,
    quality: 'low',
    size: 'auto',
  })

  return Promise.all(
    (response.data ?? []).map(async (img) => trimDataUrlPadding(`data:image/png;base64,${img.b64_json}`)),
  )
}

export async function generateImages(category: string, count: number, angle = 'center'): Promise<string[]> {
  const client = getClient()
  const categoryDesc = CATEGORY_PROMPTS[category] ?? '한국인, 자연스러운 표정'
  const angleDesc = ANGLE_PROMPTS[angle] ?? ANGLE_PROMPTS.center
  const prompt = `${angleDesc} 얼굴 사진, ${categoryDesc}, 흰 배경, 고화질 인물 사진, 클로즈업`

  const response = await client.images.generate({
    model: 'gpt-image-1',
    prompt,
    n: count,
    quality: 'low',
    size: '1024x1024',
  })

  return (response.data ?? []).map((img) => `data:image/png;base64,${img.b64_json}`)
}

export async function synthesizeFace(
  originalPhoto: File,
  sourceImageDataUrl: string,
  faceOvalPoints: { x: number; y: number }[],
  _category = '30sF'
): Promise<string> {
  void _category

  const client = getClient()
  // AI 모델 이미지(base64 data URL)를 Blob으로 변환
  const sourceBase64 = sourceImageDataUrl.split(',')[1]
  const sourceMime = sourceImageDataUrl.split(';')[0].replace('data:', '')
  const sourceBytes = Uint8Array.from(atob(sourceBase64), (c) => c.charCodeAt(0))
  const sourceFile = new File([new Blob([sourceBytes], { type: sourceMime })], 'reference-face.png', { type: sourceMime })
  const insetPoints = insetFaceOvalPoints(faceOvalPoints)
  const alignedSourceFile = await alignReferenceFaceToOriginalCanvas(
    sourceImageDataUrl,
    originalPhoto,
    insetPoints.length > 0 ? insetPoints : faceOvalPoints
  ).catch(() => null)
  const mask = await createFaceMask(originalPhoto, insetPoints.length > 0 ? insetPoints : faceOvalPoints)
  const originalStructureGuide = await createFaceLandmarkSkeletonFile(
    URL.createObjectURL(originalPhoto),
    insetPoints.length > 0 ? insetPoints : faceOvalPoints
  )
  const selectedModelStructureGuide = await createFaceLandmarkSkeletonFile(sourceImageDataUrl)
  const originalHairlineGuide = await createHairlineGuideFile(
    URL.createObjectURL(originalPhoto),
    faceOvalPoints
  )

  const response = await client.images.edit({
    model: 'gpt-image-1',
    image: [
      originalPhoto,
      alignedSourceFile ?? sourceFile,
      originalStructureGuide,
      originalHairlineGuide,
      selectedModelStructureGuide,
    ],
    mask,
    prompt: 'Edit only the central facial interior inside the mask on the first image. The final result must look natural, realistic, and seamlessly blended into the original photo. Preserve the original photo composition, background, hair, hairline, bangs, forehead boundary, temples, ears, clothing, lighting, skin texture outside the mask, and camera framing. Preserve the original gaze direction, eye alignment, eye openness, pupil direction, and overall eye focus of the first image. Use the second image as a strong reference for facial identity, facial features, feature shapes, and overall look. The face inside the mask should clearly resemble the second image while still fitting naturally into the first image. Use the third image as the original facial structure guide and preserve the first image facial proportions: eye size, eye spacing, nose width, nose length, mouth width, lip placement, and overall feature scale relative to the face. Use the fourth image as the hairline and upper-face boundary guide. Match the first image forehead boundary, hairline placement, temple transitions, upper face width, cheek contour, jawline width, chin curve, and lower-face silhouette. Use the fifth image as the selected model facial skeleton guide so the face outline, eye line, nose line, mouth placement, and lower-face shape stay sharper and closer to the chosen model. Avoid stylized or over-generated results. Keep the output photorealistic, subtle, and seamless.',
    input_fidelity: 'high',
    quality: 'medium',
    size: 'auto',
  })

  const image = response.data?.[0]?.b64_json
  if (!image) throw new Error('Synthesize failed: no image returned')
  return restoreOriginalHairTexture(originalPhoto, `data:image/png;base64,${image}`)
}
