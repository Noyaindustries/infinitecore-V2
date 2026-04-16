import { spawn } from "node:child_process";

function runSeedCommand() {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("npm", ["run", "seed:test-data"], {
      stdio: "inherit",
      shell: true,
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`La commande de seed a échoué avec le code ${code ?? "inconnu"}.`));
    });
  });
}

export default async function globalSetup() {
  await runSeedCommand();
}
