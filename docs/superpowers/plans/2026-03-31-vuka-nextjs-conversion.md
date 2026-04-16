# Vuka Clinical Aesthetic — Next.js Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the single-file HTML/React prototype into a production-ready Next.js 15 project with App Router, TypeScript, and Tailwind CSS.

**Architecture:** Four pages (`/`, `/upload`, `/category-selection`, `/model-detail`) each as a `page.tsx` under `app/`. Three shared components (`NavHeader`, `StepHeader`, `BottomCta`) extracted to `components/`. State is local `useState`; values pass between pages via URL query params.

**Tech Stack:** Next.js 15, TypeScript 5, Tailwind CSS v3, React Testing Library, Jest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `package.json` | Create | Dependencies |
| `next.config.ts` | Create | Next.js config |
| `tsconfig.json` | Create | TypeScript config |
| `tailwind.config.ts` | Create | Custom theme (colors, fonts, radius) |
| `postcss.config.mjs` | Create | PostCSS for Tailwind |
| `app/layout.tsx` | Create | Root layout: fonts, Material Symbols link, metadata |
| `app/globals.css` | Create | Tailwind directives + custom CSS classes |
| `app/page.tsx` | Create | `/` — Angle Selection page |
| `app/upload/page.tsx` | Create | `/upload` — Photo Upload page |
| `app/category-selection/page.tsx` | Create | `/category-selection` — Category Selection page |
| `app/model-detail/page.tsx` | Create | `/model-detail` — Final Model Detail page |
| `components/NavHeader.tsx` | Create | Sticky top nav (back button + title) |
| `components/StepHeader.tsx` | Create | Step indicator + progress bar |
| `components/BottomCta.tsx` | Create | Fixed bottom CTA button(s) |
| `jest.config.ts` | Create | Jest config for Next.js |
| `jest.setup.ts` | Create | Testing Library setup |
| `__tests__/components/NavHeader.test.tsx` | Create | NavHeader render test |
| `__tests__/components/StepHeader.test.tsx` | Create | StepHeader render test |
| `__tests__/components/BottomCta.test.tsx` | Create | BottomCta render & click test |

---

## Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `postcss.config.mjs`

- [ ] **Step 1: Scaffold the project**

Run in `/Users/jewon/vuka/face-swap-web`:
```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --no-import-alias \
  --eslint
```
When prompted:
- Use Turbopack: **No** (use default webpack for stability)

- [ ] **Step 2: Verify dev server starts**

```bash
npm run dev
```
Expected: Server starts at `http://localhost:3000` with no errors.

- [ ] **Step 3: Install testing dependencies**

```bash
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest @types/jest
```

- [ ] **Step 4: Create `jest.config.ts`**

```ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

- [ ] **Step 5: Create `jest.setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add test script to `package.json`**

Open `package.json` and add to `"scripts"`:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: initialize Next.js 15 project with TypeScript and Tailwind"
```

---

## Task 2: Configure Tailwind Custom Theme

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Replace `tailwind.config.ts` content**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'surface-container': '#f0eded',
        'on-secondary-fixed-variant': '#474746',
        'inverse-primary': '#ffb1c3',
        'background': '#fcf9f8',
        'outline-variant': '#e5bcc4',
        'on-tertiary-fixed-variant': '#8a0556',
        'surface-tint': '#FF007A',
        'surface-bright': '#fcf9f8',
        'surface-dim': '#dcd9d9',
        'primary': '#FF007A',
        'primary-fixed': '#ffd9e0',
        'on-error-container': '#93000a',
        'secondary-fixed': '#e5e2e1',
        'tertiary-fixed-dim': '#ffb0cf',
        'on-tertiary-fixed': '#3d0023',
        'on-tertiary-container': '#fffbff',
        'tertiary-fixed': '#ffd8e5',
        'surface-variant': '#e5e2e1',
        'surface-container-low': '#f6f3f2',
        'tertiary-container': '#c74186',
        'surface': '#fcf9f8',
        'on-secondary-container': '#636262',
        'error': '#ba1a1a',
        'surface-container-high': '#eae7e7',
        'on-error': '#ffffff',
        'inverse-surface': '#313030',
        'surface-container-highest': '#e5e2e1',
        'tertiary': '#a7266c',
        'on-background': '#1c1b1b',
        'outline': '#906e75',
        'primary-fixed-dim': '#ffb1c3',
        'on-primary': '#ffffff',
        'on-tertiary': '#ffffff',
        'on-secondary': '#ffffff',
        'secondary': '#5f5e5e',
        'secondary-fixed-dim': '#c8c6c5',
        'primary-container': '#FF007A',
        'on-primary-container': '#fffbff',
        'on-surface': '#1c1b1b',
        'on-primary-fixed': '#3f0019',
        'surface-container-lowest': '#ffffff',
        'inverse-on-surface': '#f3f0ef',
        'on-secondary-fixed': '#1b1c1c',
        'on-primary-fixed-variant': '#8f0041',
        'secondary-container': '#e2dfde',
        'on-surface-variant': '#5c3f45',
        'error-container': '#ffdad6',
        'vuka-pink': '#FF007A',
      },
      fontFamily: {
        headline: ['var(--font-plus-jakarta)', 'var(--font-noto-sans-kr)', 'sans-serif'],
        body: ['var(--font-plus-jakarta)', 'var(--font-noto-sans-kr)', 'sans-serif'],
        label: ['var(--font-plus-jakarta)', 'var(--font-noto-sans-kr)', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '1rem',
        lg: '2rem',
        xl: '3rem',
        full: '9999px',
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 2: Replace `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: var(--font-plus-jakarta), var(--font-noto-sans-kr), sans-serif;
  background-color: #fcf9f8;
  min-height: max(884px, 100dvh);
}

