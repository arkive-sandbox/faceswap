'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import StepHeader from '@/components/StepHeader'
import BottomCta from '@/components/BottomCta'
import PageShell from '@/components/PageShell'
import { useSelectionStore } from '@/store/useSelectionStore'

const MODELS = [
  { id: '20sF', label: '20s F', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAdY4FCKfW1rm19HQre2n8R2uWwgshQomUNHF-eBI9xms-j8-Q9kFwbTbNdJp4oz4ZBsv9168ppc4Nb8EpZRqfl4NflzcCMzPkkmHgBvFm3UX8_VU4UzRmPR3GXm_TvnZ3U0t5x49PqV2N86Sqih4qEfCt1r1fTrcwg3OfKGCm4_1STT2nsdQ3ijd8M0tQ7B_R_t48fI_c7WMN8ebbvbIVw7ZhuoLys7B4uuwvVCfTTXBzRKjYpj0AfbQVHxX4pEkP0uc4UC13BB6LJ' },
  { id: '20sM', label: '20s M', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBD9C8hvLe6GgUy7nsjmUOcUeX5wvJ6ioigiBUbcFtbqrfpbnGvgxhHwRwjarCdRGHst0KPwex2LmqRRPkdCbcC1cDPInedDg-bItgHxt7ukh_YzEDoI6k0YSTAuVyJEWapwCr0HCppbJuVnQj29Pbexz11mdRBt7t3cq4zClxnxby_tLCZIRHg64P2rdeCMkiy8tPFpnxbo9gVdXH0HDhu-EyV7TLx1TlWgsvsmKK97ZkFDR2XLyVUEtdlgZXRcP4M6mdQqrBBBFLA' },
  { id: '30sF', label: '30s F', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBS2IVeOxmKwvp80outBTE6oWljSJl_NKOkPtBLskUtuM7DNuvSO_KSTKcwRIsYXPCS-SYs3Vo-Mm7caOBVjUz5u07bVFIXnlJ2pqTnHE0e7EXajQF4dw60udfSbxp9gR7zhgPGoh_ueHtpGC7ST-OndBEUk-vSeYNWbWPzF2r72OAEvbXkMT-XHq5lQ_tZew3A9pAKIqKVtREnKHpl48LR-Xb3HwLGSrY4BTt2zCSNR_9kKvyi1sMqf-NieUthM_pWS3ctHVYICNJH' },
  { id: '30sM', label: '30s M', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCevDoQm4dxHzIg9SQWXbRXJUkVv9Y_YX8xaYEjaMVcdwUZ41C8rm1VqWb2pSqaP6GFj7klKsvqi3DKIOmQbYL16tBwyxXA2jp8jQWgyTg6dS2LyGWr4K21fd9ZgPon_p0pVz6HDXdEXsN87ANcQH2FjG5BaU9p5MTXL9rj0XaWeqnnNsqOaFCRBvhs5Eg81LimS4egmSHwptWSR4vVThJJ_d_tWTrFTTmC84vHv_kLbQbaND5FZZWLkt_Y894g8eGDbvWbWn8WDb20' },
  { id: '40sF', label: '40s F', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAflBETqNv5q66iQopTcilqRrlIfWHmCr1jWZaaFUyO_ibeNuVYOhBwV6qzyBlu0WI5b2lZL7g8r8pIhtJyIUkNNMbW9PGk29nzDlaG-7mE4ltTUBgG1X9ykKKK_GBolN9cLKlxIHFszmVA4gjICcyHUDHKEIbRZIEfWHLxelaTEzb2Zk1huJ2QYfIQdFuNWPcUdL7zNz86peyUIcYajBaxdiIMHqaqzqnJNzwFNS7fZpVyWR3kkxPR6HepY_TITwR-yMb2m7BGokmE' },
  { id: '40sM', label: '40s M', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD_wI-I0pQ8mDQeahgQ-hViRZ9bnusrscH6V0cwlD-tj0uIErveX1E6nuADsy9csWtysECGonkvbXvh9JP3peZpyLJy1_y5CNEk9CdlY0Y3t5tl6DrVRqdgXoZvKsFWf_dcbkO5YkeLoJ20Ego0yuHXmHaHTFME1GA3w-4eaJ4fKX5zHykXM58vrxxLbLIgz07Ny31_UMqzmKwjV2rIycpgScSfniTPHuTJ5EB8lBveqT_VoXAWsEhFFgCcgcb-K5KKLuY54FQ5_jut' },
  { id: '50sF', label: '50s F', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHGW_485MIRoP_dAxoK_XorID-MLrvfW2IX11fZoOBQ1h3W0NDRIPn7f089mECQ-0UbS1IDjsoT5sCCHMs6YrzeQVvTgC9rAtpy5ZlnT78B4rbS6NK3eIehiPqQpvu1hPMF7T7s7UEZ1P9R4DWWPrS9h_M1tRIDX3WDb7EtmaU6qgpW7itsKQ4tifxANsaDksWvDuORCE9Je0R30E-H7yOYQ_T40aF7GZkz1FZ9AOUV7Mpey7ZD4tiqYgYV6wkW0pI8cJy3CaxdWMb' },
  { id: '50sM', label: '50s M', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAw-ws3aZHxzXJL0hlmn0IQt4tnMVimikxR7TfAYKNBfeOBxzXnIVuuQJPvECJbSXMMNj24xMkWxb90BpgwoAS8vJ9dB435CLe3u564fFQ6jj6P3VIsCA336RZ4JV7oJWQgRE7tgt7ViOvpdnpfe35g5QfXXZ-qWovh_j57vX900Ofjp1miLmz18eLSrPEejiXbnEAdBINdV5Pccu2H6TUnvE4RHHK2crMjVHw6hnwilinIoaXpe4W6HssQ6lJT7W5umSU3u8Dn53_Z' },
] as const

const SKIN_OPTIONS = ['맑은', '보송한', '윤기 있는', '매끈한'] as const
const EXPRESSION_OPTIONS = ['무표정', '옅은 미소', '자연스러운 미소'] as const

function OptionChips({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string
  options: readonly string[]
  selected: string
  onSelect: (value: string) => void
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-on-surface">{title}</h2>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onSelect(option)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              selected === option
                ? 'bg-primary text-white'
                : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </section>
  )
}

export default function CategorySelectionPage() {
  const router = useRouter()
  const {
    originalPhoto,
    skinExpression,
    facialExpression,
    setCategory,
    setSkinExpression,
    setFacialExpression,
    setGeneratedImages,
    setResultImage,
    setModelId,
  } = useSelectionStore()
  const [selected, setSelected] = useState('30sF')

  useEffect(() => {
    if (!originalPhoto) router.replace('/')
  }, [originalPhoto, router])
  const [selectedSkinExpression, setSelectedSkinExpression] = useState(skinExpression)
  const [selectedFacialExpression, setSelectedFacialExpression] = useState(facialExpression)

  const handleNext = () => {
    setCategory(selected)
    setSkinExpression(selectedSkinExpression)
    setFacialExpression(selectedFacialExpression)
    setGeneratedImages([])
    setResultImage(null)
    setModelId(0)
    router.push('/generate')
  }

  return (
    <PageShell className="relative overflow-x-hidden">
      <main className="flex-1 pt-10 pb-32 px-6">
        <StepHeader step={2} total={4} label="STEP 02" />

        <div className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight text-stone-950">
            세부사항을 조정해<br />AI 초안을 만들어 주세요
          </h1>
        </div>

        <section className="mb-8">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-on-surface">연령대</h2>
          <div className="grid grid-cols-3 gap-4">
            {MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelected(model.id)}
                className={`group relative aspect-square rounded-lg overflow-hidden bg-surface-container-lowest transition-all duration-300 active:scale-95 hover:shadow-xl ${
                  selected === model.id ? 'border-[3px] border-primary-container' : ''
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={model.label} className="w-full h-full object-cover transition-transform group-hover:scale-110" src={model.img} />
                <div className="absolute inset-0 bg-gradient-to-t from-on-surface/60 to-transparent" />
                <span className="absolute bottom-2 left-0 w-full text-center text-white text-[10px] font-bold uppercase tracking-widest">
                  {model.label}
                </span>
              </button>
            ))}
            <button
              disabled
              className="group relative aspect-square rounded-lg overflow-hidden bg-surface-container-high transition-all duration-300 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-outline-variant/30 opacity-50 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '28px' }}>blur_on</span>
              <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Neutral</span>
            </button>
          </div>
        </section>

        <OptionChips
          title="피부 표현"
          options={SKIN_OPTIONS}
          selected={selectedSkinExpression}
          onSelect={setSelectedSkinExpression}
        />

        <OptionChips
          title="표정"
          options={EXPRESSION_OPTIONS}
          selected={selectedFacialExpression}
          onSelect={setSelectedFacialExpression}
        />
      </main>

      <BottomCta label="초안 만들기" onClick={handleNext} variant="primary" disabled={!originalPhoto} />

      <div className="fixed top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -z-10 translate-x-1/2 -translate-y-1/2" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-tertiary/5 rounded-full blur-[100px] -z-10 -translate-x-1/2 translate-y-1/2" />
    </PageShell>
  )
}
