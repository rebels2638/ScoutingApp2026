module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: '#09090B',
        foreground: '#FAFAFA',

        card: {
          DEFAULT: '#0A0A0C',
          foreground: '#FAFAFA',
        },

        primary: {
          DEFAULT: '#FAFAFA',
          foreground: '#18181B',
        },

        secondary: {
          DEFAULT: '#27272A',
          foreground: '#FAFAFA',
        },

        muted: {
          DEFAULT: '#27272A',
          foreground: '#A1A1AA',
        },

        accent: {
          DEFAULT: '#27272A',
          foreground: '#FAFAFA',
        },

        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#FAFAFA',
        },

        border: '#27272A',
        input: '#27272A',
        ring: '#D4D4D8',

        outline: {
          DEFAULT: '#3F3F46',
          variant: '#27272A',
        },

        alliance: {
          red: '#EF4444',
          'red-muted': '#7F1D1D',
          blue: '#3B82F6',
          'blue-muted': '#1E3A5F',
        },
      },
      borderRadius: {
        'xs': '2px',
        'sm': '4px',
        'md': '6px',
        'lg': '8px',
        'xl': '12px',
        '2xl': '16px',
        'full': '9999px',
      },
    },
  },
  plugins: [],
}
