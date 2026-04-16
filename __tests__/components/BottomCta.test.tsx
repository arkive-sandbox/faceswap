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

  it('calls secondary onClick when secondary button is clicked', () => {
    const secondaryClick = jest.fn()
    render(
      <BottomCta
        label="다음"
        onClick={() => {}}
        secondary={{ label: '이전', onClick: secondaryClick }}
      />
    )
    fireEvent.click(screen.getByText('이전'))
    expect(secondaryClick).toHaveBeenCalledTimes(1)
  })
})
