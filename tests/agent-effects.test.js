import test from "node:test";
import assert from "node:assert/strict";

import { CHARACTER_BY_ID } from "../src/data/catalog.js";
import {
  AGENT_CORE_STATIC_STATS_BY_ID,
  AGENT_EFFECTS_BY_ID,
  resolveAgentEffects,
} from "../src/data/agent-effects.js";

function effectsFor(characterId, overrides = {}) {
  const owner = CHARACTER_BY_ID[characterId];
  return resolveAgentEffects(characterId, {
    owner,
    dealer: owner,
    team: [owner],
    maxActivation: true,
    ...overrides,
  });
}

function appliedAmount(result, stat) {
  return result.applied
    .filter((row) => row.stat === stat)
    .reduce((sum, row) => sum + row.amount, 0);
}

test("verified unconditional core crit-rate sources resolve at maximum activation", () => {
  const expected = new Map([
    ["1291", 12],
    ["1301", 25],
    ["1321", 25],
    ["1381", 10],
    ["1431", 30],
    ["1441", 10],
  ]);

  for (const [characterId, critRate] of expected) {
    assert.equal(
      appliedAmount(effectsFor(characterId), "critRate"),
      critRate,
      `character ${characterId}`,
    );
  }
});

test("HP-scaled core crit rate uses the supplied initial HP", () => {
  const result = effectsFor("1341", {
    stats: { initialHp: 27000 },
  });

  assert.ok(
    Math.abs(appliedAmount(result, "critRate") - 37.8) < 1e-12,
  );
});

test("Harumasa core crit rate is scoped to dash attacks", () => {
  const normal = effectsFor("1201", { skillType: "normal" });
  const dash = effectsFor("1201", { skillType: "dash" });

  assert.equal(appliedAmount(normal, "critRate"), 0);
  assert.equal(appliedAmount(dash, "critRate"), 25);
  assert.equal(
    normal.skipped.find((row) => row.stat === "critRate")?.skippedReason,
    "scope:skill",
  );
});

test("Zhu Yuan additional crit rate requires a support teammate", () => {
  const owner = CHARACTER_BY_ID["1241"];
  const withoutSupport = effectsFor("1241");
  const withSupport = effectsFor("1241", {
    team: [owner, CHARACTER_BY_ID["1311"]],
  });

  assert.equal(appliedAmount(withoutSupport, "critRate"), 0);
  assert.equal(appliedAmount(withSupport, "critRate"), 30);
});

test("Ben party crit rate follows same-element or same-camp eligibility", () => {
  const owner = CHARACTER_BY_ID["1121"];
  const ineligible = effectsFor("1121", {
    team: [owner, CHARACTER_BY_ID["1051"]],
  });
  const sameCamp = effectsFor("1121", {
    team: [owner, CHARACTER_BY_ID["1111"]],
  });

  assert.equal(appliedAmount(ineligible, "critRate"), 0);
  assert.equal(appliedAmount(sameCamp, "critRate"), 16);
  assert.equal(
    sameCamp.applied.find((row) => row.stat === "critRate")?.target,
    "party",
  );
});

test("Jane assault-only crit stays unsupported and out of global crit rate", () => {
  const result = effectsFor("1261", { mode: "anomaly" });

  assert.equal(appliedAmount(result, "critRate"), 0);
  assert.equal(result.unsupported.length, 1);
  assert.equal(result.unsupported[0].stat, "unsupported");
  assert.match(result.unsupported[0].unsupportedReason, /일반 치명타 확률/);
});

test("all-skill rows act as a wildcard for an actual selected attack", () => {
  const result = effectsFor("1531", {
    mode: "mingpo",
    skillType: "normal",
  });

  assert.equal(
    result.applied.find((row) => row.key.endsWith(":selected-damage"))
      ?.amount,
    40,
  );
});

test("Cissia core DEF ignore follows its partial stepped values and cap", () => {
  const owner = CHARACTER_BY_ID["1521"];
  const dealer = CHARACTER_BY_ID["1011"];
  const base = effectsFor("1521", {
    dealer,
    team: [dealer, owner],
    stats: { energyRegen: 1.2 },
  });
  const below = effectsFor("1521", {
    dealer,
    team: [dealer, owner],
    stats: { energyRegen: 3.12 },
  });
  const reached = effectsFor("1521", {
    dealer,
    team: [dealer, owner],
    stats: { energyRegen: 3.68 },
  });

  const amount = (result) =>
    result.applied.find((row) =>
      row.key.endsWith(":electric-defense-ignore"),
    )?.amount;

  assert.equal(amount(base), 6);
  assert.equal(amount(below), 20);
  assert.equal(amount(reached), 25);
  assert.equal(appliedAmount(reached, "critRate"), 18);
  assert.equal(
    reached.applied.find((row) =>
      row.key.endsWith(":electric-defense-ignore"),
    )?.amount,
    25,
  );
  assert.equal(
    reached.applied.find((row) =>
      row.key.endsWith(":electric-defense-ignore"),
    )?.stat,
    "defenseIgnore",
  );
});

