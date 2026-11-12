export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A round thing in space: a planet to land on, or one to stay out of. */
export interface Body {
  position: Vec3;
  radius: number;
}

export interface ShipState {
  position: Vec3;
  /** Radians. 0 faces -Z; positive turns left (counter-clockwise seen from above). */
  yaw: number;
  /** Radians. Positive points the nose up. There is no roll, so the ship is always level. */
  pitch: number;
  yawRate: number;
  pitchRate: number;
  speed: number;
  docked: boolean;
}

export interface FlightInput {
  /** -1 left .. +1 right. */
  turn: number;
  /** -1 down .. +1 up. */
  pitch: number;
  boost: boolean;
}

/** A bump: which obstacle the ship touched this step, and the way out of it. */
export interface Contact {
  /** Index into `context.obstacles` (or into `index.bodies` when it is an `ObstacleIndex`). */
  body: number;
  /** Unit vector from the obstacle's centre to the ship, at the first touch this step. */
  normal: Vec3;
}

/** One step of flight, plus what happened during it. */
export interface FlightStep {
  state: ShipState;
  /** Each obstacle touched this step, once, in the order first touched. */
  contacts: Contact[];
  /** Checkpoints the ship entered this step (it started the step outside), ascending, no repeats. */
  passed: number[];
}

/** Challenges: bounce off obstacles instead of sliding along them. */
export interface Bounce {
  /** 0 (no bounce back, just stop pushing in) .. 1 (a perfect mirror). Clamped to that range. */
  restitution: number;
  /** After a bump the speed is at most this (units per second). It never speeds the ship up. */
  speedAfter: number;
}

/**
 * A spatial grid of obstacles, built once per course (see `createObstacleIndex`).
 * `bodies` must not change after it is built.
 */
export interface ObstacleIndex {
  readonly bodies: readonly Body[];
  /** Indexes of every body with distance(p, centre) <= radius + body.radius, ascending, no repeats. */
  near(p: Vec3, radius: number): number[];
}

export interface FlightContext {
  /** The destination the player picked. Gets the pull, the slow-down, and docking. */
  target?: Body;
  /** Other bodies to stay out of: a plain list, or a spatial grid for courses with many rocks. */
  obstacles?: Body[] | ObstacleIndex;
  /** Capsules, crystals and gates: the ship passes through them, and `passed` reports them. */
  checkpoints?: Body[];
  /** Bounce instead of slide. Normal trips leave it out. */
  bounce?: Bounce;
}

export interface FlightConfig {
  cruiseSpeed: number;
  boostSpeed: number;
  /** How fast speed eases toward its goal (per second). */
  speedResponse: number;
  /** Fastest turn rates the player can ask for (radians per second). */
  yawMax: number;
  pitchMax: number;
  /** How fast turn rates ease toward their goal (per second). */
  turnResponse: number;
  /** The nose never goes past this angle up or down (radians). */
  pitchLimit: number;
  /** With no destination and no pitch input, the nose eases back to level at this many radians per second per radian of tilt. */
  levelGain: number;
  /** Strength of the always-on pull toward the destination, 0..1. */
  assistBase: number;
  /** Radians per second of turn per radian of aiming error. */
  assistGain: number;
  assistMaxRate: number;
  /** Docking hover distance, as a multiple of the body's radius, measured from its centre. */
  dockFactor: number;
  /** The pull starts taking over this many radii beyond the dock distance... */
  captureRangeFactor: number;
  /** ...or this many seconds of flying at the ship's current speed, whichever is farther. A fast ship needs room to turn. */
  captureSeconds: number;
  /** Speed limit near the destination = distance left to the dock point times this. */
  approachGain: number;
  /** Slowest the ship creeps in, in body radii per second, so it always arrives. */
  creepFactor: number;
  /** Ships stay this many radii (from the centre) away from obstacles. */
  obstacleFactor: number;
}

