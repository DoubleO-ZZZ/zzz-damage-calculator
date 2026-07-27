import test from "node:test";
import assert from "node:assert/strict";

import {
  compareInvestments,
  createDefaultComparisonState,
} from "../src/comparison-engine.js";
import {
  CHARACTERS,
  WEAPONS,
} from "../src/data/catalog.js";
import {
  normalizeDiscSelections,
  resolveDiscBuild,
} from "../src/disk-build.js";

test("catalog contains verified character and W-Engine presets", () => {
  assert.ok(CHARACTERS.length >= 50);
  assert.ok(WEAPONS.length >= 70);
  assert.equal(
    CHARACTERS.find((character) => character.name === "「11호」")?.attack,
    888,
  );
  assert.deepEqual(
    WEAPONS.find((weapon) => weapon.name === "유황석"),
    {
      id: "14104",
      name: "유황석",
      rank: "S급",
      specialty: "강공",
      baseAttack: 684,
      secondaryStat: "공격력",
      secondaryValue: 30,
      secondaryUnit: "percent",
      version: "3.0 live",
      sourceUrl: "https://zzz.nanoka.cc/weapon/14104",
    },
  );
});

test("identical profiles produce a tie", () => {
  const state = createDefaultComparisonState();
  state.profiles.B = { ...state.profiles.A };
  const result = compareInvestments(state);

  assert.equal(result.winner, "tie");
  assert.equal(result.deltaRaw, 0);
  assert.equal(result.deltaPercent, 0);
});

test("W-Engine base and secondary stats affect the comparison", () => {
  const state = createDefaultComparisonState();
  state.profiles.A.weaponId = "14104";
  state.profiles.B.weaponId = "13004";
  const result = compareInvestments(state);

  assert.ok(result.A.rawDamage > result.B.rawDamage);
  assert.equal(result.winner, "A");
  assert.ok(result.deltaPercent < 0);
});

test("the default comparison has a stable verified result", () => {
  const result = compareInvestments(createDefaultComparisonState());

  assert.equal(result.A.displayedDamage, 33429);
  assert.equal(result.B.displayedDamage, 30893);
  assert.ok(Math.abs(result.deltaPercent - -7.585293143424984) < 1e-12);
});

test("conditional bonuses can model a Mindscape or W-Engine passive", () => {
  const state = createDefaultComparisonState();
  state.profiles.B = { ...state.profiles.A };
  state.profiles.B.mindscape = 1;
  state.profiles.B.passiveDamageBonusPercent = 30;
  const result = compareInvestments(state);

  assert.equal(result.winner, "B");
  assert.ok(result.deltaPercent > 0);
});

test("conditional Mindscape values stay off unless max activation is selected", () => {
  const state = createDefaultComparisonState();
  state.profiles.B = {
    ...state.profiles.A,
    mindscape: 2,
    mindscapeEffectMode: "off",
  };
  const inactive = compareInvestments(state);

  assert.equal(inactive.winner, "tie");
  assert.equal(inactive.B.mindscape.applied.length, 0);
  assert.equal(inactive.B.mindscape.unsupported[0].level, 1);

  state.profiles.B.mindscapeEffectMode = "max";
  const active = compareInvestments(state);
  assert.equal(active.winner, "B");
  assert.equal(active.B.mindscape.applied[0].stat, "damageBonus");
  assert.equal(active.B.mindscape.applied[0].amount, 36);
});

test("always-on Mindscape stats apply without enabling conditional effects", () => {
  const state = createDefaultComparisonState();
  state.common.characterId = "1321";
  state.profiles.B = {
    ...state.profiles.A,
    mindscape: 2,
    mindscapeEffectMode: "off",
  };
  const result = compareInvestments(state);

  assert.equal(result.B.mindscape.applied[0].stat, "attackPercent");
  assert.equal(result.B.mindscape.applied[0].amount, 15);
  assert.ok(result.B.rawDamage > result.A.rawDamage);
});

test("conditional attack percent applies in combat, not to town attack", () => {
  const state = createDefaultComparisonState();
  state.profiles.B = {
    ...state.profiles.A,
    passiveAttackPercent: 30,
  };
  const result = compareInvestments(state);

  assert.equal(result.A.townAttack, result.B.townAttack);
  assert.ok(result.B.combatAttack > result.A.combatAttack);
});

