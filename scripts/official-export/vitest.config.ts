// 공식 저장소의 데이터 추출기 설정을 그대로 쓰되, 우리 스크립트만 실행한다.
import { defineConfig } from "vitest/config";
import { sharedConfig } from "../../vite.config.ts";

// biome-ignore lint/style/noDefaultExport: required for vitest
export default defineConfig(async (config) => ({
  ...(await sharedConfig(config)),
  test: {
    environment: "jsdom",
    setupFiles: ["./scripts/game-data-exporter/game-data-exporter.setup.ts"],
    include: ["./scripts/pb-export/export.test.ts"],
    disableConsoleIntercept: true,
  },
}));
