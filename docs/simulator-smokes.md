# Simulator smoke placement

Smoke decisions are authored approximations for the local radar, not copied VOD
coordinates or a claim of exact professional play. Elevation-dependent one-ways
are not represented by the two-dimensional model.

## Placement

Each choke has an entrance midpoint, a direction into the lane being denied, and
an aperture width. The circle is placed as deep as possible while covering both
ends of the opening, with a small overlap allowance. Different smoke radii therefore
produce different centers. The movement grid validates proximity to the map but
does not round or relocate those centers. This avoids gaps and excessive bulging.
Lotus apertures were calibrated against the local radar and the user's references;
other maps retain their existing named anchors with an estimated 3 m doorway width.

## Situations

- Rush: early, closely timed rotation cuts.
- Default/slow/lurk: early information denial only when enough charges or a recharge
  remain for the execute.
- Fake: one alternate-site cut, subject to the same reserve requirement.
- Split/mid: leave the friendly connector group's entrance open.
- Defense: entry smokes on nearby pressure; deeper map-control smokes for a contest.
- Retake: isolate main, but preserve a friendly flank. Open plants and clutch
  scenarios request smoke on the spike to cover a defuse.
- Post-plant: refresh threatened rotation chokes, except when teammates push CT.

Existing caster survival, range, utility budget, charge limits and smoke lifetimes
still gate requests. A request is not a guaranteed cast.

## Research consulted

- [Mobalytics controller guide](https://mobalytics.gg/blog/valorant/controller-guide-tips-tricks-responsibilities/): flush placement, cooldown conservation, connector control, retakes and defuse cover.
- [ONE Esports Lotus guide](https://www.oneesports.gg/valorant/best-smokes-on-valorant-map-lotus/): A Stairs control, Top/Drop, B rotation cuts, C Hall/Waterfall and aggressive versus passive defense.
- [Turbosmurfs guide supplied by the user](https://turbosmurfs.gg/article/valorant-essential-tips-and-tricks-to-place-smokes): ranked attack/defense variants across maps.
- [Pro-play smoke breakdown](https://note.com/wakamiya26/n/ne1cd3ed2c085): examples referencing Boaster and SugarZ3ro. Deliberately expanded survival smokes and elevation-based one-ways are situational exceptions, not the default doorway-placement rule. The linked broadcast clips were not directly reviewed in this change.

Validation: `node tests/test_simulator_smokes.cjs`.
