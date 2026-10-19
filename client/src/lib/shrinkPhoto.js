const MAX_SIDE = 1600; // px on the longer side
const MAX_BYTES = 2 * 1024 * 1024; // the server's limit

// Phone photos are several MB and carry where they were taken (GPS) in their metadata. Drawing one onto a canvas and
// saving that shrinks it under the upload limit and leaves the metadata behind. Used for review and delivery photos.
export async function shrinkPhoto(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  for (const quality of [0.85, 0.7, 0.5]) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= MAX_BYTES) return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  }
  throw new Error('That photo is too large. Try a smaller one.');
}
