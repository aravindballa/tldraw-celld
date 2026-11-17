import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const workerUrl = process.env.WORKER_URL ?? 'http://127.0.0.1:8787'

export default defineConfig({
	plugins: [react()],
	build: { outDir: 'dist/client' },
	server: {
		proxy: {
			'/api': { target: workerUrl, ws: true, changeOrigin: true },
		},
	},
})
