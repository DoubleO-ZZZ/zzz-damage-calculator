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

  assert.equal(result.A.displayedDamage, 46860);
  assert.equal(result.B.displayedDamage, 43468);
  assert.ok(Math.abs(result.deltaPercent - -7.238307349665929) < 1e-12);
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

test("Mindscape level is metadata until its numerical effect is entered", () => {
  const state = createDefaultComparisonState();
  state.profiles.B = { ...state.profiles.A, mindscape: 6 };
  const result = compareInvestments(state);

  assert.equal(result.winner, "tie");
  assert.equal(result.B.profile.mindscape, 6);
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
