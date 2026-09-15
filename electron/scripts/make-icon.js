// أيقونة التطبيق: مربع بتدرج لوني كحلي-إلى-أزرق مخضر (احترافي، مرتبط بمجال
// المحاسبة/الحساب — "L7ssab")، يحمل شعار "L7" هندسي مكوّن من حرف L فضي/أبيض
// ورقم 7 سيان/تيل متلاصقين في رمز واحد متماسك، بدون أي مكتبة رسم خارجية —
// نفس فلسفة النسخة الأولى، مع محاكاة فائقة العينات (supersampling) لتنعيم
// الحواف، تدرج لوني بدل اللون المسطح، وحزمة ICO متعددة الأحجام (16/32/48/256)
// يُعاد رسم كل حجم فيها من الصفر بدل تصغير صورة واحدة، حتى تبقى الحواف حادة
// في شريط المهام الصغير أيضاً.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG_TOP = [0x1e, 0x3a, 0x5f]; // كحلي داكن أعلى الأيقونة
const BG_BOTTOM = [0x0f, 0x76, 0x6e]; // أزرق مخضر (تيل) أسفلها — يمنح إحساساً بالعمق
const L_COLOR = [0xf5, 0xf7, 0xfa]; // حرف L بلون أبيض/فضي
const SEVEN_COLOR = [0x22, 0xd3, 0xee]; // رقم 7 بلون سيان/تيل فاتح
const SUPERSAMPLE = 4;

// حرف L: عمود رأسي + قاعدة أفقية، مُقاسان إلى مربع [0,1]x[0,1]
const L_RECTS = [
  [0.20, 0.18, 0.34, 0.80], // العمود الرأسي
  [0.20, 0.66, 0.50, 0.80], // القاعدة الأفقية
];

// رقم 7: شريط علوي أفقي، مُقاس إلى مربع [0,1]x[0,1]
const SEVEN_BAR_RECT = [0.44, 0.18, 0.82, 0.32];

// الضلع المائل لرقم 7، ينزل من نهاية الشريط العلوي نحو أسفل يسار، بمحاذاة قاعدة
// حرف L حتى يتشكل الرمزان كعلامة واحدة متماسكة
const SEVEN_DIAGONAL_POINTS = [
  [0.80, 0.32],
  [0.68, 0.32],
  [0.40, 0.82],
  [0.52, 0.82],
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

function inRect(nx, ny, [x0, y0, x1, y1]) {
  return nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1;
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

// يحدد لون نقطة معطاة (بإحداثيات مُطبَّعة 0..1) حسب الطبقات، من الأعلى أولوية للأسفل
function colorAt(nx, ny) {
  for (const rect of L_RECTS) {
    if (inRect(nx, ny, rect)) return L_COLOR;
  }
  if (inRect(nx, ny, SEVEN_BAR_RECT)) return SEVEN_COLOR;
  if (pointInPolygon(nx, ny, SEVEN_DIAGONAL_POINTS)) return SEVEN_COLOR;
  return null; // خلفية متدرجة
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
          const fg = colorAt(nx, ny);
          if (fg) {
            r += fg[0];
            g += fg[1];
            b += fg[2];
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
