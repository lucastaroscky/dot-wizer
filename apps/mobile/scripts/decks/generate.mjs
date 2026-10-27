import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const require = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const refDir = path.join(SCRIPT_DIR, "sources");
const outDir = path.join(SCRIPT_DIR, "../../assets/decks");
const deckMapPath = path.join(SCRIPT_DIR, "../../src/shared/cards/deck.ts");
const cc0Sheet = await sharp(path.join(refDir, "english-pattern-cc0.svg"), { density: 144, limitInputPixels: false }).png().toBuffer();
const W = 240;
const H = 336;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["spades", "hearts", "diamonds", "clubs"];
const RED = ["hearts", "diamonds"];
const COURTS = ["J", "Q", "K"];

const font = (name, file) => opentype.loadSync(require.resolve(`@fontsource/${name}/files/${file}`));
const FONTS = {
  jost: font("jost", "jost-latin-400-normal.woff"),
  jostBold: font("jost", "jost-latin-700-normal.woff"),
  rokkitt: font("rokkitt", "rokkitt-latin-800-normal.woff"),
  sancreek: font("sancreek", "sancreek-latin-400-normal.woff"),
  oswald: font("oswald", "oswald-latin-400-normal.woff"),
};

const SUIT_PATHS = {
  hearts: "M50 94 C50 94 2 62 2 31 C2 13 14 2 28 2 C39 2 46 9 50 18 C54 9 61 2 72 2 C86 2 98 13 98 31 C98 62 50 94 50 94 Z",
  diamonds: "M50 0 L88 50 L50 100 L12 50 Z",
  spades: "M50 0 C50 0 2 33 2 61 C2 77 13 87 27 87 C37 87 44 82 47 76 C46 87 41 94 31 100 L69 100 C59 94 54 87 53 76 C56 82 63 87 73 87 C87 87 98 77 98 61 C98 33 50 0 50 0 Z",
  clubs: "M50 2 A23 23 0 0 1 66 41 A23 23 0 1 1 54 77 C55 87 60 94 69 100 L31 100 C40 94 45 87 46 77 A23 23 0 1 1 34 41 A23 23 0 0 1 50 2 Z",
};