test("Lighter, Zhao, and Yuzuha use their verified stepped or scaled formulas", () => {
  const lighterOwner = CHARACTER_BY_ID["1161"];
  const fireDealer = CHARACTER_BY_ID["1041"];
  const lighterR1 = effectsFor("1161", {
    dealer: fireDealer,
    team: [fireDealer, lighterOwner],
    stats: { impact: 256.19 },
  });
  const lighterR5 = effectsFor("1161", {
    dealer: fireDealer,
    team: [fireDealer, lighterOwner],
    stats: { impact: 276.74 },
  });
  assert.equal(
    lighterR1.applied.find((row) => row.stat === "damageBonus")?.amount,
    65,
  );
  assert.equal(
    lighterR5.applied.find((row) => row.stat === "damageBonus")?.amount,
    75,
  );

  const zhao = effectsFor("1341", {
    stats: { initialHp: 22075.06 },
  });
  assert.equal(
    zhao.applied.find((row) => row.stat === "damageBonus")?.amount,
    27,
  );

  const yuzuhaOwner = CHARACTER_BY_ID["1411"];
  const anomalyDealer = CHARACTER_BY_ID["1561"];
  const yuzuha = effectsFor("1411", {
    dealer: anomalyDealer,
    team: [anomalyDealer, yuzuhaOwner],
    mode: "anomaly",
    stats: { anomalyMastery: 150 },
  });
  assert.equal(
    yuzuha.applied.find((row) => row.stat === "anomalyDamageBonus")
      ?.amount,
    10,
  );
});

test("Belina energy conversion keeps its verified partial scaling", () => {
  const result = effectsFor("1561", {
    mode: "anomaly",
    stats: { energyRegen: 1.56 },
  });

  assert.ok(
    Math.abs(
      result.applied.find((row) => row.stat === "damageBonus")?.amount -
        7.56,
    ) < 1e-12,
  );
  assert.ok(
    Math.abs(
      result.applied.find((row) => row.stat === "anomalyMasteryFlat")
        ?.amount - 18,
    ) < 1e-12,
  );
});

test("Ju Fufu party crit damage follows 100-ATK steps above 2800", () => {
  const amounts = [2800, 2899, 2900, 3400].map((initialAttack) =>
    effectsFor("1391", { stats: { initialAttack } }).applied.find(
      (row) => row.stat === "critDamage",
    )?.amount,
  );

  assert.deepEqual(amounts, [20, 20, 25, 50]);
});

test("Norma core uses initial crit and flat Penetration point inputs", () => {
  const combatCritOnly = effectsFor("1571", {
    stats: {
      initialCritRate: 50,
      critRate: 80,
      flatPenetration: 800,
      penetrationRatio: 50,
    },
  });
  const initialCrit = effectsFor("1571", {
    stats: {
      initialCritRate: 80,
      critRate: 80,
      flatPenetration: 960,
      penetrationRatio: 0,
    },
  });

  assert.equal(appliedAmount(combatCritOnly, "critDamage"), 0);
  assert.equal(appliedAmount(combatCritOnly, "flatAttack"), 1000);
  assert.equal(appliedAmount(initialCrit, "critDamage"), 51);
  assert.equal(appliedAmount(initialCrit, "flatAttack"), 1200);
});

test("Promia core reads initial rather than combat Anomaly Mastery", () => {
  const result = effectsFor("1541", {
    mode: "anomaly",
    stats: {
      initialAnomalyMastery: 180,
      anomalyMastery: 230,
    },
  });

  assert.equal(appliedAmount(result, "anomalyProficiency"), 45);
});

test("core promotion stats that are not baked into the catalog remain explicit", () => {
  assert.equal(
    AGENT_CORE_STATIC_STATS_BY_ID["1521"].energyRegenFlat,
    0.36,
  );
  assert.equal(AGENT_CORE_STATIC_STATS_BY_ID["1341"].hpPercent, 18);
  assert.equal(
    AGENT_CORE_STATIC_STATS_BY_ID["1491"].attackPercent,
    21,
  );
});

test("every registered agent effect row keeps source metadata", () => {
  for (const definition of Object.values(AGENT_EFFECTS_BY_ID)) {
    assert.match(
      definition.sourceUrl,
      /^https:\/\/static\.nanoka\.cc\/zzz\/3\.0\/ko\/character\//,
    );
    for (const row of definition.effects) {
      assert.ok(row.key.startsWith(`${definition.id}:`));
      assert.ok(row.origin);
      assert.ok(row.target);
    }
  }
});
