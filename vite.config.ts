import { resolve } from 'path';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index'),
        background: resolve(__dirname, 'src/background/service-worker'),
        settings: resolve(__dirname, 'src/settings/settings'),
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  publicDir: 'public',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    exclude: ['tests/e2e/**', '**/node_modules/**'],
  },
});
