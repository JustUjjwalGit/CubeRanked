import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const outputDir = resolve(projectRoot, "public/assets/cube-styles");
const styles = ["classic", "speedcube", "stickerless", "minimal"];
const port = 5197;
const baseUrl = `http://127.0.0.1:${port}`;

function waitForServer(url, timeoutMs = 20_000) {
  const startedAt = Date.now();

  return new Promise((resolveReady, rejectReady) => {
    const check = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolveReady();
          return;
        }
      } catch {
        // Keep polling until Vite is ready.
      }

      if (Date.now() - startedAt > timeoutMs) {
        rejectReady(new Error(`Timed out waiting for ${url}`));
        return;
      }

      setTimeout(check, 250);
    };

    void check();
  });
}

const server = spawn(
  "npm",
  ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

const shutdown = () => {
  if (!server.killed) {
    server.kill("SIGTERM");
  }
};

process.on("exit", shutdown);
process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});

let browser;

try {
  await mkdir(outputDir, { recursive: true });
  await waitForServer(baseUrl);

  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 512, height: 512 },
    deviceScaleFactor: 1,
  });

  for (const style of styles) {
    await page.goto(`${baseUrl}/__cube-preview-capture?style=${style}`, { waitUntil: "networkidle" });
    await page.waitForSelector(".cube-preview-capture-target canvas");
    await page.waitForFunction(() => window.__cubePreviewReady === true, null, { timeout: 10_000 });
    await page.waitForTimeout(250);

    const dataUrl = await page.$eval(".cube-preview-capture-target canvas", (canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error("Cube preview target is not a canvas");
      }
      return canvas.toDataURL("image/webp", 0.9);
    });
    const base64 = dataUrl.replace(/^data:image\/webp;base64,/, "");
    await writeFile(resolve(outputDir, `${style}.webp`), Buffer.from(base64, "base64"));
    console.log(`Generated ${style}.webp`);
  }
} finally {
  if (browser) {
    await browser.close();
  }
  shutdown();
}
