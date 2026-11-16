const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
for (const file of ['simulator-tactics.js', 'assets/simulator-ability-geometry.js',
  'assets/simulator-smokes.js', 'assets/simulator-ability-catalog.js',
  'assets/simulator-movement.js', 'assets/simulator-utility.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/web/static', file), 'utf8'), context);
}
const { smoke, geometry, tactics, utility, movement } = vm.runInContext(
  '({ smoke: ChampionsSmokes, geometry: ChampionsAbilityGeometry, tactics: ChampionsTactics, utility: ChampionsUtility, movement: ChampionsMovement })', context);
const base = { number: 6, site: 'A', alternate: 'B', plan: 'Default', defense: 'Hold',
  planted: true, postPlant: 'Crossfire', retake: 'Group and clear', finish: 'hold' };
const plans = ['Rush', 'Default', 'Slow execute', 'Fake', 'Split', 'Mid to', 'Lurk'];
let checked = 0;
for (const [map, layout] of Object.entries(tactics.layouts)) {
  for (const site of Object.keys(layout.sites)) {
    const alternate = Object.keys(layout.sites).find((letter) => letter !== site);
    for (const plan of plans) {
      for (const phase of ['opening', 'execute', 'postplant']) {
        for (const request of smoke.uses(map, { ...base, site, alternate, plan }, phase)) {
          if (request.wall || request.spot.centered) continue;
          for (const name of ['Dark Cover', 'Sky Smoke', 'Nebula', 'Ruse', 'Waveform']) {
            const spot = request.spot;
            // Deliberately hostile grid: it must not drag precision centers around.
            const terrain = { snap: ([x, y]) => [Math.round(x), Math.round(y)] };
            const result = smoke.placement(map, name, spot, [50, 50], terrain);
            assert.ok(result, `${map}: ${spot.name} accepts ${name}`);
            const radius = geometry.footprint(map, name, [50, 50], result).radius;
            const dx = spot.inside[0] - spot.lip[0], dy = spot.inside[1] - spot.lip[1];
            const length = Math.hypot(dx, dy), normal = [dx / length, dy / length];
            const halfWidth = spot.width * geometry.scaleFor(map) / 2;
            for (const sign of [-1, 1]) {
              const jamb = [spot.lip[0] - normal[1] * halfWidth * sign,
                spot.lip[1] + normal[0] * halfWidth * sign];
              assert.ok(Math.hypot(result[0] - jamb[0], result[1] - jamb[1]) <= radius,
                `${map}: ${spot.name} must cover both doorway corners`);
            }
            const depth = result.reduce((sum, value, axis) => sum + (value - spot.lip[axis]) * normal[axis], 0);
            assert.ok(depth > 0 && depth < radius, 'center stays in the denied lane');
            assert.ok(radius - depth < 1.5 * geometry.scaleFor(map), 'limited protrusion into friendly space');
            checked++;
          }
        }
      }
    }
  }
}
const requests = (changes, phase = 'postplant') => smoke.uses('Lotus', { ...base, ...changes }, phase);
assert.equal(requests({ planted: false }).length, 0);
assert.equal(requests({ finish: 'save' }).length, 0);
assert.ok(!requests({ defense: 'Flank' }).some((r) => !r.attack && r.spot.name === 'A Main exit'));
assert.ok(!requests({ postPlant: 'Push CT' }).some((r) => r.attack));
const defuse = requests({ postPlant: 'Open plant' }).find((r) => !r.attack);
assert.equal(defuse.spot.name, 'Spike defuse cover');
assert.deepEqual(smoke.placement('Lotus', 'Dark Cover', defuse.spot, [50, 50], movement.openTerrain), defuse.spot.lip);
const fake = requests({ plan: 'Fake' }, 'opening').find((r) => r.attack);
assert.ok(fake.reserve >= 1 && fake.neededBy > smoke.now(base, 1, fake.time));
const rush = requests({ plan: 'Rush' }, 'execute').find((r) => r.attack);
assert.ok(rush.time < requests({}, 'execute').find((r) => r.attack).time);
// A split through Garage must not seal the friendly connector group off.
const havenSplit = smoke.uses('Haven', { ...base, site: 'C', plan: 'Split' }, 'execute');
assert.ok(!havenSplit.some((r) => r.attack && !r.entry && !r.wall && r.spot.name.includes('Garage')));

