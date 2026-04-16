import { ImageSegmenter, FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

export interface Point {
  x: number
  y: number
}

export interface FaceReferenceAnchors {
  leftEye: Point
  rightEye: Point
  noseTip: Point
  mouthCenter: Point
}

interface LandmarkGroup {
  key: string
  points: Point[]
  closed?: boolean
  strokeStyle: string
  fillStyle?: string
  lineWidth?: number
}

let segmenter: ImageSegmenter | null = null
let hairSegmenter: ImageSegmenter | null = null
let hairSegmenterPromise: Promise<ImageSegmenter> | null = null
let faceLandmarker: FaceLandmarker | null = null
let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null
let faceLandmarkerDelegate: 'GPU' | 'CPU' = 'GPU'

// 얼굴 윤곽선 랜드마크 인덱스 (MediaPipe face oval)
const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10,
]

const LEFT_EYEBROW_INDICES = [46, 53, 52, 65, 55]
const RIGHT_EYEBROW_INDICES = [276, 283, 282, 295, 285]
const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144, 33]
const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380, 362]
const NOSE_BRIDGE_INDICES = [168, 197, 195, 5, 4]
const NOSE_BASE_INDICES = [129, 98, 2, 327, 358]
const OUTER_LIPS_INDICES = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291,
  409, 270, 269, 267, 0, 37, 39, 40, 185, 61,
]
const INNER_LIPS_INDICES = [
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308,
  415, 310, 311, 312, 13, 82, 81, 80, 191, 78,
]

function averagePoints(points: Point[]): Point {
  return points.reduce(
    (acc, point) => ({
      x: acc.x + point.x / points.length,
      y: acc.y + point.y / points.length,
    }),
    { x: 0, y: 0 }
  )
}

function mapIndicesToPoints(landmarks: Point[], indices: number[]): Point[] {
  return indices
    .map((idx) => landmarks[idx])
    .filter((point): point is Point => Boolean(point))
    .map((point) => ({ x: point.x, y: point.y }))
}

export function buildFaceLandmarkGroups(landmarks?: Point[] | null, customFaceOval?: Point[]): LandmarkGroup[] {
  const groups: LandmarkGroup[] = []
  const faceOval = customFaceOval ?? (landmarks ? mapIndicesToPoints(landmarks, FACE_OVAL_INDICES) : [])

  if (faceOval.length > 1) {
    groups.push({
      key: 'faceOval',
      points: faceOval,
      closed: true,
      strokeStyle: 'rgba(255, 0, 122, 0.95)',
      fillStyle: 'rgba(255, 0, 122, 0.16)',
      lineWidth: 2.5,
    })
  }

  if (!landmarks) return groups

  const featureDefinitions: Array<{
    key: string
    indices: number[]
    closed?: boolean
    strokeStyle: string
    fillStyle?: string
    lineWidth?: number
  }> = [
    { key: 'leftEyebrow', indices: LEFT_EYEBROW_INDICES, strokeStyle: 'rgba(255, 179, 71, 0.95)', lineWidth: 2 },
    { key: 'rightEyebrow', indices: RIGHT_EYEBROW_INDICES, strokeStyle: 'rgba(255, 179, 71, 0.95)', lineWidth: 2 },
    { key: 'leftEye', indices: LEFT_EYE_INDICES, closed: true, strokeStyle: 'rgba(0, 229, 255, 0.95)', fillStyle: 'rgba(0, 229, 255, 0.12)', lineWidth: 2 },
    { key: 'rightEye', indices: RIGHT_EYE_INDICES, closed: true, strokeStyle: 'rgba(0, 229, 255, 0.95)', fillStyle: 'rgba(0, 229, 255, 0.12)', lineWidth: 2 },
    { key: 'noseBridge', indices: NOSE_BRIDGE_INDICES, strokeStyle: 'rgba(255, 255, 255, 0.95)', lineWidth: 2 },
    { key: 'noseBase', indices: NOSE_BASE_INDICES, strokeStyle: 'rgba(255, 255, 255, 0.95)', lineWidth: 2 },
    { key: 'outerLips', indices: OUTER_LIPS_INDICES, closed: true, strokeStyle: 'rgba(163, 92, 255, 0.95)', fillStyle: 'rgba(163, 92, 255, 0.12)', lineWidth: 2 },
    { key: 'innerLips', indices: INNER_LIPS_INDICES, closed: true, strokeStyle: 'rgba(163, 92, 255, 0.75)', lineWidth: 1.5 },
  ]

  featureDefinitions.forEach((feature) => {
    const points = mapIndicesToPoints(landmarks, feature.indices)
    if (points.length < 2) return
    groups.push({ ...feature, points })
  })

  return groups
}

