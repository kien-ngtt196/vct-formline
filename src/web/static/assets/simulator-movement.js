const ChampionsMovement = (() => {
  const size = 100;
  const steps = 48;
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const join = (a, b) => same(a.at(-1), b[0]) ? [...a, ...b.slice(1)] : a;

  function terrain(mask, map) {
    const index = (x, y) => y * size + x;
    const point = (cell) => [cell % size, Math.floor(cell / size)];
    const neighbors = (cell) => [cell - size, cell + size,
      cell % size ? cell - 1 : -1, cell % size < size - 1 ? cell + 1 : -1];
    const cover = map ? ChampionsTactics.mapCover[map] || [] : [];
    const insideCover = ([x, y]) => cover.some((vertices) => {
      let inside = false;
      for (let i = 0; i < vertices.length; i++) {
        const [ax, ay] = vertices[i];
        const [bx, by] = vertices[(i + 1) % vertices.length];
        if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
      }
      return inside;
    });
    const playable = cover.length ? Uint8Array.from(mask, (walkable, cell) => walkable && !insideCover(point(cell))) : mask;
    // Keep the largest connected playable area. Isolated outlines and decorative pixels are excluded.
    const visited = new Uint8Array(mask.length);
    let main = [];
    for (let cell = 0; cell < mask.length; cell++) {
      if (!playable[cell] || visited[cell]) continue;
      const component = [cell];
      visited[cell] = 1;
      for (let head = 0; head < component.length; head++) {
        for (const next of neighbors(component[head])) {
          if (!playable[next] || visited[next]) continue;
          visited[next] = 1;
          component.push(next);
        }
      }
      if (component.length > main.length) main = component;
    }
    const field = new Uint8Array(mask.length);
    for (const cell of main) field[cell] = 1;
    const buyZones = new Map();
    const buyBarriers = map ? ChampionsTactics.buyBarriers[map] : null;
    const snapped = new Map();
    function nearest(at, zone = "") {
      const region = buyZones.get(zone);
      const allowed = region?.field || field;
      const key = `${zone}:${at.join(",")}`;
      if (snapped.has(key)) return snapped.get(key);
      const [x, y] = at;
      const column = Math.round(x);
      const row = Math.round(y);
      const closest = index(column, row);
      if (column >= 0 && row >= 0 && column < size && row < size && allowed[closest]) return closest;
      let cell = -1;
      let best = Infinity;
      for (const candidate of region?.cells || main) {
        const d = (candidate % size - x) ** 2 + (Math.floor(candidate / size) - y) ** 2;
        if (d < best) { best = d; cell = candidate; }
      }
      snapped.set(key, cell);
      return cell;
    }

    if (buyBarriers && main.length) {
      const { attack, defense } = buyBarriers;
      const barriers = [...attack, ...defense];
      const touches = ([x, y], [x1, y1, x2, y2], margin = .85) => {
        const dx = x2 - x1, dy = y2 - y1;
        const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
        return Math.hypot(x - x1 - t * dx, y - y1 - t * dy) <= margin;
      };
      const layout = ChampionsTactics.layouts[map];
      const zones = layout.attackAlt ? ["attack", "defense", "attackAlt"] : ["attack", "defense"];
      const starts = zones.map((zone) => nearest(layout[zone]));
      function region(start, allowed, radius = Infinity) {
        const reachable = new Uint8Array(field.length);
        const distances = new Int16Array(field.length).fill(-1);
        const cells = [start];
        reachable[start] = 1;
        distances[start] = 0;
        for (let head = 0; head < cells.length; head++) {
          const cell = cells[head];
          if (distances[cell] >= radius) continue;
          for (const next of neighbors(cell)) {
            if (!allowed[next] || reachable[next]) continue;
            reachable[next] = 1;
            distances[next] = distances[cell] + 1;
            cells.push(next);
          }
        }
        return { field: reachable, cells, distances };
      }
      let regions;
      const leaks = () => regions.some((result, side) => starts.some((start, foe) =>
        (side === 1) !== (foe === 1) && result.field[start]));
      for (const margin of [.85, 1.35, 1.85]) {
        const buyField = Uint8Array.from(field, (walkable, cell) =>
          walkable && !barriers.some((line) => touches(point(cell), line, margin)));
        regions = starts.map((start) => region(start, buyField));
        if (!leaks()) break;
      }
      if (leaks()) {
        // The authored line can end in open floor on the simplified radar.
        // Use the route distance to the nearest own gate as the spawn limit.
        const routes = starts.map((start) => region(start, field));
        for (const [side, zone] of zones.entries()) {
          const route = routes[side];
          const gates = side === 1 ? defense : attack;
          const gate = route.cells.find((cell) => gates.some((line) => touches(point(cell), line)));
          const enemyDistances = starts.filter((_, foe) => (side === 1) !== (foe === 1))
            .map((start) => route.distances[start]);
          const cap = Math.floor((Math.min(...enemyDistances) - 2) / 2);
          const radius = Math.max(0, Math.min(cap, gate == null ? cap : route.distances[gate] - 1));
          const result = region(starts[side], field, radius);
          buyZones.set(zone, result);
        }
      } else {
        zones.forEach((zone, side) => buyZones.set(zone, regions[side]));
      }
    }

    const cache = new Map();
    function navigate(from, to, zone = "") {
      if (!buyZones.has(zone)) zone = "";
      const allowed = buyZones.get(zone)?.field || field;
      const start = nearest(from, zone);
      const end = nearest(to, zone);
      if (start < 0 || end < 0) return [];
      const key = `${zone}:${start * field.length + end}`;
      if (cache.has(key)) return cache.get(key);
      const queue = [start];
      const previous = new Int16Array(field.length).fill(-1);
      previous[start] = start;
      for (let head = 0; head < queue.length && previous[end] === -1; head++) {
        for (const cell of neighbors(queue[head])) {
          if (!allowed[cell] || previous[cell] !== -1) continue;
          previous[cell] = queue[head];
          queue.push(cell);
        }
      }
      const path = [point(start)];
      if (previous[end] !== -1) {
        const rest = [];
        for (let cell = end; cell !== start; cell = previous[cell]) rest.push(point(cell));
        path.push(...rest.reverse());
      }
      cache.set(key, path);
      return path;
    }

    const contains = ([x, y]) => {
      const column = Math.round(x);
      const row = Math.round(y);
      return Boolean(column >= 0 && row >= 0 && column < size && row < size && field[index(column, row)]);
    };
    function clear(a, b) {
      const intervals = Math.ceil(distance(a, b) * 2);
      for (let i = 1; i <= intervals; i++) {
        const sample = a.map((v, axis) => v + (b[axis] - v) * i / intervals);
        if (!contains(sample)) return false;
      }
      return true;
    }
    function setup(name, origin, toward, count) {
      const nearby = [];
      for (let y = origin[1] - 3; y <= origin[1] + 3; y++) {
        for (let x = origin[0] - 3; x <= origin[0] + 3; x++) {
          const cell = [x, y];
          if (contains(cell) && distance(origin, cell) <= 3 && clear(origin, cell)) nearby.push(cell);
        }
      }
      const crossesChoke = (cell) => [[1, 0], [0, 1]].some(([dx, dy]) => [-1, 1].every((side) =>
        [1, 2, 3, 4, 5].some((step) => !contains([cell[0] + dx * side * step, cell[1] + dy * side * step]))));
      const candidates = name === "Trapwire" ? nearby.filter(crossesChoke) : nearby;
      candidates.sort((a, b) => distance(a, toward) - distance(b, toward));
      return candidates[Math.min(count * 3, candidates.length - 1)] || null;
    }
    return { navigate, clear, contains, setup, buyBarriers,
      snap: (at) => { const cell = nearest(at); return cell < 0 ? null : point(cell); }, ready: main.length > 0 };
  }

  const openTerrain = {
    navigate: (a, b) => {
      const length = Math.ceil(distance(a, b));
      return Array.from({ length: length + 1 }, (_, i) => a.map((v, axis) =>
        v + (b[axis] - v) * i / Math.max(1, length)));
    },
    clear: () => true, contains: () => true, snap: (point) => point, setup: (_, point) => point,
  };

  function covers(area, point, margin = 0) {
    const [x, y] = point.map((value, i) => value - area.center[i]);
    if (area.shape === "circle") return Math.hypot(x, y) <= area.radius + margin;
    const c = Math.cos(area.angle);
    const s = Math.sin(area.angle);
    return Math.abs(x * c + y * s) <= area.length / 2 + margin
      && Math.abs(-x * s + y * c) <= (area.width || 1) / 2 + margin;
  }

  function shotIsClear(board, from, to, screens, maxRange) {
    const gap = distance(from, to);
    if (gap > maxRange || !board.clear(from, to)) return false;
    const samples = Math.max(1, Math.ceil(gap * 4));
    for (let index = 0; index <= samples; index++) {
      const point = from.map((value, axis) => value + (to[axis] - value) * index / samples);
      if (screens.some((area) => covers(area, point))) return false;
    }
    return true;
  }

  const travelTime = ({ hold, delivery }) => hold || (delivery === "guided" ? .23 : .16);
  const arrivalTime = (event) => ["travel", "guided"].includes(event.delivery)
    ? Math.min(.98, event.time + travelTime(event)) : event.time;
  const visionRange = 35;
  const sightHalfAngle = Math.PI / 6;
  const angleTo = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]);
  const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  function inSightCone(from, to, facing) {
    return distance(from, to) === 0 || Math.abs(angleDifference(angleTo(from, to), facing)) <= sightHalfAngle + 1e-9;
  }

  function create(map, round, roles, board, offset, resolveContact) {
    const scale = ChampionsAbilityGeometry.scaleFor(map);
    const tracks = [[], []];
    const frames = [];
    const vision = [];
    const blindUntil = tracks.map(() => Array(5).fill(-Infinity));
    const flashed = new Set();
    let phase = -1;
    let tick = 0;
    let stopped = 0;
    const stoppedByPhase = [];

    const dead = (side, index, phase, time) => round.kills.some((kill) =>
      kill.side !== side && kill.victim === index && (kill.phase < phase || (kill.phase === phase && kill.time <= time)));
    const position = (track) => track.cells[track.cursor];
    const attackRoles = roles[round.attack];
    const lane = ChampionsTactics.lanesFor(map, round.site);

    function start(next) {
      phase = next;
      tick = 0;
      stopped = 0;
      const planter = phase === 2 && [attackRoles.support, attackRoles.lead, 0, 1, 2, 3, 4]
        .find((index) => !dead(round.attack, index, 2, 0));
      const defense = 1 - round.attack;
      const defuser = phase === 3 && round.planted && (round.skirmish || round.winner === defense)
        && [roles[defense].lead, roles[defense].support, 0, 1, 2, 3, 4]
          .find((index) => !dead(defense, index, 3, 0));
      for (const [side, team] of tracks.entries()) {
        for (let index = 0; index < 5; index++) {
          const route = ChampionsTactics.movement(map, round, side, index, roles[side]);
          const from = phase ? position(team[index]) : offset(route.spawn, index);
          const planting = phase === 2 && round.planted && side === round.attack && index === planter;
          const defusing = phase === 3 && side === defense && index === defuser;
          const noContact = round.skirmish && phase === 2 && side === defense && !round.kills.length;
          const holdOffSite = noContact && index !== roles[side].lead && index !== roles[side].support
            && index % Object.keys(ChampionsTactics.layouts[map].sites).length
              !== Object.keys(ChampionsTactics.layouts[map].sites).indexOf(round.site);
          const to = holdOffSite ? from : planting || defusing ? ChampionsTactics.spikePosition(ChampionsTactics.lanesFor(map, round.site), round)
            : offset(route.points[phase], index);
          const via = phase === 2 && route.via && offset(route.via, index);
          const buySide = phase === 0 ? (side === round.attack ? route.buyZone || "attack" : "defense") : "";
          let cells = via ? join(board.navigate(from, via), board.navigate(via, to)) : board.navigate(from, to, buySide);
          if (phase === 4 || round.ended || (phase && dead(side, index, phase, 0))) cells = [from];
          const nextCell = cells[1] || from;
          const facing = distance(from, nextCell) ? Math.atan2(nextCell[1] - from[1], nextCell[0] - from[0])
            : team[index]?.facing ?? (side === round.attack ? 0 : Math.PI);
          team[index] = { cells, cursor: 0, carry: 0, samples: [0], headings: [facing], facing, routeFacing: facing, held: false,
            holdOffSite, planting, defusing,
            decisions: round.skirmish?.recordDecisions ? [{ intent: null, state: "Phase start" }] : null };
        }
      }
      frames[phase] = tracks.map((team) => team.slice());
      const previous = vision[phase - 1]?.at(-1);
      vision[phase] = [previous || { screens: [], blinded: tracks.map(() => Array(5).fill(false)) }];
    }

    function activeEffects(events, time) {
      const seconds = ChampionsSmokes.now(round, phase, time);
      return events.flatMap((event) => {
        if (event.phase === 0 || event.phase > phase || !["smoke", "wall", "flash", "disrupt", "denial", "barrier", "ultimate"].includes(event.kind)) return [];
        if (event.smokeTiming) {
          if (seconds < event.smokeTiming.starts || seconds >= event.smokeTiming.ends) return [];
        } else {
          const arrives = arrivalTime(event);
          const persists = ["smoke", "wall", "barrier"].includes(event.kind);
          if (event.phase !== phase) {
            if (!persists || event.phase !== phase - 1 || event.time < .7 || time > .18) return [];
          } else if (time < arrives || !persists && time > arrives + .15) return [];
        }
        const area = ChampionsAbilityGeometry.footprint(map, event.name, event.origin, event.landing)
          || { shape: "circle", center: event.landing, radius: 3 * scale };
        return [{ ...event, cast: event, area }];
      });
    }

    function policyInputs(side, index, time, living, positions, screens) {
      const origin = positions[side][index];
      const track = tracks[side][index];
      const nearby = positions[side].some((point, ally) => ally !== index && living[side][ally]
        && distance(origin, point) <= 12 * scale && board.clear(origin, point));
      const contact = positions[1 - side].some((point, enemy) =>
        living[1 - side][enemy] && inSightCone(origin, point, track.facing)
        && shotIsClear(board, origin, point, screens, visionRange * scale));
      return [1, +(side === round.attack), +(phase === 1), +(phase === 2), +(phase === 3),
        time, +nearby, +contact,
        Math.min(1, (track.cells.length - 1 - track.cursor) / (35 * scale))];
    }


    function advance(events) {
      const time = ++tick / steps;
      if (round.ended) {
        vision[phase].push(vision[phase].at(-1));
        for (const team of tracks) for (const track of team) {
          track.samples.push(track.cursor);
          track.headings.push(track.facing);
          track.decisions?.push({ intent: null, state: "Round ended" });
        }
        return;
      }
      const living = tracks.map((team, side) => team.map((track, index) => !dead(side, index, phase, time)));
      const obstacles = phase ? activeEffects(events, time) : [];
      const current = tracks.map((team) => team.map(position));
      const screens = obstacles.filter(({ kind }) => ["smoke", "wall", "barrier"].includes(kind)).map(({ area }) => area);
      const seconds = ChampionsSmokes.now(round, phase, time);
      for (const event of events) {
        if (round.skirmish && ["Recon Bolt", "Haunt"].includes(event.name) && event.phase === phase
          && event.enemiesInScan == null && time >= arrivalTime(event)) {
          const area = ChampionsAbilityGeometry.footprint(map, event.name, event.origin, event.landing);
          event.enemiesInScan = current[1 - event.side].filter((point, slot) => living[1 - event.side][slot]
            && area && covers(area, point) && board.clear(event.landing, point)).length;
        }
        if (event.kind !== "flash" || event.phase !== phase || flashed.has(event) || time < arrivalTime(event)) continue;
        flashed.add(event);
        for (const [side, team] of current.entries()) {
          if (side === event.side && ["Leer", "Dizzy"].includes(event.name)) continue;
          for (const [index, point] of team.entries()) {
            if (living[side][index] && shotIsClear(board, event.landing, point, screens, 11 * scale)) {
              if (round.skirmish && blindUntil[side][index] <= seconds) {
                const field = side === event.side ? "alliesBlinded" : "enemiesBlinded";
                event[field] = (event[field] || 0) + 1;
              }
              blindUntil[side][index] = Math.max(blindUntil[side][index], seconds + 2);
            }
          }
        }
      }
      const blinded = blindUntil.map((team) => team.map((until) => seconds < until));
      vision[phase].push({ screens, blinded });
      const observedPositions = round.skirmish?.policies ? current.map((team) => [...team]) : current;
      const survivors = living.map((team) => team.filter(Boolean).length);
      const secondsLeft = (1 - time) * ChampionsTactics.phaseDuration(round, phase);
      for (const [side, team] of tracks.entries()) {
        for (const [index, track] of team.entries()) {
          const actions = events.filter((event) => event.phase === phase && event.side === side && event.index === index);
          const channel = actions.some((event) => event.hold && time >= event.time && time < event.time + event.hold);
          const mobility = actions.some((event) => event.delivery === "move" && time >= event.time && time < event.time + .13);
          const defusing = phase === 3 && side !== round.attack && index === round.defusing;
          const before = track.cursor;
          let intent = null;
          let state = !living[side][index] ? "Eliminated" : channel ? "Guiding utility"
            : defusing ? "Defusing" : "Holding position";
          if (living[side][index] && !channel && !defusing) {
            let objective;
            if (round.skirmish && phase >= 2 && phase < 4) {
              const attacking = side === round.attack;
              const spawn = ChampionsTactics.layouts[map][attacking ? "attack" : "defense"];
              const spike = ChampionsTactics.spikePosition(lane, round);
              const enemy = 1 - side;
              const rifle = ["Vandal", "Phantom"].includes(round.buys?.[side]?.players[index]?.gun);
              const carriesNextRound = round.number !== 12 && round.number < 24
                && !(round.before?.[enemy] >= 12 && round.before[enemy] > round.before[side]);
              const losingNumbers = survivors[enemy] >= survivors[side] + 2 && survivors[side] <= 2;
              const needsWinNow = attacking !== Boolean(round.planted);
              if (!track.saving && phase === 3 && needsWinNow && rifle && carriesNextRound && losingNumbers && secondsLeft <= 18) {
                const runSeconds = (board.navigate(position(track), spike).length - 1) / (4.5 * scale);
                const canDefuseNow = !attacking && secondsLeft >= 7 && distance(position(track), spike) <= 2.5 * scale;
                track.saving = !canDefuseNow && (secondsLeft <= runSeconds + (attacking ? 5 : 10)
                  || survivors[enemy] >= survivors[side] + 3);
              }
              if (track.saving) {
                objective = "Saving rifle";
              } else if (phase === 2 && track.holdOffSite && (round.kills.length || time >= .45)) {
                objective = "Rotating to support";
              } else if (phase === 2 && attacking && time >= .56) {
                objective = "Supporting the plant";
              } else if (phase === 3 && !attacking && round.planted) {
                objective = "Retaking the site";
              } else if (phase === 3 && attacking && !round.planted) {
                objective = "Clearing the site";
              }
              if (objective && track.objective !== objective) {
                const target = objective === "Saving rifle" ? spawn
                  : phase === 2 && !attacking ? (index % 2 ? lane.link : lane.back)
                    : objective === "Clearing the site" ? lane.target
                      : track.planting || track.defusing || phase === 3 && secondsLeft < 15 ? spike
                        : offset(spike.map((value, axis) => (value * 3 + (index % 2 ? lane.link : lane.back)[axis]) / 4), index);
                track.cells = join(track.cells.slice(0, track.cursor + 1), board.navigate(position(track), target));
                track.objective = objective;
              }
              if (objective) state = objective;
            }
            const pace = (track.cells.length - 1) / (steps * .86);
            const clearPace = 4.5 * scale * ChampionsTactics.phaseDuration(round, phase) / steps;
            const policy = phase > 0 && phase < 4 ? round.skirmish?.policies?.[side]?.[index] : null;
            const learnedPace = policy && track.cursor < track.cells.length - 1
              ? SkirmishPolicy.pace(policy, policyInputs(side, index, time, living, observedPositions, screens))
              : 1;
            const factor = objective ? Math.max(1, learnedPace) : learnedPace;
            if (track.cursor < track.cells.length - 1) {
              intent = factor === 0 ? "Hold" : factor > 1 ? "Hurry" : "Advance";
            }
            track.carry += Math.max(pace * (mobility ? 1.9 : 1), track.held ? clearPace : 0,
              objective ? clearPace : 0) * factor;
            while (track.carry >= 1 && track.cursor < track.cells.length - 1) {
              const cell = track.cells[track.cursor + 1];
              const here = position(track);
              const opponents = current[1 - side].filter((at, enemy) => phase && living[1 - side][enemy]
                && distance(cell, at) < 7.5 * scale && board.clear(cell, at));
              const contested = opponents.some((at) => {
                const gap = distance(cell, at);
                if (gap >= distance(here, at)) return false;
                if (gap < 1.8 * scale) return true;
                if (objective || round.skirmish && observedPositions[side].some((ally, slot) =>
                  slot !== index && living[side][slot] && distance(here, ally) < 8 * scale && board.clear(here, ally))) return false;
                return !obstacles.some((effect) => {
                  if (effect.side !== side) return false;
                  if (["smoke", "wall"].includes(effect.kind)) {
                    const middle = cell.map((v, axis) => (v + at[axis]) / 2);
                    return [cell, at, middle].some((point) => covers(effect.area, point, .35));
                  }
                  if (effect.kind === "flash" && distance(effect.landing, at) <= 11 * scale
                    && board.clear(effect.landing, at)) return true;
                  return covers(effect.area, at, 1.4 * scale);
                });
              });
              const denied = obstacles.find((effect) => effect.side !== side && ["denial", "barrier"].includes(effect.kind)
                && covers(effect.area, cell) && distance(cell, effect.area.center) < distance(here, effect.area.center));
              if (denied && !contested && round.skirmish) {
                denied.cast.blockedMovementTicks = (denied.cast.blockedMovementTicks || 0) + 1;
              }
              if (contested || denied) {
                state = contested ? "Enemy contesting route" : "Utility blocking route";
                stopped++;
                track.held = true;
                track.carry = 0;
                break;
              }
              track.cursor++;
              track.carry--;
              track.facing = Math.atan2(cell[1] - here[1], cell[0] - here[0]);
              track.routeFacing = track.facing;
              current[side][index] = cell;
            }
          }
          if (round.skirmish && phase > 0 && phase < 4 && living[side][index]
            && !defusing && before === track.cursor) {
            const here = position(track);
            const next = track.cells[track.cursor + 1];
            const approach = side === round.attack ? (index % 2 ? lane.link : lane.back) : (index % 2 ? lane.link : lane.main);
            const holdAngle = track.saving ? track.routeFacing
              : board.clear(here, approach) && distance(here, approach) > 2 * scale ? angleTo(here, approach) : track.routeFacing;
            const turn = angleDifference(next ? angleTo(here, next) : holdAngle, track.facing);
            track.facing += Math.max(-sightHalfAngle / 2, Math.min(sightHalfAngle / 2, turn));
          }
          track.samples.push(track.cursor);
          if (track.decisions) {
            track.decisions.push({ intent, state, cellsMoved: track.cursor - before });
          }
        }
      }
      stoppedByPhase[phase] = stopped;
      if (resolveContact && phase > 0 && phase < 4) {
        const canShoot = (side, shooter, victim) => living[side][shooter] && living[1 - side][victim]
          && !blinded[side][shooter]
          && !events.some((event) => event.side === side && event.index === shooter && event.phase === phase
            && event.hold && event.time <= time && time < event.time + event.hold)
          && (!round.skirmish || inSightCone(current[side][shooter], current[1 - side][victim], tracks[side][shooter].facing))
          && shotIsClear(board, current[side][shooter], current[1 - side][victim], screens, visionRange * scale);
        const shot = resolveContact(phase, time, current, canShoot);
        if (shot) {
          const { side, killer, origin, impact } = shot;
          tracks[side][killer].facing = Math.atan2(impact[1] - origin[1], impact[0] - origin[0]);
        }
      }
      for (const team of tracks) for (const track of team) track.headings.push(track.facing);
    }

    function moveTo(next, time, events) {
      while (phase < next) {
        if (phase >= 0) while (tick < steps) advance(events);
        start(phase + 1);
      }
      while (tick < Math.floor(time * steps)) advance(events);
    }

    return { moveTo, position: (side, index) => position(tracks[side][index]), frames, vision, stoppedByPhase };
  }

  const tickAt = (progress) => Math.min(steps, Math.max(0, Math.floor(progress * steps + 1e-9)));

  function sightCone(board, map, track, frames, side, index, progress) {
    const tick = tickAt(progress);
    const { point } = recordedPosition(track, progress);
    const angle = track.headings[tick];
    const { screens, blinded } = frames[tick];
    const blind = blinded[side][index];
    const range = blind ? 2 : visionRange * ChampionsAbilityGeometry.scaleFor(map);
    const halfBeams = ChampionsTactics.mapCover[map]?.length ? 16 : 4;
    const rays = Array.from({ length: 2 * halfBeams + 1 }, (_, beam) => {
      const heading = angle + (beam - halfBeams) * sightHalfAngle / halfBeams;
      let endpoint = point;
      for (let reach = .5; reach <= range; reach += .5) {
        const sample = [point[0] + Math.cos(heading) * reach, point[1] + Math.sin(heading) * reach];
        if (!board.contains(sample) || screens.some((area) => covers(area, sample))) break;
        endpoint = sample;
      }
      return endpoint;
    });
    return { point, rays, blind, angle };
  }

  function recordedPosition(track, progress) {
    const tick = tickAt(progress);
    const cell = track.samples[tick];
    return { tick, cell, point: track.cells[cell], decision: track.decisions?.[tick] };
  }

  function playback(track, time) {
    const frame = time * steps;
    const tick = Math.floor(frame);
    const start = track.samples[tick];
    const end = track.samples[Math.min(steps, tick + 1)];
    const position = start + (end - start) * (frame - tick);
    const cell = Math.floor(position);
    const from = track.cells[cell];
    const to = track.cells[Math.min(track.cells.length - 1, cell + 1)];
    return { cell, point: from.map((value, i) => value + (to[i] - value) * (position - cell)) };
  }
  return { terrain, openTerrain, create, playback, recordedPosition, tickAt, steps, shotIsClear, inSightCone,
    sightCone, arrivalTime, travelTime };
})();
