import * as THREE from 'three';

/**
 * Loads a landing photo as a texture, decoded off the main thread (`createImageBitmap`), so landing does not freeze.
 * Falls back to an ordinary image when the browser has no `createImageBitmap` or the bitmap cannot be made.
 *
 * Three.js ignores `texture.flipY` for a bitmap: the flip is asked for when it is decoded instead, so the picture faces
 * the same way as one loaded by `TextureLoader`.
 */
export async function loadPhotoTexture(url: string): Promise<THREE.Texture> {
  if (typeof createImageBitmap !== 'undefined') {
    try {
      const bitmap = await new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY' }).loadAsync(url);
      const texture = new THREE.Texture(bitmap);
      texture.needsUpdate = true;
      return texture;
    } catch {
      // Some browsers cannot decode this way: use an ordinary image below.
    }
  }
  return new THREE.TextureLoader().loadAsync(url);
}

/** Frees a photo texture, and the decoded bitmap behind it, which a texture's `dispose` leaves alone. */
export function disposePhotoTexture(texture: THREE.Texture): void {
  texture.dispose();
  const image: unknown = texture.image;
  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
}
