import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Las páginas HTML viven en src/
  root: 'src',

  // Assets estáticos (icons, robots.txt, sitemap.xml, quill.snow.css)
  // se sirven/copian tal cual, sin pasar por el pipeline de build.
  // Ruta relativa a `root`.
  publicDir: '../public',

  build: {
    // Salida a dist/, en la raíz del proyecto (hermana de functions/)
    outDir: '../dist',
    emptyOutDir: true,

    rollupOptions: {
      // App multi-página: cada .html es un entry point independiente
      input: {
        index: resolve(__dirname, 'src/index.html'),
        cd: resolve(__dirname, 'src/cd.html'),
        ayuda: resolve(__dirname, 'src/ayuda.html'),
        login: resolve(__dirname, 'src/login.html'),
        'mis-cartas': resolve(__dirname, 'src/mis-cartas.html'),
        compartir: resolve(__dirname, 'src/compartir.html'),
      },
    },
  },
});
