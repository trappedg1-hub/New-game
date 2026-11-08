import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
const projectDir=fileURLToPath(new URL('.',import.meta.url));
const approvedSource=fileURLToPath(new URL('../../Generated/Approved/HERO-01_outfit10_night_lingerie_step_pose.png',import.meta.url));
export default defineConfig({
  base:'./',
  server:{host:'0.0.0.0',allowedHosts:['.e2b.app'],fs:{allow:[projectDir,approvedSource]}},
  preview:{host:'0.0.0.0',allowedHosts:['.e2b.app']},
});
