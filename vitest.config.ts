import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'node',
        include: [
            'tests/**/*.{test,spec}.{ts,tsx}',
            'electron/**/*.{test,spec}.ts'
        ],
        exclude: ['node_modules', 'dist', 'dist-electron']
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    }
})
