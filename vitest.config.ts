import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
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
