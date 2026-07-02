import { getSmtpEnvDiagnostic, verifySmtpConnection } from "../src/server/smtpTransport";

const env = getSmtpEnvDiagnostic();
console.log("SMTP env:", env);
const result = await verifySmtpConnection();
console.log("SMTP verify:", result);
process.exit(result.ok ? 0 : 1);