export function getFaceReferenceAnchorsFromLandmarks(landmarks?: Point[] | null): FaceReferenceAnchors | null {
  if (!landmarks) return null

  const leftEye = averagePoints(mapIndicesToPoints(landmarks, LEFT_EYE_INDICES.slice(0, -1)))
  const rightEye = averagePoints(mapIndicesToPoints(landmarks, RIGHT_EYE_INDICES.slice(0, -1)))
  const mouthCenter = averagePoints(mapIndicesToPoints(landmarks, [13, 14, 78, 308]))
  const noseCandidates = mapIndicesToPoints(landmarks, [1, 2, 4, 5, 195])
  if (noseCandidates.length === 0) return null
  const noseTip = averagePoints(noseCandidates)

  return { leftEye, rightEye, noseTip, mouthCenter }
}

function drawLandmarkGroup(ctx: CanvasRenderingContext2D, group: LandmarkGroup, width: number, height: number) {
  if (group.points.length < 2) return

  ctx.save()
  ctx.beginPath()
  group.points.forEach((point, index) => {
    const x = point.x * width
    const y = point.y * height
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  if (group.closed) ctx.closePath()

  ctx.strokeStyle = group.strokeStyle
  ctx.lineWidth = group.lineWidth ?? 1.75
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (group.fillStyle && group.closed) {
    ctx.fillStyle = group.fillStyle
    ctx.fill()
  }
  ctx.stroke()
  ctx.restore()
}

async function getVision() {
  return FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
  )
}

async function createFaceLandmarker(vision: Awaited<ReturnType<typeof getVision>>, delegate: 'GPU' | 'CPU') {
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
      delegate,
    },
    runningMode: 'IMAGE',
    numFaces: 1,
  })
}

async function getHairSegmenter(): Promise<ImageSegmenter> {
  if (hairSegmenter) return hairSegmenter
  if (hairSegmenterPromise) return hairSegmenterPromise

  hairSegmenterPromise = getVision().then((vision) =>
    ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
        delegate: 'GPU',
      },
      outputCategoryMask: true,
      outputConfidenceMasks: false,
      runningMode: 'IMAGE',
    })
  ).then((seg) => {
    hairSegmenter = seg
    return seg
  })

  return hairSegmenterPromise
}

async function getSegmenter(): Promise<ImageSegmenter> {
  if (segmenter) return segmenter
  const vision = await getVision()
  segmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
      delegate: 'GPU',
    },
    outputCategoryMask: true,
    outputConfidenceMasks: false,
    runningMode: 'IMAGE',
  })
  return segmenter
}

async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (faceLandmarker) return faceLandmarker
  if (faceLandmarkerPromise) return faceLandmarkerPromise

  faceLandmarkerPromise = (async () => {
    const vision = await getVision()

    try {
      faceLandmarkerDelegate = 'GPU'
      return await createFaceLandmarker(vision, 'GPU')
    } catch {
      faceLandmarkerDelegate = 'CPU'
      return await createFaceLandmarker(vision, 'CPU')
    }
  })()
    .then((lm) => {
      faceLandmarker = lm
      return lm
    })
    .catch((err) => {
      faceLandmarkerPromise = null
      throw err
    })

  return faceLandmarkerPromise
}

async function detectFaceLandmarks(img: HTMLImageElement) {
  await img.decode().catch(() => undefined)

  let landmarker = await getFaceLandmarker()

  try {
    return landmarker.detect(img)
  } catch (err) {
    if (faceLandmarkerDelegate !== 'GPU') {
      throw err
    }

    faceLandmarker?.close()
    faceLandmarker = null
    faceLandmarkerPromise = null
    faceLandmarkerDelegate = 'CPU'

    landmarker = await getFaceLandmarker()
    return landmarker.detect(img)
  }
}

