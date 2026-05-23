/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Old-money private-wealth palette
        bg:       '#0B1220',  // background — deep navy / near-black
        surface:  '#141B2D',  // surfaces / cards — dark slate
        surface2: '#1B243B',  // raised surfaces
        gold:     '#C9A961',  // primary accent — muted gold
        goldDim:  '#9C8348',
        success:  '#3F8F5C',  // deep green
        warning:  '#D9A441',  // amber
        danger:   '#B14444',  // deep red
        ink:      '#EDE8DC',  // text — warm white
        inkDim:   '#A8A293',  // secondary text
        line:     '#252E47',  // subtle borders
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Playfair Display', 'Georgia', 'serif'],
        sans:  ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '4px',
        lg: '8px',
      },
    },
  },
  plugins: [],
};
