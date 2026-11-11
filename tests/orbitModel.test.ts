import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Reads the JSON part of a .glb file (the binary part is not needed for these checks). */
function readGlb(path: string) {
  const file = readFileSync(path);
  expect(file.toString('ascii', 0, 4)).toBe('glTF');
  expect(file.readUInt32LE(4)).toBe(2);
  const jsonLength = file.readUInt32LE(12);
  return { size: file.length, json: JSON.parse(file.toString('utf8', 20, 20 + jsonLength)) };
}

interface Accessor {
  count: number;
  min?: number[];
  max?: number[];
}
const { size, json } = readGlb('public/models/orbit.glb');
const accessors: Accessor[] = json.accessors;
const meshes: { name: string; primitives: { attributes: { POSITION: number }; indices: number }[] }[] = json.meshes;
const nodes: { name: string; mesh?: number }[] = json.nodes;

function bounds(nodeName: string) {
  const node = nodes.find((n) => n.name === nodeName);
  if (node?.mesh === undefined) throw new Error(`no mesh node called ${nodeName}`);
  const a = accessors[meshes[node.mesh].primitives[0].attributes.POSITION];
  return { min: a.min!, max: a.max! };
}

describe('orbit.glb', () => {
  it('has the four faces the game switches between, by name, and the body parts', () => {
    const names = nodes.map((n) => n.name);
    expect(names).toEqual(
      expect.arrayContaining(['Expr_Neutral', 'Expr_Happy', 'Expr_Think', 'Expr_Blink', 'Body', 'Plate', 'Ears', 'Antenna', 'AntennaBall']),
    );
    expect(json.materials.map((m: { name: string }) => m.name)).toEqual(
      expect.arrayContaining(['Hull', 'Plate', 'Eye', 'Accent', 'Antenna']),
    );
  });

  it('stays small: under 3,000 triangles (every face counted) and under 150 KB', () => {
    let triangles = 0;
    for (const mesh of meshes) for (const p of mesh.primitives) triangles += accessors[p.indices].count / 3;
    expect(triangles).toBeLessThanOrEqual(3000);
    expect(size).toBeLessThan(150 * 1024);
  });

  it('has no image textures, no double-sided materials, no cameras, lights or animations', () => {
    expect(json.images).toBeUndefined();
    expect(json.textures).toBeUndefined();
    for (const m of json.materials) expect(m.doubleSided).not.toBe(true);
    expect(json.cameras).toBeUndefined();
    expect(json.animations).toBeUndefined();
    expect(json.extensions?.KHR_lights_punctual).toBeUndefined();
  });

  it('faces -Z (like the ship) and the antenna points up', () => {
    const body = bounds('Body');
    for (const face of ['Expr_Neutral', 'Expr_Happy', 'Expr_Think', 'Expr_Blink']) {
      const f = bounds(face);
      // Every face sits on the front: its whole depth is in front of the middle of the body.
      expect(f.max[2]).toBeLessThan(0);
      // And does not stick out past the body sideways.
      expect(f.max[0]).toBeLessThan(body.max[0]);
      expect(f.min[0]).toBeGreaterThan(body.min[0]);
    }
    expect(bounds('AntennaBall').max[1]).toBeGreaterThan(body.max[1]);
    expect(bounds('AntennaBall').min[1]).toBeGreaterThan(0);
  });

  it('is about 1.2 units wide with its ears, so it is bigger than a ship cockpit but smaller than the ship', () => {
    const ears = bounds('Ears');
    const width = ears.max[0] - ears.min[0];
    expect(width).toBeGreaterThan(1);
    expect(width).toBeLessThan(1.5);
  });
});
