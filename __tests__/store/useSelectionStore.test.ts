import { act, renderHook } from '@testing-library/react'
import { useSelectionStore } from '@/store/useSelectionStore'

describe('useSelectionStore', () => {
  beforeEach(() => {
    useSelectionStore.setState({
      angle: 'center',
      category: '30sF',
      modelId: 0,
      photo: null,
      generatedImages: [],
      resultImage: null,
      isGenerating: false,
      isSynthesizing: false,
    })
  })

  it('has correct initial state', () => {
    const { result } = renderHook(() => useSelectionStore())
    expect(result.current.angle).toBe('center')
    expect(result.current.category).toBe('30sF')
    expect(result.current.modelId).toBe(0)
    expect(result.current.photo).toBeNull()
    expect(result.current.generatedImages).toEqual([])
    expect(result.current.resultImage).toBeNull()
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.isSynthesizing).toBe(false)
  })

  it('setAngle updates angle', () => {
    const { result } = renderHook(() => useSelectionStore())
    act(() => result.current.setAngle('nw'))
    expect(result.current.angle).toBe('nw')
  })

  it('setCategory updates category', () => {
    const { result } = renderHook(() => useSelectionStore())
    act(() => result.current.setCategory('20sF'))
    expect(result.current.category).toBe('20sF')
  })

  it('setModelId updates modelId', () => {
    const { result } = renderHook(() => useSelectionStore())
    act(() => result.current.setModelId(2))
    expect(result.current.modelId).toBe(2)
  })

  it('setPhoto updates photo', () => {
    const { result } = renderHook(() => useSelectionStore())
    const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
    act(() => result.current.setPhoto(file))
    expect(result.current.photo).toBe(file)
  })

  it('setGeneratedImages updates generatedImages', () => {
    const { result } = renderHook(() => useSelectionStore())
    act(() => result.current.setGeneratedImages(['url1', 'url2', 'url3', 'url4']))
    expect(result.current.generatedImages).toEqual(['url1', 'url2', 'url3', 'url4'])
  })

  it('setResultImage updates resultImage', () => {
    const { result } = renderHook(() => useSelectionStore())
    act(() => result.current.setResultImage('result-url'))
    expect(result.current.resultImage).toBe('result-url')
  })

  it('setIsGenerating updates isGenerating', () => {
    const { result } = renderHook(() => useSelectionStore())
    act(() => result.current.setIsGenerating(true))
    expect(result.current.isGenerating).toBe(true)
  })

  it('setIsSynthesizing updates isSynthesizing', () => {
    const { result } = renderHook(() => useSelectionStore())
    act(() => result.current.setIsSynthesizing(true))
    expect(result.current.isSynthesizing).toBe(true)
  })
})
