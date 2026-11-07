import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function githubPagesSpaPlugin(): Plugin {
  return {
    name: 'github-pages-spa-plugin',
    apply: 'build',
    transformIndexHtml(html) {
      // Remove the development-only root fallback script from compiled production HTML
      return html.replace(
        /<!-- GITHUB_PAGES_ROOT_FALLBACK_START -->[\s\S]*?<!-- GITHUB_PAGES_ROOT_FALLBACK_END -->\s*/g,
        ''
      );
    },
    closeBundle() {
      const distDir = path.resolve(import.meta.dirname, 'dist');
      const indexHtmlPath = path.join(distDir, 'index.html');
      const notFoundHtmlPath = path.join(distDir, '404.html');
      const noJekyllPath = path.join(distDir, '.nojekyll');

      if (fs.existsSync(indexHtmlPath)) {
        fs.copyFileSync(indexHtmlPath, notFoundHtmlPath);
      }
      if (!fs.existsSync(noJekyllPath)) {
        fs.writeFileSync(noJekyllPath, '');
      }

      // Synchronize compiled production output to docs/ so GitHub Pages works
      // seamlessly even if the repository source is set to "Deploy from a branch (main / docs)"
      const docsDir = path.resolve(import.meta.dirname, 'docs');
      try {
        fs.cpSync(distDir, docsDir, { recursive: true, force: true });
      } catch (err) {
        console.warn('Notice: Could not sync dist to docs:', err);
      }
    },
  };
}

export default defineConfig(() => {
  const rawBase = process.env.VITE_BASE_PATH?.trim();
  const normalizedBase = rawBase
    ? rawBase.endsWith('/')
      ? rawBase
      : `${rawBase}/`
    : './';

  return {
    base: normalizedBase,
    plugins: [react(), tailwindcss(), githubPagesSpaPlugin()],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: false,
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