// Run the actual utility planner: full-buy fake with a non-recharging controller
// must reserve two smokes, while an early Omen smoke can recharge before the hit.
const agents = { omen: { role: 'Controller' }, brimstone: { role: 'Controller' },
  jett: { role: 'Duelist' }, sova: { role: 'Initiator' }, killjoy: { role: 'Sentinel' }, sage: { role: 'Sentinel' } };
function simulateRound(controller, mapName, terrain, changes = {}) {
  const stats = [0, 1].map((side) => [controller, 'jett', 'sova', 'killjoy', 'sage']
    .map((agent, i) => ({ agent, player: { name: `${side}-${i}` } })));
  const round = { ...base, attack: 0, winner: 0, plan: 'Fake', planted: false, kills: [],
    buys: [0, 1].map(() => ({ label: 'Full buy', utility: 850 })), ...changes };
  return utility.planRound({ name: mapName, stats }, agents, round,
    stats.map(() => [0, 0, 0, 0, 0]), terrain);
}
const simulation = (controller, mapName = 'Lotus') =>
  simulateRound(controller, mapName, movement.openTerrain).events;
for (const mapName of Object.keys(tactics.layouts)) {
  for (const event of simulation('omen', mapName)) {
    assert.ok(event.landing.every(Number.isFinite), `${mapName}: finite landing`);
    if (event.smokeTiming) assert.ok(event.smokeTiming.ends > event.smokeTiming.starts);
  }
}
const omen = simulation('omen').filter((e) => e.side === 0 && e.name === 'Dark Cover');
assert.ok(omen.some((e) => e.phase === 1), 'Omen sells an early fake');
assert.equal(omen.filter((e) => e.phase === 2).length, 2, 'Omen retains two execute smokes');
const brim = simulation('brimstone').filter((e) => e.side === 0 && e.name === 'Sky Smoke');
assert.ok(brim.length <= 3, 'Brimstone respects his charge limit');
console.log(`Passed ${checked} smoke aperture checks, scenario checks, and seven-map utility smoke tests.`);

// Playback must wait for a visible encounter, even when the result model has
// already scheduled a kill. Check map geometry and vision-blocking utility.
const { openTerrain, shotIsClear } = movement;
const blocked = { ...openTerrain, clear: () => false };
const smokeScreen = { shape: 'circle', center: [10, 0], radius: 2 };
const wallScreen = { shape: 'line', center: [10, 0], angle: Math.PI / 2, length: 6 };
assert.ok(shotIsClear(openTerrain, [0, 0], [20, 0], [], 25));
assert.ok(!shotIsClear(openTerrain, [0, 0], [90, 0], [], 25));
assert.ok(!shotIsClear(blocked, [0, 0], [20, 0], [], 25));
for (const screen of [smokeScreen, wallScreen]) {
  assert.ok(!shotIsClear(openTerrain, [0, 0], [20, 0], [screen], 25));
}
const planned = { phase: 1, time: .66, side: 0, killer: 0, victim: 0 };
const round = { plan: 'Rush', kills: [planned] };
const fight = simulateRound('omen', 'Lotus', openTerrain, round);
assert.equal(fight.kills.length, 1, 'a nearby opponent can still be eliminated');
const [kill] = fight.kills;
assert.ok(shotIsClear(openTerrain, kill.origin, kill.impact, [], 35 * geometry.scaleFor('Lotus')));
const track = fight.tracks[kill.phase][1 - kill.side][kill.victim];
assert.deepEqual(movement.playback(track, kill.time).point, kill.impact);
assert.deepEqual(movement.playback(track, 1).point, kill.impact, 'victim stops at the shot location');
assert.equal(simulateRound('omen', 'Lotus', blocked, round).kills.length, 0,
  'a scheduled kill does not enter the feed without sight');
assert.equal(planned.time, .66, 'planning a replay leaves the original result intact');
