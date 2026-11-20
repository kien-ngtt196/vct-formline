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
    assert.ok(smoke.uses(map, { ...base, site, alternate }, 'execute').some(r => r.attack && !r.wall && !r.entry), map + ' ' + site);
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
const smokePolicy = { A: { execute: 'early', fake: 'alternate', defense: 'early', retake: 'early' } };
const early = requests({ skirmish: { smokePolicy } }, 'execute');
assert.ok(early.find(r => r.attack && !r.wall && !r.entry).time < requests({}, 'execute').find(r => r.attack).time);
assert.ok(early.find(r => !r.attack).time < requests({}, 'execute').find(r => !r.attack).time);
assert.ok(!requests({ plan: 'Fake', skirmish: { smokePolicy } }, 'opening').some(r => r.attack));
assert.ok(requests({ postPlant: 'Open plant', skirmish: { smokePolicy } }).find(r => !r.attack).time < defuse.time);
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
    ...changes };
  round.buys = utility.buyRound(stats, round, stats.map((team) => ({
    players: team.map(() => ({ credits: 5000 })),
  })));
  return utility.planRound({ name: mapName, stats }, agents, round,
    stats.map(() => [0, 0, 0, 0, 0]), terrain);
}
const simulation = (controller, mapName = 'Lotus') =>
  simulateRound(controller, mapName, { ...movement.openTerrain, clear: () => false }).events;
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
console.log(`Passed ${checked} smoke aperture checks, scenario checks, and utility smoke tests.`);

// Combat follows the replay sightline, even with no scheduled result-model kills.
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
const fight = simulateRound('omen', 'Lotus', openTerrain, { ...round, kills: [] });
assert.ok(fight.kills.length > 0, 'a clear encounter starts a fight without a scheduled kill');
const [kill] = fight.kills;
assert.ok(shotIsClear(openTerrain, kill.origin, kill.impact, [], 35 * geometry.scaleFor('Lotus')));
const track = fight.tracks[kill.phase][1 - kill.side][kill.victim];
assert.deepEqual(movement.playback(track, kill.time).point, kill.impact);
assert.deepEqual(movement.playback(track, 1).point, kill.impact, 'victim stops at the shot location');
assert.equal(simulateRound('omen', 'Lotus', blocked, round).kills.length, 0,
  'a scheduled kill does not enter the feed without sight');
assert.equal(planned.time, .66, 'planning a replay leaves the original result intact');

const positions = { 79: [40, 70], 16: [46, 70] };
const staticTerrain = { ...openTerrain, navigate: (point) => [positions[point[1]] || point] };
const roles = [0, 1].map(() => ({ lead: 0, support: 1, lurk: 4, split: [2, 3] }));
const sight = [];
const replay = movement.create('Lotus', { ...base, attack: 0, kills: [] }, roles, staticTerrain,
  (point) => point, (phase, time, positions, canShoot) => {
    if (phase === 1) sight.push([canShoot(0, 0, 0), canShoot(1, 0, 0)]);
  });
const flash = { side: 0, phase: 1, time: 0, kind: 'flash', name: 'Leer', delivery: 'cast',
  origin: [40, 70], landing: [46, 70] };
replay.moveTo(1, 1, [flash]);
assert.deepEqual(sight[0], [true, false], 'a flashed defender cannot shoot or stop an unblinded opponent from firing');
assert.deepEqual(sight.at(-1), [true, true], 'visibility returns after the flash expires');
assert.ok(movement.sightCone(staticTerrain, 'Lotus', replay.frames[1][1][0], replay.vision[1], 1, 0, .03).blind);
assert.ok(!movement.sightCone(staticTerrain, 'Lotus', replay.frames[1][1][0], replay.vision[1], 1, 0, 1).blind);
const wallTerrain = { ...staticTerrain, contains: ([x]) => x < 44 };
const cone = movement.sightCone(wallTerrain, 'Lotus', replay.frames[1][0][0], replay.vision[1], 0, 0, 1);
assert.ok(cone.rays.some(([x]) => x > 40), 'the view cone extends in the player’s facing direction');
assert.ok(cone.rays.every(([x]) => x < 44), 'the view cone stops at a wall');