test("normal anomaly selection applies its own base coefficient", () => {
  const state = createDefaultComparisonState();
  state.common.mode = "anomaly";
  state.profiles.B = { ...state.profiles.A };

  state.common.anomalyKey = "강타";
  const assault = compareInvestments(state).A.rawDamage;
  state.common.anomalyKey = "연소";
  const burn = compareInvestments(state).A.rawDamage;

  assert.ok(Math.abs(assault / burn - 14.26) < 1e-12);
});

test("comparison enforces the shared character for both plans", () => {
  const state = createDefaultComparisonState();
  state.common.characterId = "1371";
  state.profiles.A.characterId = "1041";
  state.profiles.B.characterId = "1501";
  const result = compareInvestments(state);

  assert.equal(result.A.character.id, "1371");
  assert.equal(result.B.character.id, "1371");
});

test("comparison supports Mingpo and anomaly formulas", () => {
  const mingpoState = createDefaultComparisonState();
  mingpoState.common.mode = "mingpo";
  mingpoState.common.characterId = "1371";
  mingpoState.profiles.B = { ...mingpoState.profiles.A };
  assert.equal(compareInvestments(mingpoState).winner, "tie");

  const anomalyState = createDefaultComparisonState();
  anomalyState.common.mode = "anomaly";
  anomalyState.common.characterId = "1501";
  anomalyState.profiles.B = { ...anomalyState.profiles.A };
  assert.equal(compareInvestments(anomalyState).winner, "tie");
});

test("percentage differences use raw damage before display rounding", () => {
  const state = createDefaultComparisonState();
  const result = compareInvestments(state);
  const expected =
    ((result.B.rawDamage - result.A.rawDamage) / result.A.rawDamage) * 100;

  assert.equal(result.deltaPercent, expected);
});

test("anomaly disc presets split effective rolls between AP and ATK", () => {
  const character = CHARACTERS.find((item) => item.id === "1501");
  const build = resolveDiscBuild({
    profile: {
      discBuildMode: "anomaly",
      discScore: 20,
      discFourPieceId: "31500",
      discTwoPieceId: "31600",
      discEffectMode: "off",
    },
    character,
    mode: "anomaly",
  });

  assert.deepEqual(build.rolls, {
    anomalyProficiency: 10,
    attackPercent: 10,
    critRatePercent: 0,
    critDamagePercent: 0,
  });
  assert.equal(build.discAnomalyProficiency, 182);
  assert.equal(build.discAttackPercent, 30);
  assert.equal(build.discAnomalyMasteryPercent, 30);
});

test("all anomaly score presets keep AP and ATK rolls balanced", () => {
  const character = CHARACTERS.find((item) => item.id === "1501");
  const expected = {
    20: [10, 10],
    25: [13, 12],
    30: [15, 15],
  };
  for (const [score, [apRolls, attackRolls]] of Object.entries(expected)) {
    const build = resolveDiscBuild({
      profile: {
        discBuildMode: "anomaly",
        discScore: Number(score),
        discFourPieceId: "31500",
        discTwoPieceId: "31600",
        discEffectMode: "off",
      },
      character,
      mode: "anomaly",
    });
    assert.equal(build.rolls.anomalyProficiency, apRolls);
    assert.equal(build.rolls.attackPercent, attackRolls);
  }
});

test("attack disc presets fill crit rate before splitting CD and ATK", () => {
  const character = CHARACTERS.find((item) => item.id === "1041");
  const build = resolveDiscBuild({
    profile: {
      discBuildMode: "attack",
      discScore: 30,
      discFourPieceId: "31500",
      discTwoPieceId: "31600",
      discEffectMode: "off",
      passiveCritRatePercent: 0,
    },
    character,
    weaponCritRatePercent: 24,
    mode: "strong",
  });

  assert.equal(build.rolls.critRatePercent, 14);
  assert.equal(build.rolls.critDamagePercent, 8);
  assert.equal(build.rolls.attackPercent, 8);
  assert.equal(build.discAttackPercent, 54);
  assert.equal(build.discCritRatePercent, 57.6);
  assert.equal(build.discCritDamagePercent, 38.4);
  assert.equal(build.critCapReached, true);
});

