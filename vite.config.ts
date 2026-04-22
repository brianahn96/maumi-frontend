// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    // TanStack Start가 내부적으로 사용하는 SSR 옵션을 끕니다.
    build: {
      ssr: false,
    },
    // 혹은 플러그인 레벨에서 제어 (이미 정의된 플러그인 옵션 변경)
    optimizeDeps: {
      exclude: ['@tanstack/start']
    }
  },
});