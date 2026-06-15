import { defineConfig } from 'vite';

// Single immersive page; no SSR. Ship a small, fast bundle.
export default defineConfig({
  base: './',
  build: {
    target: 'es2021',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
