export const brand = {
  green400: '#1DB87A',
  green500: '#169960',
  green600: '#0F7A4A',
  green50:  '#E8F7F0',
} as const

export const ui = {
  slate900: '#0D1117',
  slate800: '#1A202C',
  slate600: '#4A5568',
  slate200: '#CDD4DC',
  white:    '#FFFFFF',
} as const

export const status = {
  amber: '#EF9F27',
  red:   '#E24B4A',
  blue:  '#378ADD',
} as const

export const text = {
  primary:   '#0D1117',
  secondary: '#4A5568',
  inverse:   '#FFFFFF',
  brand:     '#169960',
  muted:     '#CDD4DC',
} as const

export const colors = { brand, ui, status, text } as const
export type Colors = typeof colors
