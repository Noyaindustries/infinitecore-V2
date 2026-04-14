import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => {
    return {
      // Port 5173 : `vite` seul n’écoute pas les routes /api/* (celles-ci sont sur `npm run dev` → Express :3000).
      server: {
        port: 5173,
        host: '0.0.0.0',
        // Si vous lancez seulement `vite` ici et l’API Express sur le port 3000, les GET /api/* (iframe PDF, upload) passent par ce proxy.
        proxy: {
          '/api': {
            target: 'http://127.0.0.1:3000',
            changeOrigin: true,
          },
        },
      },
      plugins: [
        react(),
        tailwindcss(),
      ],
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              'vendor-ui': ['framer-motion', 'lucide-react'],
              'vendor-utils': ['clsx', 'zustand', 'react-hot-toast', 'tailwind-merge'],
            },
          },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
          'firebase/app': path.resolve(__dirname, 'src/lib/mongoApp.ts'),
          'firebase/auth': path.resolve(__dirname, 'src/lib/mongoAuth.ts'),
          'firebase/firestore': path.resolve(__dirname, 'src/lib/mongoFirestore.ts'),
        }
      }
    };
});
