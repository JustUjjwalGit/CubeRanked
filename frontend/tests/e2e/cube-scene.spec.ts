import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { PNG } from "pngjs";

test.describe("3D cube scene", () => {
  test("renders a nonblank interactive cube without layout overflow", async ({ page }, testInfo) => {
    await page.goto("/");
    const guestButton = page.getByRole("button", { name: "Continue as Guest" });
    if (await guestButton.isVisible()) {
      await guestButton.click();
    }
    await page.locator(".lobby-mode-card", { hasText: "Practice" }).click();
    await expect(page.getByText("Generating Scramble...")).toBeVisible();
    await expect(page.locator(".countdown-overlay")).toBeVisible({ timeout: 12_000 });
    await page.waitForSelector("canvas");
    await expect(page.locator(".countdown-overlay")).toBeHidden({ timeout: 45_000 });

    const canvas = page.locator("canvas").first();
    const canvasBox = await canvas.boundingBox();
    const viewport = page.viewportSize();

    expect(canvasBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(canvasBox!.width).toBeGreaterThanOrEqual(viewport!.width - 2);
    expect(canvasBox!.height).toBeGreaterThanOrEqual(viewport!.height - 2);

    const before = await captureCanvas(page, `test-results/${testInfo.project.name}-cube-before.png`);
    expectCanvasHasRenderedCube(before);

    const overflow = await getLayoutOverflow(page);
    expect(overflow.horizontal).toBeLessThanOrEqual(1);

    await page.keyboard.press("R");
    await page.waitForTimeout(420);
    const after = await captureCanvas(page, `test-results/${testInfo.project.name}-cube-after.png`);

    expect(pixelDifference(before, after)).toBeGreaterThan(6_000);
    expectCanvasHasRenderedCube(after);
  });
});

async function captureCanvas(page: Page, path: string): Promise<Buffer> {
  const dataUrl = await page.locator("canvas").first().evaluate((canvas) => {
    return (canvas as HTMLCanvasElement).toDataURL("image/png");
  });
  const buffer = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
  await writeFile(path, buffer);
  return buffer;
}

function expectCanvasHasRenderedCube(buffer: Buffer): void {
  const image = PNG.sync.read(buffer);
  let coloredPixels = 0;
  let darkPixels = 0;
  let totalVariance = 0;
  let samples = 0;

  for (let y = 0; y < image.height; y += 4) {
    for (let x = 0; x < image.width; x += 4) {
      const index = (image.width * y + x) * 4;
      const red = image.data[index];
      const green = image.data[index + 1];
      const blue = image.data[index + 2];
      const alpha = image.data[index + 3];

      if (alpha < 20) {
        continue;
      }

      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

      if (max - min > 28) coloredPixels += 1;
      if (luminance < 224) darkPixels += 1;
      totalVariance += max - min;
      samples += 1;
    }
  }

  expect(samples).toBeGreaterThan(1_000);
  expect(coloredPixels).toBeGreaterThan(120);
  expect(darkPixels).toBeGreaterThan(500);
  expect(totalVariance / samples).toBeGreaterThan(5);
}

function pixelDifference(leftBuffer: Buffer, rightBuffer: Buffer): number {
  const left = PNG.sync.read(leftBuffer);
  const right = PNG.sync.read(rightBuffer);
  const width = Math.min(left.width, right.width);
  const height = Math.min(left.height, right.height);
  let difference = 0;

  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const index = (left.width * y + x) * 4;
      const rightIndex = (right.width * y + x) * 4;
      difference += Math.abs(left.data[index] - right.data[rightIndex]);
      difference += Math.abs(left.data[index + 1] - right.data[rightIndex + 1]);
      difference += Math.abs(left.data[index + 2] - right.data[rightIndex + 2]);
    }
  }

  return difference;
}

async function getLayoutOverflow(page: Page): Promise<{ horizontal: number; vertical: number }> {
  return page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
    vertical: document.documentElement.scrollHeight - window.innerHeight,
  }));
}