const PIPS = {
  A: [[0.5, 0.5]],
  2: [[0.5, 0], [0.5, 1]],
  3: [[0.5, 0], [0.5, 0.5], [0.5, 1]],
  4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  5: [[0, 0], [1, 0], [0.5, 0.5], [0, 1], [1, 1]],
  6: [[0, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  7: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  8: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0.5, 0.75], [0, 1], [1, 1]],
  9: [[0, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [0.5, 0.5], [0, 2 / 3], [1, 2 / 3], [0, 1], [1, 1]],
  10: [[0, 0], [1, 0], [0.5, 1 / 6], [0, 1 / 3], [1, 1 / 3], [0, 2 / 3], [1, 2 / 3], [0.5, 5 / 6], [0, 1], [1, 1]],
};

function suitPath(suit, cx, cy, size, attrs, inverted = false) {
  const rotation = inverted ? ` rotate(180 ${cx} ${cy})` : "";
  return `<path d="${SUIT_PATHS[suit]}" transform="${rotation} translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 100})" ${attrs}/>`;
}

function suitOutline(suit, cx, cy, size, color, width, inverted = false) {
  return suitPath(suit, cx, cy, size, `fill="none" stroke="${color}" stroke-width="${(width * 100) / size}" stroke-linejoin="round"`, inverted);
}

function text(fontName, value, { x, top, capHeight, fill, maxWidth = Infinity, squeeze = 1 }) {
  const fontFile = FONTS[fontName];
  const reference = fontFile.getPath("H", 0, 0, 100).getBoundingBox();
  const size = (capHeight / (reference.y2 - reference.y1)) * 100;
  const glyphs = fontFile.getPath(value, 0, 0, size);
  const box = glyphs.getBoundingBox();
  const scaleX = Math.min(squeeze, maxWidth / (box.x2 - box.x1));
  const width = (box.x2 - box.x1) * scaleX;
  return `<path d="${glyphs.toPathData(2)}" fill="${fill}" transform="translate(${x - width / 2 - box.x1 * scaleX} ${top + capHeight}) scale(${scaleX} 1)"/>`;
}

function pipLayout(rank, area) {
  return PIPS[rank].map(([col, row]) => ({
    x: area.left + col * (area.right - area.left),
    y: area.top + row * (area.bottom - area.top),
    inverted: row > 0.5,
  }));
}

function svg(body, { background = "white", border = "#888", radius = 14, borderWidth = 1.5 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}">
<defs><clipPath id="card"><rect x="0" y="0" width="${W}" height="${H}" rx="${radius}"/></clipPath></defs>
<g clip-path="url(#card)"><rect width="${W}" height="${H}" fill="${background}"/>${body}</g>
<rect x="${borderWidth / 2}" y="${borderWidth / 2}" width="${W - borderWidth}" height="${H - borderWidth}" rx="${radius - borderWidth / 2}" fill="none" stroke="${border}" stroke-width="${borderWidth}"/>
</svg>`;
}

function rotated(body) {
  return `<g transform="rotate(180 ${W / 2} ${H / 2})">${body}</g>`;
}

async function dataUri(buffer) {
  const png = await sharp(buffer).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

function image(href, x, y, width, height, aspect = "none") {
  return `<image xlink:href="${href}" href="${href}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${aspect}"/>`;
}

async function inkLayer(src, box, color, { erase = [], strength = 1.5, threshold = 25, mode = "green" } = {}) {
  const [left, top, right, bottom] = box;
  const width = right - left + 1;
  const height = bottom - top + 1;
  const scale = 4;
  const { data, info } = await sharp(src)
    .extract({ left, top, width, height })
    .resize({ width: width * scale, height: height * scale, kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [r, g, b] = color;
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const x = (i % info.width) / scale;
    const y = Math.floor(i / info.width) / scale;
    const erased = erase.some(([ex1, ey1, ex2, ey2]) => x >= ex1 && x <= ex2 && y >= ey1 && y <= ey2);
    const brightness = mode === "value" ? Math.max(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) : data[i * 3 + 1];
    const alpha = erased ? 0 : Math.max(0, Math.min(255, (255 - brightness - threshold) * strength));
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = alpha;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function cropUpscaled(src, box) {
  const [left, top, right, bottom] = box;
  return sharp(src)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize({ width: W, height: H, kernel: "lanczos3", fit: "fill" })
    .sharpen({ sigma: 0.8 })
    .png()
    .toBuffer();
}

async function cc0Art(rank, suit) {
  const column = RANKS.indexOf(rank);
  const row = SUITS.indexOf(suit);
  return sharp(cc0Sheet, { limitInputPixels: false })
    .extract({ left: (30 + column * 390 + 48) * 2, top: (30 + row * 570 + 24) * 2, width: 528, height: 984 })
    .png()
    .toBuffer();
}

function hex(color) {
  return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
}

const zodiac = {
  red: "#E3141B",
  black: "#1C1C1C",
  ref: () => path.join(refDir, "zodiac.jpeg"),
  cards: { J: [10, 37, 124, 197], Q: [129, 37, 243, 197], K: [247, 37, 362, 197], JOKER: [485, 37, 600, 197] },
  color(suit) {
    return RED.includes(suit) ? this.red : this.black;
  },
  index(rank, suit, color) {
    return text("jost", rank, { x: 30, top: 14, capHeight: 36, fill: color, maxWidth: 44 }) + suitPath(suit, 30, 76, 36, `fill="${color}"`);
  },
  pip(suit, x, y, size, color, inverted) {
    return [
      suitOutline(suit, x, y, size, color, 1.8, inverted),
      suitOutline(suit, x, y, size * 0.76, color, 1.6, inverted),
      suitPath(suit, x, y, size * 0.52, `fill="${color}"`, inverted),
    ].join("");
  },
  async face(rank, suit) {
    const color = this.color(suit);
    const index = this.index(rank, suit, color);
    let middle = "";
    if (rank === "A") {
      for (let ring = 0; ring < 8; ring++) {
        const size = 112 * (1 - ring * 0.11);
        middle += suitOutline(suit, W / 2, H / 2, size, color, 1.6);
      }
      middle += suitPath(suit, W / 2, H / 2, 12, `fill="${color}"`);
    } else if (COURTS.includes(rank)) {
      const box = this.cards[rank];
      const ink = await inkLayer(this.ref(), box, hex(color), { erase: [[0, 0, 26, 50], [box[2] - box[0] - 24, box[3] - box[1] - 42, 999, 999], [0, 0, 999, 4], [0, 0, 4, 999], [box[2] - box[0] - 4, 0, 999, 999], [0, box[3] - box[1] - 4, 999, 999]] });
      middle = image(await dataUri(ink), 0, 0, W, H);
    } else {
      const size = Number(rank) > 6 ? 38 : 42;
      middle = pipLayout(rank, { left: 84, right: 166, top: 62, bottom: 274 })
        .map((pip) => this.pip(suit, pip.x, pip.y, size, color, pip.inverted))
        .join("");
    }
    return svg(middle + index + rotated(index), { border: "#6E6E6E", radius: 16 });
  },
  async joker() {
    const box = this.cards.JOKER;
    const ink = await inkLayer(this.ref(), box, hex(this.red), { erase: [[0, 0, 999, 26], [0, box[3] - box[1] - 26, 999, 999], [0, 0, 4, 999], [box[2] - box[0] - 4, 0, 999, 999]] });
    const label = text("jostBold", "JOKER", { x: 62, top: 13, capHeight: 22, fill: this.red });
    return svg(image(await dataUri(ink), 0, 0, W, H) + label + rotated(label), { border: "#6E6E6E", radius: 16 });
  },
  async back() {
    return svg(image(await dataUri(await cropUpscaled(this.ref(), [490, 416, 596, 577])), 0, 0, W, H), { border: "#6E6E6E", radius: 16, background: "#B5121B" });
  },
};

const cartoon = {
  red: "#D7262E",
  black: "#141414",
  ref: () => path.join(refDir, "cartoon.jpeg"),
  cards: { K: [23, 49, 198, 292], Q: [23, 319, 198, 561], J: [218, 319, 393, 561], A: [218, 49, 394, 292] },
  color(suit) {
    return RED.includes(suit) ? this.red : this.black;
  },
  index(rank, suit, color) {
    return text("sancreek", rank, { x: 23, top: 14, capHeight: 30, fill: color, maxWidth: 32 }) + suitPath(suit, 23, 68, 34, `fill="${color}"`);
  },
  async refCard(rank, suit) {
    const box = this.cards[rank];
    const base = await dataUri(await cropUpscaled(this.ref(), box));
    const color = this.color(suit);
    const sx = W / (box[2] - box[0] + 1);
    const sy = H / (box[3] - box[1] + 1);
    const rankBox = [box[0] + 3, box[1] + 5, box[0] + 27, box[1] + 39];
    const rankInk = await dataUri(await inkLayer(this.ref(), rankBox, hex(color), { mode: "value", strength: 1.6 }));
    const corner = (inverted) => {
      const rankImage = image(rankInk, 3 * sx, 5 * sy, 25 * sx, 35 * sy);
      const cover = `<rect x="${2 * sx}" y="${4 * sy}" width="${26 * sx}" height="${60 * sy}" fill="white"/>`;
      const symbol = suitPath(suit, 15 * sx, 52 * sy, 23 * sx, `fill="${color}"`);
      const body = cover + rankImage + symbol;
      return inverted ? rotated(body) : body;
    };
    return svg(image(base, 0, 0, W, H) + corner(false) + corner(true), { border: "#BDBDBD", radius: 14 });
  },
  sunburst(cx, cy) {
    let rays = "";
    for (let ray = 0; ray < 72; ray++) {
      const angle = (ray / 72) * Math.PI * 2;
      const length = ray % 2 === 0 ? 98 : 80;
      const x1 = cx + Math.cos(angle) * 40;
      const y1 = cy + Math.sin(angle) * 40;
      const x2 = cx + Math.cos(angle) * length;
      const y2 = cy + Math.sin(angle) * length;
      rays += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#F4C21A" stroke-width="2.6" stroke-linecap="round"/>`;
    }
    return `<circle cx="${cx}" cy="${cy}" r="70" fill="#FFF6C8"/>${rays}`;
  },
  sword(cx, cy) {
    return `<g transform="translate(${cx} ${cy})">
<polygon points="0,-58 7,-44 7,30 -7,30 -7,-44" fill="#E9E9E9" stroke="#3A3A3A" stroke-width="1.5"/>
<line x1="0" y1="-50" x2="0" y2="28" stroke="#9C9C9C" stroke-width="2"/>
<rect x="-20" y="28" width="40" height="7" rx="2" fill="#5A5A5A" stroke="#222" stroke-width="1.5"/>
<rect x="-4" y="35" width="8" height="16" fill="#2E2E2E"/>
<circle cx="0" cy="55" r="5" fill="#5A5A5A" stroke="#222" stroke-width="1.5"/></g>`;
  },
  ace(suit) {
    const color = this.color(suit);
    const dark = RED.includes(suit) ? "#7E0E14" : "#000";
    const gradient = `<defs><radialGradient id="pip" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="${RED.includes(suit) ? "#F0565C" : "#6A6A6A"}"/><stop offset="100%" stop-color="${RED.includes(suit) ? "#A3141B" : "#151515"}"/></radialGradient></defs>`;
    const index = this.index("A", suit, color);
    const middle = gradient + this.sunburst(W / 2, H / 2) + suitPath(suit, W / 2, H / 2, 124, `fill="url(#pip)" stroke="${dark}" stroke-width="${300 / 124}"`) + suitOutline(suit, W / 2, H / 2, 100, RED.includes(suit) ? "#F7A1A4" : "#8A8A8A", 1.5) + this.sword(W / 2, H / 2 - 2);
    return svg(middle + index + rotated(index), { border: "#BDBDBD", radius: 14 });
  },
  async face(rank, suit) {
    if (COURTS.includes(rank) || (rank === "A" && suit === "spades")) {
      return this.refCard(rank, suit);
    }
    if (rank === "A") {
      return this.ace(suit);
    }
    const color = this.color(suit);
    const index = this.index(rank, suit, color);
    const pips = pipLayout(rank, { left: 84, right: 166, top: 60, bottom: 276 })
      .map((pip) => suitPath(suit, pip.x, pip.y, 42, `fill="${color}"`, pip.inverted))
      .join("");
    return svg(pips + index + rotated(index), { border: "#BDBDBD", radius: 14 });
  },
  async joker() {
    const label = "JOKER"
      .split("")
      .map((letter, position) => text("sancreek", letter, { x: 21, top: 14 + position * 27, capHeight: 21, fill: this.red }))
      .join("");
    const star = `<polygon points="${starPoints(W / 2, H / 2, 62, 26)}" fill="${this.red}" stroke="#7E0E14" stroke-width="3"/><polygon points="${starPoints(W / 2, H / 2, 44, 18)}" fill="#F4C21A"/>`;
    return svg(this.sunburst(W / 2, H / 2) + star + label + rotated(label), { border: "#BDBDBD", radius: 14 });
  },
  async back() {
    return svg(image(await dataUri(await cropUpscaled(this.ref(), [413, 49, 589, 292])), 0, 0, W, H), { border: "#BDBDBD", radius: 14 });
  },
};

