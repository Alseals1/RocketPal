/**
 * A frozen copy of `stepFlight` from before #49 (dev at bef3a97), kept only as the reference for the
 * compatibility test in `tests/flightEvents.test.ts`. Do not edit it to match new code: it is the
 * yardstick that proves normal trips fly exactly as before.
 */
import type { Body, FlightConfig, FlightInput, ShipState, Vec3 } from '../../src/flight/flightModel';
import { DEFAULT_FLIGHT, dockDistance, forwardVector } from '../../src/flight/flightModel';

const MAX_DT = 0.1;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrapAngle = (a: number) => {
  const wrapped = (a + Math.PI) % (2 * Math.PI);
  return (wrapped < 0 ? wrapped + 2 * Math.PI : wrapped) - Math.PI;
};
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

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

export function legacyStepFlight(
  state: ShipState,
  input: FlightInput,
  rawDt: number,
  context: { target?: Body; obstacles?: Body[] } = {},
  config: FlightConfig = DEFAULT_FLIGHT,
): ShipState {
  if (state.docked) return state;

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
