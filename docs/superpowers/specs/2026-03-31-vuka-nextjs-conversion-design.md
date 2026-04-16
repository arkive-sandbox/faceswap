# Vuka Clinical Aesthetic — Next.js Conversion Design

**Date:** 2026-03-31  
**Status:** Approved

---

## Overview

Convert the single-file HTML/React prototype (`index.html`) of the Vuka Clinical Aesthetic face-swap web app into a proper Next.js 15 project with App Router, TypeScript, and Tailwind CSS.

The prototype has 4 screens connected via `MemoryRouter`. The goal is a clean, production-ready Next.js project structure that mirrors the prototype's UI and flow exactly.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v3 with custom theme
- **Fonts:** Plus Jakarta Sans, Noto Sans KR (via `next/font/google`)
- **Icons:** Material Symbols Outlined (via `<link>` tag in `app/layout.tsx`)

---

## Routes

| URL | Page | Description |
|---|---|---|
| `/` | Angle Selection | 3×3 grid for shooting angle selection, scanning animation overlay |
| `/upload` | Photo Upload | File upload area + selected angle confirmation card |
| `/category-selection` | Category Selection | 8-model thumbnail grid (age/gender categories) |
| `/model-detail` | Final Model Detail | 2×2 grid of detailed models, AI synthesis CTA |

---

## Project Structure

```
face-swap-web/
├── app/
│   ├── layout.tsx                  # Root layout: fonts, global styles, metadata
│   ├── globals.css                 # Tailwind directives + custom CSS (.vuka-glow, .scanning-line, etc.)
│   ├── page.tsx                    # / → AngleSelectionPage
│   ├── upload/
│   │   └── page.tsx                # /upload → UploadPage
│   ├── category-selection/
│   │   └── page.tsx                # /category-selection → CategorySelectionPage
│   └── model-detail/
│       └── page.tsx                # /model-detail → ModelDetailPage
├── components/
│   ├── NavHeader.tsx               # Sticky top nav with back button + brand title
│   ├── StepHeader.tsx              # Step indicator + progress bar (upload, category, model-detail)
│   └── BottomCta.tsx               # Fixed bottom CTA button
├── tailwind.config.ts              # Full custom theme from prototype
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## Data Flow

State is kept minimal — each page is mostly self-contained. Selected values are passed via URL query parameters:

1. `/` — user picks angle → navigates to `/upload?angle=<id>`
2. `/upload` — reads `?angle` to display confirmed angle → navigates to `/category-selection?angle=<id>`
3. `/category-selection` — user picks category → navigates to `/model-detail?angle=<id>&category=<id>`
4. `/model-detail` — user picks final model → "AI 합성 시작하기" button (stub for now, logs to console)

No global state manager (Zustand/Redux) needed at this stage.

---

## Component Breakdown

### `NavHeader`
Props: `title?: string`, `showBack?: boolean`, `showMore?: boolean`  
Renders the sticky top navigation bar used across all 4 pages.

### `StepHeader`
Props: `step: number`, `total: number`, `label: string`  
Renders "STEP 0X / N" + progress bar. Used on upload, category-selection, model-detail.

### `BottomCta`
Props: `label: string`, `onClick: () => void`, `secondary?: { label: string; onClick: () => void }`  
Fixed bottom button. Renders single primary button or primary+secondary pair.

---

## Styling

All custom Tailwind tokens from the prototype are copied verbatim into `tailwind.config.ts`:
- Custom colors (vuka-pink, primary, surface-*, tertiary-container, etc.)
- Custom fonts (headline, body, label → Plus Jakarta Sans + Noto Sans KR)
- Custom border radius

Custom CSS in `globals.css`:
- `.vuka-glow` — pink glow box-shadow
- `.model-selected-ring` — selection ring animation
- `.scanning-line` — scan animation keyframes
- `.glass-panel` — backdrop blur glass effect

---

## Error Handling

- No API calls at this stage — all data is static/hardcoded from the prototype
- Invalid route → Next.js default 404

---

## Out of Scope

- Actual file upload logic (S3, etc.)
- AI face-swap API integration
- Authentication
- Dark mode