function starPoints(cx, cy, outer, inner) {
  const points = [];
  for (let point = 0; point < 10; point++) {
    const radius = point % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    points.push(`${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`);
  }
  return points.join(" ");
}

const neon = {
  blue: "#2793E8",
  background: "#0B0B0C",
  color(suit) {
    return RED.includes(suit) ? `url(#blue)` : `url(#silver)`;
  },
  defs: `<defs>
<linearGradient id="silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F4F4F4"/><stop offset="55%" stop-color="#C9C9C9"/><stop offset="100%" stop-color="#9C9C9C"/></linearGradient>
<linearGradient id="blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#43A9F5"/><stop offset="100%" stop-color="#1D7FD2"/></linearGradient>
<radialGradient id="sheen" cx="35%" cy="20%" r="90%"><stop offset="0%" stop-color="#1D1D20"/><stop offset="100%" stop-color="#060606"/></radialGradient></defs>`,
  index(rank, suit, color) {
    return text("oswald", rank, { x: 26, top: 13, capHeight: 34, fill: color, maxWidth: 38 }) + suitPath(suit, 26, 72, 36, `fill="${color}"`);
  },
  async courtArt(rank, suit) {
    const art = await cc0Art(rank, suit);
    const color = RED.includes(suit) ? hex(this.blue) : [220, 220, 220];
    const line = await inkLayer(art, [0, 0, 527, 983], color, { mode: "value", threshold: 40, strength: 2.6 });
    return dataUri(await sharp(line).resize({ width: 300 }).toBuffer());
  },
  async face(rank, suit) {
    const color = this.color(suit);
    const index = this.index(rank, suit, color);
    let middle = "";
    if (rank === "A") {
      middle = suitPath(suit, W / 2, H / 2, 74, `fill="${color}"`);
    } else if (COURTS.includes(rank)) {
      const frameColor = RED.includes(suit) ? this.blue : "#BDBDBD";
      middle = image(await this.courtArt(rank, suit), 50, 40, 140, 256, "xMidYMid slice") + `<rect x="50" y="40" width="140" height="256" fill="none" stroke="${frameColor}" stroke-width="2"/>`;
    } else {
      middle = pipLayout(rank, { left: 84, right: 164, top: 66, bottom: 270 })
        .map((pip) => suitPath(suit, pip.x, pip.y, 38, `fill="${color}"`, pip.inverted))
        .join("");
    }
    return svg(this.defs + `<rect width="${W}" height="${H}" fill="url(#sheen)"/>` + middle + index + rotated(index), { background: this.background, border: "#2C2C2E", radius: 14 });
  },
  async joker() {
    const label = "JOKER"
      .split("")
      .map((letter, position) => text("oswald", letter, { x: 24, top: 14 + position * 30, capHeight: 23, fill: "url(#blue)" }))
      .join("");
    const star = `<polygon points="${starPoints(W / 2, H / 2, 64, 26)}" fill="none" stroke="url(#blue)" stroke-width="4" stroke-linejoin="round"/>`;
    return svg(this.defs + `<rect width="${W}" height="${H}" fill="url(#sheen)"/>` + star + label + rotated(label), { background: this.background, border: "#2C2C2E", radius: 14 });
  },
  async back() {
    const art = await this.courtArt("K", "hearts");
    return svg(this.defs + `<rect width="${W}" height="${H}" fill="url(#sheen)"/>` + image(art, 34, 34, 172, 268, "xMidYMid slice") + `<rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="8" fill="none" stroke="${this.blue}" stroke-width="3"/>`, { background: this.background, border: "#2C2C2E", radius: 14 });
  },
};

