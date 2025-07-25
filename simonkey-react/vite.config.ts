import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar React y bibliotecas core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // Separar Firebase
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          
          // Separar bibliotecas de UI
          'ui-vendor': ['@fortawesome/fontawesome-free', '@fortawesome/react-fontawesome', '@fortawesome/free-solid-svg-icons'],
          
          // Separar bibliotecas de gráficos
          'charts-vendor': ['recharts', 'react-big-calendar', 'react-calendar'],
          
          // Separar bibliotecas utilitarias
          'utils-vendor': ['date-fns', 'papaparse', 'pdf-parse', 'pdfjs-dist'],
          
          // Separar bibliotecas de UI específicas
          'radix-vendor': ['@radix-ui/react-dialog', 'lucide-react', 'react-confetti']
        }
      }
    },
    // Optimizar chunks
    chunkSizeWarningLimit: 1000,
    // Habilitar tree shaking
    minify: 'esbuild',
    // Optimizar assets
    assetsInlineLimit: 4096,
  },
  // Optimizar dependencias
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'firebase/app',
      'firebase/auth', 
      'firebase/firestore'
    ],
  },
  server: {
    host: true
  }
})