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

  it('sets progress bar width proportional to step', () => {
    const { container } = render(<StepHeader step={2} total={4} label="STEP 02" />)
    const bar = container.querySelector('[style*="width"]') as HTMLElement
    expect(bar.style.width).toBe('50%')
  })
})