const rosters = [0, 1].map(() => Array.from({ length: 5 }, () => ({ agent: 'omen' })));
const saved = rosters.map((team) => ({ losses: 0, players: team.map(() => ({
  credits: 150, gun: 'Vandal', shield: 'heavy', charges: { 'Dark Cover': 2, Paranoia: 1, 'Shrouded Step': 1 },
})) }));
const buys = utility.buyRound(rosters, { number: 7 }, saved);
assert.equal(buys[0].label, 'Full buy');
assert.ok(buys[0].players.every((player) => player.carried && player.gun === 'Vandal' && !player.spent
  && player.charges['Dark Cover'] === 2 && player.charges.Paranoia === 1));
const unusedCharges = buys.map(({ players }) => players.map(({ charges }) => ({ ...charges })));
unusedCharges[0][0]['Dark Cover']--;
const next = utility.settleRound({ ...base, attack: 0, winner: 1 }, buys, {
  planted: false, unusedCharges, kills: [{ side: 1, killer: 0, victim: 0 }],
});
assert.equal(next[0].players[0].gun, 'Classic');
assert.equal(next[0].players[0].charges.Paranoia, 1, 'unused purchased utility survives death');
assert.equal(next[0].players[0].charges['Dark Cover'], 1, 'spent charges are deducted');
assert.equal(next[0].players[1].gun, 'Vandal');
assert.equal(next[0].players[1].credits, 1150, 'losing attacker who saves without planting gets 1,000');
assert.equal(next[1].players[0].credits, 3350, 'kill credits go to the player who earned them');
const halftime = utility.buyRound(rosters, { number: 13 }, saved);
assert.equal(halftime[0].label, 'Pistol');
assert.ok(halftime[0].players.every((player) => player.credits === 800 && !player.carried && !player.carriedCharges));
const overtime = utility.buyRound(rosters, { number: 26 }, saved);
assert.equal(overtime[0].label, 'Overtime buy');
assert.ok(overtime[0].players.every((player) => player.credits === 5000 && !player.carried && !player.carriedCharges));

const wipe = simulateRound('omen', 'Lotus', movement.openTerrain, {
  plan: 'Fake', planted: true, postPlant: 'Crossfire', finish: 'wipe',
});
assert.equal(wipe.ended?.reason, 'elimination');
assert.ok(wipe.ended.phase < 3 && !wipe.planted, 'a pre-plant wipe prevents the plant and post-plant');
assert.equal(wipe.kills.at(-1).time, wipe.ended.time);
assert.ok(wipe.events.every(({ phase, time }) => phase < wipe.ended.phase
  || (phase === wipe.ended.phase && time <= wipe.ended.time)), 'no casts occur after resolution');
const onSite = { ...movement.openTerrain, clear: () => false, navigate: () => [[86, 31]] };
const defused = simulateRound('omen', 'Lotus', onSite, {
  winner: 1, planted: true, finish: 'defuse', postPlant: 'Crossfire',
});
assert.equal(defused.ended?.reason, 'defuse');
assert.equal(defused.ended.phase, 3);
const defuseSeconds = (defused.ended.time - defused.defuse.start) * 45;
assert.ok(defuseSeconds >= 7 && defuseSeconds < 8, 'defuse resolves after seven seconds of contact');
for (const map of Object.keys(tactics.layouts)) {
  for (const side of ['attack', 'defense']) {
    const segments = tactics.buyBarriers[map][side];
    assert.ok(segments.length >= 3 && segments.every((segment) => segment.length === 4
      && segment.every((value) => value > 0 && value < 100)));
  }
}
