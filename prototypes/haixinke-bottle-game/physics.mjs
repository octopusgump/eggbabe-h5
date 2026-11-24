export const world = Object.freeze({
  width: 360,
  height: 420,
  floorY: 404,
  initial: Object.freeze({ x: 160, y: 308, angle: 0 }),
});

export const dt = 1 / 120;
export const holdTime = 0.45;

const gravity = 940;
const tiltLimit = 8 * Math.PI / 180;
const inertia = 780;
const floor = { left: -Infinity, right: Infinity, y: world.floorY };
const hull = [
  [-18, 42], [18, 42], [19, 37], [19, -16], [9, -30],
  [9, -42], [-9, -42], [-9, -30], [-19, -16], [-19, 37],
];
const deskHeight = world.initial.y + hull[0][1];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const contains = (surface, x) => x >= surface.left && x <= surface.right;

export function gesture(dx, up, seconds) {
  if (![dx, up, seconds].every(Number.isFinite) || up < 13 || up < Math.abs(dx) * 0.32) {
    return null;
  }
  const duration = Math.max(seconds, 0.045);
  const speed = clamp(up / duration / 1200, 0, 1);
  return {
    vx: clamp(dx / duration * 0.26, -220, 220),
    vy: -(260 + 425 * speed),
    omega: 4.6 + 2.1 * speed,
  };
}

export function launch(velocity) {
  return {
    ...world.initial, ...velocity,
    elapsed: 0, hold: 0, top: world.initial.y, airTurns: null,
    targetCleared: false, touchedTarget: false, firstContact: '', firstImpact: null,
    balancing: false, balanceSurface: null, quiet: 0, deskQuiet: 0, result: '',
  };
}

export function vertices({ x, y, angle }) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return hull.map(([localX, localY]) => {
    const rx = localX * cos - localY * sin;
    const ry = localX * sin + localY * cos;
    return { x: x + rx, y: y + ry, rx, ry };
  });
}

function onSurface(points, surface) {
  const inside = points.filter(point => contains(surface, point.x));
  const lowest = Math.max(...inside.map(point => point.y));
  if (lowest < surface.y) return null;
  return {
    depth: lowest - surface.y,
    points: inside.filter(point => point.y >= lowest - 0.8),
  };
}

function bounce(motion, point) {
  const normalSpeed = -(motion.vy + motion.omega * point.rx);
  if (normalSpeed >= 0) return motion;
  const restitution = normalSpeed < -85 ? 0.22 : 0;
  const normalImpulse = -(1 + restitution) * normalSpeed / (1 + point.rx ** 2 / inertia);
  const omega = motion.omega - point.rx * normalImpulse / inertia;
  const lateralSpeed = motion.vx - omega * point.ry;
  const friction = normalImpulse * 0.34;
  const sideImpulse = clamp(-lateralSpeed / (1 + point.ry ** 2 / inertia), -friction, friction);
  return {
    vx: motion.vx + sideImpulse,
    vy: motion.vy - normalImpulse,
    omega: omega - point.ry * sideImpulse / inertia,
  };
}

export function step(state, { target, desk }) {
  if (state.result) return state;
  const x = state.x + state.vx * dt;
  const vy = state.vy + gravity * dt;
  const y = state.y + vy * dt;
  const angle = state.angle + state.omega * dt;
  const elapsed = state.elapsed + dt;
  const pose = { ...state, x, y, angle, vy, elapsed, top: Math.min(y, state.top) };
  const points = vertices(pose);

  // A raised surface must be cleared completely before it can catch the bottle.
  const canHitTarget = target.y >= deskHeight || state.targetCleared;
  const targetCleared = canHitTarget || points.every(point => point.y <= target.y);
  const targetHit = canHitTarget && y < target.y && state.y < target.y
    ? onSurface(points, target)
    : null;
  const deskHit = !targetHit && desk && y < desk.y && state.y < desk.y
    ? onSurface(points, desk)
    : null;
  const floorHit = targetHit || deskHit ? null : onSurface(points, floor);
  const contact = targetHit || deskHit || floorHit;

  const motion = { vx: pose.vx, vy, omega: pose.omega };
  const signedLean = Math.atan2(Math.sin(angle), Math.cos(angle));
  const lean = Math.abs(signedLean);
  const base = points.slice(0, 2);
  const centered = base.every(point => contains(target, point.x));
  const onDesk = Boolean(deskHit) || (!targetHit && state.balanceSurface === 'desk');
  const balanceSurface = onDesk ? 'desk' : 'target';
  const balanceContact = onDesk ? deskHit : targetHit;
  const wasBalancing = state.balancing && state.balanceSurface === balanceSurface;
  const baseSupported = onDesk ? base.every(point => contains(desk, point.x)) : centered;
  const balancing = baseSupported && lean <= 0.47 && (wasBalancing || Boolean(balanceContact));
  let after = motion;
  if (balancing) {
    // Spread an upright impact across both corners while the bottle rocks toward level.
    after = {
      vx: motion.vx * Math.exp(-8 * dt),
      vy: balanceContact ? -Math.max(0, vy) * (wasBalancing ? 0 : 0.12) : vy,
      omega: wasBalancing ? motion.omega + (-105 * signedLean - 8 * motion.omega) * dt : motion.omega * 0.33,
    };
  } else if (contact) {
    after = contact.points.reduce(bounce, motion);
  }

  const touchedTarget = state.touchedTarget || Boolean(targetHit);
  const contactKind = lean > 2.15 ? 'cap' : lean > 0.60 ? 'side' : 'base';
  const firstContact = state.firstContact || (targetHit ? contactKind : '');
  const lowSpeed = Math.hypot(after.vx, after.vy) <= 18 && Math.abs(after.omega) <= 0.48;
  const hold = targetHit && target.active !== false && centered && lean <= tiltLimit && lowSpeed
    ? state.hold + dt
    : 0;
  const quiet = targetHit && lowSpeed ? state.quiet + dt : 0;
  const deskQuiet = deskHit && lowSpeed ? state.deskQuiet + dt : 0;
  let result = '';
  if (floorHit || x < -50 || x > world.width + 50) result = touchedTarget ? 'edge' : 'miss';
  else if (hold + 1e-9 >= holdTime) result = 'success';
  else if (deskQuiet > 0.35 || (deskHit && elapsed > 4)) result = touchedTarget ? 'edge' : 'wrong-target';
  else if ((quiet > 0.35 && lean > 0.60) || elapsed > 4) {
    result = firstContact === 'cap' ? 'cap' : firstContact === 'side' ? 'side' : 'unsteady';
  }

  const firstImpact = state.firstImpact ?? (
    contact
      ? {
        x: contact.points.reduce((sum, point) => sum + point.x, 0) / contact.points.length,
        y: (targetHit ? target : deskHit ? desk : floor).y,
        onTarget: Boolean(targetHit),
      }
      : null
  );
  return {
    ...pose, ...after, y: y - (contact?.depth ?? 0),
    targetCleared, touchedTarget, firstContact, firstImpact,
    balancing, balanceSurface: balancing ? balanceSurface : null, hold, quiet, deskQuiet, result,
    airTurns: state.airTurns ?? (contact ? Math.abs(angle) / (Math.PI * 2) : null),
  };
}
