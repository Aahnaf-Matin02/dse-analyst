import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // data/ is written by the backend on every market refresh; watching it made the browser reload in a loop.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/data/**'] },
    },
    build: {
      rollupOptions: {
        output: {
          // Stable vendor chunks so returning visitors keep them cached across app releases
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/.test(id)) return 'vendor-charts';
            if (/[\\/]node_modules[\\/](motion|framer-motion)[\\/]/.test(id)) return 'vendor-motion';
            if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return 'vendor-icons';
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
            return 'vendor';
          },
        },
      },
    },
  };
});
