import test from "node:test";
import assert from "node:assert/strict";

import {
  compareInvestments,
  createDefaultComparisonState,
  mergeComparisonState,
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
  state.profiles.A.weaponEffectMode = "off";
  state.profiles.B.weaponEffectMode = "off";
  const result = compareInvestments(state);

  assert.ok(result.A.rawDamage > result.B.rawDamage);
  assert.equal(result.winner, "A");
  assert.ok(result.deltaPercent < 0);
});

test("the default comparison has a stable verified result", () => {
  const result = compareInvestments(createDefaultComparisonState());

  assert.equal(result.common.stunned, true);
  assert.equal(result.A.displayedDamage, 455768);
  assert.equal(result.B.displayedDamage, 406830);
  assert.ok(Math.abs(result.deltaPercent - -10.737489793537861) < 1e-12);
});

test("dealer and support copies of the same party disc buff do not stack", () => {
  const state = createDefaultComparisonState();
  for (const profile of Object.values(state.profiles)) {
    profile.discBuildMode = "manual";
    profile.discFourPieceId = "31600";
    profile.discTwoPieceId = "31000";
    profile.discEffectMode = "max";
  }
  state.common.party.member2.discFourPieceId = "31600";
  state.common.party.member3.discFourPieceId = "31000";

  const sameSet = compareInvestments(state);
  const sameSetDamage =
    sameSet.A.effectiveProfile.passiveDamageBonusPercent +
    sameSet.common.partyDamageBonusPercent;

  state.common.party.member2.discFourPieceId = "31900";
  const differentSet = compareInvestments(state);
  const differentSetDamage =
    differentSet.A.effectiveProfile.passiveDamageBonusPercent +
    differentSet.common.partyDamageBonusPercent;

  assert.equal(differentSetDamage - sameSetDamage, 15);
});

test("Belina signature applies its self and party AP exactly once", () => {
  const state = createDefaultComparisonState();
  state.common.characterId = "1561";
  state.common.mode = "anomaly";
  state.common.anomalyKey = "풍화";
  for (const profile of Object.values(state.profiles)) {
    profile.characterId = "1561";
    profile.weaponId = "14156";
    profile.weaponRefinement = 1;
    profile.discBuildMode = "manual";
    profile.discAnomalyProficiency = 0;
  }

  const result = compareInvestments(state);
  assert.equal(
    result.A.effectiveProfile.passiveAnomalyProficiency,
    130,
  );
  assert.deepEqual(
    result.A.weaponPassive.applied
      .filter((row) => row.stat === "anomalyProficiency")
      .map((row) => row.amount),
    [70, 60],
  );
});

test("dealer disc Energy Regen reaches Cissia core DEF-ignore steps", () => {
  const state = createDefaultComparisonState();
  state.common.characterId = "1521";
  state.common.mode = "strong";
  for (const profile of Object.values(state.profiles)) {
    profile.characterId = "1521";
    profile.weaponId = "14152";
    profile.weaponRefinement = 1;
    profile.discBuildMode = "manual";
    profile.discFourPieceId = "31900";
    profile.discEffectMode = "max";
  }
  state.profiles.A.discTwoPieceId = "31000";
  state.profiles.B.discTwoPieceId = "31600";

  const result = compareInvestments(state);
  const coreIgnore = (plan) =>
    plan.agentEffects.applied.find(
      (row) => row.stat === "defenseIgnore",
    )?.amount;

  assert.equal(coreIgnore(result.A), 15);
  assert.equal(coreIgnore(result.B), 17);
  assert.equal(
    result.B.discBuild.setTotals.discEnergyRegenPercent,
    20,
  );
});

