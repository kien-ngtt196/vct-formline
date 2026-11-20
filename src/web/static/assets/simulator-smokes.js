const ChampionsSmokes = (() => {
  // Choke lips and the direction into the denied lane, measured on the local radar artwork.
  // Site executes follow the linked smoke guides. The centers below are radar approximations.
  // Ranked defense variants: https://turbosmurfs.gg/article/valorant-essential-tips-and-tricks-to-place-smokes
  // Width is the opening in world meters, not the smoke diameter. Uncalibrated
  // entrances use a conservative 3 m aperture; authored Lotus apertures follow the radar.
  const s = (name, x, y, insideX, insideY, width = 3) => ({ name, lip: [x, y], inside: [insideX, insideY], width });
  const maps = {
    Ascent: {
      // https://www.oneesports.gg/valorant/best-ascent-smokes-valorant-map/
      mid: [s("Bottom Mid", 39, 48, 33, 48), s("Top Mid", 63, 39, 69, 38)],
      midBySite: { B: s("Mid Catwalk toward A", 48, 41, 46, 36) },
      A: {
        cuts: [s("A Heaven", 25, 16, 23, 13), s("A Tree door", 38, 26, 40, 30)],
        split: [0], entry: s("A Main exit", 43, 20, 48, 20), cross: s("A Generator crossing", 36, 18, 33, 16),
      },
      B: {
        cuts: [s("B Market door", 31, 67, 32, 61), s("B CT entrance", 22, 68, 19, 63)],
        split: [1], entry: s("B Main exit", 37, 74, 42, 73), cross: s("B lane crossing", 34, 75, 31, 79),
      },
    },
    Haven: {
      // https://dotesports.com/valorant/news/best-smoke-spots-for-every-map-in-valorant
      mid: [s("B entrance from Mid", 47, 54, 43, 52), s("Mid Window", 67, 47, 71, 45)],
      A: {
        cuts: [s("A Heaven window", 34, 15, 30, 13), s("A defender entrance", 29, 25, 27, 31)],
        entry: s("A Long exit", 46, 17, 56, 17), secondary: s("A Short exit", 47, 27, 49, 34),
        push: s("A Lobby", 62, 35, 65, 37),
        cross: s("A default crossing", 41, 20, 38, 19),
      },
      B: {
        cuts: [s("A Link to B", 35.5, 43, 33, 41), s("C Link to B", 34, 58, 33, 64)],
        entry: s("B entrance from Mid", 47, 54, 55, 53),
      },
      C: {
        cuts: [s("C defender entrance", 33, 75, 34, 70), s("C Garage exit", 42, 71, 44, 66)],
        split: [0], entry: s("C Long exit", 46, 85, 55, 86),
        secondary: s("Garage doors", 54, 65, 60, 65), cross: s("C default crossing", 40, 84, 38, 82),
      },
    },
    Split: {
      // https://road2radiant.pro/en/guides/maps/split
      mid: [s("Mid Mail", 48, 59, 46, 65), s("Mid Bottom", 59, 54, 68, 54)],
      midBySite: { B: s("Mid Vent toward A", 45, 48, 43, 44) },
      A: {
        cuts: [s("A Screens exit", 21, 25, 15, 24), s("A Heaven drop", 35, 26, 38, 24)],
        split: [0], entry: s("A Main exit", 43, 20, 50, 20), secondary: s("A Ramps", 45, 31, 47, 38),
        cross: s("A site crossing", 34, 19, 30, 16),
      },
      B: {
        cuts: [s("B Heaven drop", 39, 75, 41, 70), s("B CT Alley", 24, 78, 20, 74)],
        split: [1], entry: s("B Garage exit", 44, 86, 47, 91), cross: s("B pillar crossing", 38, 86, 35, 88),
      },
    },
    Lotus: {
      // https://www.oneesports.gg/valorant/best-smokes-on-valorant-map-lotus/
      mid: [s("A Stairs from Rubble", 72.5, 39, 72.5, 34, 4), s("B Pillars", 48, 55.2, 48, 61, 3.8)],
      A: {
        cuts: [s("A Drop exit", 77.2, 35.5, 73, 35.5, 3), s("A Top exit", 81.2, 29.4, 79.5, 26, 3)],
        control: s("A Stairs from Rubble", 72.5, 39, 72.5, 34, 4),
        entry: s("A Main exit", 76.7, 41.9, 76.7, 48, 4), secondary: s("A Tree door", 81.3, 40, 77, 40, 3),
        push: s("A Root", 72, 59, 69, 62),
        cross: s("A Hut crossing", 84, 40, 86, 37),
      },
      B: {
        cuts: [s("C Link to B", 43, 40.7, 38, 40.7, 3), s("B Upper exit", 52.4, 39.4, 52.4, 35, 4.5), s("A Link to B", 55.8, 47, 62, 47, 4)],
        split: [0, 1], entry: s("B Main exit", 45.4, 50.6, 45.4, 56, 4.5),
        secondary: s("A Link to B", 55.8, 47, 62, 47, 4),
      },
      C: {
        cuts: [s("C Waterfall exit", 21.7, 45.7, 27, 45.7, 5), s("C Hall exit", 13.4, 37.3, 13.4, 32, 4.5)],
        split: [1], entry: s("C Main exit", 18.9, 54.2, 25, 54.2, 5),
        secondary: s("C Bend exit", 13.8, 49.2, 13.8, 54, 3),
        push: s("C Lobby", 30.5, 59.3, 30.5, 65, 4),
        cross: s("C mound crossing", 14, 49, 13, 47),
      },
    },
    Sunset: {
      // https://road2radiant.pro/en/guides/setups/omen
      mid: [s("Mid Top arch", 46, 37, 46, 32), s("Mid Tiles exit", 54, 59, 55, 65)],
      A: {
        cuts: [s("A Alley exit", 81, 29, 80, 24), s("A Link exit", 72, 36, 68, 36)],
        split: [0], entry: s("A Main exit", 78, 48, 77, 55), secondary: s("A Elbow exit", 82, 48, 88, 51),
        cross: s("A box crossing", 79, 42, 82, 39),
      },
      B: {
        cuts: [s("B Market entrance", 24, 39, 28, 43), s("B Boba exit", 15, 31, 15, 27)],
        split: [1], entry: s("B Main exit", 13, 49, 12, 55), cross: s("B pillar crossing", 17, 43, 20, 44),
      },
    },
    Abyss: {
      // https://dotesports.com/valorant/news/best-smoke-spots-on-abyss-valorant-map
      mid: [s("Mid Top stairs", 38, 44, 33, 44), s("Mid Bottom entrance", 57, 51, 62, 52)],
      A: {
        cuts: [s("A Tower window", 47, 23, 49, 26), s("A Security entrance", 31, 14, 27, 12)],
        entry: s("A Main exit", 56, 18, 63, 19), cross: s("A bridge crossing", 47, 12, 44, 14),
      },
      B: {
        cuts: [s("B Tower window", 34, 84, 30, 82), s("B Link entrance", 29, 75, 29, 69)],
        split: [0], entry: s("B Main exit", 54, 86, 60, 87), cross: s("B site crossing", 46, 87, 42, 90),
      },
    },
    Summit: {
      // Summit creator demonstrations: https://road2radiant.pro/en/guides/maps/summit
      // B Tower, Trophy/Link and Main lips measured against the supplied radar.
      mid: [s("Mid Window", 49, 35, 49, 31), s("Mid Tiles exit", 39, 62, 36, 62)],
      A: {
        cuts: [s("A Art exit", 81, 29, 79, 25), s("A Cave exit", 92, 33, 95, 28), s("A Link exit", 74, 35, 76, 32)],
        split: [0, 1], entry: s("A Main exit", 82.5, 49.5, 82.5, 56),
        cross: s("A Garden crossing", 84, 43.5, 88, 46),
      },
      B: {
        cuts: [s("B Tower exit", 18.4, 28.8, 16.2, 33.1, 3.5),
          s("B Trophy / Link", 23.8, 39.5, 26, 42.3, 4),
          s("B Gym exit", 16.2, 24.7, 16.2, 21.5, 3.5)],
        split: [0, 2], entry: s("B Main exit", 25.8, 53.4, 25.8, 59, 4.5),
        cross: s("B site crossing", 15, 38, 12, 35),
      },
    },
  };

  // These radar waypoints approximate ground-level sightlines at each entrance.
  // Split groups keep their connector open. Bind uses lobby control instead of mid.
  const laneNames = {
    Bind: [["A Heaven", "A Lamps", "A approach"], ["B Halls", "B Elbow", "B approach"]],
    Breeze: [["A Bridge", "A Doors", "A Main"], ["B Arches", "B Tunnel", "B Main"]],
    Corrode: [["A defender entrance", "A Link", "A Main"], ["B Tower", "B Link", "B Main"]],
    Fracture: [["A defender entrance", "A Rope", "A Main"], ["B Generator", "B Canteen", "B Main"]],
    Icebox: [["A Screens", "A Rafters", "A approach"], ["B Snowman", "B Orange", "B approach"]],
    Pearl: [["A Secret", "A Link", "A Main"], ["B Hall", "B Link", "B Main"]],
  };
  for (const [map, names] of Object.entries(laneNames)) {
    const profile = {};
    for (const [index, site] of ["A", "B"].entries()) {
      const lane = ChampionsTactics.lanesFor(map, site);
      const doorway = (name, point) => s(name, ...point,
        ...point.map((v, axis) => v + (v - lane.target[axis])));
      const [back, link, main] = names[index];
      profile[site] = { cuts: [doorway(back, lane.back), doorway(link, lane.link)],
        split: [0], entry: doorway(main, lane.main) };
    }
    const layout = ChampionsTactics.layouts[map];
    const midCut = (name, toward) => s(name, ...layout.mid, ...toward);
    profile.mid = map === "Bind" || map === "Fracture"
      ? [profile.A.cuts[1], profile.B.entry]
      : [midCut("Mid defender approach", layout.defense), midCut("Mid attacker approach", layout.attack)];
    maps[map] = profile;
  }

  const seconds = {
    "Dark Cover": 15, "Sky Smoke": 19.25, Nebula: 14.25, Ruse: 14, Cove: 19.25,
    Cloudburst: 2.5, "Cyber Cage": 7.25, Waveform: 16.75,
    // A modeled fuel window for Viper's toggled smokes.
    "Poison Cloud": 12, "Toxic Screen": 12, "High Tide": 15,
  };
  const wallNames = new Set(["Toxic Screen", "High Tide"]);
  const clipDuration = (event) => seconds[event.name];
  const now = (round, phase, fraction) => ChampionsTactics.phaseStart(round, phase)
    + fraction * ChampionsTactics.phaseDuration(round, phase);

  function placement(map, name, spot, origin, terrain) {
    const scale = ChampionsAbilityGeometry.scaleFor(map);
    if (wallNames.has(name)) {
      if (!spot.wall) return null;
      const [dx, dy] = spot.lip.map((value, i) => value - origin[i]);
      const length = Math.hypot(dx, dy);
      if (length < 1.5 * scale || length > 58 * scale) return null;
      const perpendicular = [-dy / length, dx / length];
      const toward = spot.inside.map((value, i) => value - spot.lip[i]);
      if (Math.abs((toward[0] * perpendicular[0] + toward[1] * perpendicular[1])
        / Math.hypot(...toward)) < .5) return null;
      return spot.lip;
    }
    const footprint = ChampionsAbilityGeometry.footprint(map, name, origin, spot.lip);
    if (footprint?.shape !== "circle") return null;
    if (spot.centered) return [...spot.lip];
    const [dx, dy] = spot.inside.map((value, i) => value - spot.lip[i]);
    const length = Math.hypot(dx, dy);
    if (!length) return null;
    // Fit the circle across BOTH jambs. A full-radius offset is only tangent at
    // the midpoint and leaves corner gaps; a fixed .85 inset bulges on narrow doors.
    const halfWidth = spot.width * scale / 2;
    if (halfWidth >= footprint.radius) return null;
    const inset = Math.sqrt(footprint.radius ** 2 - halfWidth ** 2) - .10 * scale;
    const point = [spot.lip[0] + dx / length * inset, spot.lip[1] + dy / length * inset];
    if (point.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) return null;
    // Check the artwork, but NEVER move a precision smoke to the integer movement
    // grid: that changes its depth and can put its edge back on the friendly side.
    const snapped = terrain.snap(point);
    if (!snapped || Math.hypot(snapped[0] - point[0], snapped[1] - point[1]) > 1.5 * scale) return null;
    return point;
  }

  function timing(event, castTime) {
    const duration = clipDuration(event);
    if (!duration) return null;
    const delay = event.name === "Dark Cover" ? event.distance / 64 + .3
      : event.name === "Sky Smoke" ? 1
        : event.delivery === "cast" ? .6 : 1;
    return { starts: castTime + delay, ends: castTime + delay + duration };
  }

  function uses(map, round, context) {
    const profile = maps[map];
    if (!profile?.[round.site]) return [];
    const site = profile[round.site];
    const alternate = profile[round.alternate];
    const mask = site.split && ["Split", "Mid to"].includes(round.plan) ? site.split : site.cuts.map((_, i) => i);
    const settings = round.skirmish?.smokePolicy?.[round.site];
    const attackKey = round.plan === "Fake" ? "fake" : ["Split", "Mid to"].includes(round.plan) ? "split" : "execute";
    const attackStyle = settings?.[attackKey];
    const defenseStyle = settings?.defense;
    const cuts = mask.map((index) => site.cuts[index]);
    if (attackStyle === "alternate") cuts.reverse();
    const mid = ["Split", "Mid to"].includes(round.plan);
    const fast = round.plan === "Rush";
    const slow = ["Default", "Slow execute", "Lurk"].includes(round.plan);
    const executeAt = attackStyle === "early" ? .06 : fast ? .12 : .25;
    const reserve = Math.min(cuts.length, 2);
    const neededBy = now(round, 2, executeAt);
    if (context === "opening") {
      return [
        ...(round.skirmish && fast && site.control ? [{ attack: true, time: round.skirmish.smokeAt ?? .10,
          spot: site.control, use: "screens the opening cross", reserve, neededBy }] : []),
        ...(round.plan === "Fake" && attackStyle !== "alternate" ? [{ attack: true, time: attackStyle === "early" ? .05 : .10, spot: alternate.cuts[0],
          use: `sells the ${round.alternate} fake while preserving the real hit`, reserve, neededBy }] : []),
        ...(slow ? [{ attack: true, time: round.skirmish?.smokeAt ?? .10,
          spot: site.control || profile.midBySite?.[round.site] || profile.mid[0],
          use: "denies early information and supports the default", reserve, neededBy }] : []),
        ...(mid && attackStyle !== "alternate" ? [{ attack: true, time: .23, spot: profile.midBySite?.[round.site] || profile.mid[0],
          use: "cuts the mid sightline without smoking the connector group", reserve, neededBy }] : []),
        ...(defenseStyle === "alternate" ? [] : round.defense === "Fight mid"
          ? [{ attack: false, time: .19, spot: profile.mid[1], use: "covers a mid contest", pressure: true }]
          : round.defense === "Take space" && site.push
            ? [{ attack: false, time: .23, spot: site.push, use: "covers the defenders' push", pressure: true }]
          : fast || round.defense === "Delay"
            ? [{ attack: false, time: fast ? .15 : .38, spot: site.entry, use: "stalls the entry on contact", pressure: true }] : []),
      ];
    }
    if (context === "execute") {
      return [
        ...cuts.map((spot, i) => ({ attack: true, time: executeAt + i * (fast ? .025 : .045), spot,
          use: fast ? "seals the rotation before the rush" : "cuts a defender sightline for the committed hit" })),
        { attack: true, time: executeAt, spot: { ...(site.cross || cuts[0]), wall: true }, use: "screens the site crossing", wall: true },
        ...(site.cross ? [{ attack: true, time: .50, spot: site.cross, use: "covers the entry player", entry: true }] : []),
        { attack: false, time: defenseStyle === "early" ? .05 : fast ? .10 : .29, spot: defenseStyle === "alternate" ? (site.secondary || site.entry) : site.entry, use: "blocks the attackers' choke", pressure: true },
        ...(round.defense === "Delay" && site.secondary
          ? [{ attack: false, time: .42, spot: site.secondary, use: "cuts the second entry", pressure: true }] : []),
      ];
    }
    if (context !== "postplant" || !round.planted || round.finish === "save") return [];
    const defuseCover = round.postPlant === "Open plant" || round.finish === "clutch";
    const plant = ChampionsTactics.spikePosition(ChampionsTactics.lanesFor(map, round.site), round);
    return [
      // A flanker needs the main sightline open. An open plant instead calls for
      // cover ON the spike so the retakers can still fight the players in main.
      ...(!defuseCover && round.defense !== "Flank"
        ? [{ attack: false, time: settings?.retake === "early" ? .05 : round.retake === "Flood" ? .12 : .24, spot: site.entry,
          use: "isolates main for the retake", pressure: true }] : []),
      ...(defuseCover ? [{ attack: false, time: settings?.retake === "early" ? .30 : .52, spot: { name: "Spike defuse cover", lip: plant, centered: true },
        use: "covers the defuse while teammates watch the spam" }] : []),
      // Do not smoke off our own CT push; retain sightlines to that teammate.
      ...(round.postPlant !== "Push CT"
        ? cuts.slice(0, 2).map((spot, i) => ({ attack: true, time: .23 + i * .08, spot,
          use: "refreshes the rotation choke against the retake", pressure: true })) : []),
    ];
  }

  return { placement, timing, now, uses };
})();
