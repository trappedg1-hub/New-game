import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Allow only this isolated project and the one approved source image. The source
// is read directly, never written to or duplicated in the source tree.
const projectDir = fileURLToPath(new URL('.', import.meta.url));
const approvedSource = fileURLToPath(new URL('../../Generated/Approved/HERO-01_outfit02_playful_maid.png', import.meta.url));

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app'],
    fs: { allow: [projectDir, approvedSource] },
  },
  preview: { host: '0.0.0.0', allowedHosts: ['.e2b.app'] },
});
