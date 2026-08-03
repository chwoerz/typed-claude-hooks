import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173/typed-claude-hooks/";
const playgroundURL = `${baseURL}playground/`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const previewCommand = "npm run preview -- --host 127.0.0.1 --port 4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    permissions: ["clipboard-read", "clipboard-write"],
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
    trace: process.env.CI ? "on-first-retry" : "retain-on-failure",
  },
  webServer: {
    command: process.env.CI
      ? previewCommand
      : `npm run build && ${previewCommand}`,
    url: playgroundURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
