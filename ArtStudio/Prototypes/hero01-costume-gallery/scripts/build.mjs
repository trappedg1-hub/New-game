// Build the gallery alongside, rather than instead of, the approved Night Step.
// Existing prototype sources and source illustrations are never modified.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cp, lstat, mkdir, readFile, readlink, rm, symlink, copyFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { art } from '../site/catalog-data.mjs';

const gallery = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(gallery, '../../..');
const prototypes = join(repo, 'ArtStudio/Prototypes');
const dist = join(gallery, 'dist');
const dependencies = join(prototypes, 'hero01-night-step/node_modules');
const vite = join(dependencies, 'vite/bin/vite.js');
const createdLinks = [];

async function ensureDependencies(project) {
  const link = join(project, 'node_modules');
  try {
    await lstat(link);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const target = relative(project, dependencies);
    await symlink(target, link, 'dir');
    createdLinks.push({ link, target });
  }
}

function viteBuild(projectName, destination) {
  const project = join(prototypes, projectName);
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', destination, '--emptyOutDir'], {
    cwd: project, stdio: 'inherit', env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${projectName}: build failed (${result.status ?? result.signal})`);
}

async function copyVerifiedArt() {
  const target = join(dist, 'collection/art');
  await mkdir(target, { recursive: true });
  for (const item of art) {
    await lstat(join(gallery, 'site/thumb', `${item.id}.webp`));
    const source = join(repo, 'ArtStudio/Generated', item.source, item.file);
    const bytes = await readFile(source);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!png || bytes.readUInt32BE(16) !== item.width || bytes.readUInt32BE(20) !== item.height || hash !== item.sha256) {
      throw new Error(`Source image does not match the recorded original: ${item.file}`);
    }
    await copyFile(source, join(target, item.file));
    console.log(`Verified original: ${item.file} (${item.width}×${item.height})`);
  }
}

try {
  await lstat(vite).catch(() => { throw new Error('Run npm --prefix ArtStudio/Prototypes/hero01-night-step ci first.'); });
  await rm(dist, { recursive: true, force: true });
  // Keep the previously published / Night Step exactly as a standalone app.
  viteBuild('hero01-night-step', dist);
  await cp(join(gallery, 'site'), join(dist, 'collection'), { recursive: true });
  await copyVerifiedArt();
  for (const [project, folder] of [
    ['hero01-idle', 'maid-v1'],
    ['hero01-idle-v2', 'maid-v2'],
    ['hero01-interactive-v3', 'maid-v3'],
    ['hero01-yoga-girl', 'yoga'],
  ]) {
    const projectDir = join(prototypes, project);
    await ensureDependencies(projectDir);
    viteBuild(project, join(dist, 'collection/motion', folder));
  }
  console.log('Gallery built at /collection/; Night Step remains at /.');
} finally {
  // Only remove symlinks this build created, never an existing node_modules.
  for (const { link, target } of createdLinks) {
    try {
      if ((await lstat(link)).isSymbolicLink() && await readlink(link) === target) await rm(link);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}
