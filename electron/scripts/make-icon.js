// أيقونة التطبيق: مربع نحاسي بتدرج لوني ورمز صاعقة أبيض (يرمز للعقاقير الكهربائية)،
// بدون أي مكتبة رسم خارجية — نفس فلسفة النسخة الأولى، لكن مع محاكاة فائقة العينات
// (supersampling) لتنعيم الحواف، تدرج لوني بدل اللون المسطح، وحزمة ICO متعددة
// الأحجام (16/32/48/256) يُعاد رسم كل حجم فيها من الصفر بدل تصغير صورة واحدة، حتى
// تبقى الحواف حادة في شريط المهام الصغير أيضاً.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG_TOP = [0xc1, 0x7a, 0x3f]; // نحاسي فاتح أعلى الأيقونة
const BG_BOTTOM = [0x8a, 0x4a, 0x1c]; // نحاسي داكن أسفلها — يمنح إحساساً بالعمق
const FG = [0xff, 0xff, 0xff];
const SUPERSAMPLE = 4;

// نقاط صاعقة أنحف وأكثر توازناً من النسخة الأولى، مُقاسة إلى مربع [0,1]x[0,1]
const BOLT_POINTS = [
  [0.56, 0.06],
  [0.32, 0.52],
  [0.47, 0.52],
  [0.42, 0.94],
  [0.7, 0.44],
  [0.53, 0.44],
];

function pointInPolygon(nx, ny, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > ny !== yj > ny && nx < ((xj - xi) * (ny - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function roundedMask(x, y, s, radius) {
  const cx = Math.min(Math.max(x, radius), s - radius);
  const cy = Math.min(Math.max(y, radius), s - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// يرسم حجماً واحداً بمعاينة فائقة العينات: لكل بكسل ناتج، يفحص شبكة SUPERSAMPLE×SUPERSAMPLE
// من العينات الفرعية ويُتوسّط لونها/شفافيتها — هذا ما يُنتج الحواف الناعمة بدل المسننة
function renderIconRGBA(size) {
  const radius = size * 0.18;
  const raw = Buffer.alloc(size * (1 + size * 4));

  for (let y = 0; y < size; y++) {
    let offset = y * (1 + size * 4);
    raw[offset] = 0; // فلتر PNG: بدون فلتر لكل سطر
    offset += 1;

    for (let x = 0; x < size; x++) {
      let a = 0;
      let r = 0;
      let g = 0;
      let b = 0;

      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        const py = y + (sy + 0.5) / SUPERSAMPLE;
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const px = x + (sx + 0.5) / SUPERSAMPLE;
          if (!roundedMask(px, py, size, radius)) continue;

          const ny = py / size;
          const nx = px / size;
          if (pointInPolygon(nx, ny, BOLT_POINTS)) {
            r += FG[0];
            g += FG[1];
            b += FG[2];
          } else {
            r += lerp(BG_TOP[0], BG_BOTTOM[0], ny);
            g += lerp(BG_TOP[1], BG_BOTTOM[1], ny);
            b += lerp(BG_TOP[2], BG_BOTTOM[2], ny);
          }
          a += 1;
        }
      }

      const totalSamples = SUPERSAMPLE * SUPERSAMPLE;
      const coverage = a / totalSamples;
      const i = offset + x * 4;
      if (a === 0) {
        raw[i] = 0;
        raw[i + 1] = 0;
        raw[i + 2] = 0;
        raw[i + 3] = 0;
      } else {
        raw[i] = Math.round(r / a);
        raw[i + 1] = Math.round(g / a);
        raw[i + 2] = Math.round(b / a);
        raw[i + 3] = Math.round(coverage * 255);
      }
    }
  }
  return raw;
}

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = renderIconRGBA(size);
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// تنسيق ICO يدعم تضمين عدة صور بأحجام مختلفة، كل واحدة PNG مباشرة (BI_PNG، مدعوم
// منذ Windows Vista) — يختار ويندوز الحجم الأنسب حسب السياق (شريط المهام، مستكشف
// الملفات، الاختصار...) بدل تكبير/تصغير صورة واحدة، فتبقى كل الأحجام حادة
function wrapAsIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // نوع: أيقونة
  header.writeUInt16LE(images.length, 4);

  let offset = header.length + images.length * 16;
  const entries = [];
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // 0 يعني 256
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const outDir = path.join(__dirname, '..', 'resources');
fs.mkdirSync(outDir, { recursive: true });

const ICO_SIZES = [16, 32, 48, 256];
const icoImages = ICO_SIZES.map((size) => ({ size, png: encodePng(size) }));

fs.writeFileSync(path.join(outDir, 'icon.png'), encodePng(512));
fs.writeFileSync(path.join(outDir, 'icon.ico'), wrapAsIco(icoImages));

console.log('Icon generated:', path.join(outDir, 'icon.png'), 'and icon.ico (sizes:', ICO_SIZES.join(', '), ')');
