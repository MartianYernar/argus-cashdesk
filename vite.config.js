import { defineConfig } from 'vite';

// relative base so the build works on GitHub Pages (/<repo>/) and when served by the backend
export default defineConfig({
  base: './',
  server: { port: 5173 },
});