const jumbo = {
  red: "#D42530",
  black: "#121212",
  frameBlue: "#4479CC",
  frame: { left: 60, top: 72, right: 186, bottom: 264 },
  color(suit) {
    return RED.includes(suit) ? this.red : this.black;
  },
  index(rank, suit, color) {
    return text("rokkitt", rank, { x: 30, top: 8, capHeight: 52, fill: color, maxWidth: 50, squeeze: 0.82 }) + suitPath(suit, 30, 96, 46, `fill="${color}"`);
  },
  frameRect() {
    const { left, top, right, bottom } = this.frame;
    return `<rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="none" stroke="${this.frameBlue}" stroke-width="2.2"/>`;
  },
  async face(rank, suit) {
    const color = this.color(suit);
    const index = this.index(rank, suit, color);
    const { left, top, right, bottom } = this.frame;
    let middle = "";
    if (rank === "A") {
      middle = suitPath(suit, (left + right) / 2, (top + bottom) / 2, 84, `fill="${color}"`);
    } else if (COURTS.includes(rank)) {
      middle = image(await dataUri(await cc0Art(rank, suit)), left + 1, top + 1, right - left - 2, bottom - top - 2, "xMidYMid slice");
    } else {
      middle = pipLayout(rank, { left: left + 30, right: right - 30, top: top + 26, bottom: bottom - 26 })
        .map((pip) => suitPath(suit, pip.x, pip.y, 32, `fill="${color}"`, pip.inverted))
        .join("");
    }
    return svg(middle + this.frameRect() + index + rotated(index), { border: "#B9B9B9", radius: 13 });
  },
  async joker() {
    const label = "JOKER"
      .split("")
      .map((letter, position) => text("rokkitt", letter, { x: 30, top: 16 + position * 31, capHeight: 25, fill: this.red }))
      .join("");
    const { left, top, right, bottom } = this.frame;
    const star = `<polygon points="${starPoints((left + right) / 2, (top + bottom) / 2, 52, 21)}" fill="${this.red}"/>`;
    return svg(star + this.frameRect() + label + rotated(label), { border: "#B9B9B9", radius: 13 });
  },
  async back() {
    const pattern = `<defs><pattern id="lattice" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#B3232C"/><path d="M0 0 L0 12 M0 0 L12 0" stroke="#E7A3A7" stroke-width="1.2"/></pattern></defs>`;
    return svg(pattern + `<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="6" fill="url(#lattice)"/><rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="6" fill="none" stroke="#B3232C" stroke-width="3"/>`, { border: "#B9B9B9", radius: 13 });
  },
};

