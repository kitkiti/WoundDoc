import path from "path";
import { mkdir } from "fs/promises";
import Jimp from "jimp";

const OUTPUT_DIR = path.join(process.cwd(), "public", "demo");
const WIDTH = 960;
const HEIGHT = 720;

function clamp(value, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function blendPixel(image, x, y, [r, g, b], alpha) {
  if (x < 0 || y < 0 || x >= image.bitmap.width || y >= image.bitmap.height) {
    return;
  }

  const index = (image.bitmap.width * y + x) * 4;
  const data = image.bitmap.data;
  const strength = Math.max(0, Math.min(1, alpha));

  data[index] = Math.round((data[index] ?? 0) * (1 - strength) + r * strength);
  data[index + 1] = Math.round((data[index + 1] ?? 0) * (1 - strength) + g * strength);
  data[index + 2] = Math.round((data[index + 2] ?? 0) * (1 - strength) + b * strength);
}

async function createBaseImage(topColor, bottomColor, warmth = 0) {
  const image = await Jimp.create(WIDTH, HEIGHT, 0xffffffff);

  for (let y = 0; y < HEIGHT; y += 1) {
    const verticalRatio = y / HEIGHT;

    for (let x = 0; x < WIDTH; x += 1) {
      const horizontalRatio = x / WIDTH;
      const wave =
        Math.sin((x + y) * 0.018) * 7 +
        Math.cos(x * 0.011) * 5 +
        Math.sin(y * 0.024) * 4;
      const vignette =
        Math.pow((x - WIDTH / 2) / (WIDTH / 2), 2) +
        Math.pow((y - HEIGHT / 2) / (HEIGHT / 2), 2);
      const shadow = vignette * 18;
      const r = clamp(
        mix(topColor[0], bottomColor[0], verticalRatio) + wave + warmth * horizontalRatio - shadow
      );
      const g = clamp(mix(topColor[1], bottomColor[1], verticalRatio) + wave * 0.7 - shadow);
      const b = clamp(mix(topColor[2], bottomColor[2], verticalRatio) + wave * 0.5 - shadow);

      image.setPixelColor(Jimp.rgbaToInt(r, g, b, 255), x, y);
    }
  }

  return image;
}

function drawSoftEllipse(image, options) {
  const { cx, cy, rx, ry, color, alpha, roughness = 0.08 } = options;
  const xStart = Math.max(0, Math.floor(cx - rx - 24));
  const xEnd = Math.min(image.bitmap.width, Math.ceil(cx + rx + 24));
  const yStart = Math.max(0, Math.floor(cy - ry - 24));
  const yEnd = Math.min(image.bitmap.height, Math.ceil(cy + ry + 24));

  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const irregularity =
        Math.sin(x * 0.035) * roughness +
        Math.cos(y * 0.031) * roughness +
        Math.sin((x + y) * 0.017) * roughness * 0.8;
      const distance = dx * dx + dy * dy;

      if (distance > 1 + irregularity) {
        continue;
      }

      const falloff = Math.max(0, 1 - distance);
      blendPixel(image, x, y, color, alpha * Math.pow(falloff, 0.9));
    }
  }
}

function drawLine(image, options) {
  const { x1, y1, x2, y2, thickness, color, alpha } = options;
  const minX = Math.floor(Math.min(x1, x2) - thickness - 10);
  const maxX = Math.ceil(Math.max(x1, x2) + thickness + 10);
  const minY = Math.floor(Math.min(y1, y2) - thickness - 10);
  const maxY = Math.ceil(Math.max(y1, y2) + thickness + 10);
  const lineLengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2 || 1;

  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const projection =
        ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lineLengthSquared;
      const t = Math.max(0, Math.min(1, projection));
      const closestX = x1 + (x2 - x1) * t;
      const closestY = y1 + (y2 - y1) * t;
      const distance = Math.hypot(x - closestX, y - closestY);

      if (distance > thickness) {
        continue;
      }

      const localAlpha = alpha * (1 - distance / thickness);
      blendPixel(image, x, y, color, localAlpha);
    }
  }
}

