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

export interface FlightContext {
  /** The destination the player picked. Gets the pull, the slow-down, and docking. */
  target?: Body;
  /** Other bodies to stay out of. */
  obstacles?: Body[];
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

/** Moves by `delta`, never ending up inside an obstacle (the ship slides along its surface instead). */
function moveAround(from: Vec3, delta: Vec3, obstacles: Body[], config: FlightConfig): Vec3 {
  if (obstacles.length === 0) {
    return { x: from.x + delta.x, y: from.y + delta.y, z: from.z + delta.z };
  }
  const smallest = Math.min(...obstacles.map((b) => b.radius * config.obstacleFactor));
  const steps = clamp(Math.ceil(Math.hypot(delta.x, delta.y, delta.z) / (0.5 * smallest)), 1, 64);
  const position = { ...from };
  for (let i = 0; i < steps; i++) {
    position.x += delta.x / steps;
    position.y += delta.y / steps;
    position.z += delta.z / steps;
    for (const body of obstacles) {
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
    }
  }
  return position;
}

export function stepFlight(
  state: ShipState,
  input: FlightInput,
  rawDt: number,
  context: FlightContext = {},
  config: FlightConfig = DEFAULT_FLIGHT,
): ShipState {
  if (state.docked) return state;

  const dt = clamp(rawDt, 0, MAX_DT);
  const turn = clamp(input.turn, -1, 1);
  const pitchInput = clamp(input.pitch, -1, 1);

  // What the player is asking for.
  let yawGoal = -turn * config.yawMax;
  let pitchGoal = pitchInput * config.pitchMax;
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
  const forward = forwardVector(yaw, pitch);
  const position = moveAround(
    state.position,
    { x: forward.x * speed * dt, y: forward.y * speed * dt, z: forward.z * speed * dt },
    context.obstacles ?? [],
    config,
  );

  // Docking cannot fail: reaching the hover distance stops the ship.
  if (target && distance(position, target.position) <= dockDistance(target, config)) {
    return { position, yaw, pitch, yawRate: 0, pitchRate: 0, speed: 0, docked: true };
  }

  return { position, yaw, pitch, yawRate, pitchRate, speed, docked: false };
}
