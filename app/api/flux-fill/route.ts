import Replicate from 'replicate'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

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
  const imageEntry = formData.get('image')
  const image = imageEntry instanceof File ? imageEntry : null
  const originalRefEntry = formData.get('original_ref')
  const originalRef = originalRefEntry instanceof File ? originalRefEntry : null
  const hairRefEntry = formData.get('hair_ref')
  const hairRef = hairRefEntry instanceof File ? hairRefEntry : null
  const faceRefEntry = formData.get('face_ref')
  const faceRef = faceRefEntry instanceof File ? faceRefEntry : null
  const prompt = formData.get('prompt') as string | null

  if (!image) return NextResponse.json({ error: 'image is required' }, { status: 400 })

  const token = process.env.REPLICATE_API_TOKEN
  if (!token) return NextResponse.json({ error: 'REPLICATE_API_TOKEN not set' }, { status: 500 })

  try {
    const replicate = new Replicate({ auth: token })
    const imageDataUri = await fileToDataUri(image)
    const inputImages: string[] = [imageDataUri]
    if (originalRef) inputImages.push(await fileToDataUri(originalRef))
    if (hairRef) inputImages.push(await fileToDataUri(hairRef))
    if (faceRef) inputImages.push(await fileToDataUri(faceRef))

    const output = await replicate.run('black-forest-labs/flux-2-klein-9b', {
      input: {
        prompt: prompt?.trim() || 'A realistic photographic portrait.',
        images: inputImages,
        aspect_ratio: 'match_input_image',
        megapixels: '1',
        go_fast: true,
        output_format: 'png',
        output_quality: 90,
        disable_safety_checker: false,
      },
    })

    const outputUrl = pickOutputUrl(output)
    if (!outputUrl) throw new Error('No output URL from FLUX')

    const dataUrl = outputUrl.startsWith('data:') ? outputUrl : await toDataUri(outputUrl)
    return NextResponse.json({ outputUrl: dataUrl })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'FLUX request failed' },
      { status: 500 },
    )
  }
}
