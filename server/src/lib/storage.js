import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';

export const UPLOAD_DIR = path.resolve(import.meta.dirname, '../../uploads');

export const isCloudinaryEnabled = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET,
  );

let configured = false;
function client() {
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

export async function saveFile(buffer, { ext, kind }) {
  if (isCloudinaryEnabled()) {
    const result = await new Promise((resolve, reject) => {
      const options =
        kind === 'model'
          ? { folder: 'loadout/models', resource_type: 'raw', public_id: `${randomUUID()}.glb` }
          : { folder: 'loadout/products', resource_type: 'image' };
      client()
        .uploader.upload_stream(options, (err, res) => (err ? reject(err) : resolve(res)))
        .end(buffer);
    });
    return { url: result.secure_url, publicId: result.public_id };
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);
  return { url: `/api/files/${name}`, publicId: `local:${name}` };
}

function publicIdFromUrl(url) {
  if (!url) return null;
  if (url.startsWith('/api/files/')) return `local:${path.basename(url)}`;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
  if (!match) return null;
  // Raw assets keep their extension in the public id; images don't.
  return url.includes('/raw/') ? match[1] : match[1].replace(/\.[a-z0-9]+$/i, '');
}

// Best effort: a failed cleanup must never fail the request that triggered it.
// The id is always derived from the URL (which isAllowedAssetUrl vetted), never from a stored publicId:
// that value comes from the request body, so trusting it would let a seller delete any asset.
// Cloudinary deletes are confined to this app's own folders.
export async function deleteFile({ url }) {
  const id = publicIdFromUrl(url);
  if (!id || url?.startsWith('/products/')) return;
  if (!id.startsWith('local:') && !id.startsWith('loadout/')) return;
  try {
    if (id.startsWith('local:')) {
      await fs.unlink(path.join(UPLOAD_DIR, path.basename(id.slice(6))));
    } else if (isCloudinaryEnabled()) {
      await client().uploader.destroy(id, { resource_type: url?.includes('/raw/') ? 'raw' : 'image' });
    }
  } catch (err) {
    console.warn(`Could not delete stored file ${id}: ${err.message}`);
  }
}

export function isAllowedAssetUrl(url) {
  if (typeof url !== 'string') return false;
  if (url.startsWith('/api/files/') || url.startsWith('/products/')) return !url.includes('..');
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  return Boolean(cloud) && url.startsWith(`https://res.cloudinary.com/${cloud}/`);
}
