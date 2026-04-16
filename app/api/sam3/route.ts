import Replicate from 'replicate'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

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
  const imageEntry = formData.get('image')
  const image = imageEntry instanceof File ? imageEntry : null
  if (!image) return NextResponse.json({ error: 'image required' }, { status: 400 })

  const token = process.env.REPLICATE_API_TOKEN
  if (!token) return NextResponse.json({ error: 'REPLICATE_API_TOKEN not set' }, { status: 500 })

  const replicate = new Replicate({ auth: token })

  try {
    const arrayBuffer = await image.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const dataUri = `data:${image.type || 'image/png'};base64,${base64}`
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
