import test from "node:test";
import assert from "node:assert/strict";

import {
  WEAPON_PASSIVES,
  WEAPON_PASSIVE_SUPPORTED_STATS,
  getWeaponPassive,
  resolveWeaponPassiveEffects,
} from "../src/data/weapon-passives.js";

const strongContext = {
  mode: "strong",
  element: "불",
  anomalyKey: "연소",
  skillType: ["basic"],
  characterId: "1041",
  maxActivation: true,
};

test("live 3.0 damage-specialty W-Engines have R1-R5 passive data", () => {
  const passives = Object.values(WEAPON_PASSIVES);
  assert.equal(passives.length, 44);
  assert.equal(passives.filter((entry) => entry.specialty === "강공").length, 21);
  assert.equal(passives.filter((entry) => entry.specialty === "명파").length, 8);
  assert.equal(passives.filter((entry) => entry.specialty === "이상").length, 15);
  for (const passive of passives) {
    assert.equal(passive.refinements.length, 5);
    assert.match(passive.sourceUrl, /\/3\.0\/ko\/weapon\/\d+\.json$/);
    for (const row of passive.effects) {
      assert.equal(row.values.length, 5);
    }
  }
});

test("getWeaponPassive exposes the verified title and five refinements", () => {
  const passive = getWeaponPassive("14104");
  assert.equal(passive.name, "유황석");
  assert.equal(passive.title, "뜨거운 숨결");
  assert.equal(passive.refinements[4].refinement, 5);
  assert.match(passive.refinements[4].description, /7% × 최대 8스택/);
  assert.equal(getWeaponPassive("custom"), null);
});

test("Brimstone refinement and maximum stacks scale ATK correctly", () => {
  const r1 = resolveWeaponPassiveEffects("14104", 1, strongContext);
  const r5 = resolveWeaponPassiveEffects("14104", 5, strongContext);
  const inactive = resolveWeaponPassiveEffects("14104", 5, {
    ...strongContext,
    maxActivation: false,
  });

  assert.equal(r1.totals.attackPercent, 28);
  assert.equal(r5.totals.attackPercent, 56);
  assert.equal(inactive.totals.attackPercent, 0);
  assert.equal(inactive.skipped[0].skippedReason, "inactive");
});

test("always-on and skill-scoped passives resolve independently", () => {
  const ex = resolveWeaponPassiveEffects("13013", 5, {
    ...strongContext,
    skillType: ["ex-special"],
  });
  const basic = resolveWeaponPassiveEffects("13013", 5, strongContext);

  assert.equal(ex.totals.attackPercent, 9.6);
  assert.equal(ex.totals.damageBonus, 24);
  assert.equal(basic.totals.attackPercent, 9.6);
  assert.equal(basic.totals.damageBonus, 0);
  assert.equal(basic.skipped[0].skippedReason, "scope:skillType");
});

test("independent Deep Sea Visitor crit buffs can coexist at maximum", () => {
  const result = resolveWeaponPassiveEffects("14119", 5, {
    ...strongContext,
    element: "얼음",
  });
  assert.equal(result.totals.damageBonus, 50);
  assert.equal(result.totals.critRate, 40);
});

test("extra-hit stays separate while DEF ignore uses its own multiplier field", () => {
  const cannon = resolveWeaponPassiveEffects("14001", 5, strongContext);
  assert.equal(cannon.totals.attackPercent, 12);
  assert.equal(cannon.unsupported.length, 1);
  assert.match(cannon.unsupported[0].reason, /별도 추가 피해/);

  const eclipse = resolveWeaponPassiveEffects("14129", 5, strongContext);
  assert.equal(eclipse.totals.critDamage, 72);
  assert.equal(eclipse.totals.defenseReduction, 0);
  assert.equal(eclipse.totals.defenseIgnore, 40);
  assert.equal(eclipse.unsupported.length, 0);

  const flamethrower = resolveWeaponPassiveEffects(
    "14130",
    5,
    strongContext,
  );
  assert.equal(flamethrower.totals.defenseIgnore, 48);
});

test("flat Anomaly Mastery is not converted into a percentage", () => {
  const result = resolveWeaponPassiveEffects("14140", 5, {
    mode: "anomaly",
    element: "물리",
    anomalyKey: "강타",
    skillType: [],
    characterId: "1401",
    maxActivation: true,
  });
  assert.equal(result.totals.anomalyMasteryFlat, 96);
  assert.equal(result.totals.anomalyMastery, 0);
  assert.equal(result.totals.damageBonus, 64);
});