test("party HP buffs feed Mingpo HP-scaled core penetration", () => {
  const state = createDefaultComparisonState();
  state.common.characterId = "1371";
  state.common.mode = "mingpo";
  for (const profile of Object.values(state.profiles)) {
    profile.characterId = "1371";
    profile.weaponId = "14137";
    profile.discBuildMode = "manual";
    profile.discHpPercent = 60;
  }

  const baseline = compareInvestments(state);
  state.common.hpPercentBuff = 10;
  const buffed = compareInvestments(state);
  const corePenetration = (result) =>
    result.A.agentEffects.applied.find(
      (row) => row.stat === "flatPenetration",
    )?.amount;

  assert.ok(corePenetration(buffed) > corePenetration(baseline));
  assert.ok(
    Math.abs(
      corePenetration(buffed) -
        buffed.A.calculation.combatHp * 0.1,
    ) < 0.1,
  );
});

test("combat Anomaly Mastery buffs do not inflate Promia's initial-stat core", () => {
  const state = createDefaultComparisonState();
  state.common.characterId = "1541";
  state.common.mode = "anomaly";
  for (const profile of Object.values(state.profiles)) {
    profile.characterId = "1541";
    profile.discBuildMode = "manual";
    profile.discAnomalyMasteryPercent = 30;
  }

  const baseline = compareInvestments(state);
  state.common.partyAnomalyMasteryFlat += 50;
  const buffed = compareInvestments(state);
  const coreAmount = (result) =>
    result.A.agentEffects.applied.find((row) =>
      row.key.endsWith(":anomaly-proficiency"),
    )?.amount;

  assert.equal(coreAmount(buffed), coreAmount(baseline));
  assert.equal(
    buffed.A.calculation.snapshot.combatAnomalyMastery -
      baseline.A.calculation.snapshot.combatAnomalyMastery,
    50,
  );
});

test("W-Engine refinement changes its resolved passive and damage", () => {
  const state = createDefaultComparisonState();
  state.profiles.B = {
    ...state.profiles.A,
    weaponRefinement: 5,
  };
  const result = compareInvestments(state);

  assert.equal(result.A.weaponPassive.totals.attackPercent, 28);
  assert.equal(result.B.weaponPassive.totals.attackPercent, 56);
  assert.equal(result.A.townAttack, result.B.townAttack);
  assert.ok(result.B.combatAttack > result.A.combatAttack);
  assert.equal(result.winner, "B");
  assert.ok(result.deltaPercent > 0);
});

test("W-Engine conditional effects can be disabled explicitly", () => {
  const state = createDefaultComparisonState();
  state.profiles.B = {
    ...state.profiles.A,
    weaponEffectMode: "off",
  };
  const result = compareInvestments(state);

  assert.equal(result.A.weaponPassive.totals.attackPercent, 28);
  assert.equal(result.B.weaponPassive.totals.attackPercent, 0);
  assert.equal(result.B.weaponPassive.applied.length, 0);
  assert.equal(result.winner, "A");
});

test("W-Engine DEF ignore is distinct from DEF reduction", () => {
  const state = createDefaultComparisonState();
  state.common.characterId = "1291";
  state.profiles.A.weaponId = "14129";
  state.profiles.A.weaponRefinement = 5;
  state.profiles.B = {
    ...state.profiles.A,
    weaponEffectMode: "off",
  };
  const result = compareInvestments(state);

  assert.equal(result.A.weaponPassive.totals.defenseIgnore, 40);
  assert.equal(result.A.effectiveProfile.passiveDefenseIgnorePercent, 40);
  assert.equal(result.A.effectiveProfile.passiveDefenseReductionPercent, 0);
  assert.ok(result.A.rawDamage > result.B.rawDamage);
});

