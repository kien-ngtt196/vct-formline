const SkirmishPolicy = (() => {
  const version = 3;
  const features = ["bias", "attack", "opening", "execute", "late", "progress",
    "tradePartner", "contact", "routeRemaining"];
  const actions = ["hold", "advance", "hurry"];
  const speed = [0, 1, 1.45];

  function valid(weights) {
    return Array.isArray(weights) && weights.length === actions.length
      && weights.every((row) => Array.isArray(row) && row.length === features.length && row.every(Number.isFinite));
  }

  function load(bundle) {
    if (bundle?.version !== version || typeof bundle.id !== "string"
      || !Array.isArray(bundle.models) || bundle.models.length !== 2
      || !bundle.models.every((side) => Array.isArray(side) && side.length === 5 && side.every(valid))) {
      throw new Error("The ten bot policies are unavailable or incompatible.");
    }
    return bundle;
  }

  function score(weights, inputs) {
    return weights.map((row) => row.reduce((sum, weight, index) => sum + weight * inputs[index], 0));
  }

  function pace(weights, inputs) {
    const [hold, advance, hurry] = score(weights, inputs);
    return hold > advance && hold > hurry ? speed[0] : hurry > advance ? speed[2] : speed[1];
  }

  return { version, features, actions, load, pace };
})();
