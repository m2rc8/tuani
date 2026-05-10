export const brand = {
  green50:  '#E8F7F0',
  green100: '#C2EAD8',
  green200: '#7FD4B0',
  green400: '#1DB87A',
  green500: '#169960',
  green600: '#0F7A4A',
  green700: '#085C36',
  green800: '#053D23',
} as const

export const teal = {
  teal50:  '#E3F4F4',
  teal200: '#7ECECE',
  teal400: '#1DA8A8',
  teal600: '#0F6E6E',
} as const

export const ui = {
  slate50:  '#F4F6F8',
  slate100: '#E8ECF0',
  slate200: '#CDD4DC',
  slate400: '#8A97A6',
  slate600: '#4A5568',
  slate800: '#1A202C',
  slate900: '#0D1117',
  white:    '#FFFFFF',
} as const

export const status = {
  amber: '#EF9F27',
  red:   '#E24B4A',
  blue:  '#378ADD',
} as const

export const surface = {
  base:        '#0D1117',
  card:        'rgba(255,255,255,0.04)',
  cardBrand:   'rgba(29,184,122,0.06)',
  border:      'rgba(255,255,255,0.08)',
  borderBrand: 'rgba(29,184,122,0.18)',
  input:       'rgba(255,255,255,0.04)',
  inputBorder: 'rgba(255,255,255,0.12)',
} as const

export const text = {
  primary:   '#FFFFFF',
  secondary: 'rgba(255,255,255,0.5)',
  muted:     'rgba(255,255,255,0.3)',
  brand:     '#1DB87A',
  inverse:   '#0D1117',
} as const

export const colors = { brand, teal, ui, status, surface, text } as const
export type Colors = typeof colors
