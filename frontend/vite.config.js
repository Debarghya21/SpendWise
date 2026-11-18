import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In local dev, /api and /health are proxied to the API Gateway on :8080
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8080',
      '/health': 'http://localhost:8080',
    },
  },
});
