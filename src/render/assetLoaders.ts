/**
 * The render side of the `AssetManager` (src/platform/assets.ts): how a texture and a model are loaded, freed, and
 * uploaded again after a lost graphics context. The app hands these to the manager. Each has the shape of the manager's
 * `AssetLoader`, without naming it: render may not import platform (docs/TECHNICAL_ARCHITECTURE.md section 3).
 */
import * as THREE from 'three';
import { disposePhotoTexture, loadPhotoTexture } from '../surface/photoTexture';

/** A colour picture, decoded off the main thread. */
export const textureLoader = {
  async load(url: string): Promise<THREE.Texture> {
    const texture = await loadPhotoTexture(url);
    texture.colorSpace = THREE.SRGBColorSpace; // every texture in the manifest is a colour picture
    return texture;
  },
  free: disposePhotoTexture,
  restore(texture: THREE.Texture): void {
    texture.needsUpdate = true;
  },
};

/** A glTF model. GLTFLoader is imported on first use, so it stays out of the first download. */
export const modelLoader = {
  async load(url: string): Promise<THREE.Group> {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(url);
    return gltf.scene;
  },
  free(model: THREE.Group): void {
    model.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      for (const material of [node.material as THREE.Material | THREE.Material[]].flat()) {
        for (const texture of materialTextures(material)) texture.dispose();
        material.dispose();
      }
    });
  },
  restore(model: THREE.Group): void {
    model.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      for (const material of [node.material as THREE.Material | THREE.Material[]].flat()) {
        for (const texture of materialTextures(material)) texture.needsUpdate = true;
      }
    });
  },
};

/** Every texture a material uses (its map, normal map and so on). */
function materialTextures(material: THREE.Material): THREE.Texture[] {
  return Object.values(material).filter((value): value is THREE.Texture => value instanceof THREE.Texture);
}
