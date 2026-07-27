import {
  NORMAL_ANOMALY_COEFFICIENTS,
  calculateDealerStats,
  calculateMainAnomalyDamageSlot,
  calculateMingpo,
  calculateStrongAttack,
} from "./calculators.js";
import {
  CHARACTER_BY_ID,
  WEAPONS,
  WEAPON_BY_ID,
} from "./data/catalog.js";

export const COMPARISON_MODES = Object.freeze({
  strong: "공격 피해",
  mingpo: "명파 피해",
  anomaly: "이상 피해",
});

export const COMPARISON_STATE_VERSION = 2;

const DEFAULT_PROFILE = Object.freeze({
  characterId: "1041",
  mindscape: 0,
  weaponId: "13004",
  customEngineBaseAttack: 594,
  discAttackPercent: 76,
  flatAttackRolls: 2,
  discHpPercent: 0,
  flatHpRolls: 0,
  discCritRatePercent: 50.6,
  discCritDamagePercent: 100,
  discAnomalyProficiency: 200,
  discAnomalyMasteryPercent: 0,
  skillCoefficientPercent: 1000,
  anomalyCoefficientMultiplier: 1,
  damageBonusPercent: 40,
  anomalyDamageBonusPercent: 0,
  passiveAttackPercent: 0,
  passiveHpPercent: 0,
  passiveCritRatePercent: 0,
  passiveCritDamagePercent: 0,
  passiveDamageBonusPercent: 0,
  passivePenetrationPercent: 0,
  passiveDefenseReductionPercent: 0,
  passiveResistanceIgnorePercent: 0,
  passiveAnomalyProficiency: 0,
  passiveAnomalyMasteryPercent: 0,
  penetrationDamageBonusPercent: 0,
  advancedOpen: false,
});

