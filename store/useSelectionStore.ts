import { create } from 'zustand'

interface SelectionState {
  angle: string
  category: string
  synthesisModel: 'flux' | 'gpt'
  skinExpression: string
  makeupIntensity: string
  facialExpression: string
  modelId: number
  photo: File | null
  originalPhoto: File | null
  faceOvalPoints: { x: number; y: number }[]
  landmarks: { x: number; y: number; z: number }[]
  segPolygon: { x: number; y: number }[] | null
  hairPolygon: { x: number; y: number }[] | null
  generatedImages: string[]
  characterDataUrl: string | null
  gptCharacterDataUrl: string | null
  resultImage: string | null
  isGenerating: boolean
  isSynthesizing: boolean
  setAngle: (v: string) => void
  setCategory: (v: string) => void
  setSynthesisModel: (v: 'flux' | 'gpt') => void
  setSkinExpression: (v: string) => void
  setMakeupIntensity: (v: string) => void
  setFacialExpression: (v: string) => void
  setModelId: (v: number) => void
  setPhoto: (v: File | null) => void
  setOriginalPhoto: (v: File | null) => void
  setFaceOvalPoints: (v: { x: number; y: number }[]) => void
  setLandmarks: (v: { x: number; y: number; z: number }[]) => void
  setSegPolygon: (v: { x: number; y: number }[] | null) => void
  setHairPolygon: (v: { x: number; y: number }[] | null) => void
  setGeneratedImages: (v: string[]) => void
  addGeneratedImages: (v: string[]) => void
  setCharacterDataUrl: (v: string | null) => void
  setGptCharacterDataUrl: (v: string | null) => void
  setResultImage: (v: string | null) => void
  setIsGenerating: (v: boolean) => void
  setIsSynthesizing: (v: boolean) => void
  faceMaskDataUrl: string | null
  hairMaskDataUrl: string | null
  fluxMaskDataUrl: string | null
  segW: number
  segH: number
  setFaceMaskDataUrl: (v: string | null) => void
  setHairMaskDataUrl: (v: string | null) => void
  setFluxMaskDataUrl: (v: string | null) => void
  setSegW: (v: number) => void
  setSegH: (v: number) => void
  totalRegenCount: number
  incrementRegenCount: () => void
  resetRegenCount: () => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  angle: 'center',
  category: '30sF',
  synthesisModel: 'flux',
  skinExpression: '맑은',
  makeupIntensity: '내추럴',
  facialExpression: '자연스러운 미소',
  modelId: 0,
  photo: null,
  originalPhoto: null,
  faceOvalPoints: [],
  landmarks: [],
  segPolygon: null,
  hairPolygon: null,
  generatedImages: [],
  characterDataUrl: null,
  gptCharacterDataUrl: null,
  resultImage: null,
  isGenerating: false,
  isSynthesizing: false,
  setAngle: (v) => set({ angle: v }),
  setCategory: (v) => set({ category: v }),
  setSynthesisModel: (v) => set({ synthesisModel: v }),
  setSkinExpression: (v) => set({ skinExpression: v }),
  setMakeupIntensity: (v) => set({ makeupIntensity: v }),
  setFacialExpression: (v) => set({ facialExpression: v }),
  setModelId: (v) => set({ modelId: v }),
  setPhoto: (v) => set({ photo: v }),
  setOriginalPhoto: (v) => set({ originalPhoto: v }),
  setFaceOvalPoints: (v) => set({ faceOvalPoints: v }),
  setLandmarks: (v) => set({ landmarks: v }),
  setSegPolygon: (v) => set({ segPolygon: v }),
  setHairPolygon: (v) => set({ hairPolygon: v }),
  setGeneratedImages: (v) => set({ generatedImages: v }),
  addGeneratedImages: (v) => set((s) => ({ generatedImages: [...s.generatedImages, ...v] })),
  setCharacterDataUrl: (v) => set({ characterDataUrl: v }),
  setGptCharacterDataUrl: (v) => set({ gptCharacterDataUrl: v }),
  setResultImage: (v) => set({ resultImage: v }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  setIsSynthesizing: (v) => set({ isSynthesizing: v }),
  faceMaskDataUrl: null,
  hairMaskDataUrl: null,
  fluxMaskDataUrl: null,
  segW: 0,
  segH: 0,
  setFaceMaskDataUrl: (v) => set({ faceMaskDataUrl: v }),
  setHairMaskDataUrl: (v) => set({ hairMaskDataUrl: v }),
  setFluxMaskDataUrl: (v) => set({ fluxMaskDataUrl: v }),
  setSegW: (v) => set({ segW: v }),
  setSegH: (v) => set({ segH: v }),
  totalRegenCount: 0,
  incrementRegenCount: () => set((s) => ({ totalRegenCount: s.totalRegenCount + 1 })),
  resetRegenCount: () => set({ totalRegenCount: 0 }),
}))
