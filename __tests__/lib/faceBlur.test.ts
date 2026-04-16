import { buildFaceLandmarkGroups, insetFaceOvalPoints } from '@/lib/faceBlur'

function createLandmarks() {
  return Array.from({ length: 500 }, (_, idx) => ({
    x: (idx % 20) / 20,
    y: (idx % 25) / 25,
  }))
}

describe('buildFaceLandmarkGroups', () => {
  it('builds grouped facial features from landmarks', () => {
    const groups = buildFaceLandmarkGroups(createLandmarks())

    expect(groups.map((group) => group.key)).toEqual([
      'faceOval',
      'leftEyebrow',
      'rightEyebrow',
      'leftEye',
      'rightEye',
      'noseBridge',
      'noseBase',
      'outerLips',
      'innerLips',
    ])
  })

  it('prefers custom face oval points while keeping internal features', () => {
    const customFaceOval = [
      { x: 0.1, y: 0.1 },
      { x: 0.3, y: 0.1 },
      { x: 0.2, y: 0.3 },
    ]

    const groups = buildFaceLandmarkGroups(createLandmarks(), customFaceOval)

    expect(groups[0]?.key).toBe('faceOval')
    expect(groups[0]?.points).toEqual(customFaceOval)
    expect(groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'leftEye' }),
        expect.objectContaining({ key: 'outerLips' }),
      ])
    )
  })

  it('returns only the custom face oval when automatic landmarks are unavailable', () => {
    const customFaceOval = [
      { x: 0.2, y: 0.2 },
      { x: 0.4, y: 0.2 },
      { x: 0.3, y: 0.4 },
    ]

    const groups = buildFaceLandmarkGroups(undefined, customFaceOval)

    expect(groups).toHaveLength(1)
    expect(groups[0]).toEqual(expect.objectContaining({ key: 'faceOval', points: customFaceOval }))
  })
})

describe('insetFaceOvalPoints', () => {
  it('shrinks the upper face boundary more aggressively than the lower face boundary', () => {
    const points = [
      { x: 0.25, y: 0.2 },
      { x: 0.75, y: 0.2 },
      { x: 0.8, y: 0.7 },
      { x: 0.5, y: 0.85 },
      { x: 0.2, y: 0.7 },
    ]

    const inset = insetFaceOvalPoints(points)

    expect(inset[0]!.y).toBeGreaterThan(points[0]!.y)
    expect(inset[1]!.y).toBeGreaterThan(points[1]!.y)
    expect(inset[3]!.y).toBeLessThan(points[3]!.y)
    expect(inset[0]!.y - points[0]!.y).toBeGreaterThan(points[3]!.y - inset[3]!.y)
  })
})
