/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary:          'var(--color-primary)',
        'primary-dark':   'var(--color-primary-dark)',
        'primary-light':  'var(--color-primary-light)',
        surface:          'var(--color-surface)',
        'surface-muted':  'var(--color-surface-muted)',
        'surface-hover':  'var(--color-surface-hover)',
        border:           'var(--color-border)',
        'border-strong':  'var(--color-border-strong)',
        'text-default':   'var(--color-text-default)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted':     'var(--color-text-muted)',
        'text-placeholder':'var(--color-text-placeholder)',
        'text-inverse':   'var(--color-text-inverse)',
        success:          'var(--color-success)',
        'success-bg':     'var(--color-success-bg)',
        'success-border': 'var(--color-success-border)',
        danger:           'var(--color-danger)',
        'danger-bg':      'var(--color-danger-bg)',
        'danger-border':  'var(--color-danger-border)',
        warning:          'var(--color-warning)',
        'warning-bg':     'var(--color-warning-bg)',
        'warning-border': 'var(--color-warning-border)',
        info:             'var(--color-info)',
        'info-bg':        'var(--color-info-bg)',
        'info-border':    'var(--color-info-border)',
        background:       'var(--color-bg)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        xs:   'var(--shadow-xs)',
        sm:   'var(--shadow-sm)',
        md:   'var(--shadow-md)',
        lg:   'var(--shadow-lg)',
        xl:   'var(--shadow-xl)',
      },
      borderRadius: {
        sm:   'var(--radius-sm)',
        md:   'var(--radius-md)',
        lg:   'var(--radius-lg)',
        xl:   'var(--radius-xl)',
      },
      keyframes: {
        fadeInUp: {
          'from': { opacity: '0', transform: 'translateY(8px)' },
          'to':   { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          'from': { opacity: '0', transform: 'scale(0.96)' },
          'to':   { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.3s ease-out forwards',
        'scale-in':   'scaleIn 0.2s ease-out forwards',
      },
    },
  },
  plugins: [],
};
