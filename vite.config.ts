import { defineConfig } from 'vite';
import { sharedNotices } from './scripts/shared-notices.mjs';

// Browser development keeps its legacy API. Native builds have a distinct
// composition root and cannot accidentally bundle that adapter.
export default defineConfig(({ mode }) => ({
  plugins: [sharedNotices(), ...(['native', 'desktop'].includes(mode) ? [{ name: 'installed-entry', transformIndexHtml: { order: 'pre', handler: (html: string) => html.replace('/src/bootstrap.tsx', mode === 'native' ? '/src/native-bootstrap.tsx' : '/src/desktop-bootstrap.tsx') } }] : [])],
  build: { outDir: mode === 'native' ? 'dist-native' : mode === 'desktop' ? 'dist-desktop' : 'dist' },
  server: {
    host: '127.0.0.1', port: 5188, strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8080' },
  },
}));
