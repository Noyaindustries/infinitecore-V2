export type App = { name: string };
const apps: App[] = [];

export function initializeApp(_config: unknown, name = "default"): App {
  const existing = apps.find((app) => app.name === name);
  if (existing) return existing;
  const app = { name };
  apps.push(app);
  return app;
}

export function getApps(): App[] {
  return [...apps];
}
