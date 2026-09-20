import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { preprocessImage, validateImage } from "@/lib/services/image-service";

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 20, b: 20 } },
  })
    .png()
    .toBuffer();
}

describe("validateImage", () => {
  afterEach(() => {
    delete process.env.MAX_IMAGE_SIZE_MB;
  });

  it("accepts a well-formed PNG", async () => {
    const buffer = await makePng(200, 100);
    const result = await validateImage(buffer);
    expect(result.valid).toBe(true);
    expect(result.format).toBe("png");
  });

  it("rejects bytes that aren't a real image", async () => {
    const result = await validateImage(Buffer.from("not an image"));
    expect(result.valid).toBe(false);
  });

  it("rejects an empty file", async () => {
    const result = await validateImage(Buffer.alloc(0));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/empty/i);
  });

  it("rejects files over the configured size limit", async () => {
    process.env.MAX_IMAGE_SIZE_MB = "0.0001";
    const buffer = await makePng(200, 100);
    const result = await validateImage(buffer);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/limit/i);
  });
});

describe("preprocessImage", () => {
  it("downsizes an oversized image while preserving aspect ratio", async () => {
    const buffer = await makePng(4000, 2000);
    const processed = await preprocessImage(buffer);
    const metadata = await sharp(processed).metadata();

    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBeLessThanOrEqual(2000);
    expect(metadata.height).toBeLessThanOrEqual(2000);
    expect((metadata.width ?? 0) / (metadata.height ?? 1)).toBeCloseTo(2, 1);
  });

  it("does not upscale a small image", async () => {
    const buffer = await makePng(200, 100);
    const processed = await preprocessImage(buffer);
    const metadata = await sharp(processed).metadata();

    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(100);
  });
});
