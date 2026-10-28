// 由 branding/logo.png 生成 XunguAgent 全套图标(pngjs 纯 JS 管线,不依赖 canvas)
import { PNG } from "pngjs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = PNG.sync.read(readFileSync(join(repoRoot, "branding", "logo.png")));
const { width: W, height: H, data } = src;

// 1. 裁白边:按"合成到白底后是否非白"判定,留 4% 内边距
let minX = W, minY = H, maxX = -1, maxY = -1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const a = data[i + 3] / 255;
    const r = data[i] * a + 255 * (1 - a);
    const g = data[i + 1] * a + 255 * (1 - a);
    const b = data[i + 2] * a + 255 * (1 - a);
    if (r < 245 || g < 245 || b < 245) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
const bw = maxX - minX + 1;
const bh = maxY - minY + 1;
const pad = Math.round(Math.max(bw, bh) * 0.04);
const sx = Math.max(0, minX - pad);
const sy = Math.max(0, minY - pad);
const sw = Math.min(W - sx, bw + pad * 2);
const sh = Math.min(H - sy, bh + pad * 2);
console.log(`trim: bbox=${bw}x${bh} crop=(${sx},${sy},${sw},${sh})`);

// 2. 双线性缩放 + 白底方形画布
function render(size) {
  const out = Buffer.alloc(size * size * 4, 255);
  const scaleX = sw / size;
  const scaleY = sh / size;
  for (let y = 0; y < size; y++) {
    const gy = sy + (y + 0.5) * scaleY - 0.5;
    const y0 = Math.max(0, Math.min(H - 1, Math.floor(gy)));
    const y1 = Math.max(0, Math.min(H - 1, y0 + 1));
    const fy = Math.min(1, Math.max(0, gy - Math.floor(gy)));
    for (let x = 0; x < size; x++) {
      const gx = sx + (x + 0.5) * scaleX - 0.5;
      const x0 = Math.max(0, Math.min(W - 1, Math.floor(gx)));
      const x1 = Math.max(0, Math.min(W - 1, x0 + 1));
      const fx = Math.min(1, Math.max(0, gx - Math.floor(gx)));
      const o = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        const i00 = (y0 * W + x0) * 4 + c;
        const i10 = (y0 * W + x1) * 4 + c;
        const i01 = (y1 * W + x0) * 4 + c;
        const i11 = (y1 * W + x1) * 4 + c;
        const top = data[i00] * (1 - fx) + data[i10] * fx;
        const bot = data[i01] * (1 - fx) + data[i11] * fx;
        out[o + c] = Math.round(top * (1 - fy) + bot * fy);
      }
      out[o + 3] = 255;
    }
  }
  return PNG.sync.write({ width: size, height: size, data: out });
}

// 3. ICO(多尺寸 PNG 内嵌)
function pngToIco(buffersBySize) {
  const entries = [...buffersBySize.entries()].sort((a, b) => a[0] - b[0]);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const dirs = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  entries.forEach(([size, buf], i) => {
    dirs.writeUInt8(size >= 256 ? 0 : size, i * 16);
    dirs.writeUInt8(size >= 256 ? 0 : size, i * 16 + 1);
    dirs.writeUInt16LE(1, i * 16 + 4);
    dirs.writeUInt16LE(32, i * 16 + 6);
    dirs.writeUInt32LE(buf.length, i * 16 + 8);
    dirs.writeUInt32LE(offset, i * 16 + 12);
    offset += buf.length;
  });
  return Buffer.concat([header, dirs, ...entries.map(([, buf]) => buf)]);
}

const SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const rendered = new Map();
for (const size of SIZES) {
  rendered.set(size, render(size));
}

