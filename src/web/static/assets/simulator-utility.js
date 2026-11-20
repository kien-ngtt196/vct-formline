/* Tactics model uses authored ability roles and the published game icon inventory. */
const ChampionsUtility = (() => {
  const effects = {
    smoke: { color: "#b295ff", label: "cuts a sightline" },
    wall: { color: "#65cfc3", label: "screens a lane" },
    recon: { color: "#68ddeb", label: "checks for defenders" },
    clear: { color: "#68ddeb", label: "clears close corners" },
    flash: { color: "#ffe3a0", label: "blinds the next angle" },
    disrupt: { color: "#ffa075", label: "disrupts the players holding the lane" },
    denial: { color: "#fa857f", label: "denies the crossing" },
    trap: { color: "#c4a4fc", label: "watches for a flank" },
    barrier: { color: "#74e2d9", label: "blocks the approach" },
    entry: { color: "#9ce6ff", label: "bursts through the choke" },
    support: { color: "#91dba3", label: "supports the next swing" },
    ultimate: { color: "#f3c873", label: "commits an ultimate" },
  };
  const groups = {
    smoke: ["Dark Cover", "Sky Smoke", "Nebula", "Ruse", "Cove", "Poison Cloud", "Cloudburst", "Cyber Cage", "Waveform"],
    wall: ["High Tide", "Toxic Screen", "Fast Lane", "Blaze", "Contingency"],
    recon: ["Recon Bolt", "Haunt", "ZERO/point", "Spycam", "Owl Drone", "Stealth Drone"],
    clear: ["Prowler", "Trailblazer", "Boom Bot", "Wingman", "FAKEOUT"],
    flash: ["Flashpoint", "FLASH/drive", "Guiding Light", "Curveball", "BLINDSIDE", "Dizzy", "Paranoia", "Leer", "Arc Rose", "Flashbulb"],
    disrupt: ["Fault Line", "Relay Bolt", "Nova Pulse", "Gravity Well", "Seize", "GravNet", "Storm Surge", "Special Delivery", "Saturate", "Undercut", "Meddle", "Displacement", "Chokehold"],
    denial: ["Aftershock", "Nanoswarm", "Snake Bite", "Incendiary", "Mosh Pit", "Hot Hands", "Paint Shells", "Slow Orb", "Shock Bolt", "FRAG/ment", "Guided Salvo", "Razorvine", "M-pulse"],
    trap: ["Trapwire", "Trademark", "Sonic Sensor", "ALARMBOT", "TURRET", "Shear", "Interceptor"],
    barrier: ["Barrier Mesh", "Barrier Orb"],
    entry: ["Tailwind", "Updraft", "Blast Pack", "High Gear", "Lightspeed", "GATECRASH", "Shrouded Step", "Flow"],
    support: ["Stim Beacon", "Harmonize"],
  };
  const category = new Map(Object.entries(groups).flatMap(([kind, names]) => names.map((name) => [name, kind])));
  const openingUltimates = new Set(["Run it Back", "Rolling Thunder", "Nightfall", "Cosmic Divide",
    "Viper's Pit", "Lockdown", "Reckoning", "Convergent Paths", "DIMENSIONAL DRIFT", "Steel Garden",
    "Bassquake", "NULL/cmd", "Seekers", "Showstopper", "Armageddon", "Overdrive", "Suspension"]);
  const stationary = new Set(["Sky Smoke", "Nebula", "Ruse", "Waveform", "Guided Salvo",
    "Barrier Orb", "Barrier Mesh", "Gravity Well", "Nova Pulse", "Arc Rose", "Spycam", "Nanoswarm"]);
  const guided = new Set(["Guiding Light", "Trailblazer", "Owl Drone", "Stealth Drone", "Prowler", "Boom Bot", "Wingman", "FAKEOUT"]);
  // Per-charge shop prices. Signatures with purchasable extra charges are listed too.
  const prices = {
    Aftershock: 200, Flashpoint: 250, "Stim Beacon": 200, Incendiary: 250, "Sky Smoke": 100, Nebula: 150,
    Meddle: 250, Ruse: 150, Trademark: 200, Trapwire: 200, "Cyber Cage": 100,
    "Barrier Mesh": 400, "Sonic Sensor": 200, Prowler: 250, Seize: 200, "Mosh Pit": 250,
    Wingman: 300, "High Tide": 300, "Storm Surge": 200, Contingency: 200, Undercut: 200,
    Cloudburst: 200, Updraft: 150, "FRAG/ment": 200, "FLASH/drive": 250, Nanoswarm: 200,
    ALARMBOT: 200, "M-pulse": 250, Harmonize: 200, Waveform: 100, "Fast Lane": 300,
    "Relay Bolt": 200, "Shrouded Step": 100, Paranoia: 250, "Dark Cover": 150, Blaze: 150,
    "Hot Hands": 200, Curveball: 250, "Boom Bot": 300, "Blast Pack": 200, Leer: 250,
    "Barrier Orb": 400, "Slow Orb": 200, Trailblazer: 300, "Guiding Light": 250,
    "Owl Drone": 400, "Shock Bolt": 150, "Stealth Drone": 400, "Special Delivery": 200,
    "Guided Salvo": 150, Chokehold: 200, "Snake Bite": 300, "Poison Cloud": 200, Razorvine: 150,
    Shear: 200, FAKEOUT: 100, BLINDSIDE: 250, GATECRASH: 150,
  };
  const extraCharges = {
    "Dark Cover": 2, "Sky Smoke": 3, Nebula: 2, Ruse: 2, Waveform: 2, Nanoswarm: 2, Trapwire: 2,
    "Cyber Cage": 2, "Blast Pack": 2, "Shock Bolt": 2, "Guiding Light": 2, "FLASH/drive": 2,
  };
  const freeFirst = new Set(["Dark Cover", "Sky Smoke", "Nebula", "Ruse", "Waveform", "Curveball", "Guiding Light"]);
  const recharge = { "Dark Cover": 40, "Recon Bolt": 50, Haunt: 50 };
  const buySetup = new Set(["Trapwire", "Cyber Cage", "Spycam", "ALARMBOT", "TURRET", "Nanoswarm", "Trademark"]);
  const controlled = { "Owl Drone": { range: 23, seconds: 7 }, Trailblazer: { range: 24, seconds: 6 },
    "Stealth Drone": { range: 22, seconds: 6 } };
  const ranges = {
    "Dark Cover": 80, "Sky Smoke": 55, Waveform: 55.5, Ruse: 55, Nebula: 100, "Guided Salvo": 45,
    Paranoia: 25, "Recon Bolt": 100, Haunt: 36, Prowler: 32, "Boom Bot": 24,
    "Guiding Light": 45, "ZERO/point": 50, "Rolling Thunder": 40, "Fault Line": 64,
    Updraft: 12, "Shrouded Step": 15, Cloudburst: 23, "Poison Cloud": 35, Cove: 35,
    Spycam: 20, Trapwire: 14, "Cyber Cage": 18, ALARMBOT: 12, TURRET: 14, Nanoswarm: 25,
  };
  const placedOnGround = new Set(["Nanoswarm", "Alarmbot", "ALARMBOT", "TURRET", "Trapwire", "Trademark",
    "Barrier Orb", "Barrier Mesh", "Incendiary", "Snake Bite", "Hot Hands", "Mosh Pit", "FRAG/ment",
    "Aftershock", "Paint Shells", "Slow Orb", "Razorvine", "Stim Beacon"]);
  const buyLimits = { Pistol: 4, Eco: 3, "Half-buy": 6, "Force buy": 7, Bonus: 7, "Full buy": 13, "Overtime buy": 13 };
  const gunPrices = { Classic: 0, Ghost: 500, Sheriff: 800, Stinger: 1100, Spectre: 1600,
    Bulldog: 2050, Phantom: 2900, Vandal: 2900 };
  const shieldPrices = { none: 0, light: 400, regen: 650, heavy: 1000 };
  const isRifle = (gun) => gun === "Vandal" || gun === "Phantom";
  const signatureAbility = ({ name, slot }) => (slot === "Ability2" && !Object.hasOwn(prices, name))
    || freeFirst.has(name);
  const roundReset = (number) => number === 1 || number === 13 || number > 24;

  function buyRound(stats, round, previous) {
    const pistol = round.number === 1 || round.number === 13;
    const overtime = round.number > 24;
    return stats.map((team, side) => {
      const saved = roundReset(round.number) ? null : previous?.[side];
      const bonus = [3, 15].includes(round.number) && saved?.players.filter(({ gun }) => gun === "Spectre").length >= 3;
      const players = team.map(({ agent }, index) => {
        const prior = saved?.players[index];
        const credits = prior?.credits ?? (overtime ? 5000 : 800);
        const savedGun = prior?.gun || "Classic";
        const pickRifle = (round.number + index + side) % 3 ? "Vandal" : "Phantom";
        let choice = "Classic";
        if (pistol && (index + side) % 5 < 3) choice = "Ghost";
        else if (overtime || (!bonus && (credits >= 3900 || isRifle(savedGun)))) choice = pickRifle;
        else if (bonus && !isRifle(savedGun)) choice = credits >= 2000 ? "Spectre" : "Classic";
        else if (credits >= 3250) choice = "Bulldog";
        else if (credits >= 2700) choice = "Spectre";
        else if (credits >= 2250) choice = "Stinger";
        else if (credits >= 1800) choice = "Sheriff";
        const gun = gunPrices[savedGun] >= gunPrices[choice] ? savedGun : choice;
        const weaponCost = gun === savedGun ? 0 : gunPrices[gun];
        const afterWeapon = credits - weaponCost;
        const wantedShield = isRifle(gun) && afterWeapon >= 1350 ? "heavy"
          : isRifle(gun) && afterWeapon >= 650 ? "regen"
            : gunPrices[gun] >= 1100 && afterWeapon >= 400 ? "light" : "none";
        const savedShield = prior?.shield || "none";
        const shield = shieldPrices[savedShield] >= shieldPrices[wantedShield] ? savedShield : wantedShield;
        const armorCost = shield === savedShield ? 0 : shieldPrices[shield];
        const cap = isRifle(gun) ? 1100 : pistol ? 550 : gunPrices[gun] >= 1100 ? 650 : 350;
        const budget = Math.min(afterWeapon - armorCost, cap);
        const charges = { ...prior?.charges };
        const carriedCharges = Object.values(charges).reduce((total, count) => total + count, 0);
        let utilityCost = 0;
        for (const ability of ChampionsAbilityCatalog[agent] || []) {
          const { name } = ability;
          if (!category.has(name) || ability.slot === "Ultimate") continue;
          const signature = signatureAbility(ability);
          const cost = prices[name] ?? (signature ? 0 : 200);
          let count = Math.max(charges[name] || 0, Number(signature));
          const capacity = extraCharges[name] || 1;
          while (count < capacity && utilityCost + cost <= budget) {
            count++;
            utilityCost += cost;
          }
          charges[name] = count;
        }
        return { credits, gun, shield, carried: gun === savedGun && gun !== "Classic", carriedCharges,
          charges, spent: weaponCost + armorCost + utilityCost };
      });
      const label = pistol ? "Pistol" : overtime ? "Overtime buy" : players.every(({ gun }) => isRifle(gun)) ? "Full buy"
        : bonus ? "Bonus" : players.some(({ gun }) => gunPrices[gun] >= 1600) ? "Force buy"
          : players.some(({ gun }) => gunPrices[gun] >= 800) ? "Half-buy" : "Eco";
      const credits = Math.round(players.reduce((total, player) => total + player.credits, 0) / players.length);
      return { label, credits, players, losses: saved?.losses || 0 };
    });
  }

  function settleRound(round, buys, replay) {
    return buys.map((buy, side) => {
      const losses = side === round.winner ? 0 : buy.losses + 1;
      const detonated = replay.ended?.reason === "detonation" || (!replay.ended && replay.planted
        && round.winner === round.attack && ["detonate", "save"].includes(round.finish));
      const players = buy.players.map((player, index) => {
        const survived = !replay.kills.some((kill) => kill.side !== side && kill.victim === index);
        const kills = replay.kills.filter((kill) => kill.side === side && kill.killer === index).length;
        const savedOnLoss = survived && (side === round.attack ? !replay.planted : detonated);
        const reward = !losses ? 3000 : savedOnLoss ? 1000 : [1900, 2400, 2900][Math.min(losses, 3) - 1];
        const plant = replay.planted && side === round.attack ? 300 : 0;
        return { credits: Math.min(9000, player.credits - player.spent + reward + kills * 200 + plant),
          gun: survived ? player.gun : "Classic", shield: survived ? player.shield : "none",
          charges: replay.unusedCharges[side][index] };
      });
      return { losses, players };
    });
  }
  const kinds = (...names) => names;
  const iconUrl = (agent, ability) =>
    `/vct-images/radar/abilities/${agent}-${ability.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;

  function assignments(lines, agents) {
    const roster = lines.map(({ agent }, index) => ({ index, role: agents[agent]?.role }));
    const lead = roster.find(({ role }) => role === "Duelist")?.index ?? 0;
    const support = roster.find(({ role, index }) => index !== lead && role === "Initiator")?.index
      ?? roster.find(({ index }) => index !== lead).index;
    const lurk = roster.find(({ role, index }) => index !== lead && index !== support && role === "Sentinel")?.index
      ?? roster.filter(({ index }) => index !== lead && index !== support).at(-1).index;
    const split = [support, roster.find(({ index }) => ![lead, support, lurk].includes(index)).index];
    return { lead, support, lurk, split };
  }

  function pathLength(path) {
    return path.slice(1).reduce((length, point, i) =>
      length + Math.hypot(point[0] - path[i][0], point[1] - path[i][1]), 0);
  }

  function playbook(map, original, layout, lane, alternate, lines, roles, points, terrain, offset) {
    const round = { ...original, kills: [] };
    const shots = [];
    const misses = new Set();
    let defuse;
    const spike = terrain.snap(ChampionsTactics.spikePosition(lane, round));
    const living = (side, index) => !round.kills.some((kill) => kill.side !== side && kill.victim === index);
    function resolveContact(phase, time, positions, canShoot) {
      if (phase === 3 && round.planted && (round.skirmish || round.winner !== round.attack) && spike) {
        const side = 1 - round.attack;
        const inReach = (index) => living(side, index)
          && Math.hypot(...positions[side][index].map((value, axis) => value - spike[axis])) <= 2.5 * scale;
        if (defuse && !inReach(defuse.index)) defuse = null;
        if (!defuse) {
          const index = positions[side].findIndex((_, index) => inReach(index));
          if (index >= 0) defuse = { index, start: time };
        }
        round.defusing = defuse?.index;
        if (defuse && (time - defuse.start) * ChampionsTactics.phaseDuration(round, phase) >= 7) {
          round.ended = { phase, time, reason: "defuse", winner: side };
          return;
        }
      }
      const last = shots.at(-1);
      if (last?.phase === phase && time - last.time < .04) return;
      const winnerAlone = !round.skirmish && round.kills.filter(({ side }) => side !== round.winner).length === 4;
      let best;
      for (const side of round.skirmish ? [round.attack, 1 - round.attack] : [round.winner, 1 - round.winner]) {
        // The bracket has already resolved the round. The last player on the
        // winning side can take fire, but cannot be eliminated in the replay.
        const miss = winnerAlone && side !== round.winner;
        for (const [killer, origin] of positions[side].entries()) {
          if (phase === 3 && side !== round.attack && killer === defuse?.index) continue;
          for (const [victim, impact] of positions[1 - side].entries()) {
            const key = `${phase}:${side}:${killer}:${victim}`;
            if (miss && misses.has(key)) continue;
            const skill = lines[side][killer].player.skill ?? .5;
            const gap = Math.hypot(origin[0] - impact[0], origin[1] - impact[1]);
            const gun = round.buys[side].players[killer].gun;
            const firepower = round.skirmish ? (isRifle(gun) ? 3 : gunPrices[gun] >= 1100 && gap <= 14 * scale ? 2 : 0)
              + shieldPrices[round.buys[side].players[killer].shield] / 500 : 0;
            const reaction = round.skirmish ? round.skirmish.random() * 7 : 0;
            const cost = gap - skill * 8 - firepower + reaction + (round.skirmish || side === round.winner ? 0 : 1);
            if ((best && cost >= best.cost) || !canShoot(side, killer, victim)) continue;
            best = { side, killer, victim, origin, impact, cost, miss, key };
          }
        }
      }
      if (!best) return;
      const { side, killer, victim, origin, impact, miss, key } = best;
      const shot = { side, killer, victim, phase, time, origin, impact };
      shots.push(shot);
      if (miss) misses.add(key);
      else {
        round.kills.push({ ...shot,
          text: `${lines[side][killer].player.name} eliminated ${lines[1 - side][victim].player.name}` });
        if (round.kills.filter((kill) => kill.side === side).length === 5
          && (side === round.attack || phase < 3 || !round.planted)) {
          round.ended = { phase, time, reason: "elimination", winner: side };
        }
      }
      return shot;
    }
    const movement = ChampionsMovement.create(map, round, roles, terrain, offset, resolveContact);
    const { main, link, back, target, linkName, backName } = lane;
    const launch = round.plan === "Split" || round.plan === "Mid to" ? link : main;
    const insideEntry = launch.map((value, axis) => value * .65 + target[axis] * .35);
    const midHit = round.plan === "Split" || round.plan === "Mid to";
    const openingTarget = round.plan === "Fake" ? alternate.main : midHit ? layout.mid : main;
    const openingName = round.plan === "Fake" ? `${round.alternate} main` : midHit ? "mid" : `${round.site} main`;
    const roundEvents = [];
    const requests = [];
    const uses = [new Map(), new Map()];
    const spent = [0, 0];
    const usedBy = lines.map((team) => team.map(() => 0));
    const unusedCharges = round.buys.map(({ players }) => players.map(({ charges }) => ({ ...charges })));
    const scale = ChampionsAbilityGeometry.scaleFor(map);
    const attack = round.attack;
    const defend = 1 - attack;

    function cast(side, phase, time, desired, landing, area, preferred, smoke) {
      const buy = round.buys[side].label;
      const limit = buyLimits[buy];
      if (spent[side] >= limit && !desired.includes("ultimate")) return;
      const seconds = ChampionsSmokes.now(round, phase, time);
      if (smoke) {
        const alreadyCovered = roundEvents.some((event) => event.side === side && event.smokeTiming?.ends > seconds
          && event.area === smoke.spot.name);
        const enemyIsNear = lines[1 - side].some((_, index) =>
          !round.kills.some((kill) => kill.side === side && kill.victim === index
            && (kill.phase < phase || (kill.phase === phase && kill.time <= time)))
          && Math.hypot(...movement.position(1 - side, index).map((value, axis) => value - landing[axis])) <= 24 * scale);
        if (alreadyCovered || (smoke.pressure && !enemyIsNear)) return;
      }
      const candidates = lines[side].flatMap(({ agent, player }, index) => {
        if (usedBy[side][index] >= (limit >= 6 ? 6 : 3)) return [];
        if (round.kills.some((kill) => kill.side !== side && kill.victim === index
          && (kill.phase < phase || (kill.phase === phase && kill.time <= time)))) return [];
        const holds = roundEvents.filter((event) => event.side === side && event.index === index && event.phase === phase && event.hold);
        if (holds.some((event) => event.time <= time && event.time + event.hold > time)) return [];
        const origin = movement.position(side, index);
        return (ChampionsAbilityCatalog[agent] || []).flatMap(({ name, slot }) => {
          if (phase === 0 && !buySetup.has(name)) return [];
          const kind = slot === "Ultimate" && openingUltimates.has(name) && points[side][index] >= 7
            ? "ultimate" : category.get(name);
          const priority = desired.indexOf(kind);
          if (priority < 0 || (preferred != null && phase === 0 && index !== preferred)) return [];
          if (phase && ["smoke", "wall"].includes(kind) && !smoke) return [];
          if (smoke?.entry && name !== "Cloudburst") return [];
          if (smoke && !smoke.entry && name === "Cloudburst") return [];
          if (kind === "entry" && index !== preferred) return [];
          const history = uses[side].get(`${index}:${name}`) || [];
          const cooldown = recharge[name];
          const refills = cooldown && history.length ? Math.floor((seconds - history[0].seconds) / cooldown) : 0;
          const remaining = unusedCharges[side][index][name] || 0;
          const usedRefills = history.filter((cast) => cast.refilled).length;
          const refilled = refills > usedRefills && remaining < (extraCharges[name] || 1);
          if (kind !== "ultimate" && !remaining && !refilled) return [];
          if (smoke?.reserve) {
            // A default/fake must leave enough cover for the real execute. Count
            // only recharges that will have completed by the planned hit.
            const capacity = extraCharges[name] || 1;
            const futureRefills = cooldown ? Math.floor((smoke.neededBy - (history[0]?.seconds ?? seconds)) / cooldown) : 0;
            const available = Math.min(capacity, remaining - 1 + Math.max(0, futureRefills - usedRefills));
            if (available < smoke.reserve) return [];
          }
          let destination = landing;
          const placement = round.skirmish?.castPreference?.[side === attack ? "attack" : "defense"];
          if (phase === 2 && ["flash", "disrupt", "denial", "recon"].includes(kind)) {
            if (placement === "entry edge") destination = insideEntry;
            if (placement === "connector") destination = link;
          }
          if (smoke) destination = ChampionsSmokes.placement(map, name, smoke.spot, origin, terrain);
          else if (phase === 0) destination = terrain.setup(name, origin, side === defend ? main : lane.staging, usedBy[side][index]);
          else if (name === "Trapwire") {
            destination = terrain.setup(name, origin, landing, usedBy[side][index]);
            if (destination && Math.hypot(destination[0] - landing[0], destination[1] - landing[1]) > 6 * scale) return [];
          }
          else if (kind === "support") destination = origin;
          else if (placedOnGround.has(name)) {
            const snapped = terrain.snap(destination);
            if (!snapped || Math.hypot(snapped[0] - destination[0], snapped[1] - destination[1]) > 3) return [];
            destination = snapped;
          }
          if (!destination) return [];
          if (phase && ["Trapwire", "Spycam", "Arc Rose", "ALARMBOT", "TURRET", "Trademark"].includes(name)
            && !terrain.clear(origin, destination)) return [];
          const device = controlled[name];
          const path = device ? terrain.navigate(origin, destination) : null;
          const distance = Math.hypot(destination[0] - origin[0], destination[1] - origin[1]) / scale;
          const maxRange = ranges[name] ?? (["wall", "ultimate"].includes(kind) ? 85 : kind === "entry" ? 25 : 32);
          const hold = device ? device.seconds / ChampionsTactics.phaseDuration(round, phase) : 0;
          if (device ? (!path.length || pathLength(path) / scale > device.range
            || Math.hypot(path.at(-1)[0] - destination[0], path.at(-1)[1] - destination[1]) > 5
            || time + hold > .94) : distance > maxRange) return [];
          if (device && round.kills.some((kill) => kill.phase === phase && kill.side === side && kill.killer === index
            && kill.time > time && kill.time < time + hold)) return [];
          return [{ side, index, agent, player, name, kind, priority, origin, destination, distance,
            refilled, hold, path }];
        });
      });
      const choice = round.skirmish?.castPreference?.[side === attack ? "attack" : "defense"];
      const cost = (candidate) => candidate.priority + (choice === "nearby" ? candidate.distance / 18
        : choice === "role" && candidate.index === preferred ? -2 : 0);
      candidates.sort((a, b) => cost(a) - cost(b)
        || Number(b.index === preferred) - Number(a.index === preferred)
        || usedBy[side][a.index] - usedBy[side][b.index] || a.distance - b.distance);
      const event = candidates[0];
      if (!event) return;
      const { index, agent, name, kind } = event;
      const key = `${index}:${name}`;
      uses[side].set(key, [...(uses[side].get(key) || []), { seconds, refilled: event.refilled }]);
      usedBy[side][index]++;
      if (kind === "ultimate") points[side][index] = 0;
      else {
        spent[side]++;
        if (!event.refilled) unusedCharges[side][index][name]--;
      }
      const effect = effects[kind];
      const delivery = kind === "entry" ? "move" : event.hold ? "guided"
        : stationary.has(name) || ["trap", "barrier", "support", "ultimate", "wall"].includes(kind) ? "cast"
          : guided.has(name) ? "guided" : "travel";
      const smokeTiming = smoke ? ChampionsSmokes.timing({ ...event, delivery }, seconds) : null;
      roundEvents.push({
        ...event, phase, time, delivery: phase === 0 ? "cast" : delivery, landing: event.destination,
        area, smokeTiming,
        color: ChampionsAbilityGeometry.colors[agent] || effect.color,
        purpose: smoke ? smoke.use : phase === 0 ? "places utility before barriers drop"
          : event.hold ? "holds position and clears nearby angles"
          : name === "Recon Bolt" && event.distance >= 40 ? "fires a long recon lineup"
          : side === defend && ["flash", "disrupt", "denial"].includes(kind)
          ? "stalls the attack" : side === defend && kind === "recon" ? "checks for the attackers"
            : effect.label,
      });
    }

    function queue(side, phase, time, rest) {
      const timing = round.skirmish?.utilityTiming?.[side === attack ? "attack" : "defense"] || 0;
      const adjusted = phase === 0 ? time : Math.max(.02, Math.min(.95, time + timing));
      requests.push({ side, phase, time: adjusted, rest });
    }
    const a = (phase, time, ...rest) => queue(attack, phase, time, rest);
    const d = (phase, time, ...rest) => queue(defend, phase, time, rest);
    function smokeRequests(phase, context) {
      for (const smoke of ChampionsSmokes.uses(map, round, context)) {
        (smoke.attack ? a : d)(phase, smoke.time, kinds(smoke.wall ? "wall" : "smoke"),
          smoke.spot.lip, smoke.spot.name, undefined, smoke);
      }
    }
    function perform(phase) {
      for (const request of requests.filter((item) => item.phase === phase).sort((a, b) => a.time - b.time)) {
        movement.moveTo(phase, request.time, roundEvents);
        if (round.ended) break;
        if (request.setup) {
          const setup = request.setup;
          const alive = !round.kills.some((kill) => kill.side === attack && kill.victim === setup.index
            && (kill.phase < phase || (kill.phase === phase && kill.time <= request.time)));
          const nearAttackers = lines[attack].some((_, index) => !round.kills.some((kill) =>
            kill.side === defend && kill.victim === index
            && (kill.phase < phase || (kill.phase === phase && kill.time <= request.time)))
            && Math.hypot(...movement.position(attack, index).map((value, axis) => value - setup.landing[axis])) <= 7 * scale);
          const smokeTiming = setup.name === "Cyber Cage"
            ? ChampionsSmokes.timing(setup, ChampionsSmokes.now(round, phase, request.time)) : null;
          if (alive && nearAttackers) roundEvents.push({ ...setup, setup, phase, time: request.time, smokeTiming,
            purpose: "activates the setup as attackers reach the choke" });
        } else cast(request.side, phase, request.time, ...request.rest);
      }
      movement.moveTo(phase, 1, roundEvents);
    }
    d(0, .68, kinds("trap", "recon", "smoke", "denial"), lane.target, "defender setup", roles[defend].lurk);
    d(0, .87, kinds("trap", "denial", "smoke", "recon"), lane.target, "defender setup", roles[defend].lurk);
    d(0, .94, kinds("denial", "trap", "smoke"), lane.target, "defender setup", roles[defend].lurk);
    a(0, .82, kinds("trap"), lane.staging, "attacker flank watch", roles[attack].lurk);
    const fast = round.plan === "Rush";
    const midPush = round.defense === "Fight mid";
    const aggressive = round.defense === "Take space" || midPush;
    const earlyFight = aggressive || round.defense === "Delay" || fast;
    a(1, .10, kinds("recon", "clear", "flash"),
      openingTarget, openingName, roles[attack].support);
    d(1, .12, aggressive ? kinds("recon", "clear", "flash") : kinds("trap", "recon"),
      midPush ? layout.mid : main, midPush ? "mid" : `${round.site} main`, roles[defend].support);
    if (earlyFight) {
      d(1, .30, aggressive ? kinds("flash", "disrupt", "clear") : kinds("denial", "barrier"),
        midPush ? layout.mid : launch, midPush ? "mid" : "the first choke");
      d(1, .56, kinds("denial", "disrupt", "barrier"), main, `${round.site} main`);
    }
    if (midHit || round.plan === "Fake") {
      a(1, .35, kinds("flash"), openingTarget, openingName);
      a(1, .62, kinds("clear", "flash", "disrupt"), openingTarget, openingName, roles[attack].support);
    } else if (!fast) {
      a(1, .55, kinds("trap", "clear"), alternate.main, `${round.alternate} main`, roles[attack].lurk);
    }

    smokeRequests(1, "opening");
    smokeRequests(2, "execute");
    d(2, .12, kinds("barrier"), launch, "the entry choke");
    a(2, .27, kinds("recon", "clear"), target, `${round.site} site`, roles[attack].support);
    d(2, .23, kinds("denial", "disrupt", "barrier"), main, `${round.site} main`);
    a(2, .36, kinds("denial", "disrupt"), back, backName);
    a(2, .34, kinds("flash", "disrupt", "support"), insideEntry, "just beyond the entry choke", roles[attack].support);
    d(2, .45, kinds("flash", "disrupt", "denial"), link, linkName);
    if (round.number > 4) a(2, .49, kinds("ultimate"), target, `${round.site} site`);
    a(2, .56, kinds("entry"), target, `${round.site} site`, roles[attack].lead);
    a(2, .76, kinds("clear", "support", "disrupt", "flash"), target, `${round.site} site`);
    d(2, .74, kinds("recon", "trap", "denial"), target, `${round.site} site`);

    perform(0);
    for (const setup of roundEvents.filter((event) => event.phase === 0 && event.side === defend
      && ["Nanoswarm", "Cyber Cage"].includes(event.name))) {
      const closest = Math.min(...[main, link, target].map(([x, y]) =>
        Math.hypot(setup.landing[0] - x, setup.landing[1] - y) / scale));
      if (closest > 10 || round.kills.some((kill) => kill.side === attack && kill.victim === setup.index && kill.phase < 2)) continue;
      requests.push({ side: defend, phase: 2, time: .48, setup });
    }

    perform(1);
    perform(2);
    if (round.planted) {
      const inPlantZone = !round.ended && spike && lines[attack].some((_, index) =>
        !round.kills.some((kill) => kill.side === defend && kill.victim === index && kill.phase <= 2)
        && Math.hypot(...movement.position(attack, index).map((value, axis) => value - spike[axis])) <= 6 * scale
        && (!round.skirmish || [0, 1, 2, 3, 4].every((second) => {
          const progress = 1 - second / ChampionsTactics.phaseDuration(round, 2);
          const { point } = ChampionsMovement.playback(movement.frames[2][attack][index], progress);
          return Math.hypot(point[0] - spike[0], point[1] - spike[1]) <= 3 * scale;
        })));
      if (!inPlantZone) {
        round.planted = false;
        round.postPlant = null;
      }
    }
    if (round.planted && !(round.finish === "save" && round.winner === attack)) {
      smokeRequests(3, "postplant");
      d(3, .10, kinds("recon", "clear"), target, `${round.site} site`, roles[defend].support);
      a(3, .35, kinds("denial", "disrupt"), ChampionsTactics.spikePosition(lane, round), "the spike");
      if (round.number > 4) d(3, .39, kinds("ultimate"), target, `${round.site} site`);
      d(3, .48, kinds("flash", "disrupt", "denial"), target, `${round.site} site`);
      a(3, .56, kinds("flash", "denial"), back, backName);
    }
    perform(3);
    if (round.skirmish && !round.ended) {
      round.ended = { phase: 3, time: 1, reason: round.planted ? "detonation" : "time",
        winner: round.planted ? attack : defend };
    }
    perform(4);
    return { events: roundEvents, kills: round.kills, shots, unusedCharges, tracks: movement.frames, vision: movement.vision,
      stopped: movement.stoppedByPhase, planted: round.planted, ended: round.ended, defuse };
  }

  function planRound(map, agents, original, points, terrain = ChampionsMovement.openTerrain, offset = (point) => point) {
    const layout = ChampionsTactics.layouts[map.name];
    const roles = map.stats.map((lines) => assignments(lines, agents));
    return playbook(map.name, original, layout, ChampionsTactics.lanesFor(map.name, original.site),
      ChampionsTactics.lanesFor(map.name, original.alternate), map.stats, roles, points, terrain, offset);
  }

  return { iconUrl, buyRound, settleRound, planRound };
})();