export async function removeBackground(imageSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const result = await detectFaceLandmarks(img)
        const landmarks = result.faceLandmarks?.[0]

        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!

        if (!landmarks) {
          // 얼굴 감지 실패 시 원본 반환
          ctx.drawImage(img, 0, 0)
          resolve(canvas.toDataURL('image/png'))
          return
        }

        const W = img.naturalWidth
        const H = img.naturalHeight

        // 랜드마크 좌표로 얼굴 윤곽 패스 그리기
        ctx.save()
        ctx.beginPath()
        FACE_OVAL_INDICES.forEach((idx, i) => {
          const pt = landmarks[idx]
          const x = pt.x * W
          const y = pt.y * H
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()
        ctx.clip()
        ctx.drawImage(img, 0, 0)
        ctx.restore()

        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

export async function createFaceMask(
  originalPhoto: File,
  points: { x: number; y: number }[]
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const W = img.naturalWidth
      const H = img.naturalHeight
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')!

      // 전체 불투명 검정 (유지 영역)
      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, W, H)

      // 윤곽선 안쪽 투명 (편집 영역)
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      points.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x * W, pt.y * H)
        else ctx.lineTo(pt.x * W, pt.y * H)
      })
      ctx.closePath()
      ctx.fill()

      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('mask blob failed')); return }
        resolve(new File([blob], 'mask.png', { type: 'image/png' }))
      }, 'image/png')
    }
    img.onerror = reject
    img.src = URL.createObjectURL(originalPhoto)
  })
}

export async function createFaceOvalGuideFile(
  imageSrc: string,
  customFaceOval?: Point[]
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        const width = canvas.width
        const height = canvas.height

        ctx.fillStyle = 'black'
        ctx.fillRect(0, 0, width, height)

        let faceOval = customFaceOval ?? []
        if (faceOval.length < 2) {
          const result = await detectFaceLandmarks(img)
          const landmarks = result.faceLandmarks?.[0]
          if (landmarks) {
            faceOval = mapIndicesToPoints(landmarks, FACE_OVAL_INDICES)
          }
        }

        if (faceOval.length > 1) {
          ctx.beginPath()
          faceOval.forEach((point, index) => {
            const x = point.x * width
            const y = point.y * height
            if (index === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          })
          ctx.closePath()
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)'
          ctx.lineWidth = Math.max(5, Math.round(Math.min(width, height) * 0.008))
          ctx.lineJoin = 'round'
          ctx.lineCap = 'round'
          ctx.stroke()
        }

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('face oval guide blob failed'))
            return
          }
          resolve(new File([blob], 'face-oval-guide.png', { type: 'image/png' }))
        }, 'image/png')
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

export async function createHairlineGuideFile(
  imageSrc: string,
  faceOvalPoints?: Point[]
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const seg = await getHairSegmenter()
        const result = seg.segment(img)
        const mask = result.categoryMask!
        const maskData = mask.getAsUint8Array()
        mask.close()

        const width = img.naturalWidth
        const height = img.naturalHeight
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = 'black'
        ctx.fillRect(0, 0, width, height)

        const contourPoints = faceOvalPoints?.length
          ? faceOvalPoints
          : await getFaceLandmarkPoints(imageSrc).catch(() => [])
        const bounds = getBoundsFromPoints(contourPoints)

        const centerX = bounds ? bounds.centerX * width : width / 2
        const faceWidth = bounds ? bounds.width * width : width * 0.38
        const faceCenterY = bounds ? bounds.centerY * height : height * 0.42
        const minX = Math.max(1, Math.floor(centerX - faceWidth * 0.62))
        const maxX = Math.min(width - 2, Math.ceil(centerX + faceWidth * 0.62))
        const maxSearchY = Math.max(8, Math.min(height - 2, Math.floor(faceCenterY)))

        const hairlinePoints: Point[] = []
        for (let x = minX; x <= maxX; x += 2) {
          let candidateY = -1
          for (let y = 1; y <= maxSearchY; y++) {
            const index = y * width + x
            const isHair = maskData[index] === 1
            const belowIsNonHair = maskData[Math.min(height - 1, y + 1) * width + x] !== 1
            if (isHair && belowIsNonHair) candidateY = y
          }
          if (candidateY >= 0) {
            hairlinePoints.push({ x: x / width, y: candidateY / height })
          }
        }

        if (hairlinePoints.length > 1) {
          ctx.beginPath()
          hairlinePoints.forEach((point, index) => {
            const x = point.x * width
            const y = point.y * height
            if (index === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          })
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)'
          ctx.lineWidth = Math.max(4, Math.round(Math.min(width, height) * 0.007))
          ctx.lineJoin = 'round'
          ctx.lineCap = 'round'
          ctx.stroke()
        }

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('hairline guide blob failed'))
            return
          }
          resolve(new File([blob], 'hairline-guide.png', { type: 'image/png' }))
        }, 'image/png')
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

