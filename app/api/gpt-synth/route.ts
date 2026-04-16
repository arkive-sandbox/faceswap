import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const originalEntry = formData.get('original')
  const constraintEntry = formData.get('constraint')
  const maskEntry = formData.get('mask')
  const prompt = formData.get('prompt') as string | null

  const original = originalEntry instanceof File ? originalEntry : null
  const constraint = constraintEntry instanceof File ? constraintEntry : null
  const mask = maskEntry instanceof File ? maskEntry : null

  if (!original || !constraint || !mask || !prompt) {
    return NextResponse.json({ error: 'original, constraint, mask, prompt are required' }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY ?? process.env.NEXT_PUBLIC_OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })

  const client = new OpenAI({ apiKey })

  try {
    const res = await (client.images.edit as Function)({
      model: 'gpt-image-1.5',
      image: [original, constraint],
      mask,
      prompt,
      n: 1,
      input_fidelity: 'low',
      quality: 'medium',
      size: 'auto',
    })
    const b64 = res.data?.[0]?.b64_json
    if (!b64) throw new Error('GPT 생성 결과가 비어 있습니다')
    return NextResponse.json({ b64 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'GPT synthesis failed' },
      { status: 500 },
    )
  }
}
