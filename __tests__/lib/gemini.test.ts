import { generateFromLandmarks, generateImages, synthesizeFace } from '../../lib/gemini'

const mockGenerate = jest.fn().mockResolvedValue({
  data: [{ b64_json: 'base64imagedata1' }],
})
const mockEdit = jest.fn().mockResolvedValue({
  data: [{ b64_json: 'base64imagedata1' }],
})

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    images: { generate: mockGenerate, edit: mockEdit },
  }))
})

jest.mock('../../lib/faceBlur', () => ({
  createFaceLandmarkSkeletonFile: jest.fn().mockResolvedValue(new File(['guide'], 'guide.png', { type: 'image/png' })),
  createHairlineGuideFile: jest.fn().mockResolvedValue(new File(['hairline'], 'hairline.png', { type: 'image/png' })),
  createFaceMask: jest.fn().mockResolvedValue(new File(['mask'], 'mask.png', { type: 'image/png' })),
  extractHairMask: jest.fn().mockResolvedValue('data:image/png;base64,hairmask'),
  getFaceLandmarkPoints: jest.fn().mockResolvedValue([
    { x: 0.32, y: 0.24 },
    { x: 0.68, y: 0.24 },
    { x: 0.72, y: 0.78 },
    { x: 0.28, y: 0.78 },
  ]),
  insetFaceOvalPoints: jest.fn((points) => points),
}))

beforeEach(() => {
  mockGenerate.mockClear()
  mockEdit.mockClear()
  Object.defineProperty(global.URL, 'createObjectURL', {
    value: jest.fn(() => 'blob:mock'),
    configurable: true,
  })
})

describe('generateImages', () => {
  it('returns array of data URLs', async () => {
    const results = await generateImages('20sF', 1)
    expect(results).toHaveLength(1)
    expect(results[0]).toMatch(/^data:image\/png;base64,/)
  })

  it('calls generate with category description in prompt', async () => {
    await generateImages('30sF', 1)
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: expect.stringContaining('30대 한국 여성') })
    )
  })
})

describe('synthesizeFace', () => {
  it('returns a data URL string', async () => {
    class MockImage {
      naturalWidth = 1000
      naturalHeight = 1200
      onload: null | (() => void) = null
      onerror: null | ((error?: unknown) => void) = null

      set src(_value: string) {
        this.onload?.()
      }
    }

    const originalImage = global.Image
    const originalCreateElement = document.createElement.bind(document)
    const drawImage = jest.fn()
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName !== 'canvas') return originalCreateElement(tagName)
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage,
          fillRect: jest.fn(),
          beginPath: jest.fn(),
          moveTo: jest.fn(),
          lineTo: jest.fn(),
          closePath: jest.fn(),
          fill: jest.fn(),
          filter: '',
          globalCompositeOperation: 'source-over',
        }),
        toBlob: (callback: BlobCallback) => callback(new Blob(['aligned'], { type: 'image/png' })),
        toDataURL: () => 'data:image/png;base64,restored',
      } as unknown as HTMLCanvasElement
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.Image = MockImage as any
    const file = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' })
    try {
      const result = await synthesizeFace(file, 'data:image/png;base64,abc=', [
        { x: 0.3, y: 0.25 },
        { x: 0.7, y: 0.25 },
        { x: 0.7, y: 0.75 },
        { x: 0.3, y: 0.75 },
      ])
      expect(typeof result).toBe('string')
      expect(result).toMatch(/^data:image\/png;base64,/)
      expect(mockEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          image: expect.any(Array),
          mask: expect.any(File),
          input_fidelity: 'high',
          quality: 'medium',
          size: 'auto',
        })
      )
      expect((mockEdit.mock.calls[0]?.[0] as { image: unknown[] }).image).toHaveLength(5)
      expect((mockEdit.mock.calls[0]?.[0] as { prompt: string }).prompt).toContain('selected model facial skeleton guide')
    } finally {
      global.Image = originalImage
      createElementSpy.mockRestore()
    }
  })

  it('throws when OpenAI edit returns no image', async () => {
    class MockImage {
      naturalWidth = 1000
      naturalHeight = 1200
      onload: null | (() => void) = null
      onerror: null | ((error?: unknown) => void) = null

      set src(_value: string) {
        this.onload?.()
      }
    }

    const originalImage = global.Image
    const originalCreateElement = document.createElement.bind(document)
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName !== 'canvas') return originalCreateElement(tagName)
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: jest.fn(),
          fillRect: jest.fn(),
          beginPath: jest.fn(),
          moveTo: jest.fn(),
          lineTo: jest.fn(),
          closePath: jest.fn(),
          fill: jest.fn(),
          filter: '',
          globalCompositeOperation: 'source-over',
        }),
        toBlob: (callback: BlobCallback) => callback(new Blob(['aligned'], { type: 'image/png' })),
        toDataURL: () => 'data:image/png;base64,restored',
      } as unknown as HTMLCanvasElement
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.Image = MockImage as any
    const file = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' })
    mockEdit.mockResolvedValueOnce({ data: [] })
    try {
      await expect(synthesizeFace(file, 'data:image/png;base64,abc=', [
        { x: 0.3, y: 0.25 },
        { x: 0.7, y: 0.25 },
        { x: 0.7, y: 0.75 },
        { x: 0.3, y: 0.75 },
      ])).rejects.toThrow('Synthesize failed: no image returned')
    } finally {
      global.Image = originalImage
      createElementSpy.mockRestore()
    }
  })
})

describe('generateFromLandmarks', () => {
  class MockImage {
    naturalWidth = 1200
    naturalHeight = 800
    onload: null | (() => void) = null
    onerror: null | ((error?: unknown) => void) = null

    set src(_value: string) {
      this.onload?.()
    }
  }

  it('sends the original photo and landmark guide together for generation', async () => {
    const originalImage = global.Image
    const mockBlob = new Blob(['resized'], { type: 'image/png' })
    const toBlob = jest.fn((callback: BlobCallback) => callback(mockBlob))
    const drawImage = jest.fn()
    const originalCreateElement = document.createElement.bind(document)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.Image = MockImage as any
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName !== 'canvas') return originalCreateElement(tagName)
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage }),
        toBlob,
      } as unknown as HTMLCanvasElement
    })

    try {
      const landmarkFile = new File(['landmark'], 'landmark.png', { type: 'image/png' })
      const originalFile = new File(['original'], 'original.png', { type: 'image/png' })
      await generateFromLandmarks('30sF', landmarkFile, 1, 'skeleton', originalFile)

      expect(mockEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          image: expect.any(Array),
          prompt: expect.stringContaining('base identity'),
          size: 'auto',
        })
      )
      expect((mockEdit.mock.calls.at(-1)?.[0] as { image: unknown[] }).image).toHaveLength(2)
    } finally {
      global.Image = originalImage
      createElementSpy.mockRestore()
    }
  })
})
