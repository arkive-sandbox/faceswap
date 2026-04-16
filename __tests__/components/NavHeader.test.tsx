import { render, screen, fireEvent } from '@testing-library/react'
import NavHeader from '@/components/NavHeader'

const mockBack = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack }),
}))

describe('NavHeader', () => {
  beforeEach(() => {
    mockBack.mockClear()
  })

  it('renders title', () => {
    render(<NavHeader title="Vuka Clinical Aesthetic" />)
    expect(screen.getByText('Vuka Clinical Aesthetic')).toBeInTheDocument()
  })

  it('renders back button when showBack is true', () => {
    render(<NavHeader showBack />)
    expect(screen.getByRole('button', { name: '뒤로가기' })).toBeInTheDocument()
  })

  it('calls router.back when back button is clicked', () => {
    render(<NavHeader showBack />)
    fireEvent.click(screen.getByRole('button', { name: '뒤로가기' }))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('does not render back button when showBack is false', () => {
    render(<NavHeader />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
