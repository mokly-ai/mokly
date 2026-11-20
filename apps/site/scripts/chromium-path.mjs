import { chromium } from "@playwright/test";

const executable = chromium.executablePath();
if (!executable || executable.includes("\n")) {
  throw new Error("Playwright did not provide one Chromium executable path");
}
process.stdout.write(executable);