.vuka-glow {
  box-shadow: 0 0 25px rgba(255, 0, 122, 0.4);
}

.model-selected-ring {
  box-shadow: 0 0 0 4px #fcf9f8, 0 0 0 8px #FF007A;
}

@keyframes scan {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(120px); }
}

.scanning-line {
  animation: scan 3s ease-in-out infinite;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
```

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts app/globals.css
git commit -m "feat: configure Tailwind custom theme and global styles"
```

---

## Task 3: Root Layout with Fonts

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Noto_Sans_KR } from 'next/font/google'
import './globals.css'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-kr',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Vuka Clinical Aesthetic - AI Prototype',
  description: 'AI-powered face analysis and aesthetic simulation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className={`${plusJakarta.variable} ${notoSansKR.variable} text-on-background selection:bg-primary-fixed overflow-x-hidden`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Verify fonts load**

```bash
npm run dev
```
Open `http://localhost:3000` — fonts should render (Plus Jakarta Sans).

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add root layout with Google Fonts and Material Symbols"
```

---

## Task 4: NavHeader Component

**Files:**
- Create: `components/NavHeader.tsx`
- Create: `__tests__/components/NavHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/NavHeader.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import NavHeader from '@/components/NavHeader'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: jest.fn() }),
}))

describe('NavHeader', () => {
  it('renders title', () => {
    render(<NavHeader title="Vuka Clinical Aesthetic" />)
    expect(screen.getByText('Vuka Clinical Aesthetic')).toBeInTheDocument()
  })

  it('renders back button when showBack is true', () => {
    render(<NavHeader showBack />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('does not render back button when showBack is false', () => {
    render(<NavHeader />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/NavHeader.test.tsx
```
Expected: FAIL — `Cannot find module '@/components/NavHeader'`

- [ ] **Step 3: Create `components/NavHeader.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'

interface NavHeaderProps {
  title?: string
  showBack?: boolean
  showMore?: boolean
}

export default function NavHeader({ title, showBack = false, showMore = false }: NavHeaderProps) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-50 w-full bg-[#fcf9f8]/80 backdrop-blur-md border-b border-stone-200/20 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 w-full max-w-lg mx-auto">
        {showBack ? (
          <button
            onClick={() => router.back()}
            className="text-[#e4006c] hover:opacity-80 active:scale-95 transition-transform"
            aria-label="뒤로가기"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        ) : (
          <div className="w-6" />
        )}

        {title && (
          <h1 className="text-xl font-extrabold tracking-tighter text-[#e4006c]">{title}</h1>
        )}

        {showMore ? (
          <button
            className="text-stone-400 hover:opacity-80 active:scale-95 transition-transform"
            aria-label="더 보기"
          >
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        ) : (
          <div className="w-6" />
        )}
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/NavHeader.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/NavHeader.tsx __tests__/components/NavHeader.test.tsx
git commit -m "feat: add NavHeader component"
```

---

## Task 5: StepHeader Component

**Files:**
- Create: `components/StepHeader.tsx`
- Create: `__tests__/components/StepHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/StepHeader.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import StepHeader from '@/components/StepHeader'

describe('StepHeader', () => {
  it('renders step label', () => {
    render(<StepHeader step={2} total={4} label="STEP 02" />)
    expect(screen.getByText('STEP 02')).toBeInTheDocument()
  })

  it('renders step fraction', () => {
    render(<StepHeader step={2} total={4} label="STEP 02" />)
    expect(screen.getByText('2 / 4')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/StepHeader.test.tsx
```
Expected: FAIL — `Cannot find module '@/components/StepHeader'`

- [ ] **Step 3: Create `components/StepHeader.tsx`**

```tsx
interface StepHeaderProps {
  step: number
  total: number
  label: string
}

export default function StepHeader({ step, total, label }: StepHeaderProps) {
  const progress = (step / total) * 100

  return (
    <div className="mb-8">
      <div className="flex justify-between items-end mb-2">
        <span className="text-primary font-extrabold tracking-widest text-xs uppercase">{label}</span>
        <span className="text-on-surface-variant text-[10px] font-semibold">{step} / {total}</span>
      </div>
      <div className="h-1 w-full bg-surface-container rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/StepHeader.test.tsx
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add components/StepHeader.tsx __tests__/components/StepHeader.test.tsx
git commit -m "feat: add StepHeader component"
```

---

## Task 6: BottomCta Component

**Files:**
- Create: `components/BottomCta.tsx`
- Create: `__tests__/components/BottomCta.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/BottomCta.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import BottomCta from '@/components/BottomCta'

describe('BottomCta', () => {
  it('renders primary label', () => {
    render(<BottomCta label="다음 단계" onClick={() => {}} />)
    expect(screen.getByText('다음 단계')).toBeInTheDocument()
  })

  it('calls onClick when primary button clicked', () => {
    const onClick = jest.fn()
    render(<BottomCta label="다음 단계" onClick={onClick} />)
    fireEvent.click(screen.getByText('다음 단계'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders secondary button when provided', () => {
    render(
      <BottomCta
        label="다음"
        onClick={() => {}}
        secondary={{ label: '이전', onClick: () => {} }}
      />
    )
    expect(screen.getByText('이전')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/BottomCta.test.tsx
```
Expected: FAIL — `Cannot find module '@/components/BottomCta'`

- [ ] **Step 3: Create `components/BottomCta.tsx`**

```tsx
interface BottomCtaProps {
  label: string
  onClick: () => void
  secondary?: {
    label: string
    onClick: () => void
  }
  icon?: string
  variant?: 'primary' | 'glow'
}

export default function BottomCta({ label, onClick, secondary, icon, variant = 'primary' }: BottomCtaProps) {
  const primaryClass =
    variant === 'glow'
      ? 'flex-1 h-16 bg-[#FF007A] text-white rounded-full flex items-center justify-center gap-3 shadow-2xl vuka-glow hover:brightness-110 transition-all active:scale-[0.98] duration-200 font-extrabold text-lg tracking-tight'
      : 'flex-1 h-14 rounded-full bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95'

  return (
    <footer className="fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-md px-6 py-8 border-t border-stone-100 z-50">
      <div className="max-w-lg mx-auto flex gap-3">
        {secondary && (
          <button
            onClick={secondary.onClick}
            className="flex-1 h-14 rounded-full border border-outline-variant font-bold text-secondary hover:bg-surface-container transition-colors active:scale-95"
          >
            {secondary.label}
          </button>
        )}
        <button onClick={onClick} className={primaryClass}>
          {icon && (
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              {icon}
            </span>
          )}
          {label}
        </button>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/BottomCta.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/BottomCta.tsx __tests__/components/BottomCta.test.tsx
git commit -m "feat: add BottomCta component"
```

---

## Task 7: Angle Selection Page (`/`)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NavHeader from '@/components/NavHeader'
import BottomCta from '@/components/BottomCta'

const ANGLES = [
  { id: 'nw', icon: 'north_west', label: '좌측 상단' },
  { id: 'n', icon: 'north', label: '상단' },
  { id: 'ne', icon: 'north_east', label: '우측 상단' },
  { id: 'w', icon: 'west', label: '좌측' },
  { id: 'center', icon: 'face', label: '정면', special: true },
  { id: 'e', icon: 'east', label: '우측' },
  { id: 'sw', icon: 'south_west', label: '좌측 하단' },
  { id: 's', icon: 'south', label: '하단' },
  { id: 'se', icon: 'south_east', label: '우측 하단' },
] as const

export default function AngleSelectionPage() {
  const router = useRouter()
  const [selectedAngle, setSelectedAngle] = useState('center')

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavHeader title="Vuka Clinical Aesthetic" showBack />

      <main className="flex-1 px-6 pt-8 pb-32 max-w-lg mx-auto w-full">
        <section className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-on-surface tracking-tight mb-3">촬영 각도 선택</h2>
          <p className="text-on-surface-variant leading-relaxed px-4">
            정확한 분석을 위해 가이드에 맞춰<br />각도를 선택해 주세요.
          </p>
        </section>

        <section className="grid grid-cols-3 gap-4 mb-8">
          {ANGLES.map((angle) => (
            <button
              key={angle.id}
              onClick={() => setSelectedAngle(angle.id)}
              className={`aspect-square rounded-2xl transition-all flex flex-col items-center justify-center p-2 relative ${
                selectedAngle === angle.id
                  ? 'bg-primary-container text-on-primary-container shadow-lg shadow-primary/20 scale-105 z-10 border-2 border-primary'
                  : 'bg-surface-container-low hover:bg-surface-container-high'
              }`}
            >
              {selectedAngle === angle.id && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-[12px] text-primary font-bold" style={{ fontVariationSettings: "'wght' 700" }}>
                    check
                  </span>
                </div>
              )}
              <span
                className={`material-symbols-outlined mb-2 ${selectedAngle === angle.id ? 'text-3xl' : 'text-stone-400'}`}
                style={'special' in angle ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {angle.icon}
              </span>
              <span className={`text-xs font-semibold ${selectedAngle === angle.id ? 'text-white' : 'text-stone-500'}`}>
                {angle.label}
              </span>
            </button>
          ))}
        </section>

        <div className="flex items-center gap-2 mb-4 bg-primary/5 text-primary text-xs font-medium px-4 py-2.5 rounded-full w-fit mx-auto">
          <span className="material-symbols-outlined text-sm">info</span>
          <span>격자에 맞춰 촬영하면 인식이 더 잘됩니다</span>
        </div>

        <div className="relative rounded-[2rem] overflow-hidden aspect-square shadow-2xl">
          <div className="absolute inset-0 z-10 grid grid-cols-3 grid-rows-3 pointer-events-none">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className={[
                  i % 3 !== 2 ? 'border-r' : '',
                  i < 6 ? 'border-b' : '',
                  'border-white/30',
                ].join(' ')}
              />
            ))}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="Skin Analysis Preview"
            className="w-full h-full object-cover brightness-95"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdUVDBWrNRJCmpsWZw0WvphGxlDOVR8LLlMOAEBsBq7YVszZav7_ngY9xFHKNOz82Krb5XHumOnQLAXbSclT7Kxf8jL4HvMO8tzJnWZtfihN0Ny8R-y4YYT4Nzhs4j6cikijg9CgDLbW0ujc18G6tchiUoQhE1IzxMgszmxBBr_FNpdMvtZBcUys9tpdbN_IyK2lpzlrVKyIqOEkn352vfI_przkQgSwmwSm23a5aXh8pZKTUtp18WiKQMlDD9d3B-rvC2HMEwpGDd"
          />
          <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none" viewBox="0 0 400 400">
            <g fill="#FF007A" stroke="#FF007A">
              <circle cx="160" cy="170" r="2" />
              <circle cx="185" cy="170" r="2" />
              <path d="M150,170 Q172,160 195,170" fill="none" opacity="0.6" strokeWidth="1" />
              <circle cx="215" cy="170" r="2" />
              <circle cx="240" cy="170" r="2" />
              <path d="M205,170 Q227,160 250,170" fill="none" opacity="0.6" strokeWidth="1" />
              <circle cx="200" cy="200" r="2" />
              <circle cx="200" cy="235" r="2" />
              <path d="M200,200 L200,235" fill="none" opacity="0.6" strokeWidth="1" />
              <path d="M175,285 Q200,270 225,285 Q200,310 175,285 Z" fill="none" opacity="0.6" strokeWidth="1" />
              <path d="M130,200 Q140,300 200,350 Q260,300 270,200" fill="none" opacity="0.4" strokeWidth="1" />
            </g>
            <rect fill="#FF007A" height="1.5" opacity="0.5" width="200" x="100" y="140">
              <animate attributeName="y" dur="4s" repeatCount="indefinite" values="140;350;140" />
            </rect>
          </svg>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-6 flex justify-between items-end">
            <span className="text-white text-xs font-bold bg-vuka-pink px-3 py-1.5 rounded-full shadow-lg">
              정밀 스캔 모드 활성화
            </span>
            <span className="text-white/80 text-[10px] uppercase tracking-widest font-bold">AI Analytics</span>
          </div>
        </div>
      </main>

      <BottomCta
        label="다음 단계"
        onClick={() => router.push(`/upload?angle=${selectedAngle}`)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify page renders**

```bash
npm run dev
```
Open `http://localhost:3000` — should see the 3×3 angle grid with the scanning preview image.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add angle selection page"
```

---

## Task 8: Upload Page (`/upload`)

**Files:**
- Create: `app/upload/page.tsx`

- [ ] **Step 1: Create `app/upload/page.tsx`**

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import NavHeader from '@/components/NavHeader'
import StepHeader from '@/components/StepHeader'
import BottomCta from '@/components/BottomCta'

const ANGLE_LABELS: Record<string, string> = {
  nw: '좌측 상단', n: '상단', ne: '우측 상단',
  w: '좌측', center: '정면 (Frontal View)', e: '우측',
  sw: '좌측 하단', s: '하단', se: '우측 하단',
}

function UploadContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const angle = searchParams.get('angle') ?? 'center'
  const angleLabel = ANGLE_LABELS[angle] ?? '정면 (Frontal View)'

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col max-w-md mx-auto">
      <NavHeader showBack showMore />

      <main className="flex-1 pt-20 pb-32 px-6 flex flex-col gap-8">
        <StepHeader step={2} total={4} label="STEP 02" />

        <section className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">
            고화질 원본 사진을<br />업로드해 주세요
          </h1>
          <p className="text-on-surface-variant text-sm">AI 정밀 분석을 위해 보정되지 않은 원본이 필요합니다.</p>
        </section>

        <section
          className="relative group cursor-pointer"
          onClick={() => router.push(`/category-selection?angle=${angle}`)}
        >
          <div className="w-full aspect-square rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-low flex flex-col items-center justify-center gap-4 transition-all hover:bg-surface-container-high hover:border-primary/40">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-4xl">cloud_upload</span>
            </div>
            <div className="text-center">
              <p className="font-bold text-on-surface">사진 선택하기</p>
              <p className="text-xs text-on-surface-variant mt-1">JPG, PNG (최대 10MB)</p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider">선택한 각도 확인</h2>
          <div className="bg-surface-container-lowest p-4 rounded-lg flex items-center gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-surface-container">
            <div className="relative w-20 h-20 rounded-md overflow-hidden bg-surface-container">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="selected face preview"
                className="w-full h-full object-cover grayscale-[0.3]"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAVLmcp2sERbg_OmoDF6qtfHfduL49EUlt9f4zTozLT47n6Mig17J27t4M9S0BSN0iVD5RxL06qSHdqvE7b3nNfhVtgEMLJsWNyg1BZ4-39FCLry8PdzcVxph7J5WNbFfvWlUSIM5Zv-aBB74punGpd5vch95RVR9KYeG3n6la2I4S-EptUFk7urPSd7JwLVEd2JwoH9nNv-FV3uaKY7MmICd-NmjjDgvm5xZxzrzNiCbYd8LDNYY-XqJkdsb0Fuo14D5yIxh50S73L"
              />
              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-primary mb-1 uppercase tracking-tighter">Selected View</span>
              <span className="text-base font-bold text-on-surface">{angleLabel}</span>
              <span className="text-xs text-on-surface-variant mt-1 leading-relaxed">이전 단계에서 선택한 분석 각도입니다.</span>
            </div>
          </div>
        </section>

        <div className="bg-tertiary-container/5 rounded-lg p-5 flex gap-4 items-start border border-tertiary-container/10">
          <span className="material-symbols-outlined text-tertiary">lightbulb</span>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-tertiary">촬영 팁</p>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              밝은 자연광 아래에서 안경이나 액세서리를 제거하고 촬영하시면 더 정확한 AI 결과를 얻을 수 있습니다
            </p>
          </div>
        </div>
      </main>

      <BottomCta
        label="다음 단계"
        onClick={() => router.push(`/category-selection?angle=${angle}`)}
        secondary={{ label: '이전', onClick: () => router.back() }}
      />
    </div>
  )
}

export default function UploadPage() {
  return (
    <Suspense>
      <UploadContent />
    </Suspense>
  )
}
```

- [ ] **Step 2: Verify page renders**

```bash
npm run dev
```
Navigate to `http://localhost:3000` → click "다음 단계" → should land on `/upload?angle=center`.

- [ ] **Step 3: Commit**

```bash
git add app/upload/page.tsx
git commit -m "feat: add upload page"
```

---

## Task 9: Category Selection Page (`/category-selection`)

**Files:**
- Create: `app/category-selection/page.tsx`

- [ ] **Step 1: Create `app/category-selection/page.tsx`**

```tsx
'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import NavHeader from '@/components/NavHeader'
import StepHeader from '@/components/StepHeader'
import BottomCta from '@/components/BottomCta'

const MODELS = [
  { id: '20sF', label: '20s F', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAdY4FCKfW1rm19HQre2n8R2uWwgshQomUNHF-eBI9xms-j8-Q9kFwbTbNdJp4oz4ZBsv9168ppc4Nb8EpZRqfl4NflzcCMzPkkmHgBvFm3UX8_VU4UzRmPR3GXm_TvnZ3U0t5x49PqV2N86Sqih4qEfCt1r1fTrcwg3OfKGCm4_1STT2nsdQ3ijd8M0tQ7B_R_t48fI_c7WMN8ebbvbIVw7ZhuoLys7B4uuwvVCfTTXBzRKjYpj0AfbQVHxX4pEkP0uc4UC13BB6LJ' },
  { id: '20sM', label: '20s M', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBD9C8hvLe6GgUy7nsjmUOcUeX5wvJ6ioigiBUbcFtbqrfpbnGvgxhHwRwjarCdRGHst0KPwex2LmqRRPkdCbcC1cDPInedDg-bItgHxt7ukh_YzEDoI6k0YSTAuVyJEWapwCr0HCppbJuVnQj29Pbexz11mdRBt7t3cq4zClxnxby_tLCZIRHg64P2rdeCMkiy8tPFpnxbo9gVdXH0HDhu-EyV7TLx1TlWgsvsmKK97ZkFDR2XLyVUEtdlgZXRcP4M6mdQqrBBBFLA' },
  { id: '30sF', label: '30s F', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBS2IVeOxmKwvp80outBTE6oWljSJl_NKOkPtBLskUtuM7DNuvSO_KSTKcwRIsYXPCS-SYs3Vo-Mm7caOBVjUz5u07bVFIXnlJ2pqTnHE0e7EXajQF4dw60udfSbxp9gR7zhgPGoh_ueHtpGC7ST-OndBEUk-vSeYNWbWPzF2r72OAEvbXkMT-XHq5lQ_tZew3A9pAKIqKVtREnKHpl48LR-Xb3HwLGSrY4BTt2zCSNR_9kKvyi1sMqf-NieUthM_pWS3ctHVYICNJH' },
  { id: '30sM', label: '30s M', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCevDoQm4dxHzIg9SQWXbRXJUkVv9Y_YX8xaYEjaMVcdwUZ41C8rm1VqWb2pSqaP6GFj7klKsvqi3DKIOmQbYL16tBwyxXA2jp8jQWgyTg6dS2LyGWr4K21fd9ZgPon_p0pVz6HDXdEXsN87ANcQH2FjG5BaU9p5MTXL9rj0XaWeqnnNsqOaFCRBvhs5Eg81LimS4egmSHwptWSR4vVThJJ_d_tWTrFTTmC84vHv_kLbQbaND5FZZWLkt_Y894g8eGDbvWbWn8WDb20' },
  { id: '40sF', label: '40s F', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAflBETqNv5q66iQopTcilqRrlIfWHmCr1jWZaaFUyO_ibeNuVYOhBwV6qzyBlu0WI5b2lZL7g8r8pIhtJyIUkNNMbW9PGk29nzDlaG-7mE4ltTUBgG1X9ykKKK_GBolN9cLKlxIHFszmVA4gjICcyHUDHKEIbRZIEfWHLxelaTEzb2Zk1huJ2QYfIQdFuNWPcUdL7zNz86peyUIcYajBaxdiIMHqaqzqnJNzwFNS7fZpVyWR3kkxPR6HepY_TITwR-yMb2m7BGokmE' },
  { id: '40sM', label: '40s M', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD_wI-I0pQ8mDQeahgQ-hViRZ9bnusrscH6V0cwlD-tj0uIErveX1E6nuADsy9csWtysECGonkvbXvh9JP3peZpyLJy1_y5CNEk9CdlY0Y3t5tl6DrVRqdgXoZvKsFWf_dcbkO5YkeLoJ20Ego0yuHXmHaHTFME1GA3w-4eaJ4fKX5zHykXM58vrxxLbLIgz07Ny31_UMqzmKwjV2rIycpgScSfniTPHuTJ5EB8lBveqT_VoXAWsEhFFgCcgcb-K5KKLuY54FQ5_jut' },
  { id: '50sF', label: '50s F', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHGW_485MIRoP_dAxoK_XorID-MLrvfW2IX11fZoOBQ1h3W0NDRIPn7f089mECQ-0UbS1IDjsoT5sCCHMs6YrzeQVvTgC9rAtpy5ZlnT78B4rbS6NK3eIehiPqQpvu1hPMF7T7s7UEZ1P9R4DWWPrS9h_M1tRIDX3WDb7EtmaU6qgpW7itsKQ4tifxANsaDksWvDuORCE9Je0R30E-H7yOYQ_T40aF7GZkz1FZ9AOUV7Mpey7ZD4tiqYgYV6wkW0pI8cJy3CaxdWMb' },
  { id: '50sM', label: '50s M', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAw-ws3aZHxzXJL0hlmn0IQt4tnMVimikxR7TfAYKNBfeOBxzXnIVuuQJPvECJbSXMMNj24xMkWxb90BpgwoAS8vJ9dB435CLe3u564fFQ6jj6P3VIsCA336RZ4JV7oJWQgRE7tgt7ViOvpdnpfe35g5QfXXZ-qWovh_j57vX900Ofjp1miLmz18eLSrPEejiXbnEAdBINdV5Pccu2H6TUnvE4RHHK2crMjVHw6hnwilinIoaXpe4W6HssQ6lJT7W5umSU3u8Dn53_Z' },
]

function CategoryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const angle = searchParams.get('angle') ?? 'center'
  const [selected, setSelected] = useState('30sF')

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col max-w-md mx-auto relative overflow-x-hidden">
      <NavHeader showBack showMore />

      <main className="flex-1 pt-24 pb-32 px-6">
        <StepHeader step={3} total={4} label="STEP 03" />

        <div className="mb-10">
          <h1 className="text-[2rem] leading-tight font-headline font-bold text-on-surface tracking-tight mb-3">
            원하시는 모델/<br />스타일을 선택해 주세요
          </h1>
          <p className="text-on-surface-variant text-sm font-medium opacity-80">
            선택하신 모델은 AI 정밀 분석의 기준점이 되어 <br />가장 이상적인 밸런스를 제안합니다.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-12">
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
              {selected === model.id && (
                <div className="absolute top-2 right-2 bg-primary-container text-white rounded-full p-0.5 shadow-md">
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 700" }}>
                    check
                  </span>
                </div>
              )}
            </button>
          ))}
          <button className="group relative aspect-square rounded-lg overflow-hidden bg-surface-container-high transition-all duration-300 active:scale-95 hover:shadow-xl flex flex-col items-center justify-center gap-1 border-2 border-dashed border-outline-variant/30">
            <span className="material-symbols-outlined text-on-surface-variant group-hover:rotate-12 transition-transform" style={{ fontSize: '28px' }}>
              blur_on
            </span>
            <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Neutral</span>
          </button>
        </div>
      </main>

      <BottomCta
        label="분석 시작하기"
        onClick={() => router.push(`/model-detail?angle=${angle}&category=${selected}`)}
        icon="bolt"
        variant="primary"
      />

      <div className="fixed top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -z-10 translate-x-1/2 -translate-y-1/2" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-tertiary/5 rounded-full blur-[100px] -z-10 -translate-x-1/2 translate-y-1/2" />
    </div>
  )
}

export default function CategorySelectionPage() {
  return (
    <Suspense>
      <CategoryContent />
    </Suspense>
  )
}
```

- [ ] **Step 2: Verify page renders**

Navigate through the flow to `/category-selection` — 8 model thumbnails + 1 Neutral button should render in a 3-column grid.

- [ ] **Step 3: Commit**

```bash
git add app/category-selection/page.tsx
git commit -m "feat: add category selection page"
```

---

## Task 10: Model Detail Page (`/model-detail`)

**Files:**
- Create: `app/model-detail/page.tsx`

- [ ] **Step 1: Create `app/model-detail/page.tsx`**

```tsx
'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import NavHeader from '@/components/NavHeader'
import BottomCta from '@/components/BottomCta'

const FINAL_MODELS = [
  {
    id: 0,
    name: 'Model 01 · Radiant',
    desc: '광채 피부와 우아한 분위기',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuACeFe-XU-ji-ecdw-terS1m3rl_-m0wZo3Va3DCkHgsAnGhnA8uawRgy9ffW0iR4hqVUQIBnOL7-LVqB3m-osvjw9XL-c4Fa327-9SlWHfPk0Mct5kLONyhIL4kyFd6wY8ylhxsv_IThnZHTD75VKunWUq9vGSy54Is6G8lHn9B4197R3ujNByOOG6_JEFKmaq5IAPGhfV-U3FnOcg4l2ykQ9ih94q5XrcVyWBl0PzJufycuB4ERa6BZxePOQ7Afh_PRfMDLd2bn07',
  },
  {
    id: 1,
    name: 'Model 02 · Pure',
    desc: '맑고 투명한 네츄럴 룩',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDFYQhly7wkNiofFAmDsSIXQ0301OgsE3ts1g_3uaepGQr6M5WcK15QchrXZOEsS5fq53_au5nDCXgNpo0NUK8ojawufJekk2p6Bwz_YnFCJ91yR8dtIldWRgzPeiB8YTm1l6lRTp1YrCQjouLjPSd0AY3pP-6XG46lSpRtJKXM88wsbtmvP3hrY9qzK-Qh9a4ri3YIFm6cIT2753KflBE3vH8F0pBhdI7o3kJcxsCYmWSdJPbuYM-14KlRHQQXnLiCM69KaboFhm88',
  },
  {
    id: 2,
    name: 'Model 03 · Classic',
    desc: '건강하고 활기찬 정석 미인',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuANp-Y_jSYGDGnRCSaLrr-xbnLfBLO9y_OZRB8em43s9zarpM-5lKDQwns_03F6ZPhl5Bt3lwfVnNr7m7avRLqkPw2GByDJBi1A9vsYpveRkZ6gU3AnPSg2Vpn--nJYrZ-pCFAjfupa-AcC1WCigM_7Mih_FwnWKM-GLj1o7d1nFVmQMtf6g8-xYlpV8Awe0VxMrWxXzOpFFmNyKvGFc1Bo9v3xFHwUZOF0ktDzxf_gz2KMXTttCNfDmCI-I5NQSc2jbiLPdoP7qCMQ',
  },
  {
    id: 3,
    name: 'Model 04 · Modern',
    desc: '세련된 분위기의 입체적 윤곽',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCsnd7UhUonzgRWndu3goRaoZdCsXppXNP4EYnZdlv1-TJvUcM3bdumQ6qgwIJP_gQcBBfoRE9t93ZX_SiCzzqYMsOUaML1n8zhilE3eZjuzY8cIOj-0D079uLRgGfirCoG3qd5wXufGhagkYReVdUaU7EKjx-mXCWw8PlPF0H49UZL2MtuiXyP9n5ssRnzHC1E0eD4cpKqGMijku-_zEYgnJAxSePf45fyKoGRo5PXll8UA2exu1UVD_ez9QwP9NazyHauySkpYCnf',
  },
]

function ModelDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const angle = searchParams.get('angle') ?? 'center'
  const category = searchParams.get('category') ?? '30sF'
  const [selectedModel, setSelectedModel] = useState(0)

  const handleStart = () => {
    console.log('AI 합성 시작:', { angle, category, model: selectedModel })
  }

  return (
    <div className="bg-background min-h-screen">
      <NavHeader showBack />

      <main className="pt-24 pb-48 px-6 max-w-screen-md mx-auto">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center space-x-2 bg-surface-container-high px-4 py-1.5 rounded-full mb-4">
            <span className="text-[10px] font-extrabold tracking-widest text-primary uppercase">Step 04</span>
            <div className="w-1 h-1 rounded-full bg-outline-variant" />
            <span className="text-[10px] font-bold tracking-widest text-secondary uppercase">Final Model Selection</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-on-surface">
            원하시는 AI 모델을 <br className="md:hidden" /> 선택해 주세요
          </h1>
          <p className="mt-3 text-secondary text-sm font-medium opacity-80">
            고객님의 이미지와 가장 잘 어울리는 페이스 모델을 제안합니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:gap-12">
          {FINAL_MODELS.map((model) => (
            <div
              key={model.id}
              className="relative group cursor-pointer"
              onClick={() => setSelectedModel(model.id)}
            >
              <div
                className={`relative aspect-[4/5] rounded-[2rem] overflow-hidden transition-all duration-300 ${
                  selectedModel === model.id
                    ? 'model-selected-ring scale-[1.02]'
                    : 'border-2 border-transparent hover:border-outline-variant'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={model.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  src={model.img}
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-t ${
                    selectedModel === model.id ? 'from-primary/40' : 'from-black/20'
                  } to-transparent`}
                />
                {selectedModel === model.id && (
                  <div className="absolute top-4 right-4 z-20 bg-primary text-white p-1.5 rounded-full shadow-lg">
                    <span
                      className="material-symbols-outlined text-sm font-bold"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-4 text-center">
                <p className={`text-xs font-black tracking-widest uppercase ${selectedModel === model.id ? 'text-primary' : 'text-on-surface/60'}`}>
                  {model.name}
                </p>
                <p className="text-[10px] text-secondary mt-1 font-medium leading-tight">{model.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomCta
        label="AI 합성 시작하기"
        onClick={handleStart}
        icon="bolt"
        variant="glow"
      />
    </div>
  )
}

export default function ModelDetailPage() {
  return (
    <Suspense>
      <ModelDetailContent />
    </Suspense>
  )
}
```

- [ ] **Step 2: Verify full flow works**

```bash
npm run dev
```
Walk the full flow: `/` → `/upload` → `/category-selection` → `/model-detail`  
Each page should render correctly and query params should carry through.

- [ ] **Step 3: Commit**

```bash
git add app/model-detail/page.tsx
git commit -m "feat: add model detail page"
```

---

## Task 11: Run All Tests

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```
Expected output:
```
PASS  __tests__/components/NavHeader.test.tsx
PASS  __tests__/components/StepHeader.test.tsx
PASS  __tests__/components/BottomCta.test.tsx

Test Suites: 3 passed, 3 total
Tests:       8 passed, 8 total
```

- [ ] **Step 2: Fix any failures before proceeding**

If tests fail, read the error message and fix the relevant component or test.

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "chore: verify all tests pass"
```

---

## Task 12: Build Verification

- [ ] **Step 1: Run production build**

```bash
npm run build
```
Expected: No TypeScript errors, no build errors. Output shows all 4 routes compiled.

- [ ] **Step 2: Fix any TypeScript or build errors**

Common issues:
- Missing `'use client'` on pages using hooks → add it to the top
- `Suspense` missing around `useSearchParams()` → already handled in Tasks 8–10

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "chore: verify production build passes"
```
