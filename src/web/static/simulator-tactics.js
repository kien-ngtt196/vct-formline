/* Round events drive both the tactical playback and the map stat lines. */
const ChampionsTactics = (() => {
  // Coordinates are percentages of the local minimap images, in their fixed orientation.
  const layouts = {
    Abyss: { attack: [90, 42], defense: [8, 47], mid: [52, 49], sites: { A: [42, 12], B: [40, 91] } },
    Ascent: { attack: [85, 56], defense: [12, 45], mid: [49, 56], sites: { A: [30, 17], B: [27, 78] } },
    Haven: { attack: [90, 53], defense: [17, 40], mid: [61, 55], sites: { A: [38, 16], B: [39, 50], C: [37, 84] } },
    Lotus: { attack: [51, 79], defense: [60, 16], mid: [42, 44], sites: { A: [86, 31], B: [49, 42], C: [10, 48] } },
    Split: { attack: [86, 54], defense: [12, 53], mid: [49, 53], sites: { A: [34, 10], B: [32, 82] } },
    Summit: { attack: [49, 91], defense: [52, 12], mid: [51, 62], sites: { A: [91, 44], B: [13, 30] } },
    Sunset: { attack: [54, 93], defense: [48, 8], mid: [47, 48], sites: { A: [82, 38], B: [13, 39] } },
  };

  const phases = ["Buy", "Opening", "Execute", "Late round", "Result"];
  const pick = (items, random) => items[Math.floor(random() * items.length)];
  const mix = (a, b, ratio) => a.map((value, axis) => value + (b[axis] - value) * ratio);
  // Staging positions just inside the modeled buy barriers, in the original minimap orientation.
  const staging = {
    Abyss: { A: [73, 25], B: [77, 77], mid: [73, 46] },
    Ascent: { A: [59, 25], B: [66, 68], mid: [64, 42] },
    Haven: { A: [65, 26], B: [69, 55], C: [63, 80], mid: [72, 49] },
    Lotus: { A: [70, 67], B: [53, 64], C: [30, 62], mid: [53, 64] },
    Split: { A: [66, 24], B: [69, 76], mid: [67, 56] },
    Summit: { A: [67, 74], B: [29, 58], mid: [49, 73] },
    Sunset: { A: [71, 67], B: [26, 66], mid: [51, 66] },
  };
  const approaches = {
    Abyss: { A: [[63, 19], [30, 27]], B: [[62, 86], [31, 66]] },
    Ascent: { A: [[48, 20], [40, 29], [24, 29], "Tree", "Heaven"],
      B: [[41, 71], [30, 50], [20, 64], "Market", "Defender Spawn"] },
    Haven: { A: [[58, 18], [46, 28], [29, 23], "Short", "Heaven"],
      B: [[55, 52], [42, 44]], C: [[64, 89], [49, 63], [34, 65], "Garage", "C Link"] },
    Lotus: { A: [[75, 54], [85, 47], [82, 25], "Tree", "A Top"],
      B: [[45, 57], [61, 48], [36, 38], "A Link", "C Link"], C: [[23, 54], [36, 38]] },
    Split: { A: [[49, 21], [46, 31], [28, 26], "Ramps", "Screens"],
      B: [[54, 87], [41, 69], [27, 73], "Heaven", "Alley"] },
    Summit: { A: [[69, 57], [65, 36], [79, 40], "A Link", "Garden"],
      B: [[19, 49], [33, 42]] },
    Sunset: { A: [[76, 58], [72, 47], [79, 25], "A Link", "A Alley"],
      B: [[14, 60], [25, 43], [18, 27], "Market", "B Boba"] },
  };

  function lanesFor(map, site) {
    const layout = layouts[map];
    if (!layout) return null;
    const target = layout.sites[site];
    const [main, link, back = mix(layout.defense, target, 0.72), linkName = "connector", backName = "defender entrance"] = approaches[map][site];
    return { target, main, link, back, linkName, backName, staging: staging[map][site] };
  }

  const buySeconds = (number) => number === 1 || number === 13 ? 45 : 30;
  const phaseDuration = (round, phase) => [buySeconds(round.number), round.plan === "Rush" ? 17 : 36,
    round.plan === "Rush" ? 31 : 38, round.planted ? 45 : 29, 0][phase];
  function phaseStart(round, phase) {
    if (phase === 0) return -buySeconds(round.number);
    let elapsed = 0;
    for (let index = 1; index < phase; index++) elapsed += phaseDuration(round, index);
    return elapsed;
  }

  function movement(map, round, side, index, roles) {
    const layout = layouts[map];
    const lane = lanesFor(map, round.site);
    const alternate = lanesFor(map, round.alternate);
    const { target, main, link, back } = lane;
    const sites = Object.keys(layout.sites);
    const hold = lanesFor(map, sites[index % sites.length]);
    if (side === round.attack) {
      const lurker = index === roles.lurk;
      const connector = round.plan === "Mid to" || (round.plan === "Split" && roles.split.includes(index));
      const entrance = connector ? link : main;
      const alternateGroup = (round.plan === "Fake" && roles.split.includes(index))
        || (round.plan === "Lurk" && lurker) || (round.plan === "Default" && lurker);
      const buy = alternateGroup ? alternate.staging : connector ? staging[map].mid : lane.staging;
      const opening = {
        Rush: main, Default: lurker ? alternate.main : index === roles.support ? layout.mid : main,
        "Slow execute": mix(buy, main, .55), Fake: alternateGroup ? alternate.main : main,
        Split: connector ? layout.mid : main, "Mid to": layout.mid, Lurk: alternateGroup ? alternate.main : main,
      }[round.plan];
      const entry = round.planted ? spikePosition(lane, round)
        : round.finish === "wipe" ? target : mix(entrance, target, .45);
      const delayed = round.plan === "Lurk" && lurker;
      const saves = round.finish === "save" && round.winner !== round.attack;
      const playsMain = index === roles.lurk || (round.postPlant === "Open plant" && index !== roles.lead);
      const anchor = round.planted && playsMain ? entrance : entry;
      const takeSpawn = round.postPlant === "Push CT" && index === roles.lead;
      const late = saves ? layout.attack : takeSpawn ? mix(back, layout.defense, .32)
        : round.planted && delayed ? back : anchor;
      return { spawn: layout.attack, points: [buy, opening, delayed ? alternate.link : entry, late, late],
        via: connector && !delayed ? link : null };
    }
    const pushers = [roles.lead, roles.support].includes(index);
    const push = round.defense === "Take space" && pushers;
    const midPush = round.defense === "Fight mid" && pushers;
    const flank = round.defense === "Flank" && index === roles.lurk;
    const buy = push || midPush ? back : flank ? alternate.target
      : round.defense === "Fight mid" && index === roles.lurk ? link : hold.target;
    const opening = push ? mix(main, layout.attack, .25) : midPush ? layout.mid
      : flank ? alternate.main : index === roles.support ? link : hold.target;
    const rotates = pushers || hold.target === target;
    const rotate = flank ? mix(alternate.main, layout.attack, .65)
      : round.plan === "Fake" && index === roles.lead ? alternate.target
        : rotates ? index === roles.lead ? back : mix(back, target, .48) : hold.back;
    const saves = round.finish === "save" && round.winner === round.attack;
    const retake = saves ? layout.defense : flank ? main : round.planted
      ? mix(back, target, round.retake === "Flood" ? .75 : .35) : rotate;
    const final = ["defuse", "clutch"].includes(round.finish) && round.winner !== round.attack ? target : retake;
    return { spawn: layout.defense, points: [buy, opening, rotate, retake, final], via: null };
  }

  function playMap(name, winners, teams, random) {
    const sites = Object.keys(layouts[name]?.sites || { A: null, B: null });
    const score = [0, 0];
    return winners.map((winner, index) => {
      const number = index + 1;
      const attack = number <= 12 || (number > 24 && number % 2 === 1) ? 0 : 1;
      const site = pick(sites, random);
      const alternate = pick(sites.filter((letter) => letter !== site), random);
      const plans = ["Rush", "Rush", "Default", "Slow execute", "Fake", "Split", "Lurk"];
      if (["Ascent", "Split", "Sunset", "Abyss", "Summit"].includes(name)) plans.push("Mid to");
      const plan = pick(plans, random);
      const defense = pick(["Hold", "Delay", "Take space", "Fight mid", "Flank"], random);
      const strategy = plan === "Fake" ? `Fake ${alternate}, hit ${site}`
        : plan === "Default" ? `Default into ${site}`
          : plan === "Lurk" ? `Lurk behind the ${site} hit` : `${plan} ${site}`;
      const finish = pick(winner === attack
        ? ["hold", "detonate", "save", "wipe", "clutch"]
        : ["defuse", "stop", "time", "save", "clutch"], random);
      const planted = ["hold", "detonate", "defuse", "clutch"].includes(finish)
        || (finish === "save" && winner === attack);
      const postPlant = planted ? pick(["Crossfire", "Open plant", "Push CT"], random) : null;
      const retake = planted ? pick(["Group and clear", "Flood"], random) : null;
      const loser = 1 - winner;
      const living = [[0, 1, 2, 3, 4], [0, 1, 2, 3, 4]];
      const kills = [];
      const names = (side, player) => teams[side].roster[player].name;

      function eliminate(side, phase) {
        const victims = living[1 - side];
        const victim = victims.splice(Math.floor(random() * victims.length), 1)[0];
        const shooters = living[side];
        const killer = pick(shooters.flatMap((player) =>
          Array(Math.max(1, Math.round(teams[side].roster[player].skill * 5))).fill(player)), random);
        const partners = shooters.filter((player) => player !== killer);
        const assist = partners.length && random() < 0.55 ? pick(partners, random) : null;
        kills.push({ side, killer, victim, assist, phase, text: `${names(side, killer)} eliminated ${names(1 - side, victim)}` });
      }

      const loserLosses = ["clutch", "wipe", "hold", "stop"].includes(finish) ? 5 : 2 + Math.floor(random() * 3);
      const winnerLosses = finish === "clutch" ? 4 : Math.floor(random() * 4);
      const firstSide = winnerLosses && random() < 0.42 ? loser : winner;
      eliminate(firstSide, 1);
      while (5 - living[winner].length < winnerLosses || 5 - living[loser].length < Math.min(4, loserLosses)) {
        const exchanges = [];
        if (5 - living[winner].length < winnerLosses) exchanges.push(loser);
        if (5 - living[loser].length < Math.min(4, loserLosses)) exchanges.push(winner);
        eliminate(pick(exchanges, random), kills.length <= 3 ? 2 : 3);
      }
      const lastDuel = finish === "clutch" ? names(loser, living[loser][0]) : "";
      const closer = names(winner, living[winner][0]);
      if (loserLosses === 5) eliminate(winner, 4);
      const exchangesByPhase = [0, 0, 0, 0, 0];
      for (const kill of kills) {
        const order = exchangesByPhase[kill.phase]++;
        kill.time = Math.min(.96, (kill.phase === 4 ? .28 : .66) + order * .065);
      }
      const ending = {
        hold: `Post-plant hold on ${site}. The attackers win the last trade.`,
        detonate: `Spike detonates on ${site} before the defenders can finish the retake.`,
        defuse: `Defenders retake ${site}. ${closer} sticks the defuse.`,
        stop: `Defenders shut down the hit on ${site} before the plant.`,
        wipe: `Attackers break through ${site} and eliminate the defense before planting.`,
        save: winner === attack ? `Defenders save their weapons as the spike detonates on ${site}.`
          : "Attackers back out to save their weapons. The round clock runs out.",
        time: "The defenders deny the plant until the round clock runs out.",
        clutch: winner === attack ? `${closer} wins the 1v1 against ${lastDuel} and holds the plant.`
          : `${closer} wins the 1v1 against ${lastDuel} and defuses.`,
      }[finish];
      const before = [...score];
      score[winner]++;
      const lane = lanesFor(name, site);
      const opening = {
        Rush: `Attackers group for a fast hit on ${site}.`,
        Default: "Attackers spread across the lanes to gather information and catch a defender push.",
        "Slow execute": `Attackers hold outside ${site} and wait out early defensive utility.`,
        Fake: `A decoy group shows pressure at ${alternate}. The spike stays with the ${site} group.`,
        Split: `Three attackers take main while two approach ${site} through ${lane?.linkName || "the connector"}.`,
        "Mid to": `Attackers take mid together before turning toward ${site} through ${lane?.linkName || "the connector"}.`,
        Lurk: `Four attackers prepare the ${site} hit while a lurker holds the opposite lane for rotations.`,
      }[plan];
      const defenseOpening = {
        Hold: "Defenders hold crossfires and keep their rotation options open.",
        Delay: "The site anchors prepare counter-utility for the first choke.",
        "Take space": "Two defenders use info and a flash to push out and contest early space.",
        "Fight mid": "Two defenders take mid together while the site players hold their anchors.",
        Flank: "One defender takes the quiet lane while the anchors stay on site.",
      }[defense];
      const execute = {
        Fake: `The main group hits ${site} after showing utility at ${alternate}. The decoys follow through the connector.`,
        Split: `The main and connector groups hit ${site} together. Smokes cut the remaining defender sightlines.`,
        "Mid to": `With mid secured, the pack swings through ${lane?.linkName || "the connector"} toward ${site}.`,
        Lurk: `The entry group commits to ${site}. The lurker trails the defenders' rotation.`,
      }[plan] || `The entry player goes through first while the second player follows to trade on ${site}.`;
      const round = {
        number, attack, winner, before, score: [...score], site, alternate, plan, defense, strategy,
        finish, planted, postPlant, retake, kills, notes: [
          "Teams buy, move up to their side of the barriers and place eligible setup utility.",
          `${opening} ${defenseOpening}`,
          `${execute} Defenders try to stall the hit at the choke.`,
          finish === "clutch" ? `1v1 on ${site}. ${closer} faces ${lastDuel} with the spike down.`
            : finish === "save" ? winner === attack
              ? `Spike planted on ${site}. Defenders give up the retake to save their weapons.`
              : "The attackers give up the hit and fall back to save their weapons."
              : planted ? `${postPlant === "Open plant" ? "The spike is planted open for main. The attackers fall back and keep a line on the defuse."
                : postPlant === "Push CT" ? "After planting, the entry player pushes defender spawn to take space and delay the retake."
                  : "Attackers hold crossfires on the planted spike."} ${retake === "Flood"
                ? "Defenders flood the site together." : "Defenders group and clear one angle at a time."}`
                : `Defenders contest ${site} and cut off the spike carrier's approach.`,
          ending,
        ],
      };
      return round;
    });
  }

  function buyAnchors(map) {
    const layout = layouts[map];
    const attack = Object.entries(staging[map]).map(([lane, at]) => ({
      at, toward: lane === "mid" ? layout.mid : lanesFor(map, lane).main, attacking: true,
    }));
    const defense = Object.keys(layout.sites).map((site) => {
      const { target, main } = lanesFor(map, site);
      return { at: mix(target, main, .35), toward: main, attacking: false };
    });
    return [...attack, ...defense];
  }

  function spikePosition(lane, round) {
    return round.postPlant === "Open plant" ? mix(lane.target, lane.main, .29) : lane.target;
  }

  return { layouts, phases, lanesFor, buySeconds, phaseDuration, phaseStart, movement, buyAnchors, spikePosition, playMap };
})();