export const DEFAULT_FLIGHT: FlightConfig = {
  cruiseSpeed: 40,
  boostSpeed: 160,
  speedResponse: 2.5,
  yawMax: 1.6,
  pitchMax: 1.2,
  turnResponse: 6,
  pitchLimit: 1.45,
  levelGain: 0.8,
  assistBase: 0.5,
  assistGain: 2.5,
  assistMaxRate: 2,
  dockFactor: 1.8,
  captureRangeFactor: 10,
  captureSeconds: 2.5,
  approachGain: 1.2,
  creepFactor: 0.2,
  obstacleFactor: 1.1,
};

/** Longest single step we trust. A frame hiccup becomes slow motion, not a jump. */
const MAX_DT = 0.1;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrapAngle = (a: number) => {
  const wrapped = (a + Math.PI) % (2 * Math.PI);
  return (wrapped < 0 ? wrapped + 2 * Math.PI : wrapped) - Math.PI;
};
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function createShip(position: Vec3, yaw = 0, pitch = 0, speed = DEFAULT_FLIGHT.cruiseSpeed): ShipState {
  return { position: { ...position }, yaw, pitch, yawRate: 0, pitchRate: 0, speed, docked: false };
}

/** The unit vector the nose points along. */
export function forwardVector(yaw: number, pitch: number): Vec3 {
  return {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
}

/** How far from the centre of `target` the ship stops and docks. */
export function dockDistance(target: Body, config: FlightConfig = DEFAULT_FLIGHT): number {
  return target.radius * config.dockFactor;
}

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

/** Biggest radius in each index, worked out once. */
const largestRadius = new WeakMap<ObstacleIndex, number>();
function maxRadiusOf(index: ObstacleIndex): number {
  let max = largestRadius.get(index);
  if (max === undefined) {
    max = 0;
    for (const body of index.bodies) max = Math.max(max, body.radius);
    largestRadius.set(index, max);
  }
  return max;
}

/** Closest distance from `c` to the segment a..b. */
function segmentDistance(a: Vec3, b: Vec3, c: Vec3): number {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const lengthSq = dot(ab, ab);
  const t = lengthSq > 0 ? clamp(((c.x - a.x) * ab.x + (c.y - a.y) * ab.y + (c.z - a.z) * ab.z) / lengthSq, 0, 1) : 0;
  return distance({ x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t }, c);
}

interface Heading {
  yaw: number;
  pitch: number;
  speed: number;
}

interface Move extends Heading {
  position: Vec3;
  bounced: boolean;
  contacts: Contact[];
  passed: number[];
}

/** Mirrors the velocity off a surface with normal `n`, then turns it back into a heading. */
function bounceOff(heading: Heading, n: Vec3, bounce: Bounce, config: FlightConfig): Heading {
  const forward = forwardVector(heading.yaw, heading.pitch);
  const v = { x: forward.x * heading.speed, y: forward.y * heading.speed, z: forward.z * heading.speed };
  const vn = dot(v, n);
  const e = clamp(bounce.restitution, 0, 1);
  const out = vn < 0 ? { x: v.x - (1 + e) * vn * n.x, y: v.y - (1 + e) * vn * n.y, z: v.z - (1 + e) * vn * n.z } : v;
  const dir = Math.hypot(out.x, out.y, out.z) > 1e-9 ? out : n;
  const horizontal = Math.hypot(dir.x, dir.z);
  return {
    yaw: horizontal > 1e-9 ? Math.atan2(-dir.x, -dir.z) : heading.yaw,
    pitch: clamp(Math.atan2(dir.y, horizontal), -config.pitchLimit, config.pitchLimit),
    speed: Math.min(heading.speed, Math.max(0, bounce.speedAfter)),
  };
}

/**
 * Where a sub-step (from `a`, moving `delta / steps`) first enters an obstacle's shell, as a fraction
 * 0..1 of the sub-step. A ship already on or inside a shell only counts if it is heading further in.
 */
function firstHit(
  a: Vec3,
  delta: Vec3,
  steps: number,
  candidates: number[],
  bodies: readonly Body[],
  config: FlightConfig,
): { index: number; t: number } | undefined {
  const s = { x: delta.x / steps, y: delta.y / steps, z: delta.z / steps };
  const qa = dot(s, s);
  if (qa === 0) return undefined;
  let best: { index: number; t: number } | undefined;
  for (const index of candidates) {
    const body = bodies[index];
    const minimum = body.radius * config.obstacleFactor;
    const f = { x: a.x - body.position.x, y: a.y - body.position.y, z: a.z - body.position.z };
    const qb = 2 * dot(f, s);
    const qc = dot(f, f) - minimum * minimum;
    let t: number;
    if (qc <= 0) {
      if (qb >= 0) continue; // on or inside the shell, but already heading out
      t = 0;
    } else {
      const disc = qb * qb - 4 * qa * qc;
      if (disc <= 0) continue; // misses, or only grazes the surface
      t = (-qb - Math.sqrt(disc)) / (2 * qa);
      if (t < 0 || t > 1) continue;
    }
    if (!best || t < best.t) best = { index, t };
  }
  return best;
}

/**
 * Moves along the heading for `dt`, never ending up inside an obstacle: the ship slides along its
 * surface, or bounces off it when `context.bounce` is set. Also notes every bump and checkpoint.
 */
function move(from: Vec3, start: Heading, dt: number, context: FlightContext, config: FlightConfig): Move {
  let heading = start;
  let forward = forwardVector(heading.yaw, heading.pitch);
  let delta = { x: forward.x * heading.speed * dt, y: forward.y * heading.speed * dt, z: forward.z * heading.speed * dt };

  // Which obstacles could matter this step. A plain list: all of them, sized as always, so normal
  // trips get exactly the same numbers. An index: only the ones near this step's path.
  const obstacles = context.obstacles;
  let bodies: readonly Body[] = [];
  let candidates: number[] = [];
  if (Array.isArray(obstacles)) {
    bodies = obstacles;
    candidates = obstacles.map((_, i) => i);
  } else if (obstacles) {
    bodies = obstacles.bodies;
    // Pushing out of a shell can carry the ship a little past the plain travel distance, so look twice as far.
    const travel = Math.hypot(delta.x, delta.y, delta.z);
    candidates = obstacles.near(from, 2 * travel + Math.max(0, config.obstacleFactor - 1) * maxRadiusOf(obstacles));
  }

  let steps = 1;
  if (candidates.length > 0) {
    const smallest = Math.min(...candidates.map((i) => bodies[i].radius * config.obstacleFactor));
    steps = clamp(Math.ceil(Math.hypot(delta.x, delta.y, delta.z) / (0.5 * smallest)), 1, 64);
  }

  // Checkpoints only count when the ship starts the step outside them.
  const checkpoints = context.checkpoints ?? [];
  const outside = checkpoints.map((c) => distance(from, c.position) > c.radius);
  const passed = new Set<number>();

  const contacts: Contact[] = [];
  const touched = new Set<number>();
  const touch = (index: number, normal: Vec3) => {
    if (touched.has(index)) return;
    touched.add(index);
    contacts.push({ body: index, normal });
  };
  const checkSegment = (a: Vec3, b: Vec3) => {
    for (let c = 0; c < checkpoints.length; c++) {
      if (outside[c] && !passed.has(c) && segmentDistance(a, b, checkpoints[c].position) <= checkpoints[c].radius) passed.add(c);
    }
  };

  let bounced = false;
  const position = { ...from };
  for (let i = 0; i < steps; i++) {
    const before = { ...position };
    let normal: Vec3 | undefined;

    // Bouncing: find where this sub-step's path first meets a shell, so the bump happens at the same
    // point, with the same normal, at any frame rate. Sliding keeps the simple push-out below.
    const hit = context.bounce ? firstHit(before, delta, steps, candidates, bodies, config) : undefined;
    if (context.bounce && hit) {
      const body = bodies[hit.index];
      const minimum = body.radius * config.obstacleFactor;
      const entry = { x: before.x + (delta.x / steps) * hit.t, y: before.y + (delta.y / steps) * hit.t, z: before.z + (delta.z / steps) * hit.t };
      const gap = distance(entry, body.position);
      normal =
        gap > 1e-9
          ? { x: (entry.x - body.position.x) / gap, y: (entry.y - body.position.y) / gap, z: (entry.z - body.position.z) / gap }
          : { x: 0, y: 1, z: 0 };
      position.x = body.position.x + normal.x * minimum;
      position.y = body.position.y + normal.y * minimum;
      position.z = body.position.z + normal.z * minimum;
      touch(hit.index, normal);
      checkSegment(before, position);
      // Spend the rest of the step on the new heading.
      heading = bounceOff(heading, normal, context.bounce, config);
      bounced = true;
      forward = forwardVector(heading.yaw, heading.pitch);
      delta = { x: forward.x * heading.speed * dt, y: forward.y * heading.speed * dt, z: forward.z * heading.speed * dt };
      const rest = 1 - hit.t;
      const turnPoint = { ...position };
      position.x += (delta.x / steps) * rest;
      position.y += (delta.y / steps) * rest;
      position.z += (delta.z / steps) * rest;
      checkSegment(turnPoint, position);
    } else {
      position.x += delta.x / steps;
      position.y += delta.y / steps;
      position.z += delta.z / steps;
    }

    // Never end a sub-step inside a shell: push straight out to its surface (the ship slides along it).
    const pushedFrom = { ...position };
    let pushed: Vec3 | undefined;
    for (const index of candidates) {
      const body = bodies[index];
      const minimum = body.radius * config.obstacleFactor;
      const gap = distance(position, body.position);
      if (gap >= minimum) continue;
      const away =
        gap > 1e-9
          ? { x: (position.x - body.position.x) / gap, y: (position.y - body.position.y) / gap, z: (position.z - body.position.z) / gap }
          : { x: 0, y: 1, z: 0 };
      position.x = body.position.x + away.x * minimum;
      position.y = body.position.y + away.y * minimum;
      position.z = body.position.z + away.z * minimum;
      touch(index, away);
      pushed ??= away;
    }
    if (!hit) checkSegment(before, position);
    else if (pushed) checkSegment(pushedFrom, position);

    if (pushed && !normal && context.bounce) {
      heading = bounceOff(heading, pushed, context.bounce, config);
      bounced = true;
      forward = forwardVector(heading.yaw, heading.pitch);
      delta = { x: forward.x * heading.speed * dt, y: forward.y * heading.speed * dt, z: forward.z * heading.speed * dt };
    }
  }

  return { position, ...heading, bounced, contacts, passed: [...passed].sort((a, b) => a - b) };
}

/** Same physics as `stepFlight`, plus what happened this step: bumps and checkpoints entered. */
export function stepFlightWithEvents(
  state: ShipState,
  input: FlightInput,
  rawDt: number,
  context: FlightContext = {},
  config: FlightConfig = DEFAULT_FLIGHT,
): FlightStep {
  if (state.docked) return { state, contacts: [], passed: [] };

  const dt = clamp(rawDt, 0, MAX_DT);
  const turn = clamp(input.turn, -1, 1);
  const pitchInput = clamp(input.pitch, -1, 1);

  // What the player is asking for.
  let yawGoal = -turn * config.yawMax;
  let pitchGoal = pitchInput * config.pitchMax;
  // Let go of the stick and the rocket levels out by itself, so it is easy to tell which way is "flat".
  if (!context.target) pitchGoal = lerp(pitchGoal, -state.pitch * config.levelGain, 1 - Math.abs(pitchInput));
  let speedGoal = input.boost ? config.boostSpeed : config.cruiseSpeed;
  let speedCap = Infinity;

  // What the destination adds.
  const target = context.target;
  if (target) {
    const toTarget = {
      x: target.position.x - state.position.x,
      y: target.position.y - state.position.y,
      z: target.position.z - state.position.z,
    };
    const dist = Math.hypot(toTarget.x, toTarget.y, toTarget.z);
    const dock = dockDistance(target, config);
    // How close counts as "near enough for the pull to take over". Scales with the planet AND with
    // speed, so the ship always has room to turn (its turning circle grows with speed).
    const capture = Math.max(target.radius * config.captureRangeFactor, state.speed * config.captureSeconds);
    // 0 far away, rising to 1 (total takeover) once the ship is in the inner half of the capture range.
    const near = clamp(2 * (1 - (dist - dock) / capture), 0, 1);

    const horizontal = Math.hypot(toTarget.x, toTarget.z);
    const aimYaw = horizontal > 1e-6 ? Math.atan2(-toTarget.x, -toTarget.z) : state.yaw;
    const aimPitch = Math.atan2(toTarget.y, horizontal);
    const yawPull = clamp(wrapAngle(aimYaw - state.yaw) * config.assistGain, -config.assistMaxRate, config.assistMaxRate);
    const pitchPull = clamp((aimPitch - state.pitch) * config.assistGain, -config.assistMaxRate, config.assistMaxRate);

    // The pull is gentle while the player steers that axis, and takes over completely at the dock point.
    yawGoal = lerp(yawGoal, yawPull, Math.max(config.assistBase * (1 - Math.abs(turn)), near));
    pitchGoal = lerp(pitchGoal, pitchPull, Math.max(config.assistBase * (1 - Math.abs(pitchInput)), near));

    speedCap = (dist - dock) * config.approachGain + target.radius * config.creepFactor;
  }

  // Ease turn rates and speed toward their goals.
  const turnEase = 1 - Math.exp(-config.turnResponse * dt);
  const yawRate = lerp(state.yawRate, yawGoal, turnEase);
  const pitchRate = lerp(state.pitchRate, pitchGoal, turnEase);
  const yaw = wrapAngle(state.yaw + yawRate * dt);
  const pitch = clamp(state.pitch + pitchRate * dt, -config.pitchLimit, config.pitchLimit);
  const speed = Math.min(lerp(state.speed, speedGoal, 1 - Math.exp(-config.speedResponse * dt)), speedCap);

  // Move, in small steps if there are obstacles, so a fast ship cannot skip across a small body.
  const moved = move(state.position, { yaw, pitch, speed }, dt, context, config);
  const { position, contacts, passed } = moved;

  // Docking cannot fail: reaching the hover distance stops the ship.
  if (target && distance(position, target.position) <= dockDistance(target, config)) {
    return { state: { position, yaw: moved.yaw, pitch: moved.pitch, yawRate: 0, pitchRate: 0, speed: 0, docked: true }, contacts, passed };
  }

  // A bounce points the ship away and stops it turning, so it does not swing straight back in.
  const after = moved.bounced
    ? { position, yaw: moved.yaw, pitch: moved.pitch, yawRate: 0, pitchRate: 0, speed: moved.speed, docked: false }
    : { position, yaw, pitch, yawRate, pitchRate, speed, docked: false };
  return { state: after, contacts, passed };
}

/** One step of flight. Unchanged for every existing caller; `stepFlightWithEvents` also reports events. */
export function stepFlight(
  state: ShipState,
  input: FlightInput,
  rawDt: number,
  context: FlightContext = {},
  config: FlightConfig = DEFAULT_FLIGHT,
): ShipState {
  return stepFlightWithEvents(state, input, rawDt, context, config).state;
}