const DECKS = { jumbo, zodiac, cartoon, neon };
const FILES = [...SUITS.flatMap((suit) => RANKS.map((rank) => `${rank}-${suit}`)), "joker", "back"];

function deckMapSource() {
  const names = Object.keys(DECKS);
  const lines = [`export const DECK_IMAGES: Record<${names.map((name) => `"${name}"`).join(" | ")}, Record<string, number>> = {`];
  for (const name of names) {
    lines.push(`  ${name}: {`);
    for (const file of FILES) {
      const key = file.includes("-") ? `"${file}"` : file;
      lines.push(`    ${key}: require("../../../assets/decks/${name}/${file}.png"),`);
    }
    lines.push("  },");
  }
  lines.push("};", "");
  return lines.join("\n");
}

for (const [name, deck] of Object.entries(DECKS)) {
  const dir = path.join(outDir, name);
  fs.mkdirSync(dir, { recursive: true });
  const write = async (file, content) => sharp(Buffer.from(content), { limitInputPixels: false }).png({ compressionLevel: 9, palette: false }).toFile(path.join(dir, `${file}.png`));
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      await write(`${rank}-${suit}`, await deck.face(rank, suit));
    }
  }
  await write("joker", await deck.joker());
  await write("back", await deck.back());
  console.log(`${name}: ${FILES.length} cartas`);
}
fs.writeFileSync(deckMapPath, deckMapSource());
