import { brand, teal, ui, status, surface, text } from './colors'

export const colors = { brand, teal, ui, status, surface, text }

export const typography = {
  fontDisplay: 'DMSerifDisplay',
  fontBody:    'DMSans',
  size: {
    xs:      10,
    sm:      12,
    md:      14,
    base:    16,
    lg:      20,
    xl:      24,
    xxl:     36,
    display: 52,
  },
  weight: {
    regular:  '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
  },
} as const

export const spacing = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const

export const radius = {
  sm:   6,
  md:   12,
  lg:   20,
  xl:   32,
  full: 9999,
} as const

export const animation = {
  fast:   150,
  normal: 250,
  spring: 400,
  slow:   600,
} as const

export const tokens = { colors, typography, spacing, radius, animation } as const
export type Tokens = typeof tokens
