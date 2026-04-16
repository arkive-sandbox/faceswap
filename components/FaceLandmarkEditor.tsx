'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

interface Point { x: number; y: number }

interface Props {
  imageSrc: string
  initialPoints: Point[]  // 0~1 정규화 좌표
  onConfirm: (points: Point[]) => void
  onCancel: () => void
}

const POINT_RADIUS = 8
const HIT_RADIUS = 16

export default function FaceLandmarkEditor({ imageSrc, initialPoints, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [points, setPoints] = useState<Point[]>(initialPoints)
  const draggingIdx = useRef<number | null>(null)

  // 캔버스에 이미지 + 포인트 그리기
  const draw = useCallback((pts: Point[]) => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const W = canvas.width
    const H = canvas.height

    // 윤곽선 연결
    ctx.beginPath()
    pts.forEach((pt, i) => {
      const x = pt.x * W
      const y = pt.y * H
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.strokeStyle = 'rgba(3, 199, 90, 0.8)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // 포인트
    pts.forEach((pt) => {
      const x = pt.x * W
      const y = pt.y * H
      ctx.beginPath()
      ctx.arc(x, y, POINT_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = '#03c75a'
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }, [])

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const canvas = canvasRef.current
      if (!canvas) return
      // 캔버스 크기를 이미지 비율에 맞게
      const maxW = Math.min(img.naturalWidth, window.innerWidth - 48)
      const scale = maxW / img.naturalWidth
      canvas.width = maxW
      canvas.height = img.naturalHeight * scale
      draw(points)
    }
    img.src = imageSrc
  }, [imageSrc, draw, points])

  useEffect(() => {
    draw(points)
  }, [points, draw])

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    }
  }

  const findNearestPoint = (nx: number, ny: number): number => {
    const canvas = canvasRef.current!
    const hitNorm = HIT_RADIUS / canvas.width
    let nearest = -1
    let minDist = Infinity
    points.forEach((pt, i) => {
      const dist = Math.hypot(pt.x - nx, pt.y - ny)
      if (dist < hitNorm && dist < minDist) {
        minDist = dist
        nearest = i
      }
    })
    return nearest
  }

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    const { x, y } = getCanvasPoint(e)
    const idx = findNearestPoint(x, y)
    if (idx !== -1) draggingIdx.current = idx
  }

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (draggingIdx.current === null) return
    e.preventDefault()
    const { x, y } = getCanvasPoint(e)
    setPoints((prev) => {
      const next = [...prev]
      next[draggingIdx.current!] = {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      }
      return next
    })
  }

  const handlePointerUp = () => {
    draggingIdx.current = null
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center gap-4 p-6">
      <p className="text-white text-sm font-bold">윤곽 포인트를 드래그해서 조정하세요</p>

      <canvas
        ref={canvasRef}
        className="rounded-2xl max-w-full touch-none"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />

      <div className="flex gap-3 w-full max-w-xs">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-white/30 text-white text-sm font-bold"
        >
          취소
        </button>
        <button
          onClick={() => onConfirm(points)}
          className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold"
        >
          완료
        </button>
      </div>
    </div>
  )
}
