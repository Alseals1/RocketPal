import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const SHIP_MODEL_URL = '/models/ship.glb';

export interface ShipModel {
  /** The rocket, pointing along -Z like the flight model's forward direction. */
  model: THREE.Group;
  /** Grows and shrinks with the engine. It scales along its own +Y, which points backward. */
  flame: THREE.Object3D;
}

/** Loads the Blender-made rocket. Rejects if the file is missing or broken, so the caller can keep the placeholder. */
export async function loadShipModel(url = SHIP_MODEL_URL): Promise<ShipModel> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;

  let flame: THREE.Object3D | undefined;
  model.traverse((node) => {
    if (node.name === 'Flame') flame = node;
  });
  if (!flame) throw new Error(`${url} has no part called Flame`);

  // The flame glows by itself instead of being lit by the Sun, like the placeholder's.
  (flame as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9 });

  return { model, flame };
}
