import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Reads the JSON part of a .glb file (the binary part is not needed for these checks). */
function readGlb(path: string) {
  const file = readFileSync(path);
  expect(file.toString('ascii', 0, 4)).toBe('glTF');
  expect(file.readUInt32LE(4)).toBe(2);
  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.toString('utf8', 20, 20 + jsonLength));
  return { size: file.length, json };
}

interface Accessor {
  count: number;
  min?: number[];
  max?: number[];
}
interface Primitive {
  attributes: { POSITION: number };
  indices?: number;
  material?: number;
}

const { size, json } = readGlb('public/models/ship.glb');
const accessors: Accessor[] = json.accessors;
const meshes: { name: string; primitives: Primitive[] }[] = json.meshes;
const nodes: { name?: string; mesh?: number; rotation?: number[]; children?: number[] }[] = json.nodes;
const materialNames: string[] = json.materials.map((m: { name: string }) => m.name);

function nodeNamed(name: string) {
  const node = nodes.find((n) => n.name === name);
  if (!node) throw new Error(`no node called ${name}`);
  return node;
}

function positionBounds(meshIndex: number) {
  const bounds = meshes[meshIndex].primitives.map((p) => accessors[p.attributes.POSITION]);
  return {
    min: [0, 1, 2].map((a) => Math.min(...bounds.map((b) => b.min![a]))),
    max: [0, 1, 2].map((a) => Math.max(...bounds.map((b) => b.max![a]))),
  };
}

describe('ship.glb', () => {
  it('has every part the game looks for, by name', () => {
    expect(materialNames).toEqual(expect.arrayContaining(['Hull', 'Trim', 'Window', 'Dark', 'Flame']));
    expect(nodes.some((n) => n.name === 'Flame' && n.mesh !== undefined)).toBe(true);
  });

  it('stays small: under 3,000 triangles and under 150 KB', () => {
    let triangles = 0;
    for (const mesh of meshes) {
      for (const p of mesh.primitives) triangles += accessors[p.indices!].count / 3;
    }
    expect(triangles).toBeLessThanOrEqual(3000);
    expect(size).toBeLessThan(150 * 1024);
  });

  it('has no image textures, so the credit "original work, flat colours only" stays true', () => {
    expect(json.images).toBeUndefined();
    expect(json.textures).toBeUndefined();
  });

  it('draws only the outside of its closed shapes (no double-sided materials)', () => {
    for (const m of json.materials) expect(m.doubleSided).not.toBe(true);
  });

  it('has no cameras, lights or animations', () => {
    expect(json.cameras).toBeUndefined();
    expect(json.animations).toBeUndefined();
    expect(json.extensions?.KHR_lights_punctual).toBeUndefined();
  });

  it('points its nose along -Z, the flight model forward direction, and is about as long as the old placeholder', () => {
    const bodyNode = nodeNamed('Body');
    const { min, max } = positionBounds(bodyNode.mesh!);
    const trim = positionBounds(nodeNamed('Trim').mesh!);
    const nozzle = positionBounds(nodeNamed('Nozzle').mesh!);
    const front = -Math.min(min[2], trim.min[2]); // how far it reaches forward
    const back = Math.max(max[2], nozzle.max[2]); // how far it reaches backward
    expect(front).toBeGreaterThan(back);
    // The placeholder was about 3.2 units long.
    expect(front + back).toBeGreaterThan(2.8);
    expect(front + back).toBeLessThan(4);
  });

  it('has a flame that grows along its own +Y, away from the engine, pointing backward (+Z)', () => {
    const flame = nodeNamed('Flame');
    const bounds = positionBounds(flame.mesh!);
    // Wide end at the engine (origin), tip at the far end of the node's +Y.
    expect(bounds.min[1]).toBeCloseTo(0, 3);
    expect(bounds.max[1]).toBeCloseTo(1.6, 3);

    // Turn local +Y by the node's rotation (a quaternion): it must end up pointing to +Z.
    const [x, y, z, w] = flame.rotation ?? [0, 0, 0, 1];
    const v = [0, 1, 0];
    // v' = v + 2w(q x v) + 2 q x (q x v)
    const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const t = cross([x, y, z], v).map((n) => 2 * n);
    const c = cross([x, y, z], t);
    const out = v.map((n, i) => n + w * t[i] + c[i]);
    expect(out[2]).toBeCloseTo(1, 3);
    expect(out[0]).toBeCloseTo(0, 3);
    expect(out[1]).toBeCloseTo(0, 3);
  });
});
