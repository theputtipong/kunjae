import { createRequire } from "node:module";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { COLORS, UNLOCKED_DEG, fullMark, rotated, smallMark } from "./mark.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const loadSharp = () => {
  const require = createRequire(import.meta.url);
  try {
    return require("sharp");
  } catch {
    const store = join(root, "node_modules", ".pnpm");
    const dir = readdirSync(store).find((name) => name.startsWith("sharp@"));
    if (dir === undefined) throw new Error("ไม่พบ sharp — รัน pnpm install ที่รากของ repo ก่อน");
    return require(join(store, dir, "node_modules", "sharp"));
  }
};
const sharp = loadSharp();

const TILE_RADIUS = 0.224;

const svg = ({ size, shapes, ratio = 0.61, background = null, radius = TILE_RADIUS, extraStyle = "" }) => {
  const scale = (size * ratio) / 64;
  const offset = (size - 64 * scale) / 2;
  const bg =
    background === null
      ? ""
      : `<rect class="tile" width="${size}" height="${size}" rx="${size * radius}" fill="${background}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${extraStyle}${bg}<g transform="translate(${offset} ${offset}) scale(${scale})">${shapes}</g></svg>`;
};

const png = (svgText) => sharp(Buffer.from(svgText)).png({ compressionLevel: 9 }).toBuffer();

const ico = (frames) => {
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, at);
    header.writeUInt8(size >= 256 ? 0 : size, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...frames.map((f) => f.data)]);
};

const out = (relative, data) => {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log("  ✓", relative);
};

const web = "apps/web/public";

out(
  `${web}/favicon.svg`,
  svg({
    size: 64,
    ratio: 0.69,
    background: COLORS.ink,
    shapes: smallMark(COLORS.brassLight),
    extraStyle: `<style>@media (prefers-color-scheme: dark){.tile{fill:${COLORS.ink2}}}</style>`,
  }),
);

out(
  `${web}/favicon.ico`,
  ico([
    { size: 16, data: await png(svg({ size: 16, ratio: 0.69, background: COLORS.ink, shapes: smallMark(COLORS.brassLight) })) },
    { size: 32, data: await png(svg({ size: 32, ratio: 0.625, background: COLORS.ink, shapes: fullMark(COLORS.brassLight) })) },
  ]),
);

out(
  `${web}/apple-touch-icon.png`,
  await png(svg({ size: 180, background: COLORS.ink, radius: 0, shapes: fullMark(COLORS.brassLight) })),
);

for (const size of [192, 512]) {
  out(`${web}/icon-${size}.png`, await png(svg({ size, background: COLORS.ink, shapes: fullMark(COLORS.brassLight) })));
}

out(
  `${web}/maskable-512.png`,
  await png(svg({ size: 512, ratio: 0.61 * 0.8, background: COLORS.ink, radius: 0, shapes: fullMark(COLORS.brassLight) })),
);

out(`${web}/safari-pinned.svg`, svg({ size: 64, ratio: 1, shapes: fullMark("#000") }));

const ext = "apps/extension/public";

for (const size of [16, 32]) {
  out(`${ext}/icon/${size}.png`, await png(svg({ size, ratio: 0.94, shapes: smallMark(COLORS.brassDeep) })));
}
out(`${ext}/icon/48.png`, await png(svg({ size: 48, ratio: 0.83, shapes: fullMark(COLORS.brass) })));
out(
  `${ext}/icon/128.png`,
  await png(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g transform="translate(8 8)">${svg({
      size: 112,
      background: COLORS.ink,
      shapes: fullMark(COLORS.brassLight),
    }).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g></svg>`,
  ),
);

const toolbarColor = { light: COLORS.brassDeep, dark: COLORS.brassLight };
for (const [state, deg] of [["locked", 0], ["unlocked", UNLOCKED_DEG]]) {
  for (const [theme, color] of Object.entries(toolbarColor)) {
    for (const size of [16, 32]) {
      out(
        `${ext}/action/${state}-${theme}-${size}.png`,
        await png(svg({ size, ratio: 0.94, shapes: rotated(smallMark(color), deg) })),
      );
    }
  }
}

console.log("เสร็จ — Android (vector XML) และมาร์กในหน้าจอ แก้ด้วยมือตามตัวเลขใน mark.mjs");
