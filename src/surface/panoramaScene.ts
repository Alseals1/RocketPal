import * as THREE from 'three';
import type { ScreenPoint } from '../scene/spaceScene';
import { azElToDirection, type LookState } from './geometry';

const SPHERE_RADIUS = 500;
const VERTICAL_FOV = 70;

/**
 * A real 360 degree photo wrapped round the inside of a sphere, seen from the middle.
 * It draws with the game's own renderer, so there is only ever one WebGL context.
 */
export class PanoramaScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(VERTICAL_FOV, 1, 0.1, 2000);
  private readonly tmp = new THREE.Vector3();
  private mesh?: THREE.Mesh;
  private texture?: THREE.Texture;
  /** Counts loads. If a newer load has started, an older one that finishes late throws its picture away. */
  private loadTicket = 0;
  private width = 1;
  private height = 1;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.scene.background = new THREE.Color(0x000000);
  }

  readonly verticalFov = VERTICAL_FOV;

  /** The biggest picture this graphics card can hold. */
  get maxTextureSize(): number {
    return this.renderer.capabilities.maxTextureSize;
  }

  async load(url: string): Promise<void> {
    this.dispose();
    const ticket = ++this.loadTicket;
    const texture = await new THREE.TextureLoader().loadAsync(url);
    if (ticket !== this.loadTicket) {
      texture.dispose(); // a newer load has begun since: this picture is out of date
      return;
    }
    this.dispose(); // never leave an older picture behind
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.texture = texture;

    // The picture's left edge is azimuth 0. Flipping the sphere inside out (scale -1) makes it read the right way round from inside.
    const geometry = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 40);
    geometry.scale(-1, 1, 1);
    this.mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
    this.scene.add(this.mesh);
  }

  get isLoaded(): boolean {
    return this.mesh !== undefined;
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  setLook(look: LookState): void {
    const d = azElToDirection(look.azimuth, look.elevation);
    this.camera.lookAt(d.x, d.y, d.z);
    this.camera.updateMatrixWorld();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Where a direction in the picture shows up on screen. Call after `setLook`. */
  project(azimuth: number, elevation: number): ScreenPoint {
    const d = azElToDirection(azimuth, elevation);
    this.tmp.set(d.x * 100, d.y * 100, d.z * 100);
    const inFront = this.tmp.clone().applyMatrix4(this.camera.matrixWorldInverse).z < 0;
    this.tmp.project(this.camera);
    const x = (this.tmp.x * 0.5 + 0.5) * this.width;
    const y = (-this.tmp.y * 0.5 + 0.5) * this.height;
    return { x, y, inFront, onScreen: inFront && x >= 0 && x <= this.width && y >= 0 && y <= this.height };
  }

  /** Frees the picture's memory. Called when you leave. */
  dispose(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = undefined;
    }
    this.texture?.dispose();
    this.texture = undefined;
  }
}
