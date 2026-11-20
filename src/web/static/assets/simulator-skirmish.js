const SkirmishSim = (() => {
  const maps = Object.keys(ChampionsTactics.layouts).sort();
  const attackPlans = (map) => ["Rush", "Default", "Slow execute", "Split", "Lurk", "Fake", "Group late",
    ...(["Ascent", "Split", "Sunset", "Abyss", "Summit"].includes(map) ? ["Mid to"] : [])];
  const defensePlans = ["Hold", "Delay", "Take space", "Fight mid", "Flank", "Crossfire", "Site stack"];
  const agents = Object.fromEntries(["Duelist", "Initiator", "Sentinel", "Controller", "Flex"].map((role, i) =>
    [`bot-${i + 1}`, { name: `Bot ${i + 1}`, role }]));
  const teams = ["Blue", "Red"].map((name) => ({ id: name.toLowerCase(), name, roster: Object.keys(agents) }));
  const pick = (pool, random) => pool[Math.floor(random() * pool.length)];
  const done = ([blue, red]) => Math.max(blue, red) >= 13 && Math.abs(blue - red) >= 2;

  function seeded(seed) {
    let state = seed >>> 0 || 1;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }

  async function play({ name = "Sunset", terrain, seed, policyBundle, scenario, tactics = {},
    draft, agentCatalog, tournamentTeams, recordDecisions = !tournamentTeams, progress = () => {}, yieldRound = async () => {} }) {
    if (!maps.includes(name) || !terrain.ready) throw new Error("The selected radar is unavailable.");
    const { id: policyId, models } = SkirmishPolicy.load(policyBundle);
    if (policyBundle.training?.map !== name) throw new Error("The bot policies do not match the selected map.");
    const plans = attackPlans(name);
    if ((tactics.attack && !plans.includes(tactics.attack)) || (tactics.defense && !defensePlans.includes(tactics.defense))) {
      throw new Error("Choose a supported attack and defense plan.");
    }
    if (draft != null && (!Array.isArray(draft) || draft.length !== teams.length || !draft.every((lineup, side) =>
      Array.isArray(lineup) && lineup.length === teams[side].roster.length && new Set(lineup).size === lineup.length
      && lineup.every((agent) => Object.hasOwn(agentCatalog || {}, agent) && (tournamentTeams || agentCatalog[agent].image))))) {
      throw new Error("Draft five different agents for each team.");
    }
    const lineup = draft || [["jett", "sova", "cypher", "omen", "breach"], ["raze", "fade", "killjoy", "brimstone", "skye"]];
    const roles = agentCatalog || Object.fromEntries(lineup.flatMap(team => team.map((agent, index) => [agent, agents[teams[0].roster[index]]])));
    const random = seeded(seed);
    const map = { name, seed, policyId, draft: lineup.map((lineup) => [...lineup]), terrain: scenario ? undefined : terrain,
      stats: teams.map(({ id, roster }, side) => roster.map((agent, slot) => ({
      team: tournamentTeams?.[side].id ?? id, agent: lineup[side][slot], player: tournamentTeams?.[side].roster[slot] ?? { name: `${id === "blue" ? "Blue" : "Red"} ${agents[agent].name}`,
        skill: .45 + random() * .1 }, kills: 0, deaths: 0,
    }))), timeline: [], replays: [], rounds: [0, 0] };
    const points = map.stats.map((team) => team.map(() => 0));
    const sites = Object.keys(ChampionsTactics.layouts[name].sites);
    if (scenario && !sites.includes(scenario.site)) throw new Error("The selected site is unavailable.");
    const offsets = [[-1, 0], [0, -1.5], [1, 0], [-1, 1.5], [1, 1.5]];
    const offset = (point, index) => point.map((value, axis) => value + offsets[index][axis]);
    // At 30–30 the lab can stop at a draw instead of simulating indefinite OT.
    const maxRounds = scenario ? 1 : tournamentTeams ? 61 : 60;
    for (let index = 0; index < maxRounds && !done(map.rounds); index++) {
      const number = scenario ? 6 : index + 1;
      const attack = scenario?.attack ?? (number <= 12 || (number > 24 && number % 2 === 1) ? 0 : 1);
      const sampledPlan = pick(plans, random);
      const sampledSite = pick(sites, random);
      const plan = tactics.attack || sampledPlan;
      const site = scenario?.site ?? sampledSite;
      const alternate = pick(sites.filter((letter) => letter !== site), random);
      const sampledDefense = pick(defensePlans, random);
      const round = {
        number, attack, site, alternate, plan, defense: tactics.defense || sampledDefense,
        defenseSite: sites[(number + attack) % sites.length],
        before: [...map.rounds], planted: true, finish: "detonate",
        postPlant: pick(["Open plant", "Crossfire", "Push CT"], random),
        retake: pick(["Flood", "Group and clear"], random),
        skirmish: { random, policies: models, smokePolicy: policyBundle.smokePolicy, utilityTiming: policyBundle.utilityTiming, castPreference: policyBundle.castPreference, recordDecisions: recordDecisions && !scenario },
      };
      const previous = scenario ? teams.map(({ roster }) => ({
        players: roster.map(() => ({ credits: 5000 })),
      })) : map.replays.at(-1)?.economy;
      round.buys = ChampionsUtility.buyRound(map.stats, round, previous);
      if (number === 13 || number > 24) points.forEach((team) => team.fill(number > 24 ? 4 : 0));
      const replay = ChampionsUtility.planRound(map, roles, round, points, terrain, offset);
      round.winner = replay.ended.winner;
      round.planted = replay.planted;
      round.kills = replay.kills;
      round.finish = { elimination: "wipe", defuse: "defuse", detonation: "detonate", time: "time" }[replay.ended.reason];
      map.rounds[round.winner]++;
      round.score = [...map.rounds];
      map.timeline.push(round);
      map.replays.push({ ...replay, buys: round.buys, economy: ChampionsUtility.settleRound(round, round.buys, replay) });
      for (const { side, killer, victim } of replay.kills) {
        map.stats[side][killer].kills++;
        map.stats[1 - side][victim].deaths++;
        points[side][killer]++;
        points[1 - side][victim]++;
      }
      progress(number);
      await yieldRound();
    }
    return map;
  }

  function trainingLog(map) {
    return {
      version: 2, source: "simulation", mode: "agent-utility", map: map.name, seed: map.seed,
      policy: map.policyId, smokePolicy: map.timeline[0]?.skirmish.smokePolicy, utilityTiming: map.timeline[0]?.skirmish.utilityTiming, castPreference: map.timeline[0]?.skirmish.castPreference, score: map.rounds,
      teams: map.stats.map((team) => team.map(({ agent }) => agent)),
      ...(map.draft ? { draft: map.draft } : {}),
      rounds: map.timeline.map((round, index) => {
        const replay = map.replays[index];
        const { number, attack, site, plan, defense, score, buys } = round;
        const phaseSeconds = ChampionsTactics.phases.map((_, phase) =>
          ChampionsTactics.phaseDuration({ ...round, planted: replay.planted }, phase));
        return {
          number, attack, site, plan, defense, score, buys, phaseSeconds, planted: replay.planted, outcome: replay.ended,
          casts: replay.events.map((event) => {
            const { side, index: slot, agent, name, phase, time, origin, landing } = event;
            return { side, slot, agent, name, phase, time, origin, landing, purpose: event.purpose, enemiesBlinded: event.enemiesBlinded || 0, alliesBlinded: event.alliesBlinded || 0, enemiesInScan: event.enemiesInScan || 0, blockedMovementTicks: event.blockedMovementTicks || 0, activation: Boolean(event.setup) };
          }),
          kills: replay.kills,
          decisions: replay.tracks.map((teams) => teams.map((team) => team.map((track) => track.decisions))),
          tracks: replay.tracks.map((teams) => teams.map((team) => team.map((track) =>
            track.samples.map((cursor) => track.cells[cursor])))),
        };
      }),
    };
  }

  return { play, trainingLog, seeded, maps, teams, agents, attackPlans, defensePlans };
})();
