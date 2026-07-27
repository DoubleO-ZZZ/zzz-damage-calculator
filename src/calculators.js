/**
 * Pure calculation engine for the source Zenless Zone Zero workbook.
 *
 * Percent-valued inputs use the same units as the sheet: `50` means 50%.
 * Coefficients entered as percentages (for example 3850%) are converted to
 * multipliers only at the point where the workbook does so.
 */

const PERCENT = 0.01;

const freeze = (value) => Object.freeze(value);

function number(value, field) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${field} must be a finite number`);
  }
  return parsed;
}

function percent(value, field) {
  return number(value, field) * PERCENT;
}

function snapNearInteger(value) {
  const nearest = Math.round(value);
  const tolerance =
    Number.EPSILON * 16 * Math.max(1, Math.abs(value), Math.abs(nearest));
  return Math.abs(value - nearest) <= tolerance ? nearest : value;
}

function floorToInteger(value) {
  return Math.floor(snapNearInteger(value));
}

function ceilToInteger(value) {
  return Math.ceil(snapNearInteger(value));
}

function enabled(value, labels = []) {
  if (typeof value === "boolean") return value;
  return labels.includes(value);
}

function requiredLookup(table, key, label) {
  const value = table[key];
  if (value === undefined) {
    throw new RangeError(`${label}: unsupported value "${key}"`);
  }
  return value;
}

export function calculateDefenseMultiplier({
  enemyDefense,
  enemyDefenseIncreasePercent = 0,
  enemyDefenseReductionPercent = 0,
  penetrationPercent = 0,
  penetrationValue = 0,
}) {
  const effectiveDefense = Math.max(
    0,
    number(enemyDefense, "enemyDefense") *
      (1 +
        percent(enemyDefenseIncreasePercent, "enemyDefenseIncreasePercent") -
        percent(enemyDefenseReductionPercent, "enemyDefenseReductionPercent")) *
      (1 - percent(penetrationPercent, "penetrationPercent")) -
      number(penetrationValue, "penetrationValue"),
  );

  return 794 / (794 + effectiveDefense);
}

export function calculateResistanceMultiplier({
  resistanceReductionPercent = 0,
  resistanceIgnorePercent = 0,
  assaultResistanceReductionPercent = 0,
  enemyResistancePercent = 0,
}) {
  return (
    1 +
    percent(resistanceReductionPercent, "resistanceReductionPercent") +
    percent(resistanceIgnorePercent, "resistanceIgnorePercent") +
    percent(
      assaultResistanceReductionPercent,
      "assaultResistanceReductionPercent",
    ) -
    percent(enemyResistancePercent, "enemyResistancePercent")
  );
}

export const STRONG_ATTACK_DEFAULTS = freeze({
  characterBaseAttack: 938,
  engineBaseAttack: 743,
  skillCoefficientPercent: 3850,
  engineAttackPercent: 0,
  discAttackPercent: 78,
  flatAttackRolls: 2,
  attackPercentBuff: 30,
  flatAttackBuff: 1100,
  selfCriticalDamagePercent: 233.4,
  support1CriticalDamagePercent: 60,
  support2CriticalDamagePercent: 0,
  criticalDamageReductionPercent: 0,
  assaultCriticalDamagePercent: 0,
  gimmickCriticalDamagePercent: 0,
  criticalChancePercent: 100,
  enemyDefense: 952.8,
  enemyDefenseIncreasePercent: 0,
  enemyDefenseReductionPercent: 41,
  penetrationPercent: 0,
  penetrationValue: 36,
  resistanceReductionPercent: 35,
  resistanceIgnorePercent: 0,
  enemyResistancePercent: 0,
  selfDamageBonusPercent: 100,
  support1DamageBonusPercent: 55,
  support2DamageBonusPercent: 43,
  assaultDamageBonusPercent: 0,
  otherDamageBonusPercent: 0,
  baseStunMultiplierPercent: 150,
  additionalStunMultiplierPercent: 60,
  receivedDamageIncreasePercent: 0,
  receivedDamageReductionPercent: 0,
});

export const DEFAULT_STRONG_ATTACK_INPUTS = STRONG_ATTACK_DEFAULTS;

export function calculateStrongAttack(overrides = {}) {
  const input = { ...STRONG_ATTACK_DEFAULTS, ...overrides };
  const baseAttack =
    number(input.characterBaseAttack, "characterBaseAttack") +
    number(input.engineBaseAttack, "engineBaseAttack");
  const townAttack = floorToInteger(
    baseAttack *
      (1 +
        percent(input.engineAttackPercent, "engineAttackPercent") +
        percent(input.discAttackPercent, "discAttackPercent")) +
      19 * number(input.flatAttackRolls, "flatAttackRolls") +
      316,
  );
  const combatAttack =
    townAttack * (1 + percent(input.attackPercentBuff, "attackPercentBuff")) +
    number(input.flatAttackBuff, "flatAttackBuff");
  const defenseMultiplier = calculateDefenseMultiplier(input);
  const totalDamageBonusPercent =
    number(input.selfDamageBonusPercent, "selfDamageBonusPercent") +
    number(input.support1DamageBonusPercent, "support1DamageBonusPercent") +
    number(input.support2DamageBonusPercent, "support2DamageBonusPercent") +
    number(input.assaultDamageBonusPercent, "assaultDamageBonusPercent") +
    number(input.otherDamageBonusPercent, "otherDamageBonusPercent");
  const damageMultiplier = 1 + totalDamageBonusPercent * PERCENT;
  const totalCriticalDamagePercent =
    number(input.selfCriticalDamagePercent, "selfCriticalDamagePercent") +
    number(
      input.support1CriticalDamagePercent,
      "support1CriticalDamagePercent",
    ) +
    number(
      input.support2CriticalDamagePercent,
      "support2CriticalDamagePercent",
    ) +
    number(
      input.assaultCriticalDamagePercent,
      "assaultCriticalDamagePercent",
    ) +
    number(
      input.gimmickCriticalDamagePercent,
      "gimmickCriticalDamagePercent",
    ) -
    number(
      input.criticalDamageReductionPercent,
      "criticalDamageReductionPercent",
    );
  const criticalMultiplier =
    1 +
    percent(input.criticalChancePercent, "criticalChancePercent") *
      percent(totalCriticalDamagePercent, "totalCriticalDamagePercent");
  const resistanceMultiplier = calculateResistanceMultiplier(input);
  const stunMultiplier =
    percent(input.baseStunMultiplierPercent, "baseStunMultiplierPercent") +
    percent(
      input.additionalStunMultiplierPercent,
      "additionalStunMultiplierPercent",
    );
  const receivedDamageMultiplier =
    1 +
    percent(
      input.receivedDamageIncreasePercent,
      "receivedDamageIncreasePercent",
    ) -
    percent(
      input.receivedDamageReductionPercent,
      "receivedDamageReductionPercent",
    );
  const skillMultiplier = percent(
    input.skillCoefficientPercent,
    "skillCoefficientPercent",
  );
  const rawDamage =
    skillMultiplier *
    combatAttack *
    defenseMultiplier *
    damageMultiplier *
    criticalMultiplier *
    resistanceMultiplier *
    stunMultiplier *
    receivedDamageMultiplier;
  const displayedDamage = ceilToInteger(rawDamage);

  return {
    input,
    baseAttack,
    townAttack,
    combatAttack,
    skillMultiplier,
    defenseMultiplier,
    totalDamageBonusPercent,
    damageMultiplier,
    totalCriticalDamagePercent,
    criticalMultiplier,
    resistanceMultiplier,
    stunMultiplier,
    receivedDamageMultiplier,
    rawDamage,
    displayedDamage,
    finalDamage: displayedDamage,
    damage: displayedDamage,
  };
}

export const calculateStrongAttackDamage = calculateStrongAttack;

export const MINGPO_DEFAULTS = freeze({
  characterBaseAttack: 872,
  engineBaseAttack: 743,
  engineAttackPercent: 0,
  discAttackPercent: 3,
  flatAttackRolls: 3,
  attackPercentBuff: 0,
  flatAttackBuff: 0,
  characterBaseHp: 8373,
  engineHpPercent: 30,
  discHpPercent: 76,
  flatHpRolls: 1,
  hpPercentBuff: 20,
  flatPenetrationBuff: 900,
  penetrationDamageBonusPercent: 45,
  selfDamageBonusPercent: 106,
  support1DamageBonusPercent: 55,
  support2DamageBonusPercent: 63,
  assaultDamageBonusPercent: 0,
  otherDamageBonusPercent: 0,
  selfCriticalDamagePercent: 221.2,
  support1CriticalDamagePercent: 60,
  support2CriticalDamagePercent: 30,
  criticalDamageReductionPercent: 0,
  assaultCriticalDamagePercent: 0,
  gimmickCriticalDamagePercent: 0,
  criticalChancePercent: 100,
  resistanceReductionPercent: 33,
  resistanceIgnorePercent: 20,
  enemyResistancePercent: 0,
  baseStunMultiplierPercent: 150,
  additionalStunMultiplierPercent: 50,
  receivedDamageIncreasePercent: 0,
  receivedDamageReductionPercent: 0,
  skillCoefficientPercent: 2932.5,
});

export const DEFAULT_MINGPO_INPUTS = MINGPO_DEFAULTS;

export function calculateMingpo(overrides = {}) {
  const input = { ...MINGPO_DEFAULTS, ...overrides };
  const baseAttack =
    number(input.characterBaseAttack, "characterBaseAttack") +
    number(input.engineBaseAttack, "engineBaseAttack");
  const townAttack = floorToInteger(
    baseAttack *
      (1 +
        percent(input.engineAttackPercent, "engineAttackPercent") +
        percent(input.discAttackPercent, "discAttackPercent")) +
      19 * number(input.flatAttackRolls, "flatAttackRolls") +
      316,
  );
  const combatAttack =
    townAttack * (1 + percent(input.attackPercentBuff, "attackPercentBuff")) +
    number(input.flatAttackBuff, "flatAttackBuff");
  const townHp = ceilToInteger(
    number(input.characterBaseHp, "characterBaseHp") *
      (1 +
        percent(input.engineHpPercent, "engineHpPercent") +
        percent(input.discHpPercent, "discHpPercent")) +
      112 * number(input.flatHpRolls, "flatHpRolls") +
      2200,
  );
  const combatHp =
    townHp * (1 + percent(input.hpPercentBuff, "hpPercentBuff"));
  const townPenetration = floorToInteger(townAttack * 0.3 + townHp * 0.1);
  const combatPenetration =
    townPenetration +
    (townAttack * percent(input.attackPercentBuff, "attackPercentBuff") +
      number(input.flatAttackBuff, "flatAttackBuff")) *
      0.3 +
    townHp * percent(input.hpPercentBuff, "hpPercentBuff") * 0.1 +
    number(input.flatPenetrationBuff, "flatPenetrationBuff");
  const penetrationDamageMultiplier =
    1 +
    percent(
      input.penetrationDamageBonusPercent,
      "penetrationDamageBonusPercent",
    );
  const totalDamageBonusPercent =
    number(input.selfDamageBonusPercent, "selfDamageBonusPercent") +
    number(input.support1DamageBonusPercent, "support1DamageBonusPercent") +
    number(input.support2DamageBonusPercent, "support2DamageBonusPercent") +
    number(input.assaultDamageBonusPercent, "assaultDamageBonusPercent") +
    number(input.otherDamageBonusPercent, "otherDamageBonusPercent");
  const damageMultiplier = 1 + totalDamageBonusPercent * PERCENT;
  const totalCriticalDamagePercent =
    number(input.selfCriticalDamagePercent, "selfCriticalDamagePercent") +
    number(
      input.support1CriticalDamagePercent,
      "support1CriticalDamagePercent",
    ) +
    number(
      input.support2CriticalDamagePercent,
      "support2CriticalDamagePercent",
    ) +
    number(
      input.assaultCriticalDamagePercent,
      "assaultCriticalDamagePercent",
    ) +
    number(
      input.gimmickCriticalDamagePercent,
      "gimmickCriticalDamagePercent",
    ) -
    number(
      input.criticalDamageReductionPercent,
      "criticalDamageReductionPercent",
    );
  const criticalMultiplier =
    1 +
    percent(input.criticalChancePercent, "criticalChancePercent") *
      percent(totalCriticalDamagePercent, "totalCriticalDamagePercent");
  const resistanceMultiplier = calculateResistanceMultiplier(input);
  const stunMultiplier =
    percent(input.baseStunMultiplierPercent, "baseStunMultiplierPercent") +
    percent(
      input.additionalStunMultiplierPercent,
      "additionalStunMultiplierPercent",
    );
  const receivedDamageMultiplier =
    1 +
    percent(
      input.receivedDamageIncreasePercent,
      "receivedDamageIncreasePercent",
    ) -
    percent(
      input.receivedDamageReductionPercent,
      "receivedDamageReductionPercent",
    );
  const skillMultiplier = percent(
    input.skillCoefficientPercent,
    "skillCoefficientPercent",
  );
  const rawDamage =
    skillMultiplier *
    combatPenetration *
    penetrationDamageMultiplier *
    damageMultiplier *
    criticalMultiplier *
    resistanceMultiplier *
    stunMultiplier *
    receivedDamageMultiplier;
  const displayedDamage = ceilToInteger(rawDamage);

  return {
    input,
    baseAttack,
    townAttack,
    combatAttack,
    townHp,
    townHP: townHp,
    combatHp,
    combatHP: combatHp,
    townPenetration,
    combatPenetration,
    penetration: combatPenetration,
    skillMultiplier,
    penetrationDamageMultiplier,
    totalDamageBonusPercent,
    damageMultiplier,
    totalCriticalDamagePercent,
    criticalMultiplier,
    resistanceMultiplier,
    stunMultiplier,
    receivedDamageMultiplier,
    rawDamage,
    displayedDamage,
    finalDamage: displayedDamage,
    damage: displayedDamage,
  };
}

export const calculateMingpoDamage = calculateMingpo;
export const calculateMyungpa = calculateMingpo;

const EMPTY_ELEMENT_BONUSES = freeze({
  연소: 0,
  침식: 0,
  감전: 0,
  쇄빙: 0,
  강타: 0,
  풍화: 0,
});

export const ANOMALY_DEALER_A_DEFAULTS = freeze({
  id: "A",
  characterBaseAttack: 872,
  engineBaseAttack: 713,
  engineAttackPercent: 0,
  discAttackPercent: 54,
  flatAttackRolls: 1,
  attackPercentBuff: 0,
  flatAttackBuff: 1600,
  enemyDefense: 952.8,
  enemyDefenseIncreasePercent: 0,
  enemyDefenseReductionPercent: 0,
  penetrationPercent: 24,
  penetrationValue: 27,
  resistanceReductionPercent: 0,
  resistanceIgnorePercent: 0,
  assaultResistanceReductionPercent: 0,
  selfDamageBonusPercent: 63,
  support1DamageBonusPercent: 0,
  support2DamageBonusPercent: 48,
  assaultDamageBonusPercent: 0,
  otherDamageBonusPercent: 0,
  baseAnomalyDamageBonusPercent: 25,
  assaultAnomalyDamageBonusPercent: 50,
  assaultDisorderDamageBonusPercent: 0,
  disseminationDamageBonusPercent: 34.3,
  turbulenceDamageBonusPercent: 24,
  elementDamageBonusPercent: freeze({ ...EMPTY_ELEMENT_BONUSES, 풍화: 24 }),
  lumenAnomalyProficiency: 703,
  mutationPercentPerProficiency: 0.02,
  additionalMutationPercent: 10,
  lumenIncluded: true,
  townAnomalyProficiency: 365,
  selfAnomalyProficiencyBuff: 180,
  partyAnomalyProficiencyBuff: 0,
  assaultAnomalyProficiencyBuff: 70,
  stunned: true,
  baseStunMultiplierPercent: 150,
  additionalStunMultiplierPercent: 0,
  attackerLevel: 60,
  receivedDamageIncreasePercent: 0,
  receivedDamageReductionPercent: 15,
  baseAnomalyMastery: 112,
  anomalyMasteryPercent: 0,
  selfAnomalyMasteryBuff: 84,
  anomalyMasteryBuff: 0,
});

export const ANOMALY_DEALER_B_DEFAULTS = freeze({
  id: "B",
  characterBaseAttack: 872,
  engineBaseAttack: 713,
  engineAttackPercent: 0,
  discAttackPercent: 48,
  flatAttackRolls: 5,
  attackPercentBuff: 0,
  flatAttackBuff: 1600,
  enemyDefense: 952.8,
  enemyDefenseIncreasePercent: 0,
  enemyDefenseReductionPercent: 0,
  penetrationPercent: 0,
  penetrationValue: 18,
  resistanceReductionPercent: 0,
  resistanceIgnorePercent: 0,
  assaultResistanceReductionPercent: 0,
  selfDamageBonusPercent: 80,
  support1DamageBonusPercent: 0,
  support2DamageBonusPercent: 48,
  assaultDamageBonusPercent: 0,
  otherDamageBonusPercent: 0,
  baseAnomalyDamageBonusPercent: 25,
  assaultAnomalyDamageBonusPercent: 50,
  assaultDisorderDamageBonusPercent: 0,
  disseminationDamageBonusPercent: 69.3,
  turbulenceDamageBonusPercent: 0,
  elementDamageBonusPercent: EMPTY_ELEMENT_BONUSES,
  lumenAnomalyProficiency: 703,
  mutationPercentPerProficiency: 0.02,
  additionalMutationPercent: 10,
  lumenIncluded: true,
  townAnomalyProficiency: 350,
  selfAnomalyProficiencyBuff: 195,
  partyAnomalyProficiencyBuff: 60,
  assaultAnomalyProficiencyBuff: 70,
  stunned: true,
  baseStunMultiplierPercent: 150,
  additionalStunMultiplierPercent: 0,
  attackerLevel: 60,
  receivedDamageIncreasePercent: 0,
  receivedDamageReductionPercent: 15,
  baseAnomalyMastery: 148,
  anomalyMasteryPercent: 68,
  selfAnomalyMasteryBuff: 0,
  anomalyMasteryBuff: 0,
});

export const DEFAULT_ANOMALY_DEALERS = freeze({
  A: ANOMALY_DEALER_A_DEFAULTS,
  B: ANOMALY_DEALER_B_DEFAULTS,
});

function dealerDefaults(id) {
  return String(id).toUpperCase() === "B"
    ? ANOMALY_DEALER_B_DEFAULTS
    : ANOMALY_DEALER_A_DEFAULTS;
}

export function calculateDealerStats(overrides = {}) {
  const requestedId =
    typeof overrides === "string" ? overrides : (overrides.id ?? "A");
  const supplied = typeof overrides === "string" ? {} : overrides;
  const defaults = dealerDefaults(requestedId);
  const input = {
    ...defaults,
    ...supplied,
    id: String(requestedId).toUpperCase() === "B" ? "B" : "A",
    elementDamageBonusPercent: {
      ...defaults.elementDamageBonusPercent,
      ...(supplied.elementDamageBonusPercent ?? {}),
    },
  };
  const baseAttack =
    number(input.characterBaseAttack, "characterBaseAttack") +
    number(input.engineBaseAttack, "engineBaseAttack");
  const townAttack = floorToInteger(
    baseAttack *
      (1 +
        percent(input.engineAttackPercent, "engineAttackPercent") +
        percent(input.discAttackPercent, "discAttackPercent")) +
      19 * number(input.flatAttackRolls, "flatAttackRolls") +
      316,
  );
  const combatAttack =
    townAttack * (1 + percent(input.attackPercentBuff, "attackPercentBuff")) +
    number(input.flatAttackBuff, "flatAttackBuff");
  const defenseMultiplier = calculateDefenseMultiplier(input);
  const resistanceMultiplier = calculateResistanceMultiplier(input);
  const totalDamageBonusPercent =
    number(input.selfDamageBonusPercent, "selfDamageBonusPercent") +
    number(input.support1DamageBonusPercent, "support1DamageBonusPercent") +
    number(input.support2DamageBonusPercent, "support2DamageBonusPercent") +
    number(input.assaultDamageBonusPercent, "assaultDamageBonusPercent") +
    number(input.otherDamageBonusPercent, "otherDamageBonusPercent");
  const damageMultiplier = 1 + totalDamageBonusPercent * PERCENT;
  const mutationPercent =
    number(input.lumenAnomalyProficiency, "lumenAnomalyProficiency") *
      number(
        input.mutationPercentPerProficiency,
        "mutationPercentPerProficiency",
      ) +
    number(input.additionalMutationPercent, "additionalMutationPercent");
  const mutationMultiplier = enabled(input.lumenIncluded, ["편성"])
    ? 1 + mutationPercent * PERCENT
    : 1;
  const anomalyProficiency =
    number(input.townAnomalyProficiency, "townAnomalyProficiency") +
    number(
      input.selfAnomalyProficiencyBuff,
      "selfAnomalyProficiencyBuff",
    ) +
    number(
      input.partyAnomalyProficiencyBuff,
      "partyAnomalyProficiencyBuff",
    ) +
    number(
      input.assaultAnomalyProficiencyBuff,
      "assaultAnomalyProficiencyBuff",
    );
  const stunMultiplier =
    enabled(input.stunned, ["그로기"])
      ? percent(input.baseStunMultiplierPercent, "baseStunMultiplierPercent") +
        percent(
          input.additionalStunMultiplierPercent,
          "additionalStunMultiplierPercent",
        )
      : 1;
  const levelMultiplier =
    1 + (number(input.attackerLevel, "attackerLevel") - 1) / 59;
  const receivedDamageMultiplier =
    1 +
    percent(
      input.receivedDamageIncreasePercent,
      "receivedDamageIncreasePercent",
    ) -
    percent(
      input.receivedDamageReductionPercent,
      "receivedDamageReductionPercent",
    );
  const initialAnomalyMastery = floorToInteger(
    number(input.baseAnomalyMastery, "baseAnomalyMastery") *
      (1 + percent(input.anomalyMasteryPercent, "anomalyMasteryPercent")),
  );
  const combatAnomalyMastery =
    initialAnomalyMastery +
    number(input.selfAnomalyMasteryBuff, "selfAnomalyMasteryBuff") +
    number(input.anomalyMasteryBuff, "anomalyMasteryBuff");

  return {
    id: input.id,
    input,
    baseAttack,
    townAttack,
    combatAttack,
    defenseMultiplier,
    resistanceMultiplier,
    totalDamageBonusPercent,
    damageMultiplier,
    mutationPercent,
    mutationMultiplier,
    anomalyProficiency,
    anomalyProficiencyMultiplier: anomalyProficiency * PERCENT,
    stunMultiplier,
    levelMultiplier,
    receivedDamageMultiplier,
    initialAnomalyMastery,
    combatAnomalyMastery,
  };
}

export const NORMAL_ANOMALY_COEFFICIENTS = freeze({
  연소: 50,
  침식: 62.5,
  감전: 125,
  쇄빙: 500,
  강타: 713,
  풍화: 1250,
});

export const DISORDER_COEFFICIENTS = freeze({
  연소: freeze({ base: 450, perSecond: 100 }),
  침식: freeze({ base: 450, perSecond: 125 }),
  감전: freeze({ base: 450, perSecond: 125 }),
  쇄빙: freeze({ base: 450, perSecond: 7.5 }),
  서리: freeze({ base: 600, perSecond: 75 }),
  강타: freeze({ base: 450, perSecond: 7.5 }),
  풍화: freeze({ base: 100, perSecond: 0 }),
});

export const TURBULENCE_COEFFICIENTS = freeze({
  연소: freeze({ base: 900, perSecond: 100 }),
  침식: freeze({ base: 650, perSecond: 125 }),
  감전: freeze({ base: 650, perSecond: 125 }),
  쇄빙: freeze({ base: 1300, perSecond: 7.5 }),
  서리: freeze({ base: 0, perSecond: 75 }),
  강타: freeze({ base: 800, perSecond: 7.5 }),
});

export const NANKAI_CHARACTER_COEFFICIENTS = freeze({
  벨리나: freeze({
    kind: "skill",
    values: freeze({
      "국소 사이클론": 145,
      "광역 사이클론": 255,
      궁극기: 680,
    }),
  }),
  프로미아: freeze({
    kind: "skill",
    values: freeze({
      "처형식·단행": 635,
      "처형식·단행(M2)": 755,
      "콤보 스킬": 100,
      궁극기: 250,
    }),
  }),
  남궁우: freeze({
    kind: "element",
    values: freeze({
      연소: 450,
      침식: 450,
      감전: 450,
      쇄빙: 450,
      강타: 449.19,
      풍화: 450,
    }),
  }),
  버니스: freeze({
    kind: "element",
    values: freeze({
      연소: 300,
      침식: 300,
      감전: 300,
      쇄빙: 300,
      강타: 285.2,
      풍화: 300,
    }),
  }),
  그레이스: freeze({
    kind: "element",
    values: freeze({
      연소: 350,
      침식: 350,
      감전: 350,
      쇄빙: 350,
      강타: 356.5,
      풍화: 350,
    }),
  }),
  비비안: freeze({
    kind: "scaled",
    requiredStat: "컴뱃 이상마",
    defaultStat: 666,
    values: freeze({
      연소: 4,
      침식: 3.84375,
      감전: 4,
      쇄빙: 5.4,
      강타: 5.3475,
      풍화: 4,
    }),
  }),
  아리아: freeze({
    kind: "scaled",
    requiredStat: "마을 이상장악력",
    defaultStat: 253,
    values: freeze({
      연소: 17.85,
      침식: 17.1875,
      감전: 17.875,
      쇄빙: 18,
      강타: 17.825,
      풍화: 17.5,
    }),
  }),
});

export const NANKAI_DEFAULT_SELECTIONS = freeze({
  벨리나: "광역 사이클론",
  프로미아: "처형식·단행",
  남궁우: "쇄빙",
  아리아: "침식",
  그레이스: "감전",
  버니스: "연소",
  비비안: "강타",
});

export const ANOMALY_COEFFICIENT_TABLES = freeze({
  normal: NORMAL_ANOMALY_COEFFICIENTS,
  disorder: DISORDER_COEFFICIENTS,
  turbulence: TURBULENCE_COEFFICIENTS,
  nankai: NANKAI_CHARACTER_COEFFICIENTS,
});

export const RADIANCE_SKILL_COEFFICIENTS = freeze({
  일반평꾹: freeze({
    11: 155,
    12: 160,
    13: 165,
    14: 170,
    15: 175,
    16: 180,
  }),
  강화평꾹: freeze({
    11: 310,
    12: 320,
    13: 330,
    14: 340,
    15: 350,
    16: 360,
  }),
  지원스킬: freeze({
    11: 310,
    12: 320,
    13: 330,
    14: 340,
    15: 350,
    16: 360,
  }),
  궁극기: freeze({
    11: 325.5,
    12: 336,
    13: 346.5,
    14: 357,
    15: 367.5,
    16: 378,
  }),
});

export const ADDITIONAL_MULTIPLIER_LOOKUPS = freeze({
  아리아: freeze({
    명함비그로기: 1,
    명함그로기: 1.5,
    "1돌비그로기": 1.25,
    "1돌그로기": 1.875,
  }),
  남궁우: freeze({
    "1스택": 1.25,
    "2스택": 1.5,
    "3스택": 1.75,
    "4스택": 2,
    "(M2) 1스택": 1.35,
    "(M2) 2스택": 1.7,
    "(M2) 3스택": 2.05,
    "(M2) 4스택": 2.4,
  }),
  제인: freeze({
    "2돌미만": 1.5,
    "2돌미만(as)": 1.8,
    "2돌이상": 2,
    "2돌이상(as)": 2.3,
  }),
  "벨리나(6돌)": freeze({
    "1초": 1.025,
    "2초": 1.05,
    "3초": 1.075,
    "4초": 1.1,
    "5초": 1.125,
    "6초": 1.15,
    "7초": 1.175,
    "8초": 1.2,
    "9초": 1.225,
    "10초": 1.25,
    "11초": 1.275,
    "12초": 1.3,
    "13초": 1.325,
    "14초": 1.35,
    "15초": 1.375,
    "16초이상": 1.4,
  }),
});

export const ALICE_ADDITIONAL_COEFFICIENTS = freeze({
  "1초": 18,
  "2초": 36,
  "3초": 54,
  "4초": 72,
  "5초": 90,
  "6초": 108,
  "7초": 126,
  "8초": 144,
  "9초": 162,
  "10초": 180,
});

export function getAdditionalMultiplier(character, option) {
  const table = requiredLookup(
    ADDITIONAL_MULTIPLIER_LOOKUPS,
    character,
    "additional multiplier character",
  );
  return requiredLookup(table, option, `${character} option`);
}

export function getAliceAdditionalCoefficient(option) {
  return requiredLookup(
    ALICE_ADDITIONAL_COEFFICIENTS,
    option,
    "앨리스 duration",
  );
}

function normalizedCoefficientKind(kind) {
  const value = String(kind ?? "normal").trim().toLowerCase();
  if (["normal", "속성이상", "일반"].includes(value)) return "normal";
  if (["disorder", "혼돈"].includes(value)) return "disorder";
  if (["turbulence", "난류"].includes(value)) return "turbulence";
  if (["nankai", "dissemination", "난개"].includes(value)) return "nankai";
  if (["radiance", "휘광"].includes(value)) return "radiance";
  throw new RangeError(`unsupported anomaly coefficient kind "${kind}"`);
}

export function calculateAnomalyCoefficient(options = {}) {
  const kind = normalizedCoefficientKind(options.kind ?? options.type);

  if (kind === "radiance") {
    return calculateRemielRadianceCoefficient(options);
  }

  if (kind === "normal") {
    const element = options.element ?? "풍화";
    const finalCoefficient = requiredLookup(
      NORMAL_ANOMALY_COEFFICIENTS,
      element,
      "normal anomaly element",
    );
    return {
      kind,
      element,
      baseCoefficient: finalCoefficient,
      finalCoefficient,
      coefficient: finalCoefficient,
    };
  }

  if (kind === "disorder" || kind === "turbulence") {
    const element = options.element ?? (kind === "disorder" ? "서리" : "쇄빙");
    const table =
      kind === "disorder" ? DISORDER_COEFFICIENTS : TURBULENCE_COEFFICIENTS;
    const lookup = requiredLookup(
      table,
      element,
      `${kind} anomaly element`,
    );
    const defaultRemainingSeconds = kind === "disorder" ? 17 : 13;
    const remainingSeconds = Math.max(
      0,
      Math.floor(
        number(
          options.remainingSeconds ?? defaultRemainingSeconds,
          "remainingSeconds",
        ),
      ),
    );
    const additionalCoefficient = number(
      options.additionalCoefficient ?? 0,
      "additionalCoefficient",
    );
    const finalCoefficient =
      lookup.base +
      lookup.perSecond * remainingSeconds +
      additionalCoefficient;
    return {
      kind,
      element,
      baseCoefficient: lookup.base,
      coefficientPerSecond: lookup.perSecond,
      remainingSeconds,
      additionalCoefficient,
      finalCoefficient,
      coefficient: finalCoefficient,
    };
  }

  const character = options.character ?? "벨리나";
  const lookup = requiredLookup(
    NANKAI_CHARACTER_COEFFICIENTS,
    character,
    "난개 character",
  );
  const selection =
    options.selection ??
    options.skill ??
    options.element ??
    NANKAI_DEFAULT_SELECTIONS[character];
  const baseCoefficient = requiredLookup(
    lookup.values,
    selection,
    `${character} 난개 selection`,
  );

  if (lookup.kind !== "scaled") {
    return {
      kind,
      character,
      selection,
      baseCoefficient,
      finalCoefficient: baseCoefficient,
      coefficient: baseCoefficient,
      requiredStat: null,
      stat: null,
    };
  }

  const stat = number(options.stat ?? lookup.defaultStat, "stat");
  const finalCoefficient = (baseCoefficient * stat) / 10;
  return {
    kind,
    character,
    selection,
    baseCoefficient,
    coefficientPer10Stat: baseCoefficient,
    requiredStat: lookup.requiredStat,
    stat,
    finalCoefficient,
    coefficient: finalCoefficient,
  };
}

export function calculateNormalAnomalyCoefficient(element = "풍화") {
  return calculateAnomalyCoefficient({ kind: "normal", element });
}

export function calculateDisorderCoefficient(options = {}) {
  return calculateAnomalyCoefficient({ ...options, kind: "disorder" });
}

export function calculateTurbulenceCoefficient(options = {}) {
  return calculateAnomalyCoefficient({ ...options, kind: "turbulence" });
}

export function calculateNankaiCoefficient(options = {}) {
  return calculateAnomalyCoefficient({ ...options, kind: "nankai" });
}

export const RESISTANCE_SCENARIO_MODIFIERS = freeze({
  약점: 0.2,
  비약점: 0,
  저항20: -0.2,
  저항40: -0.4,
});

function parseAnomalyKey(value) {
  if (typeof value === "object" && value !== null) {
    return {
      element: value.element ?? null,
      kind: normalizedCoefficientKind(value.kind ?? value.type),
    };
  }
  const key = String(value);
  if (key === "혼돈") return { element: null, kind: "disorder" };
  if (key.endsWith("난개")) {
    return { element: key.slice(0, -2), kind: "nankai" };
  }
  if (key.endsWith("난류")) {
    return { element: key.slice(0, -2), kind: "turbulence" };
  }
  return { element: key, kind: "normal" };
}

export function getAnomalyDamageBonusPercent(dealer, anomalyKey) {
  const stats =
    dealer?.input && dealer?.combatAttack !== undefined
      ? dealer
      : calculateDealerStats(dealer);
  const { element, kind } = parseAnomalyKey(anomalyKey);
  const input = stats.input;
  const base = number(
    input.baseAnomalyDamageBonusPercent,
    "baseAnomalyDamageBonusPercent",
  );

  if (kind === "disorder") {
    return (
      base +
      number(
        input.assaultDisorderDamageBonusPercent,
        "assaultDisorderDamageBonusPercent",
      )
    );
  }

  const elementBonus = requiredLookup(
    input.elementDamageBonusPercent,
    element,
    "anomaly damage element",
  );
  let total =
    base +
    number(
      input.assaultAnomalyDamageBonusPercent,
      "assaultAnomalyDamageBonusPercent",
    ) +
    number(elementBonus, `${element}DamageBonusPercent`);
  if (kind === "nankai") {
    total += number(
      input.disseminationDamageBonusPercent,
      "disseminationDamageBonusPercent",
    );
  }
  if (kind === "turbulence") {
    total += number(
      input.turbulenceDamageBonusPercent,
      "turbulenceDamageBonusPercent",
    );
  }
  return total;
}

export function getAnomalyDamageBonusMultiplier(dealer, anomalyKey) {
  return 1 + getAnomalyDamageBonusPercent(dealer, anomalyKey) * PERCENT;
}

function normalizeDealerId(value) {
  const normalized = String(value ?? "A")
    .replace("딜러", "")
    .trim()
    .toUpperCase();
  if (!["A", "B"].includes(normalized)) {
    throw new RangeError(`unsupported dealer "${value}"`);
  }
  return normalized;
}

function asCalculatedDealers(dealers = {}) {
  return {
    A:
      dealers.A?.combatAttack !== undefined
        ? dealers.A
        : calculateDealerStats({
            ...ANOMALY_DEALER_A_DEFAULTS,
            ...(dealers.A ?? {}),
            id: "A",
          }),
    B:
      dealers.B?.combatAttack !== undefined
        ? dealers.B
        : calculateDealerStats({
            ...ANOMALY_DEALER_B_DEFAULTS,
            ...(dealers.B ?? {}),
            id: "B",
          }),
  };
}

export const MAIN_ANOMALY_SLOT_DEFAULTS = freeze([
  freeze({
    id: "A",
    snapshotDealer: "A",
    realtimeDealer: "B",
    anomalyKey: "풍화난개",
    resistanceScenario: "비약점",
    coefficientPercent: 6.35,
    additionalMultiplier: 1,
  }),
  freeze({
    id: "B",
    snapshotDealer: "B",
    realtimeDealer: "A",
    anomalyKey: "쇄빙난류",
    resistanceScenario: "약점",
    coefficientPercent: 13.975,
    additionalMultiplier: 1,
  }),
]);

export const MAIN_ANOMALY_DEFAULTS = freeze({
  dealers: DEFAULT_ANOMALY_DEALERS,
  slots: MAIN_ANOMALY_SLOT_DEFAULTS,
});

export function calculateMainAnomalyDamageSlot(slot = {}, dealers = {}) {
  slot = { ...MAIN_ANOMALY_SLOT_DEFAULTS[0], ...slot };
  const calculatedDealers = asCalculatedDealers(dealers);
  const snapshotDealerId = normalizeDealerId(slot.snapshotDealer ?? "A");
  const realtimeDealerId = normalizeDealerId(slot.realtimeDealer ?? "B");
  const snapshot = calculatedDealers[snapshotDealerId];
  const realtime = calculatedDealers[realtimeDealerId];
  const anomalyKey = slot.anomalyKey ?? slot.anomaly ?? "풍화난개";
  const resistanceScenario =
    slot.resistanceScenario ?? slot.resistance ?? "비약점";
  const resistanceModifier = requiredLookup(
    RESISTANCE_SCENARIO_MODIFIERS,
    resistanceScenario,
    "resistance scenario",
  );
  const anomalyDamageMultiplier = getAnomalyDamageBonusMultiplier(
    realtime,
    anomalyKey,
  );
  const resistanceMultiplier =
    realtime.resistanceMultiplier + resistanceModifier;
  const coefficientPercent = number(
    slot.coefficientPercent ?? 0,
    "coefficientPercent",
  );
  // The sheet labels this field "이상계수%" but multiplies the entered value
  // directly (J44/N44), e.g. 6.35 is a factor of 6.35 rather than 0.0635.
  const coefficientMultiplier = coefficientPercent;
  const additionalMultiplier = number(
    slot.additionalMultiplier ?? 1,
    "additionalMultiplier",
  );
  const rawDamage =
    snapshot.combatAttack *
    snapshot.defenseMultiplier *
    snapshot.damageMultiplier *
    snapshot.anomalyProficiencyMultiplier *
    snapshot.levelMultiplier *
    anomalyDamageMultiplier *
    resistanceMultiplier *
    realtime.mutationMultiplier *
    realtime.stunMultiplier *
    realtime.receivedDamageMultiplier *
    coefficientMultiplier *
    additionalMultiplier;
  const displayedDamage = ceilToInteger(rawDamage);

  return {
    id: slot.id ?? snapshotDealerId,
    snapshotDealer: snapshotDealerId,
    realtimeDealer: realtimeDealerId,
    anomalyKey,
    resistanceScenario,
    snapshot,
    realtime,
    anomalyDamageMultiplier,
    resistanceModifier,
    resistanceMultiplier,
    coefficientPercent,
    coefficientMultiplier,
    additionalMultiplier,
    rawDamage,
    displayedDamage,
    finalDamage: displayedDamage,
    damage: displayedDamage,
  };
}

export function calculateMainAnomalyDamage(options = {}) {
  const dealers = asCalculatedDealers(options.dealers);
  const requestedSlots = options.slots ?? MAIN_ANOMALY_SLOT_DEFAULTS;
  const slots = requestedSlots.map((slot, index) =>
    calculateMainAnomalyDamageSlot(
      { ...MAIN_ANOMALY_SLOT_DEFAULTS[index], ...slot },
      dealers,
    ),
  );

  return {
    dealers,
    slots,
    slotA: slots[0],
    slotB: slots[1],
    displayedDamageA: slots[0]?.displayedDamage,
    displayedDamageB: slots[1]?.displayedDamage,
  };
}

export const REMIEL_RADIANCE_COEFFICIENT_DEFAULTS = freeze({
  skill: "궁극기",
  skillLevel: 12,
  remielAnomalyProficiency: 689,
  mindscape4: false,
});

export function calculateRemielRadianceCoefficient(overrides = {}) {
  const input = {
    ...REMIEL_RADIANCE_COEFFICIENT_DEFAULTS,
    ...overrides,
  };
  const skillTable = requiredLookup(
    RADIANCE_SKILL_COEFFICIENTS,
    input.skill,
    "Remiel radiance skill",
  );
  const skillLevel = number(input.skillLevel, "skillLevel");
  const baseCoefficient = requiredLookup(
    skillTable,
    skillLevel,
    `${input.skill} skill level`,
  );
  const anomalyProficiencyMultiplier =
    1 +
    0.002 *
      number(input.remielAnomalyProficiency, "remielAnomalyProficiency");
  const mindscape4Multiplier = enabled(input.mindscape4, ["4돌 이상"])
    ? 1.12
    : 1;
  const finalCoefficient =
    baseCoefficient * anomalyProficiencyMultiplier * mindscape4Multiplier;

  return {
    input,
    skill: input.skill,
    skillLevel,
    baseCoefficient,
    anomalyProficiencyMultiplier,
    mindscape4Multiplier,
    finalCoefficient,
    coefficient: finalCoefficient,
    coefficientMultiplier: finalCoefficient * PERCENT,
  };
}

export const REMIEL_ENGINE_DAMAGE_BONUS = freeze({
  대체엔진: 0,
  전엔1재: 20,
  전엔2재: 23,
  전엔3재: 26,
  전엔4재: 29,
  전엔5재: 32,
});

export const REMIEL_DEFAULTS = freeze({
  skill: "궁극기",
  skillLevel: 12,
  remielAnomalyProficiency: 689,
  mindscape4: false,
  resistanceReductionPercent: 0,
  resistanceIgnorePercent: 0,
  assaultResistanceReductionPercent: 15,
  mindscape1: false,
  threeAnomalyParty: true,
  mindscape2: false,
  mutationPercentPerProficiency: 0.02,
  baseAnomalyDamageMultiplier: 1.15,
  anomalyDamageAdjustmentPercent: 0,
  assaultAnomalyDamageBonusPercent: 75,
  engine: "전엔1재",
  stunned: true,
  baseStunMultiplierPercent: 150,
  additionalStunMultiplierPercent: 0,
  receivedDamageIncreasePercent: 0,
  receivedDamageReductionPercent: 15,
  resistanceScenario: "약점",
  additionalMultiplier: 1,
});

export const REMIEL_RADIANCE_DAMAGE_DEFAULTS = freeze({
  dealers: DEFAULT_ANOMALY_DEALERS,
  remiel: REMIEL_DEFAULTS,
  slots: freeze([
    freeze({
      id: "A",
      snapshotDealer: "A",
      resistanceScenario: "약점",
      additionalMultiplier: 1,
    }),
    freeze({
      id: "B",
      snapshotDealer: "B",
      resistanceScenario: "약점",
      additionalMultiplier: 1,
    }),
  ]),
});

function calculateRemielRuntime(overrides = {}) {
  const input = { ...REMIEL_DEFAULTS, ...overrides };
  const radiance = calculateRemielRadianceCoefficient(input);
  const engineDamageBonusPercent = requiredLookup(
    REMIEL_ENGINE_DAMAGE_BONUS,
    input.engine,
    "Remiel engine",
  );
  const anomalyDamageMultiplier =
    number(
      input.baseAnomalyDamageMultiplier,
      "baseAnomalyDamageMultiplier",
    ) +
    percent(
      number(
        input.anomalyDamageAdjustmentPercent,
        "anomalyDamageAdjustmentPercent",
      ) +
        number(
          input.assaultAnomalyDamageBonusPercent,
          "assaultAnomalyDamageBonusPercent",
        ) +
        engineDamageBonusPercent,
      "totalRemielAnomalyDamageBonusPercent",
    );
  const baseResistanceMultiplier =
    1 +
    percent(
      number(input.resistanceReductionPercent, "resistanceReductionPercent") +
        number(input.resistanceIgnorePercent, "resistanceIgnorePercent") +
        number(
          input.assaultResistanceReductionPercent,
          "assaultResistanceReductionPercent",
        ) +
        (enabled(input.mindscape1, ["1돌 이상"]) ? 50 : 0),
      "totalRemielResistancePercent",
    );
  const resistanceModifier = requiredLookup(
    RESISTANCE_SCENARIO_MODIFIERS,
    input.resistanceScenario,
    "Remiel resistance scenario",
  );
  const resistanceMultiplier =
    baseResistanceMultiplier + resistanceModifier;
  const mutationBonusPercent =
    (enabled(input.threeAnomalyParty, ["편성"]) ? 10 : 0) +
    (enabled(input.mindscape2, ["2돌 이상"]) ? 20 : 0);
  const mutationPercent =
    number(input.remielAnomalyProficiency, "remielAnomalyProficiency") *
      number(
        input.mutationPercentPerProficiency,
        "mutationPercentPerProficiency",
      ) +
    mutationBonusPercent;
  const mutationMultiplier = 1 + mutationPercent * PERCENT;
  const stunMultiplier =
    enabled(input.stunned, ["그로기"])
      ? percent(input.baseStunMultiplierPercent, "baseStunMultiplierPercent") +
        percent(
          input.additionalStunMultiplierPercent,
          "additionalStunMultiplierPercent",
        )
      : 1;
  const receivedDamageMultiplier =
    1 +
    percent(
      input.receivedDamageIncreasePercent,
      "receivedDamageIncreasePercent",
    ) -
    percent(
      input.receivedDamageReductionPercent,
      "receivedDamageReductionPercent",
    );

  return {
    input,
    radiance,
    engineDamageBonusPercent,
    anomalyDamageMultiplier,
    baseResistanceMultiplier,
    resistanceModifier,
    resistanceMultiplier,
    mutationBonusPercent,
    mutationPercent,
    mutationMultiplier,
    stunMultiplier,
    receivedDamageMultiplier,
    additionalMultiplier: number(
      input.additionalMultiplier,
      "additionalMultiplier",
    ),
  };
}

export function calculateRemielRadianceDamage(options = {}) {
  const dealers = asCalculatedDealers(options.dealers);
  const remiel = calculateRemielRuntime(options.remiel);
  const requestedSlots =
    options.slots ?? REMIEL_RADIANCE_DAMAGE_DEFAULTS.slots;
  const slots = requestedSlots.map((slot, index) => {
    const defaults = REMIEL_RADIANCE_DAMAGE_DEFAULTS.slots[index] ?? {};
    const merged = { ...defaults, ...slot };
    const snapshotDealer = normalizeDealerId(merged.snapshotDealer);
    const snapshot = dealers[snapshotDealer];
    const resistanceScenario =
      merged.resistanceScenario ?? remiel.input.resistanceScenario;
    const resistanceModifier = requiredLookup(
      RESISTANCE_SCENARIO_MODIFIERS,
      resistanceScenario,
      "Remiel slot resistance scenario",
    );
    const resistanceMultiplier =
      remiel.baseResistanceMultiplier + resistanceModifier;
    const additionalMultiplier = number(
      merged.additionalMultiplier ?? remiel.additionalMultiplier,
      "additionalMultiplier",
    );
    const rawDamage =
      snapshot.combatAttack *
      snapshot.defenseMultiplier *
      snapshot.damageMultiplier *
      snapshot.anomalyProficiencyMultiplier *
      snapshot.levelMultiplier *
      remiel.anomalyDamageMultiplier *
      resistanceMultiplier *
      remiel.mutationMultiplier *
      remiel.stunMultiplier *
      remiel.receivedDamageMultiplier *
      remiel.radiance.coefficientMultiplier *
      additionalMultiplier;
    const displayedDamage = ceilToInteger(rawDamage);

    return {
      id: merged.id ?? snapshotDealer,
      snapshotDealer,
      snapshot,
      resistanceScenario,
      resistanceModifier,
      resistanceMultiplier,
      additionalMultiplier,
      rawDamage,
      displayedDamage,
      finalDamage: displayedDamage,
      damage: displayedDamage,
    };
  });

  return {
    dealers,
    remiel,
    coefficient: remiel.radiance,
    slots,
    slotA: slots[0],
    slotB: slots[1],
    displayedDamageA: slots[0]?.displayedDamage,
    displayedDamageB: slots[1]?.displayedDamage,
  };
}

export const calculateRemielDamage = calculateRemielRadianceDamage;
