const ChampionsRadar = (() => {
  const size = 100;
  const step = 1600;
  const phaseCount = ChampionsTactics.phases.length;
  const colors = ["#66e1ea", "#fa857f"];
  const offsets = [[-5, 0], [0, -5], [5, 0], [-3, 5], [3, 5]];
  const iconSkip = "M4 5l10 7-10 7z M18 5v14";
  const iconResult = "M4 19h16M7 15v-4m5 4V8m5 7V5";
  const label = (text, className = "") => {
    const element = document.createElement("span");
    element.className = className;
    element.textContent = text;
    return element;
  };
  const position = (element, [x, y]) => {
    element.style.left = `${x}%`;
    element.style.top = `${y}%`;
  };
  const offset = (point, index, spread = 1) => point.map((value, axis) =>
    value + offsets[index][axis] * spread);
  const mix = (a, b, ratio) => a.map((value, index) => value + (b[index] - value) * ratio);

  function routePlanner(image) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    const walkable = Uint8Array.from({ length: size * size }, (_, index) => pixels[index * 4 + 3] > 92);
    return ChampionsMovement.terrain(walkable);
  }

  function create({ map, teams, order, agents, node, button, addImage, teamIdentity, controlIcon, exit, live }) {
    const layout = ChampionsTactics.layouts[map.name];
    const rounds = [];
    const points = map.stats.map((lines) => lines.map(() => 0));
    const rotation = layout && Math.abs(layout.attack[0] - layout.defense[0]) > Math.abs(layout.attack[1] - layout.defense[1])
      ? Math.sign(layout.attack[0] - layout.defense[0]) : 0;
    const orient = ([x, y]) => rotation === 1 ? [100 - y, x] : rotation === -1 ? [y, 100 - x] : [x, y];
    const placeOnMap = (element, point) => position(element, orient(point));
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const panel = node("section", "sim-radar");
    const heading = node("h3", "", `${map.name} tactical playback`);
    heading.tabIndex = -1;
    const header = node("header", "sim-radar-header");
    header.append(heading, label("Simulated rounds", "sim-muted"));
    const scoreboard = node("div", "sim-radar-scores");
    const center = node("div", "sim-radar-score");
    const score = node("strong");
    const roundLabel = label("");
    const clock = label("", "sim-radar-round-clock");
    center.append(score, roundLabel, clock);
    const teamCards = [];
    for (const side of order) {
      const card = node("div", `sim-radar-side sim-radar-side-${order.indexOf(side)}`);
      const assignment = label("");
      const buy = label("");
      const loadout = label("", "sim-radar-loadout");
      card.append(teamIdentity(teams[side]), assignment, buy, loadout);
      scoreboard.append(card);
      if (side === order[0]) scoreboard.append(center);
      teamCards[side] = { assignment, buy, loadout };
    }

    const body = node("div", "sim-radar-body");
    const commentary = ChampionsCommentary.create({ node, controlIcon });
    const sidebars = node("div", "sim-radar-sidebars");
    const board = node("div", "sim-radar-board");
    board.setAttribute("aria-hidden", "true");
    const boardStatus = node("p", "sim-muted", layout ? "Loading radar…" : "Radar unavailable for this map.");
    boardStatus.setAttribute("role", "status");
    if (layout) boardStatus.prepend(node("span", "sim-spinner"), document.createTextNode(" "));
    const asides = node("div", "sim-radar-detail");
    const plan = node("strong");
    const stage = node("strong", "sim-radar-stage");
    const narrative = node("p");
    const contact = node("p", "sim-muted");
    const alive = node("p", "sim-radar-alive");
    const effects = node("ol", "sim-radar-ability-feed");
    effects.setAttribute("aria-label", "Utility timeline for this phase");
    const feed = node("ol", "sim-radar-feed");
    feed.setAttribute("aria-label", "Eliminations this round");
    asides.append(plan, stage, alive, narrative, contact, effects, feed);
    sidebars.append(asides, commentary.panel);
    const radar = node("img", "sim-radar-image");
    radar.alt = "";
    radar.style.transform = `rotate(${rotation * 90}deg)`;
    const trail = node("canvas", "sim-radar-trail");
    trail.width = trail.height = 400;
    const context = trail.getContext("2d");
    const markers = map.stats.map((lines, side) => lines.map(({ player, agent }) => {
      const marker = node("span", `sim-radar-agent sim-radar-agent-${order.indexOf(side)}`);
      marker.title = `${player.name} · ${agents[agent].name}`;
      marker.append(label(player.name.slice(0, 2).toUpperCase()));
      addImage(marker, agents[agent].image, "", "");
      return marker;
    }));
    const utility = node("div", "sim-radar-utilities");
    const spike = node("span", "sim-radar-spike");
    spike.title = "Planted Spike";
    spike.hidden = true;
    let planner;
    if (layout) {
      radar.addEventListener("load", () => {
        if (disposed) return;
        planner = routePlanner(radar);
        if (!planner.ready) {
          boardStatus.textContent = "Radar routes unavailable for this map.";
          return;
        }
        boardStatus.remove();
        render(playing);
      });
      radar.addEventListener("error", () => { boardStatus.textContent = "Radar image unavailable."; });
      radar.src = `/vct-images/radar/${map.name.toLowerCase()}.png`;
      board.append(radar, trail, boardStatus);
      for (const [site, point] of Object.entries(layout.sites)) {
        const badge = label(site, "sim-radar-site");
        const [x, y] = orient(point);
        position(badge, [x, y - 5]);
        board.append(badge);
      }
      board.append(utility, ...markers.flat(), spike);
      body.append(board, sidebars);
    } else {
      asides.prepend(boardStatus);
      body.append(sidebars);
    }

    const tools = node("div", "sim-radar-controls");
    const timeline = node("input", "sim-radar-timeline");
    timeline.type = "range";
    timeline.min = "0";
    timeline.max = String(map.timeline.length * phaseCount - 1);
    timeline.setAttribute("aria-label", "Round playback timeline");
    const speed = node("select");
    speed.setAttribute("aria-label", "Playback speed");
    for (const rate of [0.5, 1, 2]) speed.append(new Option(`${rate}×`, rate));
    speed.value = "1";
    let playing = !reducedMotion;
    let disposed = false;
    let frame = 0;
    let lastTick;
    let playedMs = 0;
    let animation;
    let paths = [];
    let throws = [];
    let phaseKills = [];
    let phaseShots = [];
    let roundState;
    let earlierCalls = [];
    let phaseCalls = [];
    const toggle = button("", () => {
      if (!playing && frame === Number(timeline.max)) setFrame(0, false);
      playing = !playing;
      setToggle();
      lastTick = undefined;
      cancelAnimationFrame(animation);
      if (playing) animation = requestAnimationFrame(tick);
    });
    function setToggle() {
      const icon = playing ? "M9 5v14M15 5v14" : "M7 4l13 8-13 8z";
      const text = playing ? "Pause" : "Play";
      toggle.replaceChildren(controlIcon(icon), document.createTextNode(text));
    }
    setToggle();
    const skipRound = button("Skip round", () => {
      const next = (Math.floor(frame / phaseCount) + 1) * phaseCount;
      if (next > Number(timeline.max)) finish("result");
      else setFrame(next, playing);
    }, "sim-button", iconSkip);
    tools.append(toggle, speed, timeline, skipRound);
    if (live) tools.append(button("Skip map", () => finish("skip"), "sim-button", iconSkip));
    tools.append(button("Map result", () => finish("result"), "sim-button", iconResult));
    if (live) tools.append(button("Series result", () => finish("series"), "sim-button", iconResult));
    timeline.addEventListener("input", () => {
      playing = false;
      cancelAnimationFrame(animation);
      setToggle();
      setFrame(Number(timeline.value), false);
    });
    panel.append(header, scoreboard, tools, body);

    function setFrame(value, animate) {
      frame = value;
      playedMs = animate ? 0 : playbackDuration();
      lastTick = undefined;
      render(animate);
    }

    const playbackDuration = () => step + throws.length * 140;

    function playbackRound(number) {
      while (rounds.length < number) {
        const round = map.timeline[rounds.length];
        if (round.number === 13) points.forEach((team) => team.fill(0));
        const simulation = ChampionsUtility.planRound(map, agents, round, points, planner, offset);
        rounds.push(simulation);
        for (const { side, killer, victim } of simulation.kills) {
          points[side][killer]++;
          points[1 - side][victim]++;
        }
      }
      return rounds[number - 1];
    }

    function prepareCalls(round, phase, simulation) {
      const input = { round, teams, stats: map.stats, simulation };
      earlierCalls = Array.from({ length: phase }, (_, index) =>
        ChampionsCommentary.calls({ ...input, phase: index })).flat().slice(-5);
      phaseCalls = ChampionsCommentary.calls({ ...input, phase });
    }

    function showCommentary(progress) {
      const currentCalls = phaseCalls.filter((cue) => cue.at <= progress);
      commentary.update([...earlierCalls, ...currentCalls]);
    }

    function render(animate) {
      const round = map.timeline[Math.floor(frame / phaseCount)];
      const phase = frame % phaseCount;
      roundState = { round, phase };
      const finished = phase === phaseCount - 1;
      const scores = finished ? round.score : round.before;
      score.textContent = order.map((side) => scores[side]).join("–");
      roundLabel.textContent = `Round ${round.number} / ${map.timeline.length}`;
      plan.textContent = phase === 0 ? "Buy phase" : round.strategy;
      stage.textContent = finished ? `${teams[round.winner].name} wins the round` : ChampionsTactics.phases[phase];
      narrative.textContent = round.notes[phase];
      timeline.value = String(frame);
      timeline.setAttribute("aria-valuetext", `Round ${round.number}, ${ChampionsTactics.phases[phase]}`);
      for (const side of order) {
        const { assignment, buy, loadout } = teamCards[side];
        assignment.textContent = side === round.attack ? "Attack" : "Defense";
        buy.textContent = `${round.buys[side].label} · ≈${round.buys[side].credits.toLocaleString()} credits/player`;
        const { gun, shield, weaponCost, armorCost, utility: reserve, carried } = round.buys[side];
        loadout.hidden = phase !== 0;
        loadout.textContent = `${gun} (${carried ? "carried" : weaponCost}) · ${shield === "none" ? "no armor" : `${shield} armor (${armorCost})`} · ≈${reserve} for utility`;
      }
      const simulation = planner?.ready ? playbackRound(round.number) : null;
      phaseShots = (simulation?.shots || []).filter((shot) => shot.phase === phase);
      const visibleKills = (simulation?.kills || []).filter((kill) => kill.phase <= phase);
      phaseKills = visibleKills.map((kill) => ({
        ...kill, at: kill.phase < phase ? 0 : kill.time,
        entry: node("li", `sim-radar-kill-${order.indexOf(kill.side)}`, kill.text),
      }));
      effects.replaceChildren();
      utility.replaceChildren();
      if (!simulation) {
        prepareCalls(round, phase);
        place(animate ? 0 : 1);
        return;
      }
      roundState = { phase, round: { ...round, planted: simulation.planted } };
      prepareCalls(round, phase, simulation);
      contact.textContent = simulation.stopped[phase] && phase > 0 && phase < 4
        ? "Players hold at contested angles until they find cover or an opening." : "";
      if (finished && ["hold", "stop", "wipe", "clutch", "defuse"].includes(round.finish)) {
        narrative.textContent = `${teams[round.winner].name} take round ${round.number}.`;
      } else if (phase === 3 && round.finish === "clutch" && simulation.planted) {
        narrative.textContent = `The spike is down on ${round.site}. The defenders look for a retake.`;
      } else if (phase === 3 && round.planted && !simulation.planted) {
        narrative.textContent = "The hit stalls before the Spike can go down.";
      }
      const lane = ChampionsTactics.lanesFor(map.name, round.site);
      const roundEvents = simulation.events;
      const events = roundEvents.filter((event) => event.phase === phase);
      const makeIcon = (event) => {
        const icon = node("img", "sim-radar-ability-icon");
        icon.src = ChampionsUtility.iconUrl(event.agent, event.name);
        icon.alt = "";
        return icon;
      };
      const setup = phase === 1 || phase === 2 ? roundEvents.filter((event) => event.phase === 0
        && !roundEvents.some((trigger) => trigger.setup === event && trigger.phase <= phase)) : [];
      const phaseStart = ChampionsSmokes.now(roundState.round, phase, 0);
      const carriedSmokes = roundEvents.filter((event) => event.phase < phase && event.smokeTiming?.ends > phaseStart);
      throws = [...setup.map((event) => ({ ...event, time: 0, carried: true })), ...carriedSmokes, ...events].map((event) => {
        const { side, kind, landing, color, player, agent, name, area, purpose, delivery, origin } = event;
        const marker = node("span", `sim-radar-utility sim-radar-${kind}`);
        marker.style.setProperty("--ability-color", color);
        marker.append(makeIcon(event));
        utility.append(marker);
        const description = node("li", `sim-radar-kill-${order.indexOf(side)}`);
        const footprint = phase === 0 || event.carried ? null
          : ChampionsAbilityGeometry.footprint(map.name, name, origin, landing);
        const detail = [area, event.smokeTiming && event.phase < phase ? "carried from the previous phase" : purpose,
          footprint?.dimensions, event.refilled ? "recharged" : null,
          event.cost ? `${event.cost} credits` : null].filter(Boolean).join(" · ");
        const copy = node("span");
        copy.append(node("strong", "", `${player.name} · ${name}`), node("small", "", detail));
        description.append(makeIcon(event), copy);
        effects.append(description);
        marker.title = `${agents[agent].name} · ${name} · ${detail}`;
        placeOnMap(marker, footprint?.center || landing);
        const path = event.path || (delivery === "guided" ? planner.navigate(origin, landing) : null);
        return { ...event, marker, path, footprint, description };
      });
      spike.hidden = !simulation.planted || phase !== 3;
      placeOnMap(spike, planner.snap(ChampionsTactics.spikePosition(lane, round)));
      paths = markers.map((sideMarkers, side) => sideMarkers.map((marker, index) => {
        const eliminated = visibleKills.find((kill) => kill.side !== side && kill.victim === index);
        const track = simulation.tracks[phase][side][index];
        const holds = roundEvents.filter((event) => event.phase === phase
          && event.side === side && event.index === index && event.hold);
        marker.hidden = false;
        return { marker, track, holds, vision: simulation.vision[phase], cones: new Map(),
          death: eliminated?.time, priorDeath: eliminated?.phase < phase,
          impact: eliminated?.phase === phase };
      }));
      place(animate && !reducedMotion ? 0 : 1);
    }

    function showKills(progress) {
      const happened = phaseKills.filter(({ at }) => at <= progress);
      const visible = happened.slice(-4).reverse().map(({ entry }) => entry);
      if (visible.length !== feed.children.length || visible[0] !== feed.firstElementChild) {
        feed.replaceChildren(...visible);
      }
      const remaining = order.map((side) => 5 - happened.filter((kill) => kill.side !== side).length);
      const count = `${remaining.join(" vs ")} alive`;
      if (alive.textContent !== count) alive.textContent = count;
    }

    function showClock(progress) {
      const { round, phase } = roundState;
      const duration = ChampionsTactics.phaseDuration(round, phase);
      const remaining = phase === 0 ? duration * (1 - progress)
        : phase === 3 && round.planted ? 45 - duration * progress
          : Math.max(0, 100 - ChampionsTactics.phaseStart(round, phase) - duration * progress);
      const seconds = Math.ceil(remaining);
      const timestamp = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      clock.hidden = phase === 4;
      clock.textContent = `${phase === 0 ? "Buy" : phase === 3 && round.planted ? "Spike" : "Round"} ${timestamp}`;
    }

    function place(progress) {
      showClock(progress);
      showKills(progress);
      showCommentary(progress);
      if (!planner?.ready) return;
      context.clearRect(0, 0, 400, 400);
      context.save();
      context.translate(200, 200);
      context.rotate(rotation * Math.PI / 2);
      context.translate(-200, -200);
      for (const side of order) {
        for (const [index, { track, vision, cones, death, priorDeath }] of paths[side].entries()) {
          if (priorDeath || (death != null && progress >= death)) continue;
          const cell = Math.floor(progress * (vision.length - 1));
          if (!cones.has(cell)) {
            cones.set(cell, ChampionsMovement.sightCone(planner, map.name, track, vision, side, index, progress));
          }
          const { point, rays, blind, angle } = cones.get(cell);
          const [x, y] = ChampionsMovement.playback(track, progress).point.map((value) => value * 4);
          context.beginPath();
          context.moveTo(x, y);
          for (const [rx, ry] of rays) context.lineTo(rx * 4, ry * 4);
          context.closePath();
          context.fillStyle = colors[order.indexOf(side)] + "1c";
          context.fill();
          const blocked = rays.every(([rx, ry]) => Math.hypot(rx - point[0], ry - point[1]) < 3);
          const edges = blind || blocked ? [-1, 1].map((sign) => [
            x + 16 * Math.cos(angle + sign * Math.PI / 6), y + 16 * Math.sin(angle + sign * Math.PI / 6),
          ]) : [rays[0], rays.at(-1)].map(([rx, ry]) => [rx * 4, ry * 4]);
          context.beginPath();
          context.moveTo(...edges[0]);
          context.lineTo(x, y);
          context.lineTo(...edges[1]);
          context.lineWidth = 1.2;
          context.strokeStyle = blind ? "#efd08e" : colors[order.indexOf(side)] + "a8";
          if (blind || blocked) context.setLineDash([2, 3]);
          context.stroke();
          context.setLineDash([]);
        }
      }
      for (const { time: at, origin, impact, side } of phaseShots) {
        if (progress < at || progress > at + .12 || progress === 1) continue;
        context.strokeStyle = colors[order.indexOf(side)];
        context.globalAlpha = 1 - (progress - at) / .12;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(origin[0] * 4, origin[1] * 4);
        context.lineTo(impact[0] * 4, impact[1] * 4);
        context.stroke();
      }
      context.globalAlpha = 1;
      if (roundState.phase === 0) {
        context.lineWidth = 2;
        context.setLineDash([4, 3]);
        for (const { at, toward, attacking } of ChampionsTactics.buyAnchors(map.name)) {
          context.strokeStyle = attacking ? "#92ddfac0" : "#f8a392bb";
          const [dx, dy] = toward.map((point, axis) => point - at[axis]);
          const length = Math.hypot(dx, dy);
          if (!length) continue;
          const [x, y] = at.map((point) => point * 4);
          const [sx, sy] = [-dy / length * 13, dx / length * 13];
          context.beginPath();
          context.moveTo(x - sx, y - sy);
          context.lineTo(x + sx, y + sy);
          context.stroke();
        }
        context.setLineDash([]);
      }
      const seconds = ChampionsSmokes.now(roundState.round, roundState.phase, progress);
      for (const { marker, origin, landing, path, color, time, delivery, kind, footprint, description, hold, carried,
        phase, smokeTiming } of throws) {
        const travelTime = ChampionsMovement.travelTime({ hold, delivery });
        const arrival = ChampionsMovement.arrivalTime({ time, hold, delivery });
        const castTime = ChampionsSmokes.now(roundState.round, phase, time);
        const active = smokeTiming ? seconds >= castTime : progress >= time;
        const lingering = roundState.phase === 0 || carried || ["smoke", "wall", "trap", "barrier"].includes(kind);
        const arrived = smokeTiming ? seconds >= smokeTiming.starts : progress >= arrival;
        const visible = arrived && (smokeTiming ? seconds < smokeTiming.ends
          : lingering || progress < arrival + .27 || progress === 1);
        marker.classList.toggle("is-landing", visible);
        description.classList.toggle("is-pending", !active);
        if (visible && footprint) ChampionsAbilityGeometry.draw(context, footprint, color, kind);
        if (!active || delivery === "cast" || arrived && delivery !== "move") continue;
        if (delivery === "move" && progress > time + .16) continue;
        const fraction = smokeTiming ? Math.min(1, (seconds - castTime) / (smokeTiming.starts - castTime))
          : Math.min(1, (progress - time) / travelTime);
        const [x, y] = path?.length ? path[Math.round(fraction * (path.length - 1))] : mix(origin, landing, fraction);
        context.beginPath();
        context.fillStyle = color;
        context.arc(x * 4, y * 4, 3, 0, Math.PI * 2);
        context.fill();
      }
      for (const side of order) {
        context.strokeStyle = colors[order.indexOf(side)] + "65";
        context.lineWidth = 1.6;
        for (const { marker, track, holds, death, priorDeath, impact } of paths[side]) {
          const eliminated = priorDeath || (death != null && progress >= death);
          const { cell, point } = ChampionsMovement.playback(track, progress);
          const path = track.cells;
          placeOnMap(marker, point);
          marker.classList.toggle("is-controlling", !eliminated && holds.some((action) =>
            action.time <= progress && progress < action.time + action.hold));
          marker.classList.toggle("is-out", eliminated);
          if (eliminated) {
            const fade = 1 - (progress - death) * 4;
            if (impact && fade > 0 && progress < 1) {
              context.beginPath();
              context.fillStyle = `rgba(255, 198, 134, ${fade * 0.75})`;
              context.arc(point[0] * 4, point[1] * 4, 5 + (1 - fade) * 13, 0, Math.PI * 2);
              context.fill();
            }
            continue;
          }
          context.beginPath();
          context.moveTo(path[0][0] * 4, path[0][1] * 4);
          for (let i = 1; i <= cell; i++) context.lineTo(path[i][0] * 4, path[i][1] * 4);
          context.lineTo(point[0] * 4, point[1] * 4);
          context.stroke();
        }
      }
      context.restore();
    }

    function tick(time) {
      if (disposed) return;
      if (panel.getClientRects().length && (!layout || planner || radar.complete)) {
        lastTick ??= time;
        playedMs += (time - lastTick) * Number(speed.value);
        lastTick = time;
        const duration = playbackDuration();
        if (playedMs >= duration) {
          showCommentary(1);
          if (frame === Number(timeline.max)) { finish("result"); return; }
          setFrame(frame + 1, true);
        } else if (reducedMotion) showCommentary(Math.min(1, playedMs / duration));
        else place(Math.min(1, playedMs / duration));
      } else {
        lastTick = undefined;
      }
      animation = requestAnimationFrame(tick);
    }

    function finish(action) {
      dispose();
      exit(action);
    }
    function dispose() {
      disposed = true;
      cancelAnimationFrame(animation);
    }
    render(false);
    if (playing) animation = requestAnimationFrame(tick);
    return { panel, heading, dispose };
  }

  return { create };
})();
