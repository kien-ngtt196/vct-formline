const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const project = path.join(__dirname, '..');
const context = vm.createContext({});
for (const file of ['simulator-tactics.js', 'assets/simulator-ability-catalog.js',
  'assets/simulator-ability-geometry.js', 'assets/simulator-smokes.js', 'assets/skirmish-policy.js', 'assets/simulator-movement.js',
  'assets/simulator-utility.js', 'assets/simulator-skirmish.js', 'simulator-engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(project, 'src/web/static', file), 'utf8'), context);
}
const { sim, movement, policy, tactics, geometry } = vm.runInContext(
  '({ sim: SkirmishSim, movement: ChampionsMovement, policy: SkirmishPolicy, tactics: ChampionsTactics, geometry: ChampionsAbilityGeometry })', context);
const options = { seed: 42, terrain: { ...movement.openTerrain, ready: true } };

function verifySunsetTerrain() {
  const open = movement.terrain(new Uint8Array(10000).fill(1), 'Sunset');
  for (const [from, to] of [[[45, 46], [49, 49]], [[81, 38], [85, 42]], [[27, 64], [30, 64]]]) {
    assert.ok(open.contains(from) && open.contains(to));
    assert.ok(!movement.shotIsClear(open, from, to, [], 20), 'interior cover blocks shots');
    const route = open.navigate(from, to);
    assert.deepEqual([...route.at(-1)], to);
    assert.ok(route.every((point, index) => open.contains(point)
      && (!index || open.clear(route[index - 1], point))), 'route avoids solid cells');
  }
  assert.ok(open.navigate([27, 64], [30, 64]).length > 4, 'B Lobby route detours around cover');
  const corridor = Uint8Array.from({ length: 10000 }, (_, cell) => {
    const x = cell % 100;
    return x >= 49 && x <= 51;
  });
  const board = movement.terrain(corridor, 'Sunset');
  const from = [54, 93];
  const beyondBarrier = [50, 27];
  assert.ok(board.navigate(from, beyondBarrier, 'attack').every(([, y]) => y > 35),
    'buy route stays on the spawn side');
  assert.deepEqual([...board.navigate(from, beyondBarrier).at(-1)], beyondBarrier,
    'the corridor opens when buy time ends');
}

function verifyFlank(wall) {
  const round = { number: 6, site: 'A', alternate: 'B', attack: 0, plan: 'Rush', defense: 'Hold',
    kills: [], skirmish: {} };
  const roles = Array.from({ length: 2 }, () => ({ lead: 0, support: 1, lurk: 2, split: [1, 2] }));
  const board = { navigate: (from) => [from], clear: () => !wall };
  const offset = (point, i) => [point === tactics.layouts.Sunset.attack ? 10 : 20, 20 + i];
  let checked = false;
  const simulation = movement.create('Sunset', round, roles, board, offset, (phase, time, positions, canShoot) => {
    assert.equal(canShoot(0, 0, 0), !wall, 'flanker must see target through a clear line');
    assert.equal(canShoot(1, 0, 0), false, 'target cannot return fire while facing away');
    checked = true;
  });
  simulation.moveTo(0, 0, []);
  for (const team of simulation.frames[0]) for (const track of team) track.facing = 0;
  simulation.moveTo(1, 1 / movement.steps, []);
  assert.ok(checked);
}

async function verify() {
  verifySunsetTerrain();
  verifyFlank(false);
  verifyFlank(true);
  const bundle = policy.load(JSON.parse(fs.readFileSync(
    path.join(project, 'src/web/static/assets/skirmish-weights.json'), 'utf8')));
  assert.deepEqual(bundle.training.sites, ['A', 'B']);
  assert.equal(new Set(bundle.models.flat().map((weights) => JSON.stringify(weights))).size, 10);
  await assert.rejects(sim.play(options), /bot policies are unavailable/);
  await assert.rejects(sim.play({ ...options, name: 'Haven', policyBundle: bundle }), /do not match the selected map/);
  assert.ok(!sim.attackPlans('Haven').includes('Mid to'));
  assert.ok(sim.attackPlans('Ascent').includes('Mid to'));
  const trainedOptions = { ...options, policyBundle: bundle };
  await assert.rejects(sim.play({ ...trainedOptions, tactics: { attack: 'bad plan' } }), /supported attack and defense plan/);
  const agentCatalog = JSON.parse(fs.readFileSync(path.join(project, 'vct_images/agents/catalog.json'), 'utf8'));
  const picks = [['jett', 'sova', 'omen', 'killjoy', 'kayo'], ['jett', 'fade', 'clove', 'cypher', 'skye']];
  const scenario = { ...trainedOptions, scenario: { site: 'A', attack: 0 } };
  await assert.rejects(sim.play({ ...scenario, agentCatalog, draft: [Array(5).fill('jett'), picks[1]] }),
    /five different agents/);
  const drafted = sim.trainingLog(await sim.play({ ...scenario, agentCatalog, draft: picks }));
  assert.deepEqual([...drafted.draft[0]], picks[0]);
  assert.ok(drafted.rounds[0].casts.length);
  for (const event of drafted.rounds[0].casts) {
    assert.equal(event.agent, picks[event.side][event.slot]);
    assert.ok(event.origin.every(Number.isFinite) && event.landing.every(Number.isFinite));
    assert.ok(event.purpose);
  }
  const map = await sim.play(trainedOptions);
  const exported = sim.trainingLog(map);
  const [a, b] = map.rounds;
  assert.equal(map.timeline.length, a + b);
  assert.ok(Math.max(a, b) >= 13 && (Math.abs(a - b) >= 2 || a === 30 && b === 30));
  const score = [0, 0];
  for (const round of exported.rounds) {
    assert.deepEqual([...round.score], (score[round.outcome.winner]++, [...score]));
    assert.equal(round.tracks.length, 5);
    if (round.outcome.reason === 'defuse') assert.ok(round.planted && round.outcome.winner !== round.attack);
    if (round.outcome.reason === 'detonation') assert.ok(round.planted && round.outcome.winner === round.attack);
    if (round.outcome.reason === 'time') assert.ok(!round.planted && round.outcome.winner !== round.attack);
    assert.ok(round.casts.every((cast) => cast.phase < round.outcome.phase
      || (cast.phase === round.outcome.phase && cast.time <= round.outcome.time)));
  }
  assert.ok(exported.rounds.some((round) => round.kills.length));
  assert.ok(exported.rounds.some((round) => round.decisions[2].flat(2)
    .some((decision) => decision.state === 'Supporting the plant' && decision.cellsMoved > 0)));
  for (const round of exported.rounds) {
    round.decisions[3].forEach((team, side) => team.forEach((bot, index) => {
      if (bot.some(({ state }) => state === 'Saving rifle')) {
        assert.ok(['Vandal', 'Phantom'].includes(round.buys[side].players[index].gun));
        assert.ok(side === round.attack ? !round.planted : round.planted);
      }
    }));
  }
  assert.equal(exported.mode, 'agent-utility');
  assert.ok(exported.rounds.some(round => round.casts.some(cast => cast.phase === 0)));
  assert.ok(exported.rounds.some(round => round.casts.some(cast => cast.phase > 0)));
  for (const round of exported.rounds) {
    for (const event of round.casts) {
      assert.ok(!round.kills.some(kill => kill.side !== event.side && kill.victim === event.slot
        && (kill.phase < event.phase || (kill.phase === event.phase && kill.time <= event.time))));
    }
    assert.ok(round.buys.every(team => team.players.every(player => player.spent <= player.credits)));
  }
  for (const site of ['A', 'B']) {
    const match = await sim.play({ ...trainedOptions, tactics: { attack: 'Group late', defense: 'Site stack' }, scenario: { site, attack: 1 } });
    assert.equal(match.timeline.length, 1);
    assert.equal(match.timeline[0].site, site);
    assert.equal(match.timeline[0].plan, 'Group late');
    assert.equal(match.timeline[0].defense, 'Site stack');
    assert.equal(match.timeline[0].attack, 1);
  }
  const tournament = vm.runInContext('ChampionsSim', context);
  const tournamentTeams = picks.map((lineup, side) => ({
    id: `team-${side}`, name: `Team ${side}`,
    roster: lineup.map((agent, index) => ({ name: `Player ${side}-${index}`, agents: [agent], skill: .55 })),
  }));
  const catalog = { agents: agentCatalog, maps: ['Sunset'],
    comps: { Sunset: picks.map(agents => ({ agents, uses: 1 })) } };
  const run = { teams: Object.fromEntries(tournamentTeams.map(team => [team.id, team])), results: {} };
  const fixture = { id: 'test', bestOf: 1, sides: tournamentTeams.map(team => team.id) };
  const result = await tournament.playTactical(catalog, run, fixture, (setup, teams) =>
    sim.play({ ...trainedOptions, ...setup, agentCatalog, tournamentTeams: teams }));
  const replayedMap = result.maps[0];
  assert.equal(result.score.reduce((sum, value) => sum + value, 0), 1);
  assert.equal(replayedMap.stats[0][0].player, tournamentTeams[0].roster[0]);
  assert.equal(replayedMap.stats.flat().reduce((sum, line) => sum + line.kills, 0),
    replayedMap.replays.reduce((sum, round) => sum + round.kills.length, 0));
  const audited = await sim.play(trainedOptions);
  assert.equal(JSON.stringify(exported), JSON.stringify(sim.trainingLog(audited)));
  const track = audited.replays[0].tracks[1][0][0];
  const trace = exported.rounds[0].decisions[1][0][0];
  assert.equal(trace.length, track.samples.length);
  for (const [index, sample] of track.samples.entries()) {
    const frame = movement.recordedPosition(track, index / movement.steps);
    assert.equal(frame.cell, sample);
    assert.deepEqual(frame.point, exported.rounds[0].tracks[1][0][0][index]);
    if (index && trace[index].cellsMoved != null) {
      assert.equal(trace[index].cellsMoved, sample - track.samples[index - 1]);
    }
  }
  assert.equal(exported.policy, bundle.id);
  for (const name of sim.maps.filter((map) => map !== 'Sunset')) {
    const filename = `skirmish-weights-${name.toLowerCase()}.json`;
    const mapBundle = policy.load(JSON.parse(fs.readFileSync(path.join(project, 'src/web/static/assets', filename), 'utf8')));
    const sites = Object.keys(tactics.layouts[name].sites);
    assert.ok(Number.isFinite(geometry.scaleFor(name)), `${name}: finite combat scale`);
    assert.equal(mapBundle.training.map, name);
    assert.deepEqual(mapBundle.training.sites, sites);
    for (const site of sites) {
      const match = await sim.play({ ...options, name, policyBundle: mapBundle, scenario: { site, attack: 1 } });
      assert.equal(match.timeline[0].site, site);
      assert.equal(match.policyId, mapBundle.id);
    }
    if (name === 'Fracture') {
      const match = await sim.play({ ...options, name, policyBundle: mapBundle,
        tactics: { attack: 'Split' }, scenario: { site: 'A', attack: 0 } });
      const origins = sim.trainingLog(match).rounds[0].tracks[0][0].map((track) => track[0]);
      for (const spawn of [tactics.layouts.Fracture.attack, tactics.layouts.Fracture.attackAlt]) {
        assert.ok(origins.some((point) => Math.hypot(point[0] - spawn[0], point[1] - spawn[1]) <= 2),
          'Split starts attackers on both sides of Fracture');
      }
    }
  }
  console.log(`Verified Sunset gunplay, drafted utility, both sites, tactic controls, and trained replay export (${a}–${b}).`);
  console.log('Verified map-specific checkpoints and scenarios for every site on all thirteen maps.');
}
verify().catch((error) => { console.error(error); process.exitCode = 1; });
