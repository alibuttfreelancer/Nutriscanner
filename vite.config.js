import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    // Allow the sandboxed live-preview host (*.e2b.app) to reach the dev server.
    allowedHosts: ['.e2b.app'],
  },
});
