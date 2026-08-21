/** @type {import('tailwindcss').Config} */
// NOTA: este config replica bit a bit el <script>tailwind.config = {...}</script>
// que tenía cd.html embebido. El valor de "primary" ('000080', sin '#') es
// inválido como color CSS y por lo tanto NO se está aplicando hoy en el sitio
// en producción (el <h1> "Completar Formulario" con clase text-primary queda
// sin colorear). Se preserva tal cual para no introducir cambios visuales en
// este paso. Ver aviso en el mensaje de la conversación para corregirlo cuando
// quieran.
export default {
  content: ['./src/**/*.html', './src/js/**/*.js'],
  theme: {
    extend: {
      fontFamily: { sans: ['Geist', 'sans-serif'] },
      colors: {
        primary: '000080',
        'primary-light': '#f8fafc',
        accent: '#2563eb',
      },
    },
  },
  plugins: [],
};
