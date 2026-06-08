import { ensureEnvFilesLoaded } from "../src/config/loadEnvFiles";
import { formatEnvValidationReport, validateProcessEnv } from "../src/config/envSchema";

ensureEnvFilesLoaded();

const report = validateProcessEnv(process.env);
if (report.warnings.length) {
  console.warn(formatEnvValidationReport({ ok: true, errors: [], warnings: report.warnings }));
}

if (!report.ok) {
  console.error("Validation des variables d'environnement : ÉCHEC\n");
  console.error(formatEnvValidationReport(report));
  process.exit(1);
}

console.log(`Validation des variables d'environnement : OK (${process.env.NODE_ENV || "development"})`);