const DEFAULT_COMMON = Object.freeze({
  characterId: "1041",
  mode: "strong",
  enemyDefense: 952.8,
  enemyDefenseReductionPercent: 0,
  enemyResistancePercent: 0,
  resistanceReductionPercent: 0,
  attackPercentBuff: 0,
  flatAttackBuff: 0,
  hpPercentBuff: 0,
  flatPenetrationBuff: 0,
  partyDamageBonusPercent: 0,
  partyCriticalDamagePercent: 0,
  stunned: false,
  baseStunMultiplierPercent: 150,
  additionalStunMultiplierPercent: 0,
  anomalyKey: "강타",
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createDefaultComparisonState() {
  return {
    version: COMPARISON_STATE_VERSION,
    common: clone(DEFAULT_COMMON),
    profiles: {
      A: {
        ...clone(DEFAULT_PROFILE),
        label: "명함 + 전용 엔진",
        weaponId: "14104",
      },
      B: {
        ...clone(DEFAULT_PROFILE),
        label: "명함 + 대체 엔진",
        weaponId: "13004",
      },
    },
  };
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function secondaryValue(weapon, stat) {
  return weapon?.secondaryStat === stat ? weapon.secondaryValue : 0;
}

function resolveProfile(profile) {
  const character = CHARACTER_BY_ID[profile.characterId] ?? CHARACTER_BY_ID["1041"];
  let weapon;
  if (profile.weaponId === "custom") {
    weapon = {
          id: "custom",
          name: "직접 입력",
          baseAttack: number(profile.customEngineBaseAttack, 0),
          secondaryStat: "",
          secondaryValue: 0,
          sourceUrl: "",
          version: "manual",
        };
  } else {
    const requestedWeapon = WEAPON_BY_ID[profile.weaponId];
    const signatureId = `14${character.id.slice(0, 3)}`;
    weapon =
      (requestedWeapon?.specialty === character.specialty
        ? requestedWeapon
        : undefined) ??
      (WEAPON_BY_ID[signatureId]?.specialty === character.specialty
        ? WEAPON_BY_ID[signatureId]
        : undefined) ??
      WEAPONS.find((item) => item.specialty === character.specialty) ??
      WEAPON_BY_ID["13004"];
  }

  const engineAttackPercent = secondaryValue(weapon, "공격력");
  const engineHpPercent = secondaryValue(weapon, "HP");
  const engineCritRatePercent = secondaryValue(weapon, "치명타 확률");
  const engineCritDamagePercent = secondaryValue(weapon, "치명타 피해");
  const enginePenetrationPercent = secondaryValue(weapon, "관통률");
  const engineAnomalyProficiency = secondaryValue(weapon, "이상 마스터리");
  const engineAnomalyMasteryPercent = secondaryValue(weapon, "이상 장악력");

  return {
    character,
    weapon,
    engineAttackPercent,
    engineHpPercent,
    engineCritRatePercent,
    engineCritDamagePercent,
    enginePenetrationPercent,
    engineAnomalyProficiency,
    engineAnomalyMasteryPercent,
  };
}

function commonMultipliers(common) {
  const stunned = Boolean(common.stunned);
  return {
    enemyDefense: number(common.enemyDefense, 0),
    enemyDefenseReductionPercent: number(
      common.enemyDefenseReductionPercent,
      0,
    ),
    enemyResistancePercent: number(common.enemyResistancePercent, 0),
    resistanceReductionPercent: number(
      common.resistanceReductionPercent,
      0,
    ),
    attackPercentBuff: number(common.attackPercentBuff, 0),
    flatAttackBuff: number(common.flatAttackBuff, 0),
    hpPercentBuff: number(common.hpPercentBuff, 0),
    flatPenetrationBuff: number(common.flatPenetrationBuff, 0),
    partyDamageBonusPercent: number(common.partyDamageBonusPercent, 0),
    partyCriticalDamagePercent: number(
      common.partyCriticalDamagePercent,
      0,
    ),
    baseStunMultiplierPercent: stunned
      ? number(common.baseStunMultiplierPercent, 150)
      : 100,
    additionalStunMultiplierPercent: stunned
      ? number(common.additionalStunMultiplierPercent, 0)
      : 0,
  };
}

function calculateStrongProfile(profile, common, resolved) {
  const shared = commonMultipliers(common);
  const { character, weapon } = resolved;
  return calculateStrongAttack({
    characterBaseAttack: character.attack,
    engineBaseAttack: weapon.baseAttack,
    skillCoefficientPercent: number(profile.skillCoefficientPercent, 0),
    engineAttackPercent: resolved.engineAttackPercent,
    discAttackPercent: number(profile.discAttackPercent, 0),
    flatAttackRolls: number(profile.flatAttackRolls, 0),
    attackPercentBuff:
      shared.attackPercentBuff + number(profile.passiveAttackPercent, 0),
    flatAttackBuff: shared.flatAttackBuff,
    selfCriticalDamagePercent:
      character.critDamage +
      resolved.engineCritDamagePercent +
      number(profile.discCritDamagePercent, 0) +
      number(profile.passiveCritDamagePercent, 0),
    support1CriticalDamagePercent: shared.partyCriticalDamagePercent,
    support2CriticalDamagePercent: 0,
    criticalDamageReductionPercent: 0,
    assaultCriticalDamagePercent: 0,
    gimmickCriticalDamagePercent: 0,
    criticalChancePercent: clamp(
      character.critRate +
        resolved.engineCritRatePercent +
        number(profile.discCritRatePercent, 0) +
        number(profile.passiveCritRatePercent, 0),
      0,
      100,
    ),
    enemyDefense: shared.enemyDefense,
    enemyDefenseIncreasePercent: 0,
    enemyDefenseReductionPercent:
      shared.enemyDefenseReductionPercent +
      number(profile.passiveDefenseReductionPercent, 0),
    penetrationPercent:
      character.penetrationRatio +
      resolved.enginePenetrationPercent +
      number(profile.passivePenetrationPercent, 0),
    penetrationValue: 0,
    resistanceReductionPercent: shared.resistanceReductionPercent,
    resistanceIgnorePercent: number(
      profile.passiveResistanceIgnorePercent,
      0,
    ),
    enemyResistancePercent: shared.enemyResistancePercent,
    selfDamageBonusPercent:
      number(profile.damageBonusPercent, 0) +
      number(profile.passiveDamageBonusPercent, 0),
    support1DamageBonusPercent: shared.partyDamageBonusPercent,
    support2DamageBonusPercent: 0,
    assaultDamageBonusPercent: 0,
    otherDamageBonusPercent: 0,
    baseStunMultiplierPercent: shared.baseStunMultiplierPercent,
    additionalStunMultiplierPercent:
      shared.additionalStunMultiplierPercent,
    receivedDamageIncreasePercent: 0,
    receivedDamageReductionPercent: 0,
  });
}

function calculateMingpoProfile(profile, common, resolved) {
  const shared = commonMultipliers(common);
  const { character, weapon } = resolved;
  return calculateMingpo({
    characterBaseAttack: character.attack,
    engineBaseAttack: weapon.baseAttack,
    engineAttackPercent: resolved.engineAttackPercent,
    discAttackPercent: number(profile.discAttackPercent, 0),
    flatAttackRolls: number(profile.flatAttackRolls, 0),
    attackPercentBuff:
      shared.attackPercentBuff + number(profile.passiveAttackPercent, 0),
    flatAttackBuff: shared.flatAttackBuff,
    characterBaseHp: character.hp,
    engineHpPercent: resolved.engineHpPercent,
    discHpPercent: number(profile.discHpPercent, 0),
    flatHpRolls: number(profile.flatHpRolls, 0),
    hpPercentBuff:
      shared.hpPercentBuff + number(profile.passiveHpPercent, 0),
    flatPenetrationBuff: shared.flatPenetrationBuff,
    penetrationDamageBonusPercent: number(
      profile.penetrationDamageBonusPercent,
      0,
    ),
    selfDamageBonusPercent:
      number(profile.damageBonusPercent, 0) +
      number(profile.passiveDamageBonusPercent, 0),
    support1DamageBonusPercent: shared.partyDamageBonusPercent,
    support2DamageBonusPercent: 0,
    assaultDamageBonusPercent: 0,
    otherDamageBonusPercent: 0,
    selfCriticalDamagePercent:
      character.critDamage +
      resolved.engineCritDamagePercent +
      number(profile.discCritDamagePercent, 0) +
      number(profile.passiveCritDamagePercent, 0),
    support1CriticalDamagePercent: shared.partyCriticalDamagePercent,
    support2CriticalDamagePercent: 0,
    criticalDamageReductionPercent: 0,
    assaultCriticalDamagePercent: 0,
    gimmickCriticalDamagePercent: 0,
    criticalChancePercent: clamp(
      character.critRate +
        resolved.engineCritRatePercent +
        number(profile.discCritRatePercent, 0) +
        number(profile.passiveCritRatePercent, 0),
      0,
      100,
    ),
    resistanceReductionPercent: shared.resistanceReductionPercent,
    resistanceIgnorePercent: number(
      profile.passiveResistanceIgnorePercent,
      0,
    ),
    enemyResistancePercent: shared.enemyResistancePercent,
    baseStunMultiplierPercent: shared.baseStunMultiplierPercent,
    additionalStunMultiplierPercent:
      shared.additionalStunMultiplierPercent,
    receivedDamageIncreasePercent: 0,
    receivedDamageReductionPercent: 0,
    skillCoefficientPercent: number(profile.skillCoefficientPercent, 0),
  });
}

function calculateAnomalyProfile(profile, common, resolved) {
  const shared = commonMultipliers(common);
  const { character, weapon } = resolved;
  const dealer = calculateDealerStats({
    id: "A",
    characterBaseAttack: character.attack,
    engineBaseAttack: weapon.baseAttack,
    engineAttackPercent: resolved.engineAttackPercent,
    discAttackPercent: number(profile.discAttackPercent, 0),
    flatAttackRolls: number(profile.flatAttackRolls, 0),
    attackPercentBuff:
      shared.attackPercentBuff + number(profile.passiveAttackPercent, 0),
    flatAttackBuff: shared.flatAttackBuff,
    enemyDefense: shared.enemyDefense,
    enemyDefenseIncreasePercent: 0,
    enemyDefenseReductionPercent:
      shared.enemyDefenseReductionPercent +
      number(profile.passiveDefenseReductionPercent, 0),
    penetrationPercent:
      character.penetrationRatio +
      resolved.enginePenetrationPercent +
      number(profile.passivePenetrationPercent, 0),
    penetrationValue: 0,
    resistanceReductionPercent: shared.resistanceReductionPercent,
    resistanceIgnorePercent: number(
      profile.passiveResistanceIgnorePercent,
      0,
    ),
    enemyResistancePercent: shared.enemyResistancePercent,
    selfDamageBonusPercent:
      number(profile.damageBonusPercent, 0) +
      number(profile.passiveDamageBonusPercent, 0),
    support1DamageBonusPercent: shared.partyDamageBonusPercent,
    support2DamageBonusPercent: 0,
    assaultDamageBonusPercent: 0,
    otherDamageBonusPercent: 0,
    baseAnomalyDamageBonusPercent: number(
      profile.anomalyDamageBonusPercent,
      0,
    ),
    assaultAnomalyDamageBonusPercent: 0,
    assaultDisorderDamageBonusPercent: 0,
    disseminationDamageBonusPercent: 0,
    turbulenceDamageBonusPercent: 0,
    elementDamageBonusPercent: {
      연소: 0,
      침식: 0,
      감전: 0,
      쇄빙: 0,
      강타: 0,
      풍화: 0,
    },
    lumenAnomalyProficiency: 0,
    mutationPercentPerProficiency: 0,
    additionalMutationPercent: 0,
    lumenIncluded: false,
    townAnomalyProficiency:
      character.anomalyProficiency +
      resolved.engineAnomalyProficiency +
      number(profile.discAnomalyProficiency, 0),
    selfAnomalyProficiencyBuff: number(
      profile.passiveAnomalyProficiency,
      0,
    ),
    partyAnomalyProficiencyBuff: 0,
    assaultAnomalyProficiencyBuff: 0,
    stunned: Boolean(common.stunned),
    baseStunMultiplierPercent: shared.baseStunMultiplierPercent,
    additionalStunMultiplierPercent:
      shared.additionalStunMultiplierPercent,
    attackerLevel: 60,
    receivedDamageIncreasePercent: 0,
    receivedDamageReductionPercent: 0,
    baseAnomalyMastery: character.anomalyMastery,
    anomalyMasteryPercent:
      resolved.engineAnomalyMasteryPercent +
      number(profile.discAnomalyMasteryPercent, 0) +
      number(profile.passiveAnomalyMasteryPercent, 0),
    selfAnomalyMasteryBuff: 0,
    anomalyMasteryBuff: 0,
  });

  return calculateMainAnomalyDamageSlot(
    {
      id: "A",
      snapshotDealer: "A",
      realtimeDealer: "A",
      anomalyKey: common.anomalyKey || "강타",
      resistanceScenario: "비약점",
      coefficientPercent:
        (NORMAL_ANOMALY_COEFFICIENTS[common.anomalyKey] ??
          NORMAL_ANOMALY_COEFFICIENTS.강타) /
        100 *
        number(profile.anomalyCoefficientMultiplier, 1),
      additionalMultiplier: 1,
    },
    { A: dealer, B: dealer },
  );
}

export function calculateInvestmentProfile(profile, common) {
  const resolved = resolveProfile(profile);
  const mode = COMPARISON_MODES[common.mode] ? common.mode : "strong";
  let calculation;

  if (mode === "mingpo") {
    calculation = calculateMingpoProfile(profile, common, resolved);
  } else if (mode === "anomaly") {
    calculation = calculateAnomalyProfile(profile, common, resolved);
  } else {
    calculation = calculateStrongProfile(profile, common, resolved);
  }

  const rawDamage = calculation.rawDamage;
  return {
    mode,
    modelLabel: COMPARISON_MODES[mode],
    profile,
    ...resolved,
    calculation,
    rawDamage,
    displayedDamage: calculation.displayedDamage,
    townAttack:
      calculation.townAttack ??
      calculation.snapshot?.townAttack ??
      calculation.snapshot?.combatAttack,
    combatAttack:
      calculation.combatAttack ?? calculation.snapshot?.combatAttack,
    townHp: calculation.townHp,
    combatPenetration: calculation.combatPenetration,
    anomalyProficiency: calculation.snapshot?.anomalyProficiency,
  };
}

export function compareInvestments(state) {
  const common = { ...DEFAULT_COMMON, ...(state?.common ?? {}) };
  const sharedCharacterId =
    CHARACTER_BY_ID[common.characterId] !== undefined
      ? common.characterId
      : DEFAULT_COMMON.characterId;
  const profileA = {
    ...DEFAULT_PROFILE,
    ...(state?.profiles?.A ?? {}),
    characterId: sharedCharacterId,
  };
  const profileB = {
    ...DEFAULT_PROFILE,
    ...(state?.profiles?.B ?? {}),
    characterId: sharedCharacterId,
  };
  const A = calculateInvestmentProfile(profileA, common);
  const B = calculateInvestmentProfile(profileB, common);
  const deltaRaw = B.rawDamage - A.rawDamage;
  const deltaPercent =
    A.rawDamage === 0 ? null : (deltaRaw / A.rawDamage) * 100;
  const winner =
    Math.abs(deltaRaw) < 1e-9 ? "tie" : deltaRaw > 0 ? "B" : "A";

  return {
    mode: common.mode,
    common,
    A,
    B,
    deltaRaw,
    deltaDisplayed: B.displayedDamage - A.displayedDamage,
    deltaPercent,
    winner,
  };
}

export function mergeComparisonState(saved) {
  const defaults = createDefaultComparisonState();
  return {
    version: COMPARISON_STATE_VERSION,
    common: { ...defaults.common, ...(saved?.common ?? {}) },
    profiles: {
      A: { ...defaults.profiles.A, ...(saved?.profiles?.A ?? {}) },
      B: { ...defaults.profiles.B, ...(saved?.profiles?.B ?? {}) },
    },
  };
}
