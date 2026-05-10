import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Update this when deploying under a different GitHub repo name.
  base: '/toolbox/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'pdf-vendor': ['pdf-lib']
        }
      }
    }
  }
});

