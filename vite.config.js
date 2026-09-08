import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        rendezvous: resolve(__dirname, 'pages/rendez-vous.html'),
        admin: resolve(__dirname, 'pages/admin.html'),
        mentionsLegales: resolve(__dirname, 'pages/mentions-legales.html'),
        confidentialite: resolve(__dirname, 'pages/confidentialite.html'),
      }
    }
  }
});
