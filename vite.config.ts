import { defineConfig } from 'vite';

// Relative asset paths, so the build works at any address: the root of a
// domain or a project page such as /quake-globe/.
export default defineConfig({
  base: './',
});
