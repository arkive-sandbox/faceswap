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
  const mimeMatch = arr[0].match(/:(.*?);/)
  if (!mimeMatch) throw new Error('Invalid data URL passed to dataUrlToFile')
  const mime = mimeMatch[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new File([u8arr], name, { type: mime })
}

export async function trimDataUrlPadding(
  dataUrl: string,
  options?: {
    threshold?: number
    target?: { r: number; g: number; b: number }
    inset?: number
  },
): Promise<string> {
  const img = await loadImageEl(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const threshold = options?.threshold ?? 18
  const target = options?.target ?? { r: 255, g: 255, b: 255 }
  const inset = options?.inset ?? 0

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = (y * width + x) * 4
      const alpha = data[px + 3]
      if (alpha === 0) continue

      const dr = Math.abs(data[px] - target.r)
      const dg = Math.abs(data[px + 1] - target.g)
      const db = Math.abs(data[px + 2] - target.b)
      const isPadding = dr <= threshold && dg <= threshold && db <= threshold
      if (isPadding) continue

      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX < minX || maxY < minY) return dataUrl

  minX = Math.max(0, minX - inset)
  minY = Math.max(0, minY - inset)
  maxX = Math.min(width - 1, maxX + inset)
  maxY = Math.min(height - 1, maxY + inset)

  const cropWidth = maxX - minX + 1
  const cropHeight = maxY - minY + 1
  if (cropWidth === width && cropHeight === height) return dataUrl

  const out = document.createElement('canvas')
  out.width = cropWidth
  out.height = cropHeight
  const outCtx = out.getContext('2d')!
  outCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
  return out.toDataURL('image/png')
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

// ── Polygon utilities ──────────────────────────────────────────────

function convexHull(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  if (pts.length < 3) return pts
  const sorted = [...pts].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y)
  const cross = (o: typeof pts[0], a: typeof pts[0], b: typeof pts[0]) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: typeof pts = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: typeof pts = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) upper.pop()
    upper.push(sorted[i])
  }
  upper.pop(); lower.pop()
  return [...lower, ...upper]
}

/**
 * binary mask(Uint8Array)로부터 경계 픽셀을 추출하고 convex hull로 polygon을 만든다.
 * 반환값 좌표는 [0,1] 정규화.
 */
export function extractClassBoundaryPolygon(data: Uint8Array, W: number, H: number): { x: number; y: number }[] {
  const boundary: { x: number; y: number }[] = []
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x
      if (data[i] !== 1) continue
      if (data[(y - 1) * W + x] !== 1 || data[(y + 1) * W + x] !== 1 ||
          data[y * W + (x - 1)] !== 1 || data[y * W + (x + 1)] !== 1)
        boundary.push({ x: x / W, y: y / H })
    }
  }
  return boundary.length === 0 ? [] : convexHull(boundary)
}

/**
 * 원본 이미지에서 특정 마스크 영역만 남기고 나머지는 흰색으로 채운 참조 이미지를 만든다.
 * flux-2-pro의 input_images 참조용.
 */
export async function createMaskedReferenceFile(
  originalFile: File,
  maskData: Uint8Array,
  segW: number,
  segH: number,
  filename: string,
): Promise<File> {
  const src = await fileToDataUrl(originalFile)
  const img = await loadImageEl(src)
  const W = img.naturalWidth
  const H = img.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
  ctx.drawImage(img, 0, 0)

  const imageData = ctx.getImageData(0, 0, W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const maskX = Math.min(segW - 1, Math.floor((x / W) * segW))
      const maskY = Math.min(segH - 1, Math.floor((y / H) * segH))
      if (maskData[maskY * segW + maskX] !== 1) {
        const px = (y * W + x) * 4
        imageData.data[px] = imageData.data[px + 1] = imageData.data[px + 2] = 255
        imageData.data[px + 3] = 255
      }
    }
  }
  ctx.putImageData(imageData, 0, 0)

  return new Promise<File>((resolve) =>
    canvas.toBlob((blob) => resolve(new File([blob!], filename, { type: 'image/png' })), 'image/png')
  )
}

