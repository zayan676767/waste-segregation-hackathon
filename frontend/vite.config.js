import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:4000';

/**
 * HTTPS is opt-in via `npm run dev:https`, which runs `vite --mode https`.
 *
 * A phone will not open its camera on a plain-http LAN address — getUserMedia
 * requires a secure context, and only localhost is exempt. Serving the dev server
 * over https with a self-signed certificate makes the phone treat the laptop's
 * LAN address as secure once the certificate warning is accepted, which is what
 * lets the camera work over a hotspot with no internet and no tunnel.
 *
 * `--mode` is used rather than an env var because Windows npm scripts cannot set
 * inline environment variables, and this avoids adding cross-env just for that.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'https' ? [basicSsl()] : [])],
  server: {
    // host: true exposes the dev server on the local network so a phone can
    // open it. Vite prints the "Network:" URL on startup.
    host: true,
    port: 5173,
    // Proxying means the frontend only ever calls relative paths like
    // /api/... — so it works unchanged on localhost, over the LAN, and
    // through an https tunnel, with no base URL hardcoded anywhere.
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/socket.io': { target: BACKEND, changeOrigin: true, ws: true }
    }
  },
  preview: {
    host: true,
    port: 4173
  }
}));
