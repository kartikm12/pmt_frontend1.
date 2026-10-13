import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      allowedHosts: true,
    },
    preview: {
      allowedHosts: true,
    },
    build: {
      rollupOptions: {
        output: {
          // Big libraries in their own files: they download in parallel and stay cached across deploys
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (/[\/](react|react-dom|react-router|react-router-dom|scheduler)[\/]/.test(id)) return 'react';
            if (/[\/](motion|framer-motion|motion-dom|motion-utils)[\/]/.test(id)) return 'motion';
            if (/[\/](socket\.io-client|engine\.io-client|socket\.io-parser|engine\.io-parser)[\/]/.test(id)) return 'socket';
            // Small helpers the app core shares with the charts must not sit inside the charts file
            if (/[\/](clsx|tailwind-merge)[\/]/.test(id)) return 'vendor';
            if (/[\/](recharts|d3-[^\/]+|victory-vendor)[\/]/.test(id)) return 'charts';
            if (/[\/]date-fns[\/]/.test(id)) return 'dates';
          },
        },
      },
    },
  };
});