export function insetFaceOvalPoints(points: Point[], ratio = 0.22): Point[] {
  if (points.length === 0) return []

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const width = maxX - minX
  const height = maxY - minY

  return points.map((point) => {
    const horizontalRatio = ratio * 1.1
    const upperRatio = ratio * 1.65
    const lowerRatio = ratio * 0.85
    const verticalRatio = point.y <= centerY ? upperRatio : lowerRatio
    const targetX = centerX + (point.x - centerX) * (1 - horizontalRatio)
    const targetY = centerY + (point.y - centerY) * (1 - verticalRatio)

    return {
      x: Math.max(minX + width * 0.12, Math.min(maxX - width * 0.12, targetX)),
      y: Math.max(minY + height * 0.16, Math.min(maxY - height * 0.12, targetY)),
    }
  })
}

function getBoundsFromPoints(points: Point[]) {
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

export async function getFaceLandmarkPoints(imageSrc: string): Promise<{ x: number; y: number }[]> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const result = await detectFaceLandmarks(img)
        const landmarks = result.faceLandmarks?.[0]
        if (!landmarks) { resolve([]); return }
        resolve(FACE_OVAL_INDICES.map((idx) => ({ x: landmarks[idx].x, y: landmarks[idx].y })))
      } catch (err) { reject(err) }
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

export async function getFaceLandmarks3D(imageSrc: string): Promise<{ x: number; y: number; z: number }[]> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const result = await detectFaceLandmarks(img)
        const landmarks = result.faceLandmarks?.[0]
        if (!landmarks) { resolve([]); return }
        resolve(landmarks.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z ?? 0 })))
      } catch (err) { reject(err) }
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

export async function getFaceReferenceAnchors(imageSrc: string): Promise<FaceReferenceAnchors | null> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const result = await detectFaceLandmarks(img)
        resolve(getFaceReferenceAnchorsFromLandmarks(result.faceLandmarks?.[0]))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

