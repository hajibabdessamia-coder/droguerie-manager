// أيقونة مؤقتة بسيطة (بدون أي مكتبة رسم خارجية): مربع بلون النحاس المستخدم في تقارير
// المشروع مع رمز صاعقة أبيض بسيط يرمز للعقاقير الكهربائية. تحسينها المرئي مؤجَّل
// عمداً لمرحلة "الأيقونة الاحترافية" — هذه فقط تكفي لبناء مثبّت صالح الآن.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 512;
const BG = [0xa8, 0x5a, 0x26]; // نحاسي، مطابق للون التمييز في تقارير المشروع
const FG = [0xff, 0xff, 0xff];

function inBolt(x, y, s) {
  // نقاط صاعقة بسيطة مُقاسة إلى مربع [0,1]x[0,1]
  const pts = [
    [0.58, 0.08], [0.30, 0.55], [0.46, 0.55],
    [0.40, 0.92], [0.72, 0.42], [0.54, 0.42],
  ];
  const nx = x / s;
  const ny = y / s;
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

function buildRawRGBA(size) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  const radius = size * 0.18;
  for (let y = 0; y < size; y++) {
    let offset = y * (1 + size * 4);
    raw[offset] = 0; // فلتر PNG: بدون فلتر لكل سطر
    offset += 1;
    for (let x = 0; x < size; x++) {
      const i = offset + x * 4;
      const opaque = roundedMask(x, y, size, radius);
      if (!opaque) {
        raw[i] = 0;
        raw[i + 1] = 0;
        raw[i + 2] = 0;
        raw[i + 3] = 0;
        continue;
      }
      const bolt = inBolt(x, y, size);
      const [r, g, b] = bolt ? FG : BG;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = 255;
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

  const raw = buildRawRGBA(size);
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function wrapAsIco(pngBuffer, size) {
  // تنسيق ICO يدعم تضمين بيانات PNG مباشرة لكل حجم (BI_PNG) منذ Windows Vista
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // نوع: أيقونة
  header.writeUInt16LE(1, 4); // عدد الصور

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size; // 0 يعني 256
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12); // offset

  return Buffer.concat([header, entry, pngBuffer]);
}

const outDir = path.join(__dirname, '..', 'resources');
fs.mkdirSync(outDir, { recursive: true });

const png512 = encodePng(SIZE);
fs.writeFileSync(path.join(outDir, 'icon.png'), png512);

const png256 = encodePng(256);
fs.writeFileSync(path.join(outDir, 'icon.ico'), wrapAsIco(png256, 256));

console.log('Icon generated:', path.join(outDir, 'icon.png'), 'and icon.ico');