test("selected Mindscape effects use maximum activation by default", () => {
  const state = createDefaultComparisonState();
  state.profiles.B = {
    ...state.profiles.A,
    mindscape: 2,
  };
  const result = compareInvestments(state);

  assert.equal(result.B.profile.mindscapeEffectMode, "max");
  assert.equal(result.B.mindscape.totals.damageBonus, 36);
  assert.equal(
    result.B.effectiveProfile.passiveDamageBonusPercent -
      result.A.effectiveProfile.passiveDamageBonusPercent,
    36,
  );
  assert.equal(result.winner, "B");
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

test("Mindscape DEF ignore reaches the separate defense multiplier", () => {
  const state = createDefaultComparisonState();
  state.common.characterId = "1321";
  state.profiles.B = {
    ...state.profiles.A,
    mindscape: 1,
    mindscapeEffectMode: "max",
  };
  const result = compareInvestments(state);

  assert.equal(result.B.mindscape.totals.defenseIgnore, 12);
  assert.equal(result.B.effectiveProfile.passiveDefenseIgnorePercent, 12);
  assert.equal(result.B.effectiveProfile.passiveDefenseReductionPercent, 0);
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

test("Mingpo W-Engine flat Penetration reaches the damage formula", () => {
  const state = createDefaultComparisonState();
  state.common.characterId = "1371";
  state.common.mode = "mingpo";
  state.common.skillType = "ultimate";
  state.profiles.A = {
    ...state.profiles.A,
    weaponId: "13014",
    weaponRefinement: 1,
    weaponEffectMode: "max",
  };
  state.profiles.B = {
    ...state.profiles.A,
    weaponEffectMode: "off",
  };

  const result = compareInvestments(state);

  assert.equal(result.A.weaponPassive.totals.flatPenetration, 240);
  assert.equal(result.B.weaponPassive.totals.flatPenetration, 0);
  assert.equal(result.A.combatPenetration - result.B.combatPenetration, 240);
  assert.ok(result.A.rawDamage > result.B.rawDamage);
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

test("attack disc presets stop before a crit roll would exceed 100%", () => {
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

  assert.equal(build.rolls.critRatePercent, 13);
  assert.equal(build.rolls.critDamagePercent, 9);
  assert.equal(build.rolls.attackPercent, 8);
  assert.equal(build.discAttackPercent, 54);
  assert.equal(build.discCritRatePercent, 55.2);
  assert.ok(Math.abs(build.discCritDamagePercent - 43.2) < 1e-9);
  assert.equal(build.critCapReached, true);
  assert.equal(build.critUpperBoundReached, true);
  assert.equal(build.critExactCapReached, false);
  assert.ok(Math.abs(build.totalCritRate - 98.6) < 1e-9);
  assert.equal(build.critOverflowPercent, 0);
});

test("30/35/40-point attack presets preserve the safe crit ceiling", () => {
  const character = CHARACTERS.find((item) => item.id === "1041");
  const expected = {
    30: [13, 9, 8],
    35: [13, 11, 11],
    40: [13, 14, 13],
  };
  for (const [score, [critRate, critDamage, attack]] of Object.entries(
    expected,
  )) {
    const build = resolveDiscBuild({
      profile: {
        discBuildMode: "attack",
        discScore: Number(score),
        discFourPieceId: "31500",
        discTwoPieceId: "31600",
        discEffectMode: "off",
        passiveCritRatePercent: 0,
      },
      character,
      weaponCritRatePercent: 24,
      mode: "strong",
    });
    assert.deepEqual(
      [
        build.rolls.critRatePercent,
        build.rolls.critDamagePercent,
        build.rolls.attackPercent,
      ],
      [critRate, critDamage, attack],
    );
    assert.ok(build.totalCritRate <= 100);
    assert.ok(build.totalCritRate + 2.4 > 100);
    assert.equal(
      Object.values(build.rolls).reduce((sum, value) => sum + value, 0),
      Number(score),
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
  assert.equal(build.critMainStat, "critDamage");
  assert.equal(build.totalCritRate, 100);
  assert.equal(build.critOverflowPercent, 0);
  assert.ok(build.fixedCritOverflowPercent > 0);
});

test("W-Engine passive crit is included before safe disc allocation", () => {
  const state = createDefaultComparisonState();
  state.common.characterId = "1191";
  state.profiles.A = {
    ...state.profiles.A,
    weaponId: "14119",
    weaponRefinement: 1,
    weaponEffectMode: "max",
    discFourPieceId: "31500",
    discTwoPieceId: "31600",
  };
  state.profiles.B = { ...state.profiles.A };

  const result = compareInvestments(state).A;

  assert.equal(result.weaponPassive.totals.critRate, 20);
  assert.deepEqual(result.discBuild.rolls, {
    anomalyProficiency: 0,
    attackPercent: 12,
    critRatePercent: 5,
    critDamagePercent: 13,
  });
  assert.ok(Math.abs(result.discBuild.totalCritRate - 99.4) < 1e-9);
  assert.equal(result.discBuild.critOverflowPercent, 0);
});

test("core and additional crit are included before safe disc allocation", () => {
  const state = createDefaultComparisonState();
  state.common.characterId = "1241";
  state.common.party.member2 = {
    characterId: "1311",
    weaponId: "14131",
    weaponRefinement: 1,
    discFourPieceId: "32800",
  };
  state.common.party.member3.characterId = "1241";
  for (const profile of Object.values(state.profiles)) {
    Object.assign(profile, {
      weaponId: "13004",
      weaponEffectMode: "off",
      discBuildMode: "attack",
      discScore: 30,
      discFourPieceId: "31000",
      discTwoPieceId: "31600",
      discEffectMode: "off",
    });
  }

  const result = compareInvestments(state).A;

  assert.equal(
    result.agentEffects.applied.find(
      (row) => row.stat === "critRate",
    )?.amount,
    30,
  );
  assert.deepEqual(result.discBuild.rolls, {
    anomalyProficiency: 0,
    attackPercent: 8,
    critRatePercent: 13,
    critDamagePercent: 9,
  });
  assert.ok(Math.abs(result.discBuild.totalCritRate - 98.2) < 1e-9);
  assert.equal(result.discBuild.critOverflowPercent, 0);
});

test("final preset crit activates a 50% disc-set threshold", () => {
  const character = CHARACTERS.find((item) => item.id === "1251");
  const build = resolveDiscBuild({
    profile: {
      discBuildMode: "attack",
      discScore: 30,
      discFourPieceId: "33200",
      discTwoPieceId: "31500",
      discEffectMode: "max",
      passiveCritRatePercent: 0,
    },
    character,
    mode: "strong",
    skillType: "ex",
  });

  assert.ok(build.totalCritRate >= 50);
  assert.equal(build.setTotals.passiveCritDamagePercent, 30);
});

test("disc 4-piece specialty scopes only activate for their required roles", () => {
  const resolveEffect = ({
    characterId,
    setId,
    effectId,
    skillType = "normal",
  }) => {
    const character = CHARACTERS.find((item) => item.id === characterId);
    const build = resolveDiscBuild({
      profile: {
        discBuildMode: "manual",
        discFourPieceId: setId,
        discTwoPieceId: "31500",
        discEffectMode: "max",
        discCritRatePercent: 50,
      },
      character,
      mode: "strong",
      skillType,
    });
    return build.effects.find(
      (effect) => effect.key === `${setId}:4:${effectId}`,
    );
  };

  for (const effectId of [
    "stun-skill-party-crit-dmg",
    "crit-threshold-party-crit-dmg",
  ]) {
    assert.equal(
      resolveEffect({
        characterId: "1251",
        setId: "33200",
        effectId,
        skillType: "ex",
      }).active,
      true,
    );
    const wrongRole = resolveEffect({
      characterId: "1041",
      setId: "33200",
      effectId,
      skillType: "ex",
    });
    assert.equal(wrongRole.inScope, false);
    assert.equal(wrongRole.active, false);
  }

  const supportEffect = "support-party-dmg";
  assert.equal(
    resolveEffect({
      characterId: "1311",
      setId: "33400",
      effectId: supportEffect,
    }).active,
    true,
  );
  assert.equal(
    resolveEffect({
      characterId: "1041",
      setId: "33400",
      effectId: supportEffect,
    }).active,
    false,
  );

  const defenseEffect = "defense-assist-party-dmg";
  assert.equal(
    resolveEffect({
      characterId: "1341",
      setId: "33700",
      effectId: defenseEffect,
    }).active,
    true,
  );
  assert.equal(
    resolveEffect({
      characterId: "1041",
      setId: "33700",
      effectId: defenseEffect,
    }).active,
    false,
  );
});

test("mixed-role disc sets keep base effects universal and gate attack bonuses", () => {
  const resolveEffects = (characterId, setId) => {
    const character = CHARACTERS.find((item) => item.id === characterId);
    return resolveDiscBuild({
      profile: {
        discBuildMode: "manual",
        discFourPieceId: setId,
        discTwoPieceId: "31500",
        discEffectMode: "max",
      },
      character,
      mode: "strong",
      skillType: "normal",
    }).effects;
  };
  const findFourPiece = (effects, setId, effectId) =>
    effects.find((effect) => effect.key === `${setId}:4:${effectId}`);

  const dawnAttack = resolveEffects("1041", "33300");
  const dawnSupport = resolveEffects("1311", "33300");
  assert.equal(
    findFourPiece(dawnAttack, "33300", "basic-dmg").active,
    true,
  );
  assert.equal(
    findFourPiece(dawnSupport, "33300", "basic-dmg").active,
    true,
  );
  assert.equal(
    findFourPiece(
      dawnAttack,
      "33300",
      "attack-ex-ultimate-basic-dmg",
    ).active,
    true,
  );
  assert.equal(
    findFourPiece(
      dawnSupport,
      "33300",
      "attack-ex-ultimate-basic-dmg",
    ).active,
    false,
  );

  const balladAttack = resolveEffects("1041", "33500");
  const balladSupport = resolveEffects("1311", "33500");
  assert.equal(
    findFourPiece(balladAttack, "33500", "ether-veil-crit").active,
    true,
  );
  assert.equal(
    findFourPiece(balladSupport, "33500", "ether-veil-crit").active,
    true,
  );
  assert.equal(
    findFourPiece(
      balladAttack,
      "33500",
      "attack-ether-veil-crit-atk",
    ).active,
    true,
  );
  assert.equal(
    findFourPiece(
      balladSupport,
      "33500",
      "attack-ether-veil-crit-atk",
    ).active,
    false,
  );
});

test("version 3 state migration enables automatic effects without reverting discs", () => {
  const saved = createDefaultComparisonState();
  saved.version = 3;
  saved.profiles.A.discBuildMode = "attack";
  saved.profiles.A.mindscapeEffectMode = "off";
  delete saved.profiles.A.weaponRefinement;
  delete saved.profiles.A.weaponEffectMode;

  const migrated = mergeComparisonState(saved);

  assert.equal(migrated.version, 7);
  assert.equal(migrated.common.stunned, true);
  assert.equal(migrated.profiles.A.discBuildMode, "attack");
  assert.equal(migrated.profiles.A.discEffectMode, "max");
  assert.equal(migrated.profiles.A.mindscapeEffectMode, "max");
  assert.equal(migrated.profiles.A.weaponEffectMode, "max");
  assert.equal(migrated.profiles.A.weaponRefinement, 1);
});

test("current saved state preserves an explicit non-stunned comparison", () => {
  const saved = createDefaultComparisonState();
  saved.common.stunned = false;

  const merged = mergeComparisonState(saved);
  const empty = mergeComparisonState(undefined);

  assert.equal(merged.version, 7);
  assert.equal(merged.common.stunned, false);
  assert.equal(empty.common.stunned, true);
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
