import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api/pacto': {
        target: 'https://apigw.pactosolucoes.com.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pacto/, ''),
      },
      '/api/uazapi': {
        target: 'https://fluxodigitaltech.uazapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/uazapi/, ''),
      },
      '/api/sheety': {
        target: 'https://api.sheety.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sheety/, ''),
      },
    },
  },
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          charts: ['recharts'],
          utils: ['date-fns', 'papaparse'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'date-fns', 'papaparse'],
  },
}));