import * as THREE from 'three';

export interface ShipModel {
  /** The rocket, pointing along -Z like the flight model's forward direction. */
  model: THREE.Group;
  /** Grows and shrinks with the engine. It scales along its own +Y, which points backward. */
  flame: THREE.Object3D;
}

/**
 * Turns the Blender-made rocket (`model/ship`, loaded by the asset manager) into the ship the scene flies. Throws if it
 * has no Flame mesh, so the caller can keep the placeholder.
 */
export function toShipModel(model: THREE.Group): ShipModel {
  let flame: THREE.Mesh | undefined;
  model.traverse((node) => {
    if (node.name === 'Flame' && node instanceof THREE.Mesh) flame = node;
  });
  if (!flame) throw new Error('The rocket model has no mesh called Flame');

  // The flame glows by itself instead of being lit by the Sun, like the placeholder's.
  for (const material of [flame.material].flat()) material.dispose();
  flame.material = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9 });

  return { model, flame };
}
