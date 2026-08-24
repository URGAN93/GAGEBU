import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 프로젝트 페이지(urgan93.github.io/GAGEBU)라 서브패스로 배포됨
  base: '/GAGEBU/',
  plugins: [react()],
})