test("Flamemaker Shaker preserves the off-field double maximum", () => {
  const result = resolveWeaponPassiveEffects("14117", 5, {
    mode: "anomaly",
    element: "불",
    anomalyKey: "연소",
    skillType: [],
    characterId: "1171",
    maxActivation: true,
  });
  assert.equal(result.totals.damageBonus, 140);
  assert.equal(result.totals.anomalyProficiency, 100);
  assert.equal(result.unsupported.length, 1);
  assert.match(result.unsupported[0].reason, /에너지 회복/);
});

test("Mingpo passives separate generic and skill-scoped Sheer damage", () => {
  const ex = resolveWeaponPassiveEffects("14137", 5, {
    mode: "mingpo",
    element: "에테르",
    anomalyKey: null,
    skillType: ["ex-special"],
    characterId: "1371",
    maxActivation: true,
  });
  const basic = resolveWeaponPassiveEffects("14137", 5, {
    ...strongContext,
    mode: "mingpo",
    element: "에테르",
    skillType: ["basic"],
  });
  assert.equal(ex.totals.critRate, 32);
  assert.equal(ex.totals.damageBonus, 25.6);
  assert.equal(ex.totals.penetrationDamageBonus, 32);
  assert.equal(basic.totals.damageBonus, 25.6);
  assert.equal(basic.totals.penetrationDamageBonus, 0);
});

test("Electro-Walk converts its maximum stacks into flat Penetration", () => {
  const result = resolveWeaponPassiveEffects("13014", 5, {
    mode: "mingpo",
    element: "전기",
    anomalyKey: null,
    skillType: ["ultimate"],
    characterId: "1371",
    maxActivation: true,
  });

  assert.equal(result.totals.flatPenetration, 384);
  assert.equal(result.unsupported.length, 0);
});

test("character-scoped effects do not leak to another equipper", () => {
  const wrongCharacter = resolveWeaponPassiveEffects("14155", 5, {
    ...strongContext,
    element: "에테르",
  });
  const pyrois = resolveWeaponPassiveEffects("14155", 5, {
    ...strongContext,
    element: "에테르",
    characterId: "1551",
  });
  assert.equal(wrongCharacter.totals.critRate, 20);
  assert.equal(wrongCharacter.totals.resistanceIgnore, 0);
  assert.equal(wrongCharacter.skipped[0].skippedReason, "scope:characterId");
  assert.equal(pyrois.totals.resistanceIgnore, 22);
});

test("every passive resolves finite common totals at R1 and R5", () => {
  for (const passive of Object.values(WEAPON_PASSIVES)) {
    for (const refinement of [1, 5]) {
      const result = resolveWeaponPassiveEffects(
        passive.id,
        refinement,
        {
          mode:
            passive.specialty === "명파"
              ? "mingpo"
              : passive.specialty === "이상"
                ? "anomaly"
                : "strong",
          element: ["물리", "불", "얼음", "전기", "에테르", "바람"],
          anomalyKey: ["강타", "연소", "쇄빙", "감전", "침식", "풍화", "난개", "난류", "혼돈"],
          skillType: [
            "basic",
            "dash",
            "dodge-counter",
            "special",
            "ex",
            "ex-special",
            "chain",
            "ultimate",
            "assist",
            "assist-attack",
            "aftershock",
          ],
          characterId: passive.id === "14155" ? "1551" : "1041",
          maxActivation: true,
        },
      );
      assert.deepEqual(Object.keys(result.totals), [
        ...WEAPON_PASSIVE_SUPPORTED_STATS,
      ]);
      for (const total of Object.values(result.totals)) {
        assert.equal(Number.isFinite(total), true);
      }
    }
  }
});

test("unknown and out-of-range refinement inputs are safe", () => {
  const unknown = resolveWeaponPassiveEffects("custom", 9, strongContext);
  assert.equal(unknown.refinement, 5);
  assert.equal(unknown.title, "");
  assert.equal(unknown.applied.length, 0);
  assert.equal(unknown.totals.attackPercent, 0);

  const clamped = resolveWeaponPassiveEffects("14104", 0, strongContext);
  assert.equal(clamped.refinement, 1);
  assert.equal(clamped.totals.attackPercent, 28);
});
