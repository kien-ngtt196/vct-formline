const ChampionsAbilityGeometry = (() => {
  // VALORANT-API map multipliers, converted from world centimeters to radar percent per meter.
  const metersToRadar = {
    Abyss: .81, Ascent: .70, Bind: .59, Breeze: .70, Corrode: .70, Fracture: .78,
    Haven: .75, Icebox: .72, Lotus: .72, Pearl: .78, Split: .78, Summit: .75, Sunset: .78,
  };
  const colors = {
    astra: "#b86cec", breach: "#ef9b54", brimstone: "#d8a47a", chamber: "#e9c47f",
    clove: "#ed86ce", cypher: "#8dd7ea", deadlock: "#81d9f2", fade: "#ad7bdb",
    gekko: "#b4d85c", harbor: "#41c4cb", hush: "#dc6cf1", iso: "#b59afa",
    jett: "#c3e6f4", kayo: "#9ca5f0", killjoy: "#dfc552", miks: "#b670db",
    neon: "#66bdf5", omen: "#7770c7", phoenix: "#ff9750", raze: "#ff9b51",
    reyna: "#e382d0", sage: "#82e2d3", skye: "#97ce70", sova: "#7aaeff",
    tejo: "#e2ae69", veto: "#eb7773", viper: "#6bd34f", vyse: "#ba68e9",
    waylay: "#ffcb79", yoru: "#6b9dff",
  };
  // PC effect dimensions, in meters. An unmeasured effect gets a marker only.
  // https://wiki.playvalorant.com/en-us/Abilities
  const groundRadius = {
    "Dark Cover": 4.1, "Sky Smoke": 4.15, Nebula: 4.75, Ruse: 4, Cove: 4.6,
    "Poison Cloud": 4.5, Cloudburst: 3.35, "Cyber Cage": 3.72, Waveform: 4.72,
    "Recon Bolt": 30, Haunt: 30, "ZERO/point": 15,
    Incendiary: 4.5, Nanoswarm: 4.5, "Snake Bite": 4.5, "Hot Hands": 4.5,
    Seize: 6.58, "Storm Surge": 6, "Nova Pulse": 4.75, "Gravity Well": 4.75, Meddle: 4, Interceptor: 18,
    "Mosh Pit": 6.2, "FRAG/ment": 4, "Guided Salvo": 4.5, "Relay Bolt": 5,
  };
  const casterRadius = { "Steel Garden": 28, Lockdown: 32.5 };
  const corridors = {
    "Fault Line": { length: 56, width: 8, start: 8, minimum: 8 },
    "Rolling Thunder": { length: 32, width: 18, start: 8 },
    // Reckoning's footprint is the swept path of the moving wave.
    Reckoning: { length: 34, width: 21, start: 8 },
    Nightfall: { length: 40, width: 20 },
  };
  const screens = { "Toxic Screen": 60, "Fast Lane": 46.5, "High Tide": 60, Blaze: 21 };

  function footprint(map, name, origin, target) {
    const scale = metersToRadar[map];
    if (!scale) return null;
    const radius = groundRadius[name] ?? casterRadius[name];
    if (radius) {
      return { shape: "circle", center: casterRadius[name] ? origin : target, radius: radius * scale,
        dimensions: `${radius} m radius` };
    }
    const [dx, dy] = target.map((value, axis) => value - origin[axis]);
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const corridor = corridors[name];
    if (corridor) {
      const { start = 0, length, width, minimum } = corridor;
      const reach = minimum ? Math.min(length, Math.max(minimum, distance / scale - start)) : length;
      const shift = (start + reach / 2) * scale;
      return { shape: "box", center: [origin[0] + Math.cos(angle) * shift, origin[1] + Math.sin(angle) * shift],
        length: reach * scale, width: width * scale, angle,
        dimensions: `${Math.round(reach)} × ${width} m${name === "Reckoning" ? " swept area" : ""}` };
    }
    if (name === "Barrier Orb") {
      return { shape: "box", center: target, length: 10.4 * scale, width: 1.5 * scale,
        angle: angle + Math.PI / 2, dimensions: "10.4 × 1.5 m" };
    }
    if (name === "Cosmic Divide") {
      return { shape: "line", center: target, length: 150, angle: angle + Math.PI / 2,
        dimensions: "Map-spanning wall" };
    }
    const maxLength = screens[name];
    if (maxLength) {
      const projected = maxLength * scale;
      return { shape: "line", center: [origin[0] + Math.cos(angle) * projected / 2, origin[1] + Math.sin(angle) * projected / 2],
        length: projected, angle, dimensions: `${maxLength} m wall length` };
    }
    return null;
  }

  function draw(context, area, color, kind, outline = color) {
    context.save();
    context.translate(area.center[0] * 4, area.center[1] * 4);
    context.rotate(area.angle || 0);
    context.beginPath();
    if (area.shape === "circle") {
      context.arc(0, 0, area.radius * 4, 0, 2 * Math.PI);
    } else if (area.shape === "box") {
      context.rect(-area.length * 2, -area.width * 2, area.length * 4, area.width * 4);
    } else {
      context.moveTo(-area.length * 2, 0);
      context.lineTo(area.length * 2, 0);
    }
    if (area.shape !== "line") {
      context.fillStyle = color + (kind === "smoke" ? "48" : "24");
      context.fill();
    }
    context.strokeStyle = outline + "c0";
    context.lineWidth = area.shape === "line" ? 1.6 : 1;
    if (kind === "recon") context.setLineDash([3, 3]);
    context.stroke();
    context.restore();
  }

  return { colors, footprint, draw, scaleFor: (map) => metersToRadar[map] };
})();
