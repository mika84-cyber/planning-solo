import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "json-summary", "html"],
      reportOnFailure: true,
      include: [
        "src/appModel.ts",
        "src/calendarApi.ts",
        "src/cet.ts",
        "src/demoAccess.ts",
        "src/grandPalais*.ts",
        "src/leaveRequest.ts",
        "src/mecenat*.ts",
        "src/overtime.ts",
        "src/payEstimate.ts",
        "src/payslip*.ts",
        "src/planningLogic.ts",
        "src/strike.ts",
        "netlify/lib/**/*.mts",
        "netlify/functions/**/*.mts",
      ],
      exclude: [
        "**/*.test.{ts,tsx,mts,mjs}",
        "netlify/lib/usefulContactsData.mts",
      ],
      thresholds: {
        // Baseline mesurée sur l’ensemble du métier client et serveur.
        // Ces seuils empêchent toute baisse ; ils pourront monter à mesure que
        // les actions serveur extraites recevront leurs tests dédiés.
        lines: 80,
        functions: 76,
        statements: 77,
        branches: 68,
      },
    },
  },
});
