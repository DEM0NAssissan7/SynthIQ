import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import fs from 'node:fs'

function getVersion(): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
    )
    return pkg.version || '0.1.0'
  } catch {
    return '0.1.0'
  }
}

function getCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return ''
  }
}


const appVersion = process.env.VITE_APP_VERSION || getVersion()
const commitHash = process.env.VITE_COMMIT_HASH || getCommitHash()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
})

