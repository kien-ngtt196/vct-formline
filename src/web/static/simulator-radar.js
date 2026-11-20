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
  const shieldNames = { light: "Light armor", regen: "Regen shield", heavy: "Heavy armor" };

  function loadoutItem(icon, text, description, kind) {
    const item = label("", `lab-gear-item lab-gear-${kind}`);
    item.title = description;
    if (icon) {
      const image = document.createElement("img");
      image.src = `/vct-images/radar/loadout/${icon}.png`;
      image.alt = "";
      image.addEventListener("error", () => image.remove(), { once: true });
      item.append(image);
    }
    item.append(label(text));
    return item;
  }

  function routePlanner(image, map) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    const walkable = Uint8Array.from({ length: size * size }, (_, index) => {
      const pixel = index * 4;
      const [r, g, b, alpha] = pixels.subarray(pixel, pixel + 4);
      return alpha > 92 && (map !== "Bind" || Math.max(r, g, b) - Math.min(r, g, b) < 70);
    });
    return ChampionsMovement.terrain(walkable, map);
  }

  function create({ map, teams, order, agents, node, button, addImage, teamIdentity, controlIcon, exit, live }) {
    const layout = ChampionsTactics.layouts[map.name];
    const rounds = map.replays?.slice() || [];
    const points = map.stats.map((lines) => lines.map(() => 0));
    const rotation = layout && Math.abs(layout.attack[0] - layout.defense[0]) > Math.abs(layout.attack[1] - layout.defense[1])
      ? Math.sign(layout.attack[0] - layout.defense[0]) : 0;
    const orient = ([x, y]) => rotation === 1 ? [100 - y, x] : rotation === -1 ? [y, 100 - x] : [x, y];
    const placeOnMap = (element, point) => position(element, orient(point));
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const labHud = Boolean(map.replays);
    const panel = node("section", labHud ? "sim-radar lab-playback" : "sim-radar");
    const heading = node("h3", "", `${map.name} tactical playback`);
    heading.tabIndex = -1;
    const header = node("header", "sim-radar-header");
    header.append(heading, label("Simulated rounds", "sim-muted"));
    const scoreboard = node("div", "sim-radar-scores");
    const center = node("div", "sim-radar-score");
    const score = node("strong");
    const roundLabel = label("");
    const clock = label("", "sim-radar-round-clock");
    const spikeStatus = label("", "lab-spike-status");
    if (labHud) center.append(roundLabel, clock, spikeStatus);
    else center.append(score, roundLabel, clock);
    const teamCards = [];
    for (const side of order) {
      const card = node("div", `sim-radar-side sim-radar-side-${order.indexOf(side)}`);
      const assignment = label("");
      const buy = label("");
      const loadout = label("", "sim-radar-loadout");
      const teamScore = node("strong", "lab-team-score");
      card.append(teamIdentity(teams[side]), assignment, buy, ...(labHud ? [teamScore] : [loadout]));
      scoreboard.append(card);
      if (side === order[0]) scoreboard.append(center);
      teamCards[side] = { assignment, buy, loadout, teamScore };
    }

    const body = node("div", "sim-radar-body");
    const commentary = ChampionsCommentary.create({ node, controlIcon });
    const rosterRows = [];
    if (labHud) for (const [column, side] of order.entries()) {
      const roster = node("aside", `lab-roster lab-roster-${column}`);
      roster.append(node("h4", "", teams[side].name));
      rosterRows[side] = map.stats[side].map(({ player, agent }, index) => {
        const entry = agents[map.draft?.[side]?.[index] || agent];
        const row = node("div", "lab-roster-player");
        if (entry.image) addImage(row, entry.image, "lab-roster-portrait", entry.name);
        const info = node("div", "lab-roster-info");
        const equipment = label("", "lab-roster-equipment");
        const kit = node("div", "lab-roster-kit");
        const state = label("", "lab-roster-state");
        const name = map.setup ? player.name : entry.image ? entry.name : player.name;
        info.append(node("strong", "", name), equipment, kit, state);
        row.append(info);
        roster.append(row);
        return { row, equipment, kit, state };
      });
      body.append(roster);
    }
    const board = node("div", "sim-radar-board");
    board.setAttribute("aria-hidden", "true");
    const boardStatus = node("p", "sim-muted", layout ? "Loading radar…" : "Radar unavailable for this map.");
    boardStatus.setAttribute("role", "status");
    if (layout) boardStatus.prepend(node("span", "sim-spinner"), document.createTextNode(" "));
    const radar = node("img", "sim-radar-image");
    radar.alt = "";
    radar.style.transform = `rotate(${rotation * 90}deg)`;
    const trail = node("canvas", "sim-radar-trail");
    trail.width = trail.height = 400;
    const context = trail.getContext("2d");
    const markers = map.stats.map((lines, side) => lines.map(({ player, agent }, index) => {
      const marker = node("span", `sim-radar-agent sim-radar-agent-${order.indexOf(side)}`);
      const portrait = agents[map.draft?.[side]?.[index] || agent];
      marker.title = `${player.name} · ${portrait.name}`;
      if (!map.draft) marker.append(label(map.replays ? String(index + 1) : player.name.slice(0, 2).toUpperCase()));
      if (portrait.image) addImage(marker, portrait.image, "", "");
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
        planner = map.terrain || routePlanner(radar, map.name === "Sunset" ? map.name : undefined);
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
        const siteLabel = label(site, "sim-radar-site");
        placeOnMap(siteLabel, point);
        board.append(siteLabel);
      }
      board.append(utility, ...markers.flat(), spike);
      body.append(board);
    } else {
      body.append(boardStatus);
    }
    body.append(commentary.panel);

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
    let phaseShots = [];
    let phaseCasts = [];
    let roundState;
    let earlierCalls = [];
    let phaseCalls = [];
    let lastProgress = 0;
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
    function pausePlayback() {
      playing = false;
      cancelAnimationFrame(animation);
      setToggle();
    }
    timeline.addEventListener("input", () => {
      pausePlayback();
      setFrame(Number(timeline.value), false);
    });
    panel.append(header, scoreboard, tools);
    const inspector = map.replays ? node("details", "sim-radar-inspector") : null;
    const inspectBot = inspector && node("select");
    const inspectTick = inspector && node("input");
    const decision = inspector && node("p", "sim-muted");
    if (inspector) {
      inspectBot.setAttribute("aria-label", "Bot to inspect");
      for (const side of order) {
        map.stats[side].forEach(({ player }, index) => inspectBot.add(
          new Option(`${teams[side].name} ${index + 1} · ${player.name}`, `${side}:${index}`)));
      }
      inspectTick.type = "range";
      inspectTick.min = "0";
      inspectTick.max = String(ChampionsMovement.steps);
      inspectTick.setAttribute("aria-label", "Recorded tick in this phase");
      const row = node("div", "sim-radar-inspector-controls");
      row.append(inspectBot, inspectTick);
      inspector.append(node("summary", "", "Inspect recorded bot decisions"), row, decision);
      inspectBot.addEventListener("change", () => place(lastProgress));
      inspector.addEventListener("toggle", () => { if (inspector.open) pausePlayback(); place(lastProgress); });
      inspectTick.addEventListener("input", () => {
        pausePlayback();
        const progress = Number(inspectTick.value) / ChampionsMovement.steps;
        playedMs = progress * playbackDuration();
        place(progress);
      });
      panel.append(inspector);
    }
    panel.append(body);

    function setFrame(value, animate) {
      frame = value;
      playedMs = animate ? 0 : playbackDuration();
      lastTick = undefined;
      render(animate);
    }

    const playbackDuration = () => step + throws.length * 140;

    function playbackRound(number) {
      while (rounds.length < number) {
        const base = map.timeline[rounds.length];
        const buys = ChampionsUtility.buyRound(map.stats, base, rounds.at(-1)?.economy);
        const round = { ...base, buys };
        if (round.number === 13 || round.number > 24) points.forEach((team) => team.fill(round.number > 24 ? 4 : 0));
        const simulation = ChampionsUtility.planRound(map, agents, round, points, planner, offset);
        rounds.push({ ...simulation, buys, economy: ChampionsUtility.settleRound(round, buys, simulation) });
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
        ChampionsCommentary.calls({ ...input, phase: index }).filter((cue) =>
          !simulation.ended || index < simulation.ended.phase
          || (index === simulation.ended.phase && cue.at <= simulation.ended.time))).flat().slice(-5);
      phaseCalls = ChampionsCommentary.calls({ ...input, phase });
    }

    function showCommentary(progress) {
      const currentCalls = phaseCalls.filter((cue) => cue.at <= progress);
      commentary.update([...earlierCalls, ...currentCalls]);
    }

    function render(animate) {
      const round = map.timeline[Math.floor(frame / phaseCount)];
      const phase = frame % phaseCount;
      const simulation = planner?.ready ? playbackRound(round.number) : null;
      if (simulation?.ended && phase > simulation.ended.phase && phase < phaseCount - 1) {
        frame += phaseCount - 1 - phase;
        render(animate);
        return;
      }
      roundState = { round, phase, ended: simulation?.ended };
      const finished = phase === phaseCount - 1;
      const scores = finished ? round.score : round.before;
      score.textContent = order.map((side) => scores[side]).join("–");
      roundLabel.textContent = `Round ${round.number} / ${map.timeline.length}`;
      timeline.value = String(frame);
      timeline.setAttribute("aria-valuetext", `Round ${round.number}, ${ChampionsTactics.phases[phase]}`);
      for (const side of order) {
        const { assignment, buy, loadout, teamScore } = teamCards[side];
        teamScore.textContent = String(scores[side]);
        assignment.textContent = side === round.attack ? "Attack" : "Defense";
        const purchase = simulation?.buys[side];
        buy.textContent = purchase ? `${purchase.label} · ≈${purchase.credits.toLocaleString()} credits/player` : "";
        rosterRows[side]?.forEach(({ equipment, kit }, index) => {
          const gear = purchase?.players[index];
          equipment.replaceChildren();
          kit.replaceChildren();
          if (!gear) return;
          for (const [name, count] of Object.entries(gear.charges || {})) {
            if (!count) continue;
            const img = node("img");
            img.src = ChampionsUtility.iconUrl(map.stats[side][index].agent, name);
            img.alt = img.title = name + " � " + count + " at round start";
            kit.append(img);
          }
          const shield = shieldNames[gear.shield];
          const balance = (gear.credits - gear.spent).toLocaleString();
          equipment.append(
            loadoutItem(gear.gun.toLowerCase(), gear.gun, gear.gun, "weapon"),
            loadoutItem(shield ? `shield-${gear.shield}` : null, shield || "Unarmored", shield || "Unarmored", "shield"),
            loadoutItem("credits", `${balance} cr`, `${balance} credits after purchase`, "credits"),
          );
        });
        loadout.hidden = phase !== 0 || !purchase;
        if (purchase && phase === 0) {
          const weapons = new Map();
          for (const { gun } of purchase.players) weapons.set(gun, (weapons.get(gun) || 0) + 1);
          const saved = purchase.players.filter(({ carried }) => carried).length;
          const charges = purchase.players.reduce((total, player) => total + player.carriedCharges, 0);
          loadout.textContent = [
            ...Array.from(weapons, ([gun, count]) => `${count}× ${gun}`),
            saved ? `${saved} saved ${saved === 1 ? "weapon" : "weapons"}` : null,
            charges ? `${charges} carried utility ${charges === 1 ? "charge" : "charges"}` : null,
          ].filter(Boolean).join(" · ");
        }
      }
      phaseShots = (simulation?.shots || []).filter((shot) => shot.phase === phase);
      phaseCasts = (simulation?.events || []).filter((event) => event.phase === phase && !event.setup);
      if (!map.replays && finished && simulation?.ended?.reason === "elimination") {
        phaseShots = [{ ...simulation.shots.at(-1), time: 0 }];
      }
      const visibleKills = (simulation?.kills || []).filter((kill) => kill.phase <= phase);
      utility.replaceChildren();
      if (!simulation) {
        earlierCalls = [];
        phaseCalls = [];
        place(animate ? 0 : 1);
        return;
      }
      roundState.round = { ...round, planted: simulation.planted };
      prepareCalls({ ...round, buys: simulation.buys }, phase, simulation);
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
        const outline = colors[order.indexOf(side)];
        marker.style.setProperty("--ability-outline", outline);
        marker.append(makeIcon(event));
        utility.append(marker);
        const footprint = phase === 0 || event.carried ? null
          : ChampionsAbilityGeometry.footprint(map.name, name, origin, landing);
        const detail = [area, event.smokeTiming && event.phase < phase ? "carried from the previous phase" : purpose,
          footprint?.dimensions, event.refilled ? "recharged" : null].filter(Boolean).join(" · ");
        marker.title = `${player.name} · ${agents[agent].name} · ${name} · ${detail}`;
        placeOnMap(marker, footprint?.center || landing);
        const path = event.path || (!map.replays && delivery === "guided" ? planner.navigate(origin, landing) : null);
        return { ...event, marker, path, footprint, outline };
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

    function showClock(progress) {
      const { round, phase } = roundState;
      const duration = ChampionsTactics.phaseDuration(round, phase);
      const remaining = phase === 0 ? duration * (1 - progress)
        : phase === 3 && round.planted ? 45 - duration * progress
          : Math.max(0, 100 - ChampionsTactics.phaseStart(round, phase) - duration * progress);
      const seconds = Math.ceil(remaining);
      const timestamp = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      clock.hidden = phase === 4;
      const planted = phase === 3 && round.planted;
      clock.textContent = labHud ? timestamp : `${phase === 0 ? "Buy" : planted ? "Spike" : "Round"} ${timestamp}`;
      if (labHud) {
        spikeStatus.classList.toggle("is-planted", planted);
        spikeStatus.textContent = phase === 4 ? "Round complete" : planted ? `Spike planted · ${round.site}`
          : phase === 0 ? "Buy phase" : "Round clock";
      }
    }

    function place(progress) {
      if (roundState.ended?.phase === roundState.phase) progress = Math.min(progress, roundState.ended.time);
      lastProgress = progress;
      const tick = ChampionsMovement.tickAt(progress);
      const positionAt = inspector?.open ? ChampionsMovement.recordedPosition : ChampionsMovement.playback;
      if (inspector?.open && planner?.ready) {
        const [side, index] = inspectBot.value.split(":").map(Number);
        const selected = paths[side]?.[index];
        if (selected) {
          const { decision: action } = ChampionsMovement.recordedPosition(selected.track, progress);
          const eliminated = selected.priorDeath || (selected.death != null && progress >= selected.death);
          const state = eliminated ? "Eliminated" : action?.cellsMoved && action.state === "Holding position"
            ? `Moved ${action.cellsMoved} ${action.cellsMoved === 1 ? "cell" : "cells"}` : action?.state;
          const cast = phaseCasts.findLast((event) => event.side === side && event.index === index && event.time <= progress);
          const text = [ChampionsTactics.phases[roundState.phase], `Tick ${tick}`,
            action?.intent ? `Intent: ${action.intent}` : null, state,
            cast ? `Latest cast: ${cast.name} · ${cast.area}` : null].filter(Boolean).join(" · ");
          if (decision.textContent !== text) decision.textContent = text;
        }
        inspectTick.max = String(roundState.ended?.phase === roundState.phase
          ? ChampionsMovement.tickAt(roundState.ended.time) : ChampionsMovement.steps);
        inspectTick.value = String(tick);
        inspectTick.setAttribute("aria-valuetext", `Tick ${tick} of ${inspectTick.max}`);
      }
      showClock(progress);
      showCommentary(progress);
      if (labHud) for (const side of order) {
        rosterRows[side].forEach(({ row, state }, index) => {
          const path = paths[side]?.[index];
          const out = path?.priorDeath || (path?.death != null && progress >= path.death);
          const action = path?.track.decisions?.[tick]?.state;
          row.classList.toggle("is-out", Boolean(out));
          const cast = phaseCasts.findLast(event => event.side === side && event.index === index
            && event.time <= progress && progress - event.time < .12);
          state.textContent = out ? "Eliminated" : cast?.name || (action === "Saving rifle" ? action : "");
          row.classList.toggle("is-casting", Boolean(cast && !out));
          state.title = cast && !out ? cast.purpose : "";
        });
      }
      if (!planner?.ready) return;
      context.clearRect(0, 0, 400, 400);
      context.save();
      context.translate(200, 200);
      context.rotate(rotation * Math.PI / 2);
      context.translate(-200, -200);
      for (const side of order) {
        for (const [index, { track, vision, cones, death, priorDeath }] of paths[side].entries()) {
          if (priorDeath || (death != null && progress >= death)) continue;
          const cell = tick;
          if (!cones.has(cell)) {
            cones.set(cell, ChampionsMovement.sightCone(planner, map.name, track, vision, side, index, progress));
          }
          const { rays, blind } = cones.get(cell);
          const [x, y] = positionAt(track, progress).point.map((value) => value * 4);
          context.beginPath();
          context.moveTo(x, y);
          for (const [rx, ry] of rays) context.lineTo(rx * 4, ry * 4);
          context.closePath();
          context.fillStyle = blind ? "#efd08e33" : colors[order.indexOf(side)] + "1c";
          context.fill();
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
        const { attack, defense } = planner.buyBarriers || ChampionsTactics.buyBarriers[map.name];
        for (const [side, segments] of [[roundState.round.attack, attack], [1 - roundState.round.attack, defense]]) {
          context.strokeStyle = colors[map.setup || !map.replays ? order.indexOf(side) : Number(side === roundState.round.attack)];
          for (const [x1, y1, x2, y2] of segments) {
            context.beginPath();
            context.moveTo(x1 * 4, y1 * 4);
            context.lineTo(x2 * 4, y2 * 4);
            context.stroke();
          }
        }
        context.setLineDash([]);
      }
      const seconds = ChampionsSmokes.now(roundState.round, roundState.phase, progress);
      for (const { marker, origin, landing, path, color, time, delivery, kind, footprint, outline, hold, carried,
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
        if (visible && footprint) ChampionsAbilityGeometry.draw(context, footprint, color, kind, outline);
        if (!active || delivery === "cast" || arrived && delivery !== "move") continue;
        if (inspector?.open && !path) continue;
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
          const { cell, point } = positionAt(track, progress);
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
        const end = roundState.ended?.phase === roundState.phase ? roundState.ended.time : null;
        if (end != null && playedMs >= duration * end) {
          setFrame(frame + phaseCount - 1 - roundState.phase, true);
        } else if (playedMs >= duration) {
          showCommentary(1);
          if (frame === Number(timeline.max)) { finish("result"); return; }
          setFrame(frame + 1, true);
        } else if (reducedMotion && !inspector?.open) showCommentary(Math.min(1, playedMs / duration));
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

  return { create, routePlanner, offset };
})();
