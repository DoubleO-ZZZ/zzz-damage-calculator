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
import {
  getMindscapeEffects,
  resolveMindscapeEffects,
} from "./data/mindscapes.js";
import { characterElement, ELEMENT_LABELS } from "./data/media.js";
import {
  normalizeDiscSelections,
  resolveDiscBuild,
} from "./disk-build.js";

export const COMPARISON_MODES = Object.freeze({
  strong: "공격 피해",
  mingpo: "명파 피해",
  anomaly: "이상 피해",
});

export const COMPARISON_STATE_VERSION = 3;

const DEFAULT_PROFILE = Object.freeze({
  characterId: "1041",
  mindscape: 0,
  weaponId: "13004",
  customEngineBaseAttack: 594,
  discBuildMode: "auto",
  discScore: 30,
  discFourPieceId: "32200",
  discTwoPieceId: "31000",
  discEffectMode: "off",
  mindscapeEffectMode: "off",
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
  passiveResistanceReductionPercent: 0,
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
  skillType: "normal",
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

function mindscapeSkillTypes(characterId, selectedSkillType) {
  const prefixByType = {
    normal: ["basic"],
    dash: ["dash"],
    counter: ["dodge-counter"],
    ex: ["ex", "ex-special", "special"],
    chain: ["chain"],
    ultimate: ["ultimate"],
    assist: ["assist", "assist-attack"],
    aftershock: ["aftershock"],
  };
  const allTypes = getMindscapeEffects(characterId)
    .flatMap((entry) => entry.skillTypes ?? []);
  if (selectedSkillType === "all") return [...new Set(allTypes)];
  const prefixes = prefixByType[selectedSkillType] ?? [selectedSkillType];
  return [
    ...new Set(
      allTypes.filter((skillType) =>
        prefixes.some(
          (prefix) =>
            skillType === prefix || skillType.startsWith(`${prefix}:`),
        ),
      ),
    ),
  ];
}

function withAutomatedBuilds(profile, common, resolved) {
  const mindscape = resolveMindscapeEffects(
    resolved.character.id,
    profile.mindscape,
    {
      mode: common.mode,
      element:
        ELEMENT_LABELS[characterElement(resolved.character.id)] ?? null,
      anomalyKey: common.anomalyKey,
      skillType: mindscapeSkillTypes(
        resolved.character.id,
        common.skillType,
      ),
      maxActivation: profile.mindscapeEffectMode === "max",
    },
  );
  const cinema = mindscape.totals;
  const discBuild = resolveDiscBuild({
    profile,
    character: resolved.character,
    weaponCritRatePercent: resolved.engineCritRatePercent,
    weaponAnomalyMasteryPercent:
      resolved.engineAnomalyMasteryPercent,
    mindscapeCritRatePercent: cinema.critRate,
    mindscapeAnomalyMasteryPercent: cinema.anomalyMastery,
    mode: common.mode,
    skillType: common.skillType,
  });
  const set = discBuild.setTotals;
  const presetMode = discBuild.type !== "manual";

  return {
    mindscape,
    discBuild,
    effectiveProfile: {
      ...profile,
      discAttackPercent:
        discBuild.discAttackPercent + set.discAttackPercent,
      flatAttackRolls: presetMode ? 0 : number(profile.flatAttackRolls, 0),
      discHpPercent: discBuild.discHpPercent + set.discHpPercent,
      flatHpRolls: presetMode ? 0 : number(profile.flatHpRolls, 0),
      discCritRatePercent:
        discBuild.discCritRatePercent + set.discCritRatePercent,
      discCritDamagePercent:
        discBuild.discCritDamagePercent + set.discCritDamagePercent,
      discAnomalyProficiency:
        discBuild.discAnomalyProficiency +
        set.discAnomalyProficiency,
      discAnomalyMasteryPercent:
        discBuild.discAnomalyMasteryPercent +
        set.discAnomalyMasteryPercent,
      damageBonusPercent: discBuild.damageBonusPercent,
      anomalyDamageBonusPercent:
        number(profile.anomalyDamageBonusPercent, 0) +
        set.anomalyDamageBonusPercent +
        cinema.anomalyDamageBonus,
      passiveAttackPercent:
        number(profile.passiveAttackPercent, 0) +
        set.passiveAttackPercent +
        cinema.attackPercent,
      passiveHpPercent:
        number(profile.passiveHpPercent, 0) + cinema.hpPercent,
      passiveCritRatePercent:
        number(profile.passiveCritRatePercent, 0) +
        set.passiveCritRatePercent +
        cinema.critRate,
      passiveCritDamagePercent:
        number(profile.passiveCritDamagePercent, 0) +
        set.passiveCritDamagePercent +
        cinema.critDamage,
      passiveDamageBonusPercent:
        number(profile.passiveDamageBonusPercent, 0) +
        set.passiveDamageBonusPercent +
        cinema.damageBonus,
      passivePenetrationPercent:
        number(profile.passivePenetrationPercent, 0) +
        set.passivePenetrationPercent +
        cinema.penetrationPercent,
      passiveDefenseReductionPercent:
        number(profile.passiveDefenseReductionPercent, 0) +
        cinema.defenseReduction,
      passiveResistanceIgnorePercent:
        number(profile.passiveResistanceIgnorePercent, 0) +
        cinema.resistanceIgnore,
      passiveResistanceReductionPercent:
        number(profile.passiveResistanceReductionPercent, 0) +
        cinema.resistanceReduction,
      passiveAnomalyProficiency:
        number(profile.passiveAnomalyProficiency, 0) +
        set.passiveAnomalyProficiency +
        cinema.anomalyProficiency,
      passiveAnomalyMasteryPercent:
        number(profile.passiveAnomalyMasteryPercent, 0) +
        set.passiveAnomalyMasteryPercent +
        cinema.anomalyMastery,
      penetrationDamageBonusPercent:
        number(profile.penetrationDamageBonusPercent, 0) +
        set.penetrationDamageBonusPercent +
        cinema.penetrationDamageBonus,
    },
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
    resistanceReductionPercent:
      shared.resistanceReductionPercent +
      number(profile.passiveResistanceReductionPercent, 0),
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
    resistanceReductionPercent:
      shared.resistanceReductionPercent +
      number(profile.passiveResistanceReductionPercent, 0),
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
    resistanceReductionPercent:
      shared.resistanceReductionPercent +
      number(profile.passiveResistanceReductionPercent, 0),
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
  const mode = COMPARISON_MODES[common.mode] ? common.mode : "strong";
  const normalizedProfile = { ...profile };
  const resolved = resolveProfile(normalizedProfile);
  normalizeDiscSelections(
    normalizedProfile,
    resolved.character,
    mode,
  );
  const { discBuild, mindscape, effectiveProfile } = withAutomatedBuilds(
    normalizedProfile,
    common,
    resolved,
  );
  let calculation;

  if (mode === "mingpo") {
    calculation = calculateMingpoProfile(
      effectiveProfile,
      common,
      resolved,
    );
  } else if (mode === "anomaly") {
    calculation = calculateAnomalyProfile(
      effectiveProfile,
      common,
      resolved,
    );
  } else {
    calculation = calculateStrongProfile(
      effectiveProfile,
      common,
      resolved,
    );
  }

  const rawDamage = calculation.rawDamage;
  return {
    mode,
    modelLabel: COMPARISON_MODES[mode],
    profile: normalizedProfile,
    effectiveProfile,
    discBuild,
    mindscape,
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
  const legacyState =
    saved &&
    number(saved.version, 0) < COMPARISON_STATE_VERSION;
  const mergeProfile = (id) => ({
    ...defaults.profiles[id],
    ...(saved?.profiles?.[id] ?? {}),
    ...(legacyState && saved?.profiles?.[id]
      ? { discBuildMode: "manual" }
      : {}),
  });
  return {
    version: COMPARISON_STATE_VERSION,
    common: { ...defaults.common, ...(saved?.common ?? {}) },
    profiles: {
      A: mergeProfile("A"),
      B: mergeProfile("B"),
    },
  };
}
