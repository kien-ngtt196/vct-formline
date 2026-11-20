/* Round events drive both the tactical playback and the map stat lines. */
const ChampionsTactics = (() => {
  // Coordinates are percentages of the local minimap images, in their fixed orientation.
  const layouts = {
    Bind: { attack: [59.29, 90.14], defense: [50.34, 9.39], mid: [50.59, 49.69],
      sites: { A: [73.32, 31.21], B: [27.87, 27.63] } },
    Breeze: { attack: [45.01, 87.47], defense: [57.79, 7.31], mid: [48.97, 48.98],
      sites: { A: [90.83, 43.59], B: [14.98, 26.67] } },
    Corrode: { attack: [92.45, 50.32], defense: [11.21, 53.3], mid: [52.94, 48.33],
      sites: { A: [40.52, 18.76], B: [38.54, 76.15] } },
    Fracture: { attack: [51.02, 82.7], defense: [50.12, 47.19], mid: [41.91, 52.13],
      sites: { A: [88.36, 50.27], B: [7.39, 52.53] }, attackAlt: [50.47, 11.18] },
    Icebox: { attack: [16.87, 60.11], defense: [94.1, 55.82], mid: [55.11, 54.36],
      sites: { A: [70.03, 83.41], B: [63.28, 19.59] } },
    Pearl: { attack: [56.91, 86.97], defense: [56.92, 7.67], mid: [58.16, 61.62],
      sites: { A: [86.75, 34.02], B: [16.89, 39.73] } },
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
    Bind: { A: [74.6, 69.28], B: [32.49, 60.29], mid: [51.12, 61.63] },
    Breeze: { A: [70.54, 72.03], B: [26.11, 56.35], mid: [53.39, 66.23] },
    Corrode: { A: [69.09, 27.71], B: [64.62, 68.7], mid: [71.83, 47.09] },
    Fracture: { A: [57.23, 82.23], B: [35.12, 82.41], mid: [50.78, 79.23] },
    Icebox: { A: [32.03, 79.71], B: [28.04, 50.41], mid: [35.0, 59.84] },
    Pearl: { A: [76.06, 67.34], B: [34.54, 81.5], mid: [62.13, 77.28] },
    Abyss: { A: [73, 25], B: [77, 77], mid: [73, 46] },
    Ascent: { A: [59, 25], B: [66, 68], mid: [64, 42] },
    Haven: { A: [65, 26], B: [69, 55], C: [63, 80], mid: [72, 49] },
    Lotus: { A: [70, 67], B: [53, 64], C: [30, 62], mid: [53, 64] },
    Split: { A: [66, 24], B: [69, 76], mid: [67, 56] },
    Summit: { A: [67, 74], B: [29, 58], mid: [49, 73] },
    Sunset: { A: [71, 67], B: [26, 66], mid: [51, 66] },
  };
  // Barrier centerlines traced from the in-game buy-phase screenshot for each map.
  const buyBarriers = {
    Abyss: {
      attack: [
        [75.64, 18.13, 75.69, 29.56], [74.5, 38.76, 73.79, 45.72], [70.2, 73.8, 70.22, 77.78],
        [73.95, 78.75, 73.96, 82.23],
      ],
      defense: [
        [58.2, 8.53, 58.23, 14.49], [45.63, 28.71, 43.4, 28.73], [36.0, 39.94, 35.78, 46.65],
        [31.08, 50.4, 31.1, 53.38], [37.09, 60.55, 33.62, 60.57], [50.87, 83.34, 50.94, 98.49],
      ],
    },
    Ascent: {
      attack: [
        [56.79, 22.98, 56.82, 30.43], [66.53, 36.61, 63.8, 36.62], [53.72, 63.48, 50.0, 63.5],
        [48.05, 74.18, 48.06, 77.41],
      ],
      defense: [
        [45.33, 13.34, 45.34, 16.82], [43.4, 28.75, 43.43, 35.45], [37.26, 47.15, 37.28, 52.12],
        [37.08, 64.29, 37.1, 68.51], [37.1, 69.01, 37.11, 72.24], [37.12, 73.48, 37.14, 77.7],
      ],
    },
    Bind: {
      attack: [
        [77.68, 64.36, 77.79, 58.4], [69.58, 58.25, 66.6, 58.19], [57.0, 52.54, 57.04, 50.8],
        [39.76, 57.2, 38.03, 56.42], [30.6, 67.97, 30.68, 63.74],
      ],
      defense: [
        [78.11, 40.74, 75.38, 40.69], [64.37, 44.22, 58.65, 44.12], [26.16, 39.53, 23.17, 39.48],
      ],
    },
    Breeze: {
      attack: [
        [72.51, 71.45, 70.93, 69.27], [64.47, 63.3, 61.99, 63.4], [50.54, 63.35, 45.07, 63.57],
        [26.73, 53.09, 22.26, 53.27], [21.55, 66.99, 21.4, 63.01],
      ],
      defense: [
        [91.49, 54.02, 80.78, 53.95], [80.28, 53.72, 72.82, 54.01], [66.13, 48.55, 59.17, 48.82],
        [37.31, 31.02, 37.14, 26.54], [45.72, 23.22, 45.6, 20.23], [16.07, 41.56, 11.84, 41.73],
      ],
    },
    Corrode: {
      attack: [
        [66.61, 24.98, 66.61, 33.42], [66.61, 43.36, 63.63, 43.36], [74.56, 58.26, 69.84, 58.26],
        [60.65, 66.46, 60.65, 72.43],
      ],
      defense: [
        [52.94, 16.78, 52.94, 22.74], [45.74, 34.66, 42.51, 34.66], [41.52, 65.22, 38.78, 65.22],
        [47.48, 78.14, 47.48, 83.6], [31.08, 66.71, 31.08, 69.69],
      ],
    },
    Fracture: {
      attack: [
        [59.93, 92.41, 59.95, 85.46], [33.63, 85.14, 33.64, 80.67], [60.89, 15.93, 60.91, 8.97],
        [37.29, 16.36, 30.36, 9.38],
      ],
      defense: [
        [86.08, 68.15, 79.62, 68.13], [67.48, 58.41, 67.49, 52.7], [59.26, 64.85, 59.27, 60.87],
        [81.45, 35.85, 75.73, 35.83], [16.06, 62.24, 10.84, 62.23], [25.54, 45.88, 21.81, 45.87],
        [14.38, 38.65, 14.39, 35.42],
      ],
    },
    Haven: {
      attack: [
        [70.58, 34.57, 70.58, 41.77], [69.83, 44.26, 69.83, 47.73], [71.33, 57.17, 71.33, 59.9],
        [72.07, 76.54, 68.84, 76.54],
      ],
      defense: [
        [50.71, 11.97, 50.71, 15.7], [49.22, 24.64, 46.24, 24.64], [47.73, 49.72, 47.73, 52.7],
        [50.22, 58.41, 50.22, 62.39], [51.71, 83.0, 51.71, 86.73],
      ],
    },
    Icebox: {
      attack: [
        [36.76, 87.9, 36.76, 83.68], [36.75, 78.47, 36.75, 70.27], [38.98, 64.56, 38.97, 55.87],
        [35.24, 45.94, 35.23, 43.7], [30.27, 42.46, 32.25, 42.46],
      ],
      defense: [
        [60.6, 93.85, 60.6, 91.36], [66.07, 90.61, 66.05, 73.97], [66.05, 72.98, 66.05, 65.28],
        [67.28, 58.58, 67.28, 50.88], [67.03, 48.39, 67.02, 41.69], [67.27, 39.7, 67.26, 31.51],
        [56.34, 34.99, 61.05, 34.99], [40.44, 25.07, 48.38, 25.07],
      ],
    },
    Lotus: {
      attack: [
        [66.57, 66.81, 63.84, 66.82], [53.67, 71.81, 48.45, 71.82], [39.29, 84.26, 39.26, 71.1],
      ],
      defense: [
        [86.16, 51.12, 86.15, 45.9], [77.2, 43.69, 70.49, 43.7], [66.52, 43.71, 56.34, 43.74],
        [45.67, 50.96, 41.45, 50.97], [22.34, 56.48, 20.6, 56.49],
      ],
    },
    Pearl: {
      attack: [
        [78.54, 62.61, 69.34, 62.61], [64.62, 75.04, 64.62, 71.56], [42.99, 67.33, 36.78, 67.33],
        [33.79, 79.51, 23.1, 79.51],
      ],
      defense: [
        [86.0, 43.72, 85.01, 41.23], [72.83, 48.94, 65.87, 48.94], [46.72, 52.42, 46.72, 45.7],
        [22.61, 46.94, 16.39, 46.94], [13.16, 47.44, 3.96, 47.44],
      ],
    },
    Split: {
      attack: [
        [57.39, 11.15, 57.39, 16.87], [62.34, 42.2, 59.12, 42.2], [65.31, 66.79, 58.86, 66.78],
        [62.33, 74.98, 62.33, 84.67],
      ],
      defense: [
        [42.49, 19.84, 42.48, 22.82], [42.23, 31.51, 42.23, 44.18], [46.45, 52.37, 46.44, 57.59],
        [48.18, 63.55, 44.21, 63.55], [45.44, 71.25, 45.44, 74.73], [44.94, 89.38, 44.94, 94.1],
      ],
    },
    Summit: {
      attack: [
        [73.22, 66.09, 66.85, 66.55], [63.23, 71.74, 60.17, 71.99], [34.23, 64.43, 32.56, 62.4],
        [29.16, 58.56, 23.65, 58.41],
      ],
      defense: [
        [83.16, 50.11, 75.56, 50.37], [64.57, 42.26, 62.0, 42.59], [51.66, 33.59, 48.88, 33.63],
        [39.05, 36.79, 36.23, 37.08], [14.9, 44.38, 9.87, 44.31],
      ],
    },
    Sunset: {
      attack: [
        [74.14, 54.62, 67.42, 54.71], [65.24, 59.71, 65.2, 56.23], [42.17, 65.49, 42.09, 59.52],
        [33.47, 66.35, 33.42, 62.12], [33.02, 69.59, 30.31, 72.36],
      ],
      defense: [
        [93.62, 40.68, 90.88, 40.71], [72.28, 45.43, 66.8, 45.51], [52.72, 34.74, 47.5, 34.8],
        [36.45, 46.4, 36.42, 43.91], [12.95, 57.65, 7.47, 57.72],
      ],
    },
  };
  const box = (left, top, right, bottom) => [[left, top], [right, top], [right, bottom], [left, bottom]];
  // Solid cover traced from the interior outlines on the local radar artwork.
  const mapCover = {
    Bind: [
      [[75.76, 33.74], [71.28, 33.65], [71.37, 28.68], [75.85, 28.76]],
      [[30.79, 30.92], [26.32, 30.83], [26.37, 27.85], [30.85, 27.93]],
    ],
    Breeze: [
      [[91.26, 48.06], [85.29, 48.29], [85.12, 43.82], [91.08, 43.58]],
      [[83.05, 48.38], [80.82, 48.47], [80.64, 44.0], [82.88, 43.91]],
      [[78.82, 35.6], [75.71, 38.96], [73.67, 37.55], [76.77, 34.19]],
      [[9.41, 36.84], [6.43, 36.96], [6.32, 34.23], [9.3, 34.11]],
    ],
    Corrode: [
      [[40.27, 15.78], [40.27, 19.01], [37.79, 19.01], [37.79, 15.78]],
      [[41.52, 74.66], [41.52, 77.39], [37.54, 77.39], [37.54, 74.66]],
      [[56.92, 51.06], [56.92, 54.04], [53.69, 54.04], [53.69, 51.06]],
    ],
    Fracture: [
      [[29.44, 74.2], [26.2, 75.93], [24.47, 74.19], [27.21, 72.21]],
      [[69.23, 51.46], [67.25, 51.46], [67.25, 48.97], [69.24, 48.98]],
      [[18.81, 54.55], [15.33, 54.54], [15.34, 51.31], [18.82, 51.32]],
    ],
    Icebox: [
      [[51.41, 83.42], [51.4, 74.98], [53.64, 74.98], [53.64, 83.42]],
      [[41.22, 75.73], [41.22, 70.52], [46.18, 70.51], [46.19, 75.73]],
      [[52.37, 48.16], [52.37, 44.43], [60.32, 44.43], [60.32, 48.15]],
      [[59.8, 22.32], [59.8, 16.61], [61.79, 16.61], [61.79, 22.32]],
    ],
    Pearl: [
      [[86.5, 35.02], [82.28, 35.02], [82.28, 31.79], [86.5, 31.79]],
      [[16.89, 39.24], [14.16, 39.24], [14.16, 34.26], [16.89, 34.26]],
      [[95.95, 52.67], [93.46, 55.65], [92.22, 54.41], [94.46, 51.43]],
    ],
    Abyss: [
      box(40.3, 6.4, 43.7, 16.1), box(43.7, 12.7, 45.3, 16.1), box(80.7, 23.4, 83.1, 26.8),
      box(48.3, 53.3, 50, 56.5), box(66.1, 69.9, 69.4, 73.4), box(37.9, 91.7, 47.5, 95.1),
      [[38, 82.1], [39.6, 79.2], [40.8, 80.4], [39.1, 83.1]],
    ],
    Ascent: [
      box(29.8, 18.2, 34.1, 19.8), box(30.5, 12.6, 31.8, 14.1), box(30.8, 11.4, 32.3, 12.8),
      box(23.7, 69.8, 33.8, 73.3), box(26.9, 78.8, 29.7, 80.4), box(31.7, 43.3, 33.3, 45),
      box(77.3, 32.6, 79, 34.1),
    ],
    Haven: [
      [[37.1, 14.8], [38.9, 14.3], [40.5, 20.2], [38.6, 20.7]],
      [[37.2, 46.2], [41, 46.2], [41, 48.4], [42.5, 48.4], [42.5, 51.4], [41, 51.4], [41, 53.7],
        [37.2, 53.7]],
      box(38.7, 76.9, 40.3, 83), box(37.1, 87.3, 41.8, 92.1), box(62.9, 47.6, 65.1, 53.4),
    ],
    Lotus: [
      box(77.7, 59.2, 83.1, 61.3), box(38, 76.5, 39.4, 79.5), box(38, 75.1, 38.7, 76.5),
      box(19.4, 37.4, 21.8, 39), box(84.9, 36.7, 86.4, 38.4), box(71, 51.9, 73, 53.6),
      box(29.5, 53.4, 31.3, 55), box(9.2, 50.7, 10.8, 53.9),
    ],
    Split: [
      box(31.9, 9.1, 35.1, 10.8), box(28.6, 12.6, 30.3, 14.3), box(49.3, 49.5, 51.1, 51.3),
      box(57.7, 49.7, 59.3, 53), box(31.8, 75.9, 33.5, 77.6), box(33.8, 84.5, 35.5, 86.2),
      box(50.3, 82, 52.3, 84), box(68.3, 33.8, 70.2, 36.9),
    ],
    Summit: [
      [[8.6, 36.2], [9.7, 35.6], [9.6, 34.9], [11, 34.2], [11.7, 35.7], [10.5, 36.2],
        [10.5, 37], [9.3, 37.6]],
      [[74.8, 41], [77.6, 40], [78.2, 41.5], [75.4, 42.5]],
      box(91.9, 44.5, 93.4, 46.1), box(76.9, 29.6, 78.4, 31.1),
      box(44.3, 55.7, 46.1, 57.4), box(50.5, 47.3, 52.1, 50.6), box(33.2, 29.4, 35, 31.2),
    ],
    Sunset: [
      [[44.8, 48], [47.2, 45.7], [48.4, 46.9], [46, 49.2]], // Mid Courtyard boxes
      [[81.3, 40.4], [84.2, 37.6], [85.4, 38.8], [82.6, 41.6]], // A Site box
      [[70.6, 47], [72.1, 45.5], [73.3, 46.6], [71.8, 48.1]], // A Main corner
      [[29.7, 46.4], [31.3, 46.4], [31.3, 50.5], [29.7, 50.5]], // B Market cover
      [[27.5, 61.9], [29.1, 61.9], [29.1, 66.3], [27.5, 66.3]], // B Lobby cover
      [[20.2, 29.7], [21.9, 29.7], [21.9, 31.2], [24, 31.2], [24, 33], [20.2, 33]], // B Boba stack
      [[17.2, 43.5], [19.6, 43.5], [19.6, 44.7], [18.7, 44.7], [18.7, 45.4], [17.2, 45.4]], // B Site stack
      [[40.7, 28], [42.3, 28], [42.3, 31.2], [40.7, 31.2]], // Mid Top corner
      [[42.9, 54.6], [44.5, 54.6], [44.5, 56.5], [42.9, 56.5]], // Mid Bottom cover
      [[51.4, 57], [53.2, 57], [53.2, 58.7], [51.4, 58.7]], // Mid Bottom corner
      [[40.6, 64], [43.8, 64], [43.8, 65.8], [40.6, 65.8]], // B Lobby corner
      [[74.1, 42.2], [75.9, 42.2], [75.9, 44], [74.1, 44]], // A Link corner
    ],
  };
  const approaches = {
    Bind: { A: [[67.46, 51.99], [75.8, 44.68], [71.97, 23.22]], B: [[22.78, 47.43], [38.45, 47.22], [27.47, 22.15]] },
    Breeze: { A: [[77.64, 56.31], [65.15, 48.84], [80.1, 36.55]], B: [[13.54, 46.89], [30.0, 41.26], [25.61, 24.75]] },
    Corrode: { A: [[59.4, 22.99], [44.25, 35.41], [31.83, 22.99]], B: [[53.19, 80.38], [39.53, 63.48], [30.83, 80.87]] },
    Fracture: { A: [[82.36, 65.41], [63.0, 59.14], [70.48, 51.47]], B: [[13.81, 65.96], [30.74, 52.85], [17.83, 51.32]] },
    Icebox: { A: [[45.7, 83.43], [59.1, 71.25], [74.0, 73.47]], B: [[47.15, 32.02], [56.34, 42.94], [76.19, 23.06]] },
    Pearl: { A: [[90.73, 55.16], [72.08, 49.69], [78.8, 26.81]], B: [[11.67, 55.15], [25.09, 48.44], [14.16, 31.53]] },
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

  const fractureBridge = {
    A: { staging: [57.66, 14.18], main: [77.22, 38.32] },
    B: { staging: [37.8, 13.63], main: [17.37, 35.67] },
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
    round.plan === "Rush" ? 31 : 38, round.planted ? 45
      : round.skirmish ? (round.plan === "Rush" ? 52 : 26) : 29, 0][phase];
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
      const bridge = map === "Fracture" && round.skirmish &&
        (round.plan === "Split" && roles.split.includes(index) || round.plan === "Lurk" && lurker);
      const connector = !bridge && (round.plan === "Mid to" || (round.plan === "Split" && roles.split.includes(index)));
      const entrance = connector ? link : main;
      const alternateGroup = (round.plan === "Fake" && roles.split.includes(index))
        || (round.plan === "Lurk" && lurker) || (round.plan === "Default" && lurker);
      const buy = bridge ? fractureBridge[round.site].staging
        : alternateGroup ? alternate.staging : connector ? staging[map].mid : lane.staging;
      const opening = {
        Rush: main, Default: lurker ? alternate.main : index === roles.support ? layout.mid : main,
        "Slow execute": mix(buy, main, .55), Fake: alternateGroup ? alternate.main : main,
        Split: connector ? layout.mid : main, "Mid to": layout.mid, Lurk: alternateGroup ? alternate.main : main,
        "Group late": index === roles.support ? mix(main, link, .35) : mix(buy, main, .35),
      }[round.plan];
      const entry = round.planted ? spikePosition(lane, round)
        : round.finish === "wipe" ? target : mix(entrance, target, .45);
      const delayed = !bridge && round.plan === "Lurk" && lurker;
      const saves = round.finish === "save" && round.winner !== round.attack;
      const playsMain = index === roles.lurk || (round.postPlant === "Open plant" && index !== roles.lead);
      const anchor = round.planted && playsMain ? entrance : entry;
      const takeSpawn = round.postPlant === "Push CT" && index === roles.lead;
      const late = saves ? layout.attack : takeSpawn ? mix(back, layout.defense, .32)
        : round.planted && delayed ? back : anchor;
      return { spawn: bridge ? layout.attackAlt : layout.attack, buyZone: bridge ? "attackAlt" : undefined,
        points: [buy, bridge ? fractureBridge[round.site].main : opening, delayed ? alternate.link : entry, late, late],
        via: connector && !delayed ? link : null };
    }
    const pushers = [roles.lead, roles.support].includes(index);
    const push = round.defense === "Take space" && pushers;
    const midPush = round.defense === "Fight mid" && pushers;
    const flank = round.defense === "Flank" && index === roles.lurk;
    const stack = round.defense === "Site stack" && index !== roles.lurk && lanesFor(map, round.defenseSite);
    const anchor = stack || hold;
    const buy = push || midPush ? back : flank ? alternate.target
      : round.defense === "Fight mid" && index === roles.lurk ? link : anchor.target;
    const opening = push ? mix(main, layout.attack, .25) : midPush ? layout.mid
      : flank ? alternate.main : round.defense === "Crossfire" ? (index % 2 ? anchor.back : anchor.link)
        : index === roles.support ? anchor.link : anchor.target;
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


  function spikePosition(lane, round) {
    return round.postPlant === "Open plant" ? mix(lane.target, lane.main, .29) : lane.target;
  }

  return { layouts, phases, lanesFor, buySeconds, phaseDuration, phaseStart, movement, buyBarriers, mapCover, spikePosition, playMap };
})();
