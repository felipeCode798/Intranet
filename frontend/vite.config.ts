import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo el API corre en :3100; Vite reenvía /api y /uploads
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3100',
      '/uploads': 'http://localhost:3100',
    },
  },
});
