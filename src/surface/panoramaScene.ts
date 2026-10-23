import * as THREE from 'three';
import type { WindowPhoto } from '../data/surfaces';
import type { ScreenPoint } from '../scene/spaceScene';
import { azElToDirection, viewHorizontalFov, windowCameraFov, type LookState } from './geometry';

const SPHERE_RADIUS = 500;
const VERTICAL_FOV = 70;
/** In a window view the camera sees at most this much up and down (less on a wide screen: see `windowCameraFov`). */
const WINDOW_VERTICAL_FOV = 50;
/** How far in front of the camera the flat photo hangs. */
const WINDOW_DISTANCE = 100;

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
  /** Set in a window view, so the camera can re-zoom when the screen changes shape. */
  private windowPhoto?: WindowPhoto;
  private width = 1;
  private height = 1;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.scene.background = new THREE.Color(0x000000);
  }

  /** How tall the camera sees, in degrees (it changes between a 360 degree picture and a window view). */
  get verticalFov(): number {
    return this.camera.fov;
  }

  /** Paints the empty space around a window photo a given colour. For the browser tests only: a bright colour shows any gap. */
  setBackdrop(color: number): void {
    this.scene.background = new THREE.Color(color);
  }

  /** What the screen sees now, in degrees. */
  viewFov(): { horizontalFov: number; verticalFov: number } {
    return { horizontalFov: viewHorizontalFov(this.camera.fov, this.camera.aspect), verticalFov: this.camera.fov };
  }

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
    this.setCameraFov(VERTICAL_FOV);

    // The picture's left edge is azimuth 0. Flipping the sphere inside out (scale -1) makes it read the right way round from inside.
    const geometry = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 40);
    geometry.scale(-1, 1, 1);
    this.mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
    this.scene.add(this.mesh);
  }

  /**
   * An ordinary wide photo seen through a window. It hangs flat in front of the camera, sized so it covers exactly the
   * angles the lens saw: that is what makes straight lines look straight, as in the photo.
   */
  async loadWindow(url: string, photo: WindowPhoto): Promise<void> {
    this.dispose();
    const ticket = ++this.loadTicket;
    const texture = await new THREE.TextureLoader().loadAsync(url);
    if (ticket !== this.loadTicket) {
      texture.dispose();
      return;
    }
    this.dispose();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.texture = texture;
    this.windowPhoto = photo;
    this.setCameraFov(windowCameraFov(photo, this.camera.aspect, WINDOW_VERTICAL_FOV));

    const width = 2 * WINDOW_DISTANCE * Math.tan((photo.horizontalFov * Math.PI) / 360);
    const height = 2 * WINDOW_DISTANCE * Math.tan((photo.verticalFov * Math.PI) / 360);
    const geometry = new THREE.PlaneGeometry(width, height);
    geometry.rotateY(-Math.PI / 2); // faces the camera, with the photo's right side toward larger azimuth (turning right)
    this.mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
    this.mesh.position.set(WINDOW_DISTANCE, 0, 0); // straight ahead at azimuth 0
    this.scene.add(this.mesh);
  }

  private setCameraFov(fov: number): void {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  get isLoaded(): boolean {
    return this.mesh !== undefined;
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    // A window view zooms so the photo always fills the screen's width (no black bars on a wide screen).
    if (this.windowPhoto) this.setCameraFov(windowCameraFov(this.windowPhoto, this.camera.aspect, WINDOW_VERTICAL_FOV));
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
    this.windowPhoto = undefined;
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
