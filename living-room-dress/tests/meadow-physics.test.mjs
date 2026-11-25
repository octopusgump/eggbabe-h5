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
import {
  LEVEL_CONFIGS,
  computeStarTier,
  maxLevelScore,
  resolveCircleObstacles,
  sampleBoostPad,
} from "../meadow/src/meadow/levels.ts";

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

test("6 progressive levels escalate sheep count 6->16 and Level 1 is pure zero-tree ice rink", () => {
  const levels = [1, 2, 3, 4, 5, 6];
  const counts = levels.map((lvl) => LEVEL_CONFIGS[lvl].sheep.length);
  const goldenCounts = levels.map((lvl) => LEVEL_CONFIGS[lvl].sheep.filter((s) => s.isGolden).length);
  const maxScores = levels.map((lvl) => maxLevelScore(lvl));

  assert.deepEqual(counts, [6, 8, 10, 12, 14, 16], "sheep counts must escalate 6, 8, 10, 12, 14, 16");
  assert.deepEqual(goldenCounts, [1, 1, 2, 2, 3, 4], "golden sheep count must escalate across levels");
  assert.deepEqual(maxScores, [8, 10, 14, 16, 20, 24], "max score must account for +3 golden sheep");

  // Level 1: zero trees, zero bumpers, pure fenced rink
  assert.equal(LEVEL_CONFIGS[1].trees.length, 0, "Level 1 must have 0 trees");
  assert.equal(LEVEL_CONFIGS[1].bumpers.length, 0, "Level 1 must have 0 bumpers");
  assert.equal(LEVEL_CONFIGS[1].hasRiver, false, "Level 1 must be flat ice");

  // Level 2: 3 elastic snow bumpers
  assert.equal(LEVEL_CONFIGS[2].bumpers.length, 3, "Level 2 must have 3 snow bumpers");
  assert.equal(LEVEL_CONFIGS[2].trees.length, 0, "Level 2 must have 0 trees");

  // Level 3: 4 collision pine trees
  assert.equal(LEVEL_CONFIGS[3].trees.length, 4, "Level 3 must have 4 pine trees");

  // Level 4: slope + river + zero trees
  assert.equal(LEVEL_CONFIGS[4].hasRiver, true);
  assert.equal(LEVEL_CONFIGS[4].hasSlope, true);
  assert.equal(LEVEL_CONFIGS[4].trees.length, 0);

  // Level 5: 3 warm-gold starlight boost pads
  assert.equal(LEVEL_CONFIGS[5].boostPads.length, 3);

  // Level 6: central knoll + 2 bumpers + 1 boost pad
  assert.equal(LEVEL_CONFIGS[6].hasKnoll, true);
  assert.equal(LEVEL_CONFIGS[6].bumpers.length, 2);
  assert.equal(LEVEL_CONFIGS[6].boostPads.length, 1);
});

test("Obstacle physics: Level 2 snow bumper high-elastic rebound, Level 3 pine collision, Level 5 boost pad", () => {
  // Level 2 bumper at (0, -0.6), radius 0.76 -> approach from south moving north
  const bHit = resolveCircleObstacles(2, 0, 0.25, 0, -4.0, 0.45);
  assert.equal(bHit.hitKind, "bumper");
  assert.equal(bHit.bumperIndex, 2);
  assert.ok(bHit.vz > 4.5, `bumper must impart high-elastic outward kick, got vz=${bHit.vz}`);

  // Level 3 tree at (-3.5, -3.4), radius 0.62 -> approach from east moving west
  const tHit = resolveCircleObstacles(3, -2.6, -3.4, -4.0, 0, 0.45);
  assert.equal(tHit.hitKind, "tree");
  assert.ok(tHit.vx > 0, `pine tree must reflect incoming skater, got vx=${tHit.vx}`);

  // Level 5 center boost pad at (0, -1.4) pushes south (+Z)
  const boostOn = sampleBoostPad(5, 0, -1.4);
  assert.equal(boostOn.active, true);
  assert.ok(boostOn.fz > 10, `boost pad must push strongly southward, got fz=${boostOn.fz}`);
  const boostOff = sampleBoostPad(5, 0, 4.5);
  assert.equal(boostOff.active, false);
});

