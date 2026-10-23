import * as THREE from 'three';
import { DEFAULT_FLIGHT, forwardVector, type ShipState, type Vec3 } from '../flight/flightModel';
import { qualitySettings, type Quality } from '../quality/quality';
import type { BodyLayout } from './layout';
import { makeGlowTexture, makeWorldTexture } from './textures';

const STAR_FIELD_RADIUS = 15_000;
const CAMERA_BACK = 16;
const CAMERA_UP = 5;

/** Where a point in space lands on the screen. `x` and `y` are in pixels from the top-left. */
export interface ScreenPoint {
  x: number;
  y: number;
  /** True if the point is in front of the camera. */
  inFront: boolean;
  /** True if it is also inside the screen. */
  onScreen: boolean;
}

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SpaceScene {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.3, 30_000);
  private readonly stars: THREE.Points;
  private readonly glows: THREE.Sprite[] = [];
  private readonly spinners: THREE.Mesh[] = [];
  private readonly ship = new THREE.Group();
  private readonly flame: THREE.Mesh;
  private readonly cameraTarget = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmpView = new THREE.Vector3();
  private cameraReady = false;
  private width = 1;
  private height = 1;

  constructor(
    parent: HTMLElement,
    layouts: BodyLayout[],
    quality: Quality,
    private readonly reducedMotion: boolean,
    /** Keeps the picture readable after it is drawn. Only for the browser tests, which check the pixels. */
    keepPicture = false,
  ) {
    const settings = qualitySettings(quality);

    this.renderer = new THREE.WebGLRenderer({ antialias: quality === 'high', powerPreference: 'high-performance', preserveDrawingBuffer: keepPicture });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatioCap));
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'A 3D view of the solar system from your rocket');
    parent.appendChild(this.canvas);

    this.scene.background = new THREE.Color(0x03040c);

    // The Sun lights everything; a soft ambient light keeps the night sides readable.
    const sunLight = new THREE.PointLight(0xffffff, 3.2, 0, 0);
    this.scene.add(sunLight);
    this.scene.add(new THREE.AmbientLight(0x6677aa, 1.1));

    const glowTexture = makeGlowTexture();
    for (const layout of layouts) this.addBody(layout, glowTexture);

    this.stars = this.makeStars();
    this.scene.add(this.stars);

    this.flame = this.makeShip();
    this.scene.add(this.ship);

    this.applyQuality(quality);
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  /** Low quality: no glow, fewer stars, lower pixel ratio. */
  applyQuality(quality: Quality): void {
    const settings = qualitySettings(quality);
    for (const glow of this.glows) glow.visible = settings.glow;
    this.stars.geometry.setDrawRange(0, settings.starCount);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatioCap));
    if (this.width > 1) this.setSize(this.width, this.height);
  }

  get glowVisible(): boolean {
    return this.glows.some((g) => g.visible);
  }

  update(dt: number, ship: ShipState, boosting: boolean): void {
    // Put the rocket where the flight model says it is.
    this.ship.position.set(ship.position.x, ship.position.y, ship.position.z);
    this.ship.rotation.set(ship.pitch, ship.yaw, 0, 'YXZ');
    const flicker = this.reducedMotion ? 1 : 0.85 + Math.random() * 0.3;
    const flameSize = ship.docked ? 0.2 : (0.5 + (boosting ? 1.4 : 0.5) * (ship.speed / DEFAULT_FLIGHT.boostSpeed + 0.4)) * flicker;
    this.flame.scale.set(1, flameSize, 1);

    // Chase camera: behind and a little above the rocket, easing after it.
    const forward = forwardVector(ship.yaw, ship.pitch);
    this.cameraTarget.set(
      ship.position.x - forward.x * CAMERA_BACK,
      ship.position.y - forward.y * CAMERA_BACK + CAMERA_UP,
      ship.position.z - forward.z * CAMERA_BACK,
    );
    const follow = this.cameraReady ? 1 - Math.exp(-(this.reducedMotion ? 14 : 7) * dt) : 1;
    this.camera.position.lerp(this.cameraTarget, follow);
    this.cameraReady = true;
    this.camera.lookAt(
      ship.position.x + forward.x * 20,
      ship.position.y + forward.y * 20,
      ship.position.z + forward.z * 20,
    );

    this.stars.position.copy(this.camera.position);

    if (!this.reducedMotion) {
      for (const body of this.spinners) body.rotation.y += dt * 0.08;
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Where a point in space shows up on screen. Call after `update`. */
  project(position: Vec3): ScreenPoint {
    this.camera.updateMatrixWorld();
    this.tmp.set(position.x, position.y, position.z);
    const inFront = this.tmpView.copy(this.tmp).applyMatrix4(this.camera.matrixWorldInverse).z < 0;
    this.tmp.project(this.camera);
    // Behind the camera the projection is mirrored; flip it so an arrow can still point the right way.
    const sign = inFront ? 1 : -1;
    const x = (this.tmp.x * sign * 0.5 + 0.5) * this.width;
    const y = (-this.tmp.y * sign * 0.5 + 0.5) * this.height;
    return { x, y, inFront, onScreen: inFront && x >= 0 && x <= this.width && y >= 0 && y <= this.height };
  }

  private addBody(layout: BodyLayout, glowTexture: THREE.Texture): void {
    const { world, position, radius } = layout;
    const isSun = world.kind === 'star';
    const geometry = new THREE.SphereGeometry(radius, 48, 32);
    const texture = makeWorldTexture(world);
    const material = isSun
      ? new THREE.MeshBasicMaterial({ map: texture })
      : new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, position.z);
    this.scene.add(mesh);
    if (world.kind !== 'moon') this.spinners.push(mesh);

    if (isSun || world.id === 'earth' || world.id === 'venus') {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: new THREE.Color(world.color),
          transparent: true,
          opacity: isSun ? 0.9 : 0.35,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      sprite.position.copy(mesh.position);
      sprite.scale.setScalar(radius * (isSun ? 4.2 : 2.7));
      this.scene.add(sprite);
      this.glows.push(sprite);
    }

    if (world.id === 'saturn') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius * 1.35, radius * 2.3, 64),
        new THREE.MeshBasicMaterial({ color: 0xcdb88a, side: THREE.DoubleSide, transparent: true, opacity: 0.75 }),
      );
      ring.rotation.x = -Math.PI / 2 + 0.45;
      ring.position.copy(mesh.position);
      this.scene.add(ring);
    }
  }

  private makeStars(): THREE.Points {
    const max = qualitySettings('high').starCount;
    const rand = seeded(12345);
    const positions = new Float32Array(max * 3);
    const colors = new Float32Array(max * 3);
    for (let i = 0; i < max; i++) {
      // A random point on a big sphere around the camera.
      const u = rand() * 2 - 1;
      const phi = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      positions.set([r * Math.cos(phi) * STAR_FIELD_RADIUS, u * STAR_FIELD_RADIUS, r * Math.sin(phi) * STAR_FIELD_RADIUS], i * 3);
      const warmth = rand();
      colors.set([1, 0.9 + warmth * 0.1, 0.8 + (1 - warmth) * 0.2], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, depthWrite: false }),
    );
    points.frustumCulled = false;
    return points;
  }

  /** A placeholder rocket made of simple shapes (the real model is listed in ASSETS.md). Returns the flame. */
  private makeShip(): THREE.Mesh {
    // A little glow of their own so the rocket never turns into a dark shape when the Sun is behind it.
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f6ff, roughness: 0.5, emissive: 0x8a93b8 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xff8c42, roughness: 0.5, emissive: 0x7a3510 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x4cc9f0, roughness: 0.3, emissive: 0x1b6f8a });

    // Built pointing along -Z, like the flight model's forward direction.
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.8, 20), white);
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1, 20), orange);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -1.4;
    const window = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), blue);
    window.position.set(0, 0.45, -0.45);
    this.ship.add(body, nose, window);

    for (let i = 0; i < 3; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.7), orange);
      const angle = (i / 3) * Math.PI * 2;
      fin.position.set(Math.sin(angle) * 0.7, Math.cos(angle) * 0.7, 0.75);
      fin.rotation.z = -angle;
      this.ship.add(fin);
    }

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 1.6, 16),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9 }),
    );
    flame.geometry.translate(0, 0.8, 0); // wide end at the engine, so it grows away from the rocket
    flame.rotation.x = Math.PI / 2; // tip points backward (+Z)
    flame.position.z = 0.9;
    this.ship.add(flame);
    return flame;
  }
}
