import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Browser tests mock the versioned API before navigation. Using the frontend-only
// Vite plugin keeps E2E state ephemeral and leaves Worker/D1 coverage to the Worker suite.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    strictPort: true,
  },
});
