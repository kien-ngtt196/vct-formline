const ChampionsMovement = (() => {
  const size = 100;
  const steps = 48;
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const join = (a, b) => same(a.at(-1), b[0]) ? [...a, ...b.slice(1)] : a;

  function terrain(mask) {
    const index = (x, y) => y * size + x;
    const point = (cell) => [cell % size, Math.floor(cell / size)];
    const neighbors = (cell) => [cell - size, cell + size,
      cell % size ? cell - 1 : -1, cell % size < size - 1 ? cell + 1 : -1];
    // Keep the largest connected playable area. Isolated outlines and decorative pixels are excluded.
    const visited = new Uint8Array(mask.length);
    let main = [];
    for (let cell = 0; cell < mask.length; cell++) {
      if (!mask[cell] || visited[cell]) continue;
      const component = [cell];
      visited[cell] = 1;
      for (let head = 0; head < component.length; head++) {
        for (const next of neighbors(component[head])) {
          if (!mask[next] || visited[next]) continue;
          visited[next] = 1;
          component.push(next);
        }
      }
      if (component.length > main.length) main = component;
    }
    const field = new Uint8Array(mask.length);
    for (const cell of main) field[cell] = 1;
    const snapped = new Map();
    function nearest(at) {
      const key = at.join(",");
      if (snapped.has(key)) return snapped.get(key);
      const [x, y] = at;
      const column = Math.round(x);
      const row = Math.round(y);
      const closest = index(column, row);
      if (column >= 0 && row >= 0 && column < size && row < size && field[closest]) return closest;
      let cell = -1;
      let best = Infinity;
      for (const candidate of main) {
        const d = (candidate % size - x) ** 2 + (Math.floor(candidate / size) - y) ** 2;
        if (d < best) { best = d; cell = candidate; }
      }
      snapped.set(key, cell);
      return cell;
    }

    const cache = new Map();
    function navigate(from, to) {
      const start = nearest(from);
      const end = nearest(to);
      if (start < 0 || end < 0) return [];
      const key = start * field.length + end;
      if (cache.has(key)) return cache.get(key);
      const queue = [start];
      const previous = new Int16Array(field.length).fill(-1);
      previous[start] = start;
      for (let head = 0; head < queue.length && previous[end] === -1; head++) {
        for (const cell of neighbors(queue[head])) {
          if (!field[cell] || previous[cell] !== -1) continue;
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
    return { navigate, clear, contains, setup, snap: (at) => { const cell = nearest(at); return cell < 0 ? null : point(cell); }, ready: main.length > 0 };
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

    function start(next) {
      phase = next;
      tick = 0;
      stopped = 0;
      const planter = phase === 2 && [attackRoles.support, attackRoles.lead, 0, 1, 2, 3, 4]
        .find((index) => !dead(round.attack, index, 2, 0));
      for (const [side, team] of tracks.entries()) {
        for (let index = 0; index < 5; index++) {
          const route = ChampionsTactics.movement(map, round, side, index, roles[side]);
          const from = phase ? position(team[index]) : offset(route.spawn, index);
          const planting = phase === 2 && round.planted && side === round.attack && index === planter;
          const to = planting ? ChampionsTactics.spikePosition(ChampionsTactics.lanesFor(map, round.site), round)
            : offset(route.points[phase], index);
          const via = phase === 2 && route.via && offset(route.via, index);
          let cells = via ? join(board.navigate(from, via), board.navigate(via, to)) : board.navigate(from, to);
          if (phase && dead(side, index, phase, 0)) cells = [from];
          const nextCell = cells[1] || from;
          const facing = distance(from, nextCell) ? Math.atan2(nextCell[1] - from[1], nextCell[0] - from[0])
            : team[index]?.facing ?? (side === round.attack ? 0 : Math.PI);
          team[index] = { cells, cursor: 0, carry: 0, samples: [0], headings: [facing], facing, held: false };
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
        return [{ ...event, area }];
      });
    }

    function advance(events) {
      const time = ++tick / steps;
      const living = tracks.map((team, side) => team.map((track, index) => !dead(side, index, phase, time)));
      const obstacles = phase ? activeEffects(events, time) : [];
      const current = tracks.map((team) => team.map(position));
      const screens = obstacles.filter(({ kind }) => ["smoke", "wall", "barrier"].includes(kind)).map(({ area }) => area);
      const seconds = ChampionsSmokes.now(round, phase, time);
      for (const event of events) {
        if (event.kind !== "flash" || event.phase !== phase || flashed.has(event) || time < arrivalTime(event)) continue;
        flashed.add(event);
        for (const [side, team] of current.entries()) {
          if (side === event.side && ["Leer", "Dizzy"].includes(event.name)) continue;
          for (const [index, point] of team.entries()) {
            if (living[side][index] && shotIsClear(board, event.landing, point, screens, 11 * scale)) {
              blindUntil[side][index] = Math.max(blindUntil[side][index], seconds + 2);
            }
          }
        }
      }
      const blinded = blindUntil.map((team) => team.map((until) => seconds < until));
      vision[phase].push({ screens, blinded });
      for (const [side, team] of tracks.entries()) {
        for (const [index, track] of team.entries()) {
          const actions = events.filter((event) => event.phase === phase && event.side === side && event.index === index);
          const channel = actions.some((event) => event.hold && time >= event.time && time < event.time + event.hold);
          const mobility = actions.some((event) => event.delivery === "move" && time >= event.time && time < event.time + .13);
          if (living[side][index] && !channel) {
            const pace = (track.cells.length - 1) / (steps * .86);
            const clearPace = 4.5 * scale * ChampionsTactics.phaseDuration(round, phase) / steps;
            track.carry += Math.max(pace * (mobility ? 1.9 : 1), track.held ? clearPace : 0);
            while (track.carry >= 1 && track.cursor < track.cells.length - 1) {
              const cell = track.cells[track.cursor + 1];
              const here = position(track);
              const opponents = current[1 - side].filter((at, enemy) => phase && living[1 - side][enemy]
                && distance(cell, at) < 7.5 * scale && board.clear(cell, at));
              const contested = opponents.some((at) => {
                const gap = distance(cell, at);
                if (gap >= distance(here, at)) return false;
                if (gap < 1.8 * scale) return true;
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
              const denied = obstacles.some((effect) => effect.side !== side && ["denial", "barrier"].includes(effect.kind)
                && covers(effect.area, cell) && distance(cell, effect.area.center) < distance(here, effect.area.center));
              if (contested || denied) {
                stopped++;
                track.held = true;
                track.carry = 0;
                break;
              }
              track.cursor++;
              track.carry--;
              track.facing = Math.atan2(cell[1] - here[1], cell[0] - here[0]);
              current[side][index] = cell;
            }
          }
          track.samples.push(track.cursor);
        }
      }
      stoppedByPhase[phase] = stopped;
      if (resolveContact && phase > 0 && phase < 4) {
        const canShoot = (side, shooter, victim) => living[side][shooter] && living[1 - side][victim]
          && !blinded[side][shooter]
          && !events.some((event) => event.side === side && event.index === shooter && event.phase === phase
            && event.hold && event.time <= time && time < event.time + event.hold)
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

  function sightCone(board, map, track, frames, side, index, progress) {
    const tick = Math.floor(progress * steps);
    const { point } = playback(track, tick / steps);
    const angle = track.headings[tick];
    const { screens, blinded } = frames[tick];
    const blind = blinded[side][index];
    const range = blind ? 2 : visionRange * ChampionsAbilityGeometry.scaleFor(map);
    const rays = Array.from({ length: 9 }, (_, beam) => {
      const heading = angle + (beam - 4) * Math.PI / 24;
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
  return { terrain, openTerrain, create, playback, shotIsClear, sightCone, arrivalTime, travelTime };
})();
