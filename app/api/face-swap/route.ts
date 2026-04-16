import Replicate from 'replicate'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

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
  const characterEntry = formData.get('character_image')
  const characterImage = characterEntry instanceof File ? characterEntry : null
  const targetEntry = formData.get('target_image')
  const targetImage = targetEntry instanceof File ? targetEntry : null

  if (!characterImage || !targetImage) {
    return NextResponse.json({ error: 'character_image and target_image are required' }, { status: 400 })
  }

  const token = process.env.REPLICATE_API_TOKEN
  if (!token) return NextResponse.json({ error: 'REPLICATE_API_TOKEN not set' }, { status: 500 })

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

    const dataUrl = outputUrl.startsWith('data:') ? outputUrl : await toDataUri(outputUrl)
    return NextResponse.json({ model: FACE_SWAP_VERSION, outputUrl: dataUrl })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Replicate face swap request failed' },
      { status: 500 },
    )
  }
}