test("attack presets support 35/40 points and cap crit rolls at 30", () => {
  const character = CHARACTERS.find((item) => item.id === "1171");
  for (const score of [35, 40]) {
    const build = resolveDiscBuild({
      profile: {
        discBuildMode: "attack",
        discScore: score,
        discFourPieceId: "31500",
        discTwoPieceId: "31600",
        discEffectMode: "off",
        passiveCritRatePercent: 0,
      },
      character,
      mode: "strong",
    });
    assert.ok(build.rolls.critRatePercent <= 30);
    assert.ok(
      Math.abs(
        build.rolls.critDamagePercent - build.rolls.attackPercent,
      ) <= 1,
    );
    assert.equal(
      Object.values(build.rolls).reduce((sum, value) => sum + value, 0),
      score,
    );
  }
});

test("an already capped attack build assigns every substat roll to CD and ATK", () => {
  const character = CHARACTERS.find((item) => item.id === "1041");
  const build = resolveDiscBuild({
    profile: {
      discBuildMode: "attack",
      discScore: 40,
      discFourPieceId: "31000",
      discTwoPieceId: "31500",
      discEffectMode: "off",
      passiveCritRatePercent: 60,
    },
    character,
    weaponCritRatePercent: 24,
    mode: "strong",
  });

  assert.equal(build.rolls.critRatePercent, 0);
  assert.equal(build.rolls.critDamagePercent, 20);
  assert.equal(build.rolls.attackPercent, 20);
});

test("a selected 4-piece grants its 2-piece bonus and max mode is explicit", () => {
  const character = CHARACTERS.find((item) => item.id === "1041");
  const build = resolveDiscBuild({
    profile: {
      discBuildMode: "attack",
      discScore: 30,
      discFourPieceId: "31400",
      discTwoPieceId: "31000",
      discEffectMode: "max",
      passiveCritRatePercent: 0,
    },
    character,
    mode: "strong",
  });

  assert.equal(build.setTotals.discAttackPercent, 10);
  assert.equal(build.setTotals.discCritRatePercent, 8);
  assert.equal(build.setTotals.passiveAttackPercent, 25);
});

test("4-piece and 2-piece selectors cannot keep the same set", () => {
  const character = CHARACTERS.find((item) => item.id === "1041");
  const profile = {
    discFourPieceId: "32200",
    discTwoPieceId: "32200",
  };

  normalizeDiscSelections(profile, character, "strong");
  assert.notEqual(profile.discFourPieceId, profile.discTwoPieceId);
});

test("max set mode never bypasses attribute or stat thresholds", () => {
  const character = CHARACTERS.find((item) => item.id === "1041");
  const wrongAttribute = resolveDiscBuild({
    profile: {
      discBuildMode: "attack",
      discScore: 30,
      discFourPieceId: "34000",
      discTwoPieceId: "31500",
      discEffectMode: "max",
      passiveCritRatePercent: 0,
    },
    character,
    mode: "strong",
  });
  assert.equal(wrongAttribute.setTotals.passiveCritDamagePercent, 0);
  assert.equal(wrongAttribute.setTotals.passiveDamageBonusPercent, 0);
  assert.equal(wrongAttribute.setTotals.passiveAttackPercent, 10);

  const belowThreshold = resolveDiscBuild({
    profile: {
      discBuildMode: "manual",
      discFourPieceId: "32700",
      discTwoPieceId: "31500",
      discEffectMode: "max",
      discAnomalyMasteryPercent: 0,
    },
    character,
    mode: "strong",
  });
  assert.equal(belowThreshold.setTotals.discCritDamagePercent, 16);
  assert.equal(belowThreshold.setTotals.passiveCritDamagePercent, 0);

  const aboveThreshold = resolveDiscBuild({
    profile: {
      discBuildMode: "manual",
      discFourPieceId: "32700",
      discTwoPieceId: "31500",
      discEffectMode: "off",
      discAnomalyMasteryPercent: 30,
    },
    character,
    mode: "strong",
  });
  assert.equal(aboveThreshold.setTotals.discCritDamagePercent, 16);
  assert.equal(aboveThreshold.setTotals.passiveCritDamagePercent, 30);
});

test("element-scoped Mindscape effects use the selected agent attribute", () => {
  const state = createDefaultComparisonState();
  state.common.characterId = "1521";
  state.profiles.B = {
    ...state.profiles.A,
    mindscape: 1,
    mindscapeEffectMode: "off",
  };
  const result = compareInvestments(state);

  assert.equal(result.B.mindscape.applied[0].stat, "resistanceIgnore");
  assert.equal(result.B.mindscape.applied[0].amount, 5);
  assert.equal(result.B.mindscape.applied[0].element, "전기");
  assert.ok(result.B.rawDamage > result.A.rawDamage);
});
