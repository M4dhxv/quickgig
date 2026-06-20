// Paste inside module.exports.theme.extend in tailwind.config.js
{
  colors: {
    orange: { DEFAULT: '#FF5A1F', deep: '#E8430A' },
    cobalt: '#2E5BFF',
    ink: '#0E1633',
    haze: '#F5F6FA',
    slate: '#5A6178',
    line: '#E4E7F0',
    cloud: '#FFFFFF',
  },
  fontFamily: {
    display: ['Archivo', 'system-ui', 'sans-serif'],
    body: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
    mono: ['"Space Mono"', 'ui-monospace', 'monospace'],
  },
  fontSize: {
    h1: ['60px', { lineHeight: '1.0' }],
    h2: ['40px', { lineHeight: '1.05' }],
    h3: ['26px', { lineHeight: '1.15' }],
    lead: ['20px', { lineHeight: '1.5' }],
    body: ['16px', { lineHeight: '1.6' }],
    small: ['14px', { lineHeight: '1.5' }],
    caption: ['12px', { lineHeight: '1.4' }],
    stat: ['24px', { lineHeight: '1.2' }],
  },
  borderRadius: { sm: '8px', md: '12px', lg: '16px', pill: '999px' },
  boxShadow: {
    card: '0 4px 16px rgba(14,22,51,0.08)',
    pop: '0 12px 32px rgba(14,22,51,0.16)',
  },
}
