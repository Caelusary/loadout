// Removes the metadata blocks a photo can carry (EXIF with GPS, XMP, IPTC, PNG text chunks) without re-encoding it,
// so where it was taken never reaches a public page. The picture data is left byte-for-byte. The browser already
// redraws review photos, which drops this, but a request made by hand would skip that.

const JPEG_DROP = new Set([0xe1, 0xed]); // APP1 (EXIF, XMP) and APP13 (IPTC)

function stripJpeg(buf) {
  const parts = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length && buf[i] === 0xff) {
    const marker = buf[i + 1];
    if (marker === 0xda) break; // start of scan: the image data follows, copy the rest as is
    const length = buf.readUInt16BE(i + 2);
    if (!JPEG_DROP.has(marker)) parts.push(buf.subarray(i, i + 2 + length));
    i += 2 + length;
  }
  parts.push(buf.subarray(i));
  return Buffer.concat(parts);
}

const PNG_DROP = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt']);

function stripPng(buf) {
  const parts = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const length = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    const end = i + 12 + length;
    if (!PNG_DROP.has(type)) parts.push(buf.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(parts);
}

function stripWebp(buf) {
  const chunks = [];
  let i = 12;
  while (i + 8 <= buf.length) {
    const type = buf.toString('latin1', i, i + 4);
    const size = buf.readUInt32LE(i + 4);
    const end = i + 8 + size + (size % 2); // chunks are padded to an even length
    if (type !== 'EXIF' && type !== 'XMP ') chunks.push(Buffer.from(buf.subarray(i, end)));
    i = end;
  }
  // The extended header has flags saying EXIF and XMP are present; clear them to match.
  const vp8x = chunks.find((c) => c.toString('latin1', 0, 4) === 'VP8X');
  if (vp8x) vp8x[8] &= ~(0x08 | 0x04);
  const body = Buffer.concat(chunks);
  const header = Buffer.from(buf.subarray(0, 12));
  header.writeUInt32LE(4 + body.length, 4);
  return Buffer.concat([header, body]);
}

// `type` is what imageTypeOf() found from the file's first bytes. Anything unexpected comes back unchanged.
export function stripMetadata(buf, type) {
  try {
    if (type === 'jpg') return stripJpeg(buf);
    if (type === 'png') return stripPng(buf);
    if (type === 'webp') return stripWebp(buf);
  } catch {
    // A malformed file: keep what we have; the browser already redrew it.
  }
  return buf;
}