async function createHeelCase() {
  const image = await createBaseImage([234, 205, 190], [223, 186, 170], 10);

  drawSoftEllipse(image, {
    cx: 470,
    cy: 380,
    rx: 270,
    ry: 180,
    color: [246, 221, 207],
    alpha: 0.22,
    roughness: 0.03
  });
  drawSoftEllipse(image, {
    cx: 490,
    cy: 392,
    rx: 230,
    ry: 170,
    color: [221, 118, 114],
    alpha: 0.24
  });
  drawSoftEllipse(image, {
    cx: 478,
    cy: 382,
    rx: 162,
    ry: 122,
    color: [171, 58, 67],
    alpha: 0.62
  });
  drawSoftEllipse(image, {
    cx: 502,
    cy: 400,
    rx: 82,
    ry: 58,
    color: [120, 25, 36],
    alpha: 0.64
  });

  drawLine(image, {
    x1: 180,
    y1: 600,
    x2: 770,
    y2: 535,
    thickness: 18,
    color: [202, 160, 145],
    alpha: 0.22
  });

  await image.writeAsync(path.join(OUTPUT_DIR, "heel-suspicion.png"));
}

async function createSacrumUncertainCase() {
  const image = await createBaseImage([176, 138, 128], [148, 110, 104], -8);

  drawSoftEllipse(image, {
    cx: 454,
    cy: 356,
    rx: 320,
    ry: 214,
    color: [188, 144, 138],
    alpha: 0.18,
    roughness: 0.04
  });
  drawSoftEllipse(image, {
    cx: 470,
    cy: 354,
    rx: 210,
    ry: 146,
    color: [146, 88, 90],
    alpha: 0.22,
    roughness: 0.09
  });
  drawSoftEllipse(image, {
    cx: 498,
    cy: 380,
    rx: 96,
    ry: 72,
    color: [121, 73, 78],
    alpha: 0.14,
    roughness: 0.12
  });

  for (let offset = -60; offset <= 60; offset += 30) {
    drawLine(image, {
      x1: 190,
      y1: 280 + offset,
      x2: 770,
      y2: 250 + offset,
      thickness: 14,
      color: [142, 96, 94],
      alpha: 0.08
    });
  }

  image.blur(2);
  await image.writeAsync(path.join(OUTPUT_DIR, "sacrum-uncertain.png"));
}

async function createDevicePressureCase() {
  const image = await createBaseImage([231, 201, 188], [214, 184, 171], 4);

  drawSoftEllipse(image, {
    cx: 520,
    cy: 332,
    rx: 190,
    ry: 132,
    color: [241, 224, 215],
    alpha: 0.2,
    roughness: 0.04
  });
  drawSoftEllipse(image, {
    cx: 494,
    cy: 318,
    rx: 132,
    ry: 98,
    color: [180, 74, 76],
    alpha: 0.42
  });
  drawSoftEllipse(image, {
    cx: 486,
    cy: 318,
    rx: 66,
    ry: 46,
    color: [131, 37, 46],
    alpha: 0.38
  });

  drawLine(image, {
    x1: 676,
    y1: 138,
    x2: 592,
    y2: 454,
    thickness: 18,
    color: [192, 199, 206],
    alpha: 0.76
  });
  drawLine(image, {
    x1: 650,
    y1: 164,
    x2: 560,
    y2: 462,
    thickness: 7,
    color: [231, 236, 240],
    alpha: 0.8
  });
  drawLine(image, {
    x1: 330,
    y1: 240,
    x2: 724,
    y2: 240,
    thickness: 22,
    color: [240, 236, 229],
    alpha: 0.14
  });

  await image.writeAsync(path.join(OUTPUT_DIR, "device-pressure.png"));
}

await mkdir(OUTPUT_DIR, { recursive: true });
await Promise.all([
  createHeelCase(),
  createSacrumUncertainCase(),
  createDevicePressureCase()
]);

console.log(`Generated demo assets in ${OUTPUT_DIR}`);
