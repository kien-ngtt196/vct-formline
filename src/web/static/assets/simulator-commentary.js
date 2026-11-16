const ChampionsCommentary = (() => {
  // Original calls organized around the cues used in a live broadcast: stakes, execute, fight, and result.
  const first = (name) => name.charAt(0).toUpperCase() + name.slice(1);
  const vary = (round, options) => options[(round.number - 1) % options.length];
  const buyName = (buy) => `${/^[aeiou]/i.test(buy.label) ? "an" : "a"} ${buy.label.toLowerCase()}`;

  function calls({ round, phase, teams, stats, simulation }) {
    const output = [];
    const add = (at, text, kind = "Call") => output.push({ at, text, kind });
    const names = teams.map((team) => team.name);
    const attack = round.attack;
    const defend = 1 - attack;
    const { site } = round;
    const duration = ChampionsTactics.phaseDuration(round, phase);
    const start = ChampionsTactics.phaseStart(round, phase);
    const player = (side, index) => stats[side][index].player.name;
    const events = simulation?.events || [];

    if (phase === 0) {
      const [a, d] = [round.buys[attack], round.buys[defend]];
      const context = round.number > 24 ? "Overtime. Every round matters from here."
        : round.number === 13 ? "The sides switch, and we’re back to pistols."
          : round.before.includes(12) ? `${first(names[round.before.indexOf(12)])} ${round.before[0] === 12 && round.before[1] === 12
            ? "and their opponents are tied at twelve." : "can close out the map here."}`
            : `Round ${round.number}. ${first(names[attack])} on the attack.`;
      add(.03, context, "Analysis");
      const economy = a.label === d.label
        ? `Both sides are on ${buyName(a)}. ${a.label === "Pistol" ? "Early trades carry extra weight." : "Watch who gets to set the pace."}`
        : `${first(names[attack])} on ${buyName(a)} against ${names[defend]}’s ${d.label.toLowerCase()}.`;
      add(.45, economy, "Analysis");
    }

    if (phase === 1) {
      const opening = {
        Rush: vary(round, [`Straight for ${site}. ${first(names[attack])} want to force the first fight.`,
          `Quick out of the gates. The attackers are heading right to ${site}.`]),
        Default: "The attackers fan out. They’re looking for information before they commit.",
        "Slow execute": "The attackers are taking their time. They can wait for the first wave of utility to burn out.",
        Fake: `Early pressure at ${round.alternate}. Watch where the spike goes.`,
        Split: `The attackers are taking two lanes. The timing of that split onto ${site} matters.`,
        "Mid to": "The pack is going through mid. The defenders need to contest it or give up the rotation.",
        Lurk: `Pressure toward ${site}, with one attacker off the main group watching the rotation.`,
      }[round.plan];
      if (opening) add(.04, opening, "Analysis");
      if (round.defense === "Fight mid" || round.defense === "Take space") {
        add(.42, `${first(names[defend])} are willing to meet them early and contest that space.`, "Analysis");
      }
    }

    if (phase === 2) {
      const hit = round.plan === "Fake" ? `Here’s the turn. The real hit is headed to ${site}.`
        : vary(round, [`The pressure is on ${site} now. Watch the first player through the choke.`,
          `${first(names[attack])} commit toward ${site}. The defense has to hold that first line.`]);
      add(.04, hit);
    }

    if (phase === 3) {
      if (simulation?.planted) {
        const setup = round.postPlant === "Open plant" ? "The attackers can play this from main."
          : round.postPlant === "Push CT" ? "The attackers are looking to take space beyond the site."
            : "The defenders need to break the post-plant crossfire.";
        add(.02, `Spike down on ${site}. ${setup}`);
        add(.76, "Time is getting tight for the retake. The defenders need a clean fight.", "Analysis");
      } else {
        add(.03, simulation && round.planted
          ? "The choke held. The attackers still need to get the spike onto the site."
          : "The spike is still in hand, and the round clock is becoming a factor.");
      }
    }

    if (phase > 0 && phase < 4 && duration) {
      const screen = events.filter((event) => event.smokeTiming && event.smokeTiming.starts >= start
        && event.smokeTiming.starts < start + duration).sort((a, b) => a.smokeTiming.starts - b.smokeTiming.starts)[0];
      if (screen) {
        const coversFor = screen.side === attack ? "The attackers have cover for their next move."
          : "The defenders have bought a few seconds.";
        add((screen.smokeTiming.starts - start) / duration,
          `${first(screen.name)} comes up at ${screen.area}. ${coversFor}`);
      }
      const response = events.find((event) => event.phase === phase && (event.hold || ["entry", "ultimate"].includes(event.kind)));
      if (response) {
        const action = response.hold ? "scouts the next angle" : response.kind === "entry"
          ? "commits the movement utility to get in" : "invests an ultimate";
        add(response.time, `${first(response.player.name)} ${action} with ${response.name}.`);
      }
    }

    const alive = stats.map((team) => new Set(team.map((_, i) => i)));
    const kills = stats.map((team) => team.map(() => 0));
    let prior;
    for (const kill of round.kills) {
      const enemy = 1 - kill.side;
      const already = alive[enemy].size;
      alive[enemy].delete(kill.victim);
      const count = ++kills[kill.side][kill.killer];
      const trade = prior?.side === enemy && prior.killer === kill.victim
        && prior.phase === kill.phase && kill.time - prior.time <= .12;
      prior = kill;
      if (kill.phase !== phase) continue;
      const killer = first(player(kill.side, kill.killer));
      const victim = player(enemy, kill.victim);
      const last = already === 2 ? player(enemy, [...alive[enemy]][0]) : null;
      const left = alive[kill.side].size;
      const opening = alive[0].size + alive[1].size === 9;
      const call = count === 5 ? `${killer} takes all five. That’s the ace!`
        : last && left ? `${killer} drops ${victim}. It’s all on ${last} in a one-versus-${left} now.`
          : trade ? `${killer} trades it back, taking down ${victim}.`
            : count > 1 ? `${killer} finds ${victim}. That’s ${count} this round.`
              : opening ? `${killer} opens the round with the pick on ${victim}.`
                : vary(round, [`${killer} takes down ${victim}.`, `${victim} falls to ${killer}.`]);
      add(kill.time, call);
    }

    if (phase === 4) {
      const at = Math.max(.05, ...round.kills.filter((kill) => kill.phase === 4).map((kill) => kill.time + .08));
      const winner = first(names[round.winner]);
      const score = `${round.score[round.winner]}–${round.score[1 - round.winner]}`;
      let outcome;
      if (simulation?.planted && ["defuse", "detonate", "hold", "clutch"].includes(round.finish)) {
        outcome = round.finish === "defuse" ? `The retake is complete. ${winner} get the defuse.`
          : round.finish === "detonate" ? `The spike goes off. ${winner} take the round.`
            : round.finish === "clutch" ? `Clutch secured for ${winner}.` : `${winner} hold the post-plant.`;
      } else if (round.finish === "save" && (!round.planted || simulation?.planted)) {
        outcome = `${first(names[1 - round.winner])} save what they can. The round goes to ${winner}.`;
      } else {
        outcome = `Round goes to ${winner}.`;
      }
      add(at, `${outcome} The score is ${score}.`);
    }
    return output.sort((a, b) => a.at - b.at);
  }

  function create({ node, controlIcon }) {
    const panel = node("section", "sim-radar-commentary");
    panel.setAttribute("aria-label", "Round commentary");
    const heading = node("h4", "sim-commentary-header", "Commentary");
    heading.prepend(controlIcon("M4 5h16v12H9l-5 4z M8 9h8 M8 13h5"));
    const current = node("p", "sr-only");
    current.setAttribute("aria-live", "polite");
    current.setAttribute("aria-atomic", "true");
    const log = node("ol", "sim-commentary-log");
    panel.append(heading, current, log);
    let shown = [];

    function update(visible) {
      const recent = visible.slice(-5);
      if (recent.length === shown.length && recent.every((cue, index) => cue === shown[index])) return;
      shown = recent;
      log.replaceChildren(...recent.map((cue) => {
        const row = node("li", cue.kind === "Analysis" ? "is-analysis" : "");
        row.append(node("small", "", cue.kind), node("p", "", cue.text));
        return row;
      }));
      const latest = recent.at(-1);
      current.textContent = latest?.text || "";
    }

    return { panel, update };
  }
  return { calls, create };
})();