test("Instant star-tier computation triggers 1★/2★/3★ upgrades immediately on score gain", () => {
  // Level 1 thresholds: [3, 5, 6]
  assert.equal(computeStarTier(1, 0), 0);
  assert.equal(computeStarTier(1, 2), 0);
  assert.equal(computeStarTier(1, 3), 1, "golden sheep (+3) on Level 1 immediately grants 1★");
  assert.equal(computeStarTier(1, 5), 2);
  assert.equal(computeStarTier(1, 6), 3);

  // Level 6 thresholds: [8, 13, 18]
  assert.equal(computeStarTier(6, 7), 0);
  assert.equal(computeStarTier(6, 8), 1);
  assert.equal(computeStarTier(6, 13), 2);
  assert.equal(computeStarTier(6, 18), 3);
});

test("Keyboard-synced visual joystick, Dash button, skid audio, instant star HUD, and 4-way belly-sliding sheep are wired", () => {
  const html = fs.readFileSync(path.join(REPO, "living-room-dress/meadow/index.html"), "utf8");
  const appTs = fs.readFileSync(path.join(REPO, "living-room-dress/meadow/src/meadow/MeadowApp.ts"), "utf8");
  const sheepTs = fs.readFileSync(path.join(REPO, "living-room-dress/meadow/src/meadow/sheep.ts"), "utf8");
  const feedbackTs = fs.readFileSync(path.join(REPO, "living-room-dress/meadow/src/meadow/feedback.ts"), "utf8");

  assert.ok(html.includes('id="stick-knob"'), "visual joystick knob must exist");
  assert.ok(html.includes('data-dir="up"') && html.includes('data-dir="left"'), "directional pips must exist");
  assert.ok(html.includes('id="btn-dash"'), "Dash button must exist");
  assert.ok(html.includes('id="score-pill"') && html.includes('data-hud-star="3"'), "live star HUD pill must exist");
  assert.ok(html.includes('data-level-pick="6"'), "6-level picker must exist in pause modal");
  assert.ok(appTs.includes("updateVisualStick"), "MeadowApp must sync keyboard input to visible joystick knob");
  assert.ok(appTs.includes("ArrowUp") && appTs.includes("Space"), "desktop arrow keys and Space dash must be wired");
  assert.ok(appTs.includes("flyStarsToHud") && appTs.includes("popAtScreen"), "instant gate star popups & flying orbs must be wired");
  assert.ok(feedbackTs.includes("updateSkidSound") && feedbackTs.includes("playStarRankUp"), "ice skid & star rank-up audio must exist");
  assert.ok(
    sheepTs.includes("isGolden") &&
      !sheepTs.includes("s.group.visible = false") &&
      sheepTs.includes("'waddle' | 'slide' | 'penned'") &&
      !sheepTs.includes("'graze'"),
    "golden sheep, visible penned sheep, and autonomous waddle/slide AI (no graze) must exist"
  );

  const penTs = fs.readFileSync(path.join(REPO, "living-room-dress/meadow/src/meadow/pen.ts"), "utf8");
  const boundsTs = fs.readFileSync(path.join(REPO, "living-room-dress/meadow/src/meadow/bounds.ts"), "utf8");
  assert.ok(/PEN_COUNT\s*=\s*1\b/.test(penTs), "must have exactly 1 single-entrance gate pen");
  assert.ok(boundsTs.includes("GATE_MOUTH_Z") && boundsTs.includes("GATE_HALF_W"), "bounds must define single South-Center gate geometry");
  assert.equal(boundsTs.includes("PEN_CORNERS"), false, "old 4-corner PEN_CORNERS must be removed");
});
