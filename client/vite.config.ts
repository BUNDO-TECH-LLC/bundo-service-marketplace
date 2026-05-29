import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split large, rarely-changing vendors into their own cacheable chunks so
        // app updates don't force users to re-download Firebase/React on every deploy.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase-vendor': [
            'firebase/app',
            'firebase/auth',
            'firebase/messaging',
          ],
        },
      },
    },
  },
});
