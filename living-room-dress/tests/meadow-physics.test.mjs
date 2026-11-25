import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  bounceInArena,
  createSkaterState,
  DEFAULT_SKATER_PARAMS,
  resolveElasticBump,
  stepSkaterVelocity,
  triggerSkaterDash,
} from "../meadow/src/meadow/physics.ts";

const REPO = path.resolve(import.meta.dirname, "../..");

test("Mario ice physics: low-drag glide inertia when input is released", () => {
  const s = createSkaterState();
  // Accelerate right for 0.6s
  for (let i = 0; i < 36; i++) {
    stepSkaterVelocity(s, 1, 0, 1 / 60, DEFAULT_SKATER_PARAMS);
  }
  const cruiseSpeed = Math.hypot(s.vx, s.vz);
  assert.ok(cruiseSpeed > 4.0, `expected cruise speed > 4.0, got ${cruiseSpeed}`);

  // Release input for 0.25s: should glide on ice rather than stopping immediately
  for (let i = 0; i < 15; i++) {
    stepSkaterVelocity(s, 0, 0, 1 / 60, DEFAULT_SKATER_PARAMS);
  }
  const glideSpeed = Math.hypot(s.vx, s.vz);
  assert.ok(glideSpeed > 2.5 && glideSpeed < cruiseSpeed, `expected smooth ice glide, got ${glideSpeed}`);
});

test("Mario high-friction ice skid triggers on reverse input and brakes much faster than passive glide", () => {
  const skidder = createSkaterState();
  const glider = createSkaterState();
  for (let i = 0; i < 40; i++) {
    stepSkaterVelocity(skidder, 1, 0, 1 / 60, DEFAULT_SKATER_PARAMS);
    stepSkaterVelocity(glider, 1, 0, 1 / 60, DEFAULT_SKATER_PARAMS);
  }

  // Slam opposite direction (left) to trigger Mario ice brake
  const res = stepSkaterVelocity(skidder, -1, 0, 1 / 60, DEFAULT_SKATER_PARAMS);
  assert.equal(res.skidding, true, "reversing at speed must trigger Mario skidding state");
  assert.ok(res.skidIntensity > 0.6, `skidIntensity should be high on full reversal, got ${res.skidIntensity}`);

  for (let i = 0; i < 12; i++) {
    stepSkaterVelocity(skidder, -1, 0, 1 / 60, DEFAULT_SKATER_PARAMS);
    stepSkaterVelocity(glider, 0, 0, 1 / 60, DEFAULT_SKATER_PARAMS);
  }
  assert.ok(
    skidder.vx < glider.vx - 2.0,
    `high-friction skid braking (${skidder.vx.toFixed(2)}) must decelerate much faster than passive glide (${glider.vx.toFixed(2)})`
  );
});

test("Dash boost grants burst speed and enforces cooldown", () => {
  const s = createSkaterState();
  assert.equal(triggerSkaterDash(s, 1, 0, DEFAULT_SKATER_PARAMS), true);
  assert.ok(Math.hypot(s.vx, s.vz) >= DEFAULT_SKATER_PARAMS.dashSpeed - 0.01);
  assert.equal(triggerSkaterDash(s, 1, 0, DEFAULT_SKATER_PARAMS), false, "second dash during cooldown must fail");

  for (let i = 0; i < 90; i++) {
    stepSkaterVelocity(s, 0, 0, 1 / 60, DEFAULT_SKATER_PARAMS);
  }
  assert.equal(triggerSkaterDash(s, 0, 1, DEFAULT_SKATER_PARAMS), true, "dash should recover after cooldown");
});

test("Elastic collision transfers momentum for Herder->Sheep shove and Sheep<->Sheep chain bowling", () => {
  const shove = resolveElasticBump(0, 0, 5.5, 0, 0.9, 0, 0, 0, 1.25, 2.6, 1.0, 0.92, 2.3);
  assert.equal(shove.collided, true);
  assert.ok(shove.bVel.x > 6.5, `sheep should launch sliding rapidly, got ${shove.bVel.x}`);

  const chain = resolveElasticBump(1.0, 0, 6.0, 0, 1.6, 0, 0, 0, 0.86, 1.0, 1.0, 0.86, 0);
  assert.equal(chain.collided, true);
  assert.ok(chain.bVel.x > 5.0, `second sheep must receive chain momentum, got ${chain.bVel.x}`);
});

test("Soft bouncy snow-oak perimeter keeps skaters inside arena with rebound", () => {
  const hit = bounceInArena(7.6, 0.2, 5.0, 1.0, 7.12, 0.5);
  assert.equal(hit.bounced, true);
  assert.equal(hit.x, 7.12);
  assert.ok(hit.vx < 0, "outward velocity must reflect inward");
});

test("Keyboard-synced visual joystick, Dash button, skid audio, and visible in-pen sheep are wired", () => {
  const html = fs.readFileSync(path.join(REPO, "living-room-dress/meadow/index.html"), "utf8");
  const appTs = fs.readFileSync(path.join(REPO, "living-room-dress/meadow/src/meadow/MeadowApp.ts"), "utf8");
  const sheepTs = fs.readFileSync(path.join(REPO, "living-room-dress/meadow/src/meadow/sheep.ts"), "utf8");
  const feedbackTs = fs.readFileSync(path.join(REPO, "living-room-dress/meadow/src/meadow/feedback.ts"), "utf8");

  assert.ok(html.includes('id="stick-knob"'), "visual joystick knob must exist");
  assert.ok(html.includes('data-dir="up"') && html.includes('data-dir="left"'), "directional pips must exist");
  assert.ok(html.includes('id="btn-dash"'), "Dash button must exist");
  assert.ok(appTs.includes("updateVisualStick"), "MeadowApp must sync keyboard input to visible joystick knob");
  assert.ok(appTs.includes("ArrowUp") && appTs.includes("Space"), "desktop arrow keys and Space dash must be wired");
  assert.ok(feedbackTs.includes("updateSkidSound") && feedbackTs.includes("playSheepSlide"), "ice skid & sheep slide audio must exist");
  assert.ok(sheepTs.includes("isGolden") && !sheepTs.includes("s.group.visible = false"), "golden sheep exists and penned sheep remain visible");
});