export async function applyCustomMask(imageSrc: string, points: { x: number; y: number }[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        const W = canvas.width
        const H = canvas.height

        ctx.save()
        ctx.beginPath()
        points.forEach((pt, i) => {
          const x = pt.x * W
          const y = pt.y * H
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()
        ctx.clip()
        ctx.drawImage(img, 0, 0)
        ctx.restore()

        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

export async function drawFaceLandmarks(imageSrc: string, customPoints?: { x: number; y: number }[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const result = await detectFaceLandmarks(img)
        const landmarks = result.faceLandmarks?.[0]

        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)

        const groups = buildFaceLandmarkGroups(landmarks, customPoints)
        const W = img.naturalWidth
        const H = img.naturalHeight
        groups.forEach((group) => drawLandmarkGroup(ctx, group, W, H))

        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

export async function drawAllFaceLandmarkDots(imageSrc: string, customPoints?: { x: number; y: number }[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const result = await detectFaceLandmarks(img)
        const landmarks = result.faceLandmarks?.[0]

        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        const W = canvas.width
        const H = canvas.height

        ctx.drawImage(img, 0, 0)

        if (landmarks) {
          landmarks.forEach((point) => {
            ctx.beginPath()
            ctx.arc(point.x * W, point.y * H, 1.8, 0, Math.PI * 2)
            ctx.fillStyle = '#00E5FF'
            ctx.fill()
          })
        }

        const faceOval = customPoints ?? (landmarks ? FACE_OVAL_INDICES.map((idx) => landmarks[idx]) : null)
        if (faceOval && faceOval.length > 1) {
          ctx.save()
          ctx.beginPath()
          faceOval.forEach((point, index) => {
            const x = point.x * W
            const y = point.y * H
            if (index === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          })
          ctx.closePath()
          ctx.strokeStyle = 'rgba(255, 0, 122, 0.95)'
          ctx.lineWidth = 2.5
          ctx.lineJoin = 'round'
          ctx.lineCap = 'round'
          ctx.stroke()
          ctx.restore()
        }

        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

export async function drawFaceOvalDots(imageSrc: string, customPoints?: { x: number; y: number }[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const result = await detectFaceLandmarks(img)
        const landmarks = result.faceLandmarks?.[0]

        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        const width = canvas.width
        const height = canvas.height

        ctx.drawImage(img, 0, 0)

        const faceOval = customPoints ?? (landmarks ? FACE_OVAL_INDICES.map((idx) => landmarks[idx]) : null)
        if (faceOval && faceOval.length > 0) {
          faceOval.forEach((point) => {
            ctx.beginPath()
            ctx.arc(point.x * width, point.y * height, 2.6, 0, Math.PI * 2)
            ctx.fillStyle = '#03c75a'
            ctx.fill()
          })

          if (faceOval.length > 1) {
            ctx.save()
            ctx.beginPath()
            faceOval.forEach((point, index) => {
              const x = point.x * width
              const y = point.y * height
              if (index === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            })
            ctx.closePath()
            ctx.strokeStyle = 'rgba(255, 0, 122, 0.7)'
            ctx.lineWidth = 1.75
            ctx.lineJoin = 'round'
            ctx.lineCap = 'round'
            ctx.stroke()
            ctx.restore()
          }
        }

        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

export async function drawFaceOvalComparison(imageSrc: string, customPoints?: { x: number; y: number }[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const [landmarkResult, seg] = await Promise.all([
          detectFaceLandmarks(img),
          getSegmenter(),
        ])
        const landmarks = landmarkResult.faceLandmarks?.[0]
        const segmentResult = seg.segment(img)
        const mask = segmentResult.categoryMask!
        const maskData = mask.getAsUint8Array()
        mask.close()

        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        const width = canvas.width
        const height = canvas.height

        ctx.drawImage(img, 0, 0)

        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const index = y * width + x
            const isPerson = maskData[index] === 1
            if (!isPerson) continue

            const touchesBackground =
              maskData[(y - 1) * width + x] !== 1 ||
              maskData[(y + 1) * width + x] !== 1 ||
              maskData[y * width + (x - 1)] !== 1 ||
              maskData[y * width + (x + 1)] !== 1

            if (!touchesBackground) continue

            ctx.fillStyle = 'rgba(57, 255, 20, 0.98)'
            ctx.fillRect(x - 2, y - 2, 5, 5)
          }
        }

        const faceOval = customPoints ?? (landmarks ? FACE_OVAL_INDICES.map((idx) => landmarks[idx]) : null)
        if (faceOval && faceOval.length > 0) {
          faceOval.forEach((point) => {
            ctx.beginPath()
            ctx.arc(point.x * width, point.y * height, 2.8, 0, Math.PI * 2)
            ctx.fillStyle = '#03c75a'
            ctx.fill()
          })

          if (faceOval.length > 1) {
            ctx.save()
            ctx.beginPath()
            faceOval.forEach((point, index) => {
              const x = point.x * width
              const y = point.y * height
              if (index === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            })
            ctx.closePath()
            ctx.strokeStyle = 'rgba(255, 0, 122, 0.9)'
            ctx.lineWidth = 2.25
            ctx.lineJoin = 'round'
            ctx.lineCap = 'round'
            ctx.stroke()
            ctx.restore()
          }
        }

        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

export async function createFaceLandmarkSkeletonFile(
  imageSrc: string,
  customPoints?: { x: number; y: number }[],
  size = 512
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const result = await detectFaceLandmarks(img)
        const landmarks = result.faceLandmarks?.[0]
        if (!landmarks) {
          reject(new Error('No face landmarks detected'))
          return
        }

        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, size, size)

        const groups = buildFaceLandmarkGroups(landmarks, customPoints)
        groups.forEach((group) => drawLandmarkGroup(ctx, group, size, size))

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('skeleton blob failed'))
            return
          }
          resolve(new File([blob], 'landmark-skeleton.png', { type: 'image/png' }))
        }, 'image/png')
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

export async function applyFaceBlur(imageSrc: string, blurAmount = 12): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const seg = await getSegmenter()

        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!

        // Draw original image
        ctx.drawImage(img, 0, 0)

        // Get segmentation mask (1 = person/face, 0 = background)
        const result = seg.segment(img)
        const mask = result.categoryMask!
        const maskData = mask.getAsUint8Array()
        mask.close()

        const { width, height } = canvas

        // Draw blurred version on a separate canvas
        const blurCanvas = document.createElement('canvas')
        blurCanvas.width = width
        blurCanvas.height = height
        const blurCtx = blurCanvas.getContext('2d')!
        blurCtx.filter = `blur(${blurAmount}px)`
        blurCtx.drawImage(img, 0, 0)
        const blurredData = blurCtx.getImageData(0, 0, width, height)

        // Get original pixel data
        const originalData = ctx.getImageData(0, 0, width, height)

        // Composite: use blurred pixels where mask = 1 (person), original elsewhere
        const output = ctx.createImageData(width, height)
        for (let i = 0; i < maskData.length; i++) {
          const isFace = maskData[i] === 1
          const px = i * 4
          output.data[px] = isFace ? blurredData.data[px] : originalData.data[px]
          output.data[px + 1] = isFace ? blurredData.data[px + 1] : originalData.data[px + 1]
          output.data[px + 2] = isFace ? blurredData.data[px + 2] : originalData.data[px + 2]
          output.data[px + 3] = 255
        }

        ctx.putImageData(output, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

export async function extractHairMask(imageSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const seg = await getHairSegmenter()
        const result = seg.segment(img)
        const mask = result.categoryMask!
        const maskData = mask.getAsUint8Array()
        mask.close()

        const W = img.naturalWidth
        const H = img.naturalHeight
        const canvas = document.createElement('canvas')
        canvas.width = W
        canvas.height = H
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, W, H)
        for (let i = 0; i < maskData.length; i++) {
          if (maskData[i] !== 1) imageData.data[i * 4 + 3] = 0
        }
        ctx.putImageData(imageData, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch (err) { reject(err) }
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

export async function extractHairLayer(imageSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const seg = await getHairSegmenter()
        const result = seg.segment(img)
        const mask = result.categoryMask!
        const maskData = mask.getAsUint8Array()
        mask.close()

        // debug: count pixels per category
        const counts: Record<number, number> = {}
        for (let i = 0; i < maskData.length; i++) {
          counts[maskData[i]] = (counts[maskData[i]] ?? 0) + 1
        }
        console.log('[hair] mask categories:', counts, 'total px:', maskData.length)

        const W = img.naturalWidth
        const H = img.naturalHeight

        // draw original image + pink contour outline on hair boundary
        const outlineCanvas = document.createElement('canvas')
        outlineCanvas.width = W
        outlineCanvas.height = H
        const outCtx = outlineCanvas.getContext('2d')!
        outCtx.drawImage(img, 0, 0)
        const outData = outCtx.getImageData(0, 0, W, H)
        for (let y = 1; y < H - 1; y++) {
          for (let x = 1; x < W - 1; x++) {
            const i = y * W + x
            const isHair = maskData[i] === 1
            const hasNonHairNeighbor =
              maskData[(y - 1) * W + x] !== 1 ||
              maskData[(y + 1) * W + x] !== 1 ||
              maskData[y * W + (x - 1)] !== 1 ||
              maskData[y * W + (x + 1)] !== 1
            if (isHair && hasNonHairNeighbor) {
              // draw 3px thick outline
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  const ny = y + dy; const nx = x + dx
                  if (ny < 0 || ny >= H || nx < 0 || nx >= W) continue
                  const np = (ny * W + nx) * 4
                  outData.data[np] = 255; outData.data[np + 1] = 0
                  outData.data[np + 2] = 122; outData.data[np + 3] = 255
                }
              }
            }
          }
        }
        outCtx.putImageData(outData, 0, 0)
        resolve(outlineCanvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = reject
    img.src = imageSrc
  })
}