/**
 * flux-fill-pro용 선처리: 원본 이미지에서 flux 마스크(흰색=편집 영역)에 해당하는
 * 픽셀을 완전 검정으로 지워 반환한다.
 * 마스크 아래 원본 얼굴 픽셀을 제거해 모델이 원본 특징을 참조하지 못하게 한다.
 */
export async function eraseFluxMaskRegion(
  originalFile: File,
  fluxMaskDataUrl: string,
): Promise<File> {
  const [origSrc, maskEl] = await Promise.all([
    fileToDataUrl(originalFile),
    loadImageEl(fluxMaskDataUrl),
  ])
  const origEl = await loadImageEl(origSrc)
  const W = origEl.naturalWidth
  const H = origEl.naturalHeight

  // 마스크를 원본 해상도로 렌더링
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = W; maskCanvas.height = H
  const maskCtx = maskCanvas.getContext('2d')!
  maskCtx.drawImage(maskEl, 0, 0, W, H)
  const maskData = maskCtx.getImageData(0, 0, W, H)

  // 원본 복사 후 마스크 흰색 영역 검정 처리
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(origEl, 0, 0)
  const imageData = ctx.getImageData(0, 0, W, H)
  for (let i = 0; i < W * H; i++) {
    const px = i * 4
    // 마스크 픽셀이 흰색(R>127)이면 원본 픽셀을 검정으로
    if (maskData.data[px] > 127) {
      imageData.data[px] = imageData.data[px + 1] = imageData.data[px + 2] = 0
      imageData.data[px + 3] = 255
    }
  }
  ctx.putImageData(imageData, 0, 0)

  return new Promise<File>((resolve) =>
    canvas.toBlob((blob) => resolve(new File([blob!], 'erased.png', { type: 'image/png' })), 'image/png')
  )
}

/**
 * 이미지 파일을 정사각형으로 크롭하고 File + src + size를 반환한다.
 */
export function squareFile(
  file: File,
  name: string,
  background = '#000000',
  mode: 'pad' | 'crop' = 'pad',
): Promise<SquareAsset> {
  return fileToDataUrl(file).then(
    (src) =>
      new Promise<SquareAsset>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          const { naturalWidth: w, naturalHeight: h } = img
          const size = mode === 'crop' ? Math.min(w, h) : Math.max(w, h)
          const canvas = document.createElement('canvas')
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')!
          if (mode === 'crop') {
            const offsetX = (w - size) / 2
            const offsetY = (h - size) / 2
            ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size)
          } else {
            ctx.fillStyle = background
            ctx.fillRect(0, 0, size, size)
            const offsetX = (size - w) / 2
            const offsetY = (size - h) / 2
            ctx.drawImage(img, offsetX, offsetY, w, h)
          }
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

/**
 * squareFile('pad') 로 정사각형 패딩 처리한 뒤 모델이 반환한 정사각형 결과를
 * 원본 비율로 역크롭한다.
 * 출력 해상도가 입력과 다른 경우(모델이 내부적으로 리사이즈)도 비율로 처리.
 */
export async function cropToOriginalAspect(
  squaredDataUrl: string,
  origW: number,
  origH: number,
): Promise<string> {
  if (origW === origH) return squaredDataUrl
  const img = await loadImageEl(squaredDataUrl)
  const squareSize = img.naturalWidth
  const maxDim = Math.max(origW, origH)
  const scale = squareSize / maxDim
  const cropW = Math.round(origW * scale)
  const cropH = Math.round(origH * scale)
  const offsetX = Math.round((squareSize - cropW) / 2)
  const offsetY = Math.round((squareSize - cropH) / 2)
  const canvas = document.createElement('canvas')
  canvas.width = cropW
  canvas.height = cropH
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, offsetX, offsetY, cropW, cropH, 0, 0, cropW, cropH)
  return canvas.toDataURL('image/png')
}