const pngTargets = [
  [512, "packages/desktop/build/icon.png"],
  [512, "packages/desktop/build/icon_windows.png"],
  [512, "packages/desktop/build/icon_installer.png"],
  [1024, "public/icon_512@2x.png"],
  [256, "packages/desktop/src/renderer/splash-logo.png"],
];
for (const [size, rel] of pngTargets) {
  const dest = join(repoRoot, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, rendered.get(size));
  console.log("wrote", rel);
}
for (const dir of ["packages/desktop/build/icons", "public/logo/icons"]) {
  for (const size of SIZES) {
    const dest = join(repoRoot, dir, `${size}x${size}.png`);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, rendered.get(size));
  }
  console.log("wrote", dir, SIZES.join("/"));
}
const ico = pngToIco(new Map([16, 24, 32, 48, 64, 128, 256].map((s) => [s, rendered.get(s)])));
for (const rel of ["packages/desktop/build/icon.ico", "packages/desktop/build/icon_installer.ico"]) {
  writeFileSync(join(repoRoot, rel), ico);
  console.log("wrote", rel);
}

// 4. macOS .icns(PNG 编码条目;类型常量见 Apple Icon 规范)
function pngToIcns(entriesByType) {
  const parts = [];
  let total = 8;
  for (const [type, buf] of entriesByType) {
    const head = Buffer.alloc(8);
    head.write(type, 0, "ascii");
    head.writeUInt32BE(8 + buf.length, 4);
    parts.push(head, buf);
    total += 8 + buf.length;
  }
  const header = Buffer.alloc(8);
  header.write("icns", 0, "ascii");
  header.writeUInt32BE(total, 4);
  return Buffer.concat([header, ...parts]);
}
const icnsEntries = new Map(
  (
    [
      ["ic11", 32],
      ["ic12", 64],
      ["ic07", 128],
      ["ic08", 256],
      ["ic09", 512],
      ["ic10", 1024],
      ["ic13", 512],
      ["ic14", 1024],
    ]
  ).map(([type, size]) => [type, rendered.get(size)]),
);
for (const rel of ["packages/desktop/build/icon.icns", "packages/desktop/build/icon_installer.icns"]) {
  writeFileSync(join(repoRoot, rel), pngToIcns(icnsEntries));
  console.log("wrote", rel);
}

// 5. DMG 安装盘背景:深色纵向渐变 + 居中 XG 白底图标卡
function renderDmgBackground(width, height, logoSize) {
  const out = Buffer.alloc(width * height * 4);
  const top = [26, 29, 33];
  const bottom = [12, 14, 16];
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      out[o] = Math.round(top[0] * (1 - t) + bottom[0] * t);
      out[o + 1] = Math.round(top[1] * (1 - t) + bottom[1] * t);
      out[o + 2] = Math.round(top[2] * (1 - t) + bottom[2] * t);
      out[o + 3] = 255;
    }
  }
  const logo = PNG.sync.read(rendered.get(logoSize));
  const lx = Math.round((width - logo.width) / 2);
  const ly = Math.round((height - logo.height) / 2);
  for (let y = 0; y < logo.height; y++) {
    for (let x = 0; x < logo.width; x++) {
      const si = (y * logo.width + x) * 4;
      const di = ((ly + y) * width + (lx + x)) * 4;
      const a = logo.data[si + 3] / 255;
      out[di] = Math.round(logo.data[si] * a + out[di] * (1 - a));
      out[di + 1] = Math.round(logo.data[si + 1] * a + out[di + 1] * (1 - a));
      out[di + 2] = Math.round(logo.data[si + 2] * a + out[di + 2] * (1 - a));
    }
  }
  return PNG.sync.write({ width, height, data: out });
}
for (const [rel, width, height, logoSize] of [
  ["packages/desktop/build/dmg_background.png", 540, 380, 256],
  ["packages/desktop/build/dmg_background@2x.png", 1080, 760, 512],
] ) {
  writeFileSync(join(repoRoot, rel), renderDmgBackground(width, height, logoSize));
  console.log("wrote", rel);
}
console.log("done");
