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
import {
  AGENT_CORE_STATIC_STATS_BY_ID,
  resolveAgentEffects,
} from "./data/agent-effects.js";
import { resolveEnemy } from "./data/enemies.js";
import { resolvePartyWeaponEffects } from "./data/party-weapon-effects.js";
import {
  getWeaponPassive,
  resolveWeaponPassiveEffects,
} from "./data/weapon-passives.js";
import { characterElement, ELEMENT_LABELS } from "./data/media.js";
import {
  normalizeDiscSelections,
  resolveDiscBuild,
} from "./disk-build.js";
import { resolveSharedParty } from "./party-engine.js";

export const COMPARISON_MODES = Object.freeze({
  strong: "공격 피해",
  mingpo: "명파 피해",
  anomaly: "이상 피해",
});

export const COMPARISON_STATE_VERSION = 7;

const DEFAULT_PROFILE = Object.freeze({
  characterId: "1041",
  mindscape: 0,
  weaponId: "13004",
  weaponRefinement: 1,
  weaponEffectMode: "max",
  customEngineBaseAttack: 594,
  discBuildMode: "auto",
  discScore: 30,
  discFourPieceId: "32200",
  discTwoPieceId: "31000",
  discEffectMode: "max",
  mindscapeEffectMode: "max",
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
  passiveFlatAttack: 0,
  passiveHpPercent: 0,
  passiveCritRatePercent: 0,
  passiveCritDamagePercent: 0,
  passiveDamageBonusPercent: 0,
  passivePenetrationPercent: 0,
  passiveDefenseReductionPercent: 0,
  passiveDefenseIgnorePercent: 0,
  passiveResistanceIgnorePercent: 0,
  passiveResistanceReductionPercent: 0,
  passiveReceivedDamageIncreasePercent: 0,
  passiveStunMultiplierPercent: 0,
  passiveAnomalyProficiency: 0,
  passiveAnomalyMasteryPercent: 0,
  penetrationDamageBonusPercent: 0,
  passiveFlatPenetration: 0,
  advancedOpen: false,
});

const DEFAULT_COMMON = Object.freeze({
  characterId: "1041",
  mode: "strong",
  enemyId: "30032",
  enemyDefense: 952.8,
  enemyDefenseReductionPercent: 0,
  enemyDefenseIgnorePercent: 0,
  enemyResistancePercent: 0,
  enemyResistanceAdjustmentPercent: 0,
  resistanceReductionPercent: 0,
  receivedDamageIncreasePercent: 0,
  attackPercentBuff: 0,
  flatAttackBuff: 0,
  hpPercentBuff: 0,
  flatPenetrationBuff: 0,
  partyDamageBonusPercent: 0,
  partyCriticalRatePercent: 0,
  partyCriticalDamagePercent: 0,
  partyPenetrationPercent: 0,
  partyResistanceIgnorePercent: 0,
  partyAnomalyProficiencyBuff: 0,
  partyAnomalyMasteryFlat: 0,
  partyAnomalyDamageBonusPercent: 0,
  stunned: true,
  baseStunMultiplierPercent: 150,
  additionalStunMultiplierPercent: 0,
  anomalyKey: "강타",
  skillType: "normal",
  party: Object.freeze({
    member2: Object.freeze({
      characterId: "1311",
      weaponId: "14131",
      weaponRefinement: 1,
      discFourPieceId: "32800",
    }),
    member3: Object.freeze({
      characterId: "1161",
      weaponId: "14116",
      weaponRefinement: 1,
      discFourPieceId: "33200",
    }),
  }),
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
        weaponRefinement: 1,
      },
      B: {
        ...clone(DEFAULT_PROFILE),
        label: "명함 + 대체 엔진",
        weaponId: "13004",
        weaponRefinement: 5,
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

function agentCoreStaticStats(characterId) {
  return (
    AGENT_CORE_STATIC_STATS_BY_ID[String(characterId)] ?? {}
  );
}

function agentBaseEnergyRegen(characterId) {
  return (
    1.2 +
    number(agentCoreStaticStats(characterId).energyRegenFlat)
  );
}

function refinement(value) {
  return clamp(Math.trunc(number(value, 1)), 1, 5);
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
    const signatureWeapon = [
      WEAPON_BY_ID[`14${character.id.slice(0, 3)}`],
      WEAPON_BY_ID[`13${character.id.slice(0, 3)}`],
    ].find((item) => item?.specialty === character.specialty);
    weapon =
      (requestedWeapon?.specialty === character.specialty
        ? requestedWeapon
        : undefined) ??
      signatureWeapon ??
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
  const engineEnergyRegenPercent = secondaryValue(
    weapon,
    "에너지 자동 회복",
  );

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
    engineEnergyRegenPercent,
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
    enemyDefenseIgnorePercent: number(
      common.enemyDefenseIgnorePercent,
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
    partyCriticalRatePercent: number(
      common.partyCriticalRatePercent,
      0,
    ),
    partyCriticalDamagePercent: number(
      common.partyCriticalDamagePercent,
      0,
    ),
    partyPenetrationPercent: number(
      common.partyPenetrationPercent,
      0,
    ),
    partyResistanceIgnorePercent: number(
      common.partyResistanceIgnorePercent,
      0,
    ),
    partyAnomalyProficiencyBuff: number(
      common.partyAnomalyProficiencyBuff,
      0,
    ),
    partyAnomalyMasteryFlat: number(
      common.partyAnomalyMasteryFlat,
      0,
    ),
    partyAnomalyDamageBonusPercent: number(
      common.partyAnomalyDamageBonusPercent,
      0,
    ),
    receivedDamageIncreasePercent: number(
      common.receivedDamageIncreasePercent,
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

function weaponSkillTypes(selectedSkillType) {
  const typesBySelection = {
    normal: ["normal", "basic"],
    dash: ["dash"],
    counter: ["counter", "dodge-counter"],
    ex: ["ex", "special", "ex-special"],
    chain: ["chain"],
    ultimate: ["ultimate"],
    assist: ["assist", "quick-assist"],
    aftershock: ["aftershock"],
  };
  if (selectedSkillType === "all") {
    return [...new Set(Object.values(typesBySelection).flat())];
  }
  return typesBySelection[selectedSkillType] ?? [selectedSkillType];
}

function sumAgentCombatEffects(agentEffects, character) {
  const totals = {
    attackPercent: 0,
    flatAttack: 0,
    hpPercent: 0,
    critRate: 0,
    critDamage: 0,
    damageBonus: 0,
    penetrationPercent: 0,
    flatPenetration: 0,
    defenseReduction: 0,
    defenseIgnore: 0,
    resistanceIgnore: 0,
    resistanceReduction: 0,
    anomalyProficiency: 0,
    anomalyMasteryPercent: 0,
    anomalyDamageBonus: 0,
    penetrationDamageBonus: 0,
    receivedDamageIncrease: 0,
    stunMultiplier: 0,
  };
  for (const row of [
    ...(agentEffects?.applied ?? []),
    ...(agentEffects?.selfApplied ?? []),
  ]) {
    if (
      !["self", "party", "active", "enemy"].includes(row.target)
    ) {
      continue;
    }
    if (row.stat === "anomalyMasteryFlat") {
      if (character.anomalyMastery > 0) {
        totals.anomalyMasteryPercent +=
          row.amount / character.anomalyMastery * 100;
      }
    } else if (Object.hasOwn(totals, row.stat)) {
      totals[row.stat] += number(row.amount);
    }
  }
  return totals;
}

function resolveDealerAgentEffects(
  profile,
  common,
  resolved,
  party,
  stats = {},
) {
  return resolveAgentEffects(resolved.character.id, {
    owner: resolved.character,
    dealer: resolved.character,
    team: party?.team ?? [resolved.character],
    mode: common.mode,
    skillType: common.skillType,
    stunned: Boolean(common.stunned),
    stats,
    maxActivation: true,
  });
}

function withAutomatedBuilds(profile, common, resolved, party) {
  const weaponPassive = resolveWeaponPassiveEffects(
    resolved.weapon.id,
    profile.weaponRefinement,
    {
      mode: common.mode,
      element:
        ELEMENT_LABELS[characterElement(resolved.character.id)] ?? null,
      anomalyKey: common.anomalyKey,
      skillType: weaponSkillTypes(common.skillType),
      characterId: resolved.character.id,
      maxActivation: profile.weaponEffectMode === "max",
    },
  );
  const partyWeaponEffects = resolvePartyWeaponEffects(
    resolved.weapon.id,
    profile.weaponRefinement,
    {
      wearer: resolved.character,
      dealer: resolved.character,
      maxActivation: profile.weaponEffectMode === "max",
    },
  );
  // Damage-specialty definitions already include their party-facing rows in
  // weapon-passives.js. The only current overlap is 14156; do not count its
  // party AP a second time through the support-engine catalog.
  const hasDamageWeaponPassive = Boolean(
    getWeaponPassive(resolved.weapon.id),
  );
  const supplementalPartyWeaponEffects =
    hasDamageWeaponPassive
      ? {
          ...partyWeaponEffects,
          applied: [],
          selfApplied: [],
          skipped: [],
          unsupported: [],
        }
      : partyWeaponEffects;
  const displayedWeaponPassive = {
    ...weaponPassive,
    applied: [
      ...(weaponPassive.applied ?? []),
      ...supplementalPartyWeaponEffects.applied,
      ...supplementalPartyWeaponEffects.selfApplied,
    ],
    skipped: [
      ...(weaponPassive.skipped ?? []),
      ...supplementalPartyWeaponEffects.skipped,
    ],
    unsupported: [
      ...(weaponPassive.unsupported ?? []),
      ...supplementalPartyWeaponEffects.unsupported,
    ],
  };
  const engine = weaponPassive.totals;
  const engineParty = sumAgentCombatEffects(
    supplementalPartyWeaponEffects,
    resolved.character,
  );
  const coreStatic = agentCoreStaticStats(
    resolved.character.id,
  );
  const dealerPartyAnomalyProficiency =
    weaponPassive.applied
      ?.filter((row) => row.key === "14156:party-proficiency")
      .reduce((sum, row) => sum + number(row.amount), 0) ?? 0;
  const supportPartyAnomalyProficiency =
    party?.ledger
      ?.filter(
        (row) =>
          row.active &&
          row.stackGroup ===
            "wengine:14156:party-anomaly-proficiency",
      )
      .reduce((maximum, row) => Math.max(maximum, number(row.amount)), 0) ??
    0;
  const engineAnomalyProficiency =
    engine.anomalyProficiency -
    Math.min(
      dealerPartyAnomalyProficiency,
      supportPartyAnomalyProficiency,
    );
  const engineAnomalyMasteryPercent =
    engine.anomalyMastery +
    (resolved.character.anomalyMastery > 0
      ? (engine.anomalyMasteryFlat /
          resolved.character.anomalyMastery) *
        100
      : 0);
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
  const agentPre = resolveDealerAgentEffects(
    profile,
    common,
    resolved,
    party,
    {
      initialAttack:
        (resolved.character.attack + resolved.weapon.baseAttack) *
        (1 +
          (resolved.engineAttackPercent +
            number(coreStatic.attackPercent)) /
            100),
      initialHp:
        resolved.character.hp *
        (1 +
          (resolved.engineHpPercent +
            number(coreStatic.hpPercent)) /
            100),
      combatHp:
        resolved.character.hp *
        (1 +
          (resolved.engineHpPercent +
            number(coreStatic.hpPercent)) /
            100),
      critRate:
        resolved.character.critRate +
        resolved.engineCritRatePercent +
        engine.critRate +
        engineParty.critRate +
        cinema.critRate +
        number(profile.passiveCritRatePercent),
      initialCritRate:
        resolved.character.critRate +
        resolved.engineCritRatePercent,
      penetrationRatio:
        resolved.character.penetrationRatio +
        resolved.enginePenetrationPercent,
      flatPenetration: 0,
      anomalyMastery: resolved.character.anomalyMastery,
      initialAnomalyMastery:
        resolved.character.anomalyMastery *
        (1 + resolved.engineAnomalyMasteryPercent / 100),
      energyRegen:
        agentBaseEnergyRegen(resolved.character.id) *
        (1 + resolved.engineEnergyRegenPercent / 100),
    },
  );
  const agentPreTotals = sumAgentCombatEffects(
    agentPre,
    resolved.character,
  );
  const discBuild = resolveDiscBuild({
    profile,
    character: resolved.character,
    weaponCritRatePercent:
      resolved.engineCritRatePercent + engine.critRate,
    weaponAnomalyMasteryPercent:
      resolved.engineAnomalyMasteryPercent +
      engineAnomalyMasteryPercent,
    mindscapeCritRatePercent: cinema.critRate,
    mindscapeAnomalyMasteryPercent: cinema.anomalyMastery,
    externalCritRatePercent:
      agentPreTotals.critRate +
      engineParty.critRate +
      number(common.partyCriticalRatePercent),
    externalAnomalyMasteryPercent:
      agentPreTotals.anomalyMasteryPercent +
      engineParty.anomalyMasteryPercent +
      (resolved.character.anomalyMastery > 0
        ? number(common.partyAnomalyMasteryFlat) /
          resolved.character.anomalyMastery *
          100
        : 0),
    mode: common.mode,
    skillType: common.skillType,
  });
  const set = discBuild.setTotals;
  const matchingPartyDiscRows =
    party?.ledger?.filter(
      (row) =>
        row.active &&
        row.sourceType === "disc" &&
        row.sourceId === profile.discFourPieceId,
    ) ?? [];
  const overlappingPartyDiscDamage = matchingPartyDiscRows
    .filter((row) => row.stat === "damageBonus")
    .reduce((sum, row) => sum + number(row.amount), 0);
  const overlappingPartyDiscCritDamage = matchingPartyDiscRows
    .filter((row) => row.stat === "critDamage")
    .reduce((sum, row) => sum + number(row.amount), 0);
  const uniqueSetPassiveDamageBonus =
    set.passiveDamageBonusPercent -
    Math.min(
      set.passiveDamageBonusPercent,
      overlappingPartyDiscDamage,
    );
  const uniqueSetPassiveCritDamage =
    set.passiveCritDamagePercent -
    Math.min(
      set.passiveCritDamagePercent,
      overlappingPartyDiscCritDamage,
    );
  const presetMode = discBuild.type !== "manual";
  const estimatedInitialAttack =
    (resolved.character.attack + resolved.weapon.baseAttack) *
      (1 +
        (resolved.engineAttackPercent +
          number(coreStatic.attackPercent) +
          discBuild.discAttackPercent +
          set.discAttackPercent) /
          100) +
    316;
  const estimatedInitialHp =
    resolved.character.hp *
      (1 +
        (resolved.engineHpPercent +
          number(coreStatic.hpPercent) +
          discBuild.discHpPercent +
          set.discHpPercent) /
          100) +
    2200;
  const estimatedCritRate =
    resolved.character.critRate +
    resolved.engineCritRatePercent +
    engine.critRate +
    engineParty.critRate +
    cinema.critRate +
    number(common.partyCriticalRatePercent) +
    discBuild.discCritRatePercent +
    set.discCritRatePercent +
    set.passiveCritRatePercent +
    number(profile.passiveCritRatePercent) +
    agentPreTotals.critRate;
  const estimatedInitialCritRate =
    resolved.character.critRate +
    resolved.engineCritRatePercent +
    discBuild.discCritRatePercent +
    set.discCritRatePercent;
  const estimatedAnomalyMastery =
    resolved.character.anomalyMastery *
      (1 +
        (resolved.engineAnomalyMasteryPercent +
          engineAnomalyMasteryPercent +
          engineParty.anomalyMasteryPercent +
          cinema.anomalyMastery +
          discBuild.discAnomalyMasteryPercent +
          set.discAnomalyMasteryPercent +
          set.passiveAnomalyMasteryPercent) /
          100) +
    number(common.partyAnomalyMasteryFlat);
  const estimatedInitialAnomalyMastery =
    resolved.character.anomalyMastery *
    (1 +
      (resolved.engineAnomalyMasteryPercent +
        discBuild.discAnomalyMasteryPercent +
        set.discAnomalyMasteryPercent) /
        100);
  const agentEffects = resolveDealerAgentEffects(
    profile,
    common,
    resolved,
    party,
    {
      initialAttack: estimatedInitialAttack,
      initialHp: estimatedInitialHp,
      combatHp:
        estimatedInitialHp *
        (1 +
          (number(common.hpPercentBuff) +
            number(profile.passiveHpPercent) +
            cinema.hpPercent +
            engine.hpPercent +
            engineParty.hpPercent) /
            100),
      critRate: estimatedCritRate,
      initialCritRate: estimatedInitialCritRate,
      critDamage:
        resolved.character.critDamage +
        resolved.engineCritDamagePercent +
        discBuild.discCritDamagePercent +
        set.discCritDamagePercent +
        set.passiveCritDamagePercent,
      penetrationRatio:
        resolved.character.penetrationRatio +
        resolved.enginePenetrationPercent +
        set.passivePenetrationPercent,
      flatPenetration:
        number(profile.passiveFlatPenetration) +
        number(common.flatPenetrationBuff) +
        engine.flatPenetration +
        engineParty.flatPenetration,
      anomalyMastery: estimatedAnomalyMastery,
      initialAnomalyMastery: estimatedInitialAnomalyMastery,
      energyRegen:
        agentBaseEnergyRegen(resolved.character.id) *
        (1 +
          (resolved.engineEnergyRegenPercent +
            set.discEnergyRegenPercent) /
            100),
    },
  );
  const agent = sumAgentCombatEffects(
    agentEffects,
    resolved.character,
  );

  return {
    weaponPassive: displayedWeaponPassive,
    partyWeaponEffects: supplementalPartyWeaponEffects,
    mindscape,
    agentEffects,
    discBuild,
    effectiveProfile: {
      ...profile,
      discAttackPercent:
        discBuild.discAttackPercent +
        set.discAttackPercent +
        number(coreStatic.attackPercent),
      flatAttackRolls: presetMode ? 0 : number(profile.flatAttackRolls, 0),
      discHpPercent:
        discBuild.discHpPercent +
        set.discHpPercent +
        number(coreStatic.hpPercent),
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
      discEnergyRegenPercent: set.discEnergyRegenPercent,
      damageBonusPercent: discBuild.damageBonusPercent,
      anomalyDamageBonusPercent:
        number(profile.anomalyDamageBonusPercent, 0) +
        set.anomalyDamageBonusPercent +
        cinema.anomalyDamageBonus +
        engine.anomalyDamageBonus +
        engineParty.anomalyDamageBonus +
        agent.anomalyDamageBonus,
      passiveAttackPercent:
        number(profile.passiveAttackPercent, 0) +
        set.passiveAttackPercent +
        cinema.attackPercent +
        engine.attackPercent +
        engineParty.attackPercent +
        agent.attackPercent,
      passiveFlatAttack:
        number(profile.passiveFlatAttack, 0) +
        engineParty.flatAttack +
        agent.flatAttack,
      passiveHpPercent:
        number(profile.passiveHpPercent, 0) +
        cinema.hpPercent +
        engine.hpPercent +
        engineParty.hpPercent +
        agent.hpPercent,
      passiveCritRatePercent:
        number(profile.passiveCritRatePercent, 0) +
        set.passiveCritRatePercent +
        cinema.critRate +
        engine.critRate +
        engineParty.critRate +
        agent.critRate,
      passiveCritDamagePercent:
        number(profile.passiveCritDamagePercent, 0) +
        uniqueSetPassiveCritDamage +
        cinema.critDamage +
        engine.critDamage +
        engineParty.critDamage +
        agent.critDamage,
      passiveDamageBonusPercent:
        number(profile.passiveDamageBonusPercent, 0) +
        uniqueSetPassiveDamageBonus +
        cinema.damageBonus +
        engine.damageBonus +
        engineParty.damageBonus +
        agent.damageBonus,
      passivePenetrationPercent:
        number(profile.passivePenetrationPercent, 0) +
        set.passivePenetrationPercent +
        cinema.penetrationPercent +
        engine.penetrationPercent +
        engineParty.penetrationPercent +
        agent.penetrationPercent,
      passiveDefenseReductionPercent:
        number(profile.passiveDefenseReductionPercent, 0) +
        cinema.defenseReduction +
        engine.defenseReduction +
        engineParty.defenseReduction +
        agent.defenseReduction,
      passiveDefenseIgnorePercent:
        number(profile.passiveDefenseIgnorePercent, 0) +
        cinema.defenseIgnore +
        engine.defenseIgnore +
        engineParty.defenseIgnore +
        agent.defenseIgnore,
      passiveResistanceIgnorePercent:
        number(profile.passiveResistanceIgnorePercent, 0) +
        cinema.resistanceIgnore +
        engine.resistanceIgnore +
        engineParty.resistanceIgnore +
        agent.resistanceIgnore,
      passiveResistanceReductionPercent:
        number(profile.passiveResistanceReductionPercent, 0) +
        cinema.resistanceReduction +
        engine.resistanceReduction +
        engineParty.resistanceReduction +
        agent.resistanceReduction,
      passiveAnomalyProficiency:
        number(profile.passiveAnomalyProficiency, 0) +
        set.passiveAnomalyProficiency +
        cinema.anomalyProficiency +
        engineAnomalyProficiency +
        engineParty.anomalyProficiency +
        agent.anomalyProficiency,
      passiveAnomalyMasteryPercent:
        number(profile.passiveAnomalyMasteryPercent, 0) +
        set.passiveAnomalyMasteryPercent +
        cinema.anomalyMastery +
        engineAnomalyMasteryPercent +
        engineParty.anomalyMasteryPercent +
        agent.anomalyMasteryPercent,
      penetrationDamageBonusPercent:
        number(profile.penetrationDamageBonusPercent, 0) +
        set.penetrationDamageBonusPercent +
        cinema.penetrationDamageBonus +
        engine.penetrationDamageBonus +
        engineParty.penetrationDamageBonus +
        agent.penetrationDamageBonus,
      passiveFlatPenetration:
        number(profile.passiveFlatPenetration, 0) +
        engine.flatPenetration +
        engineParty.flatPenetration +
        agent.flatPenetration,
      passiveReceivedDamageIncreasePercent:
        number(profile.passiveReceivedDamageIncreasePercent, 0) +
        engineParty.receivedDamageIncrease +
        agent.receivedDamageIncrease,
      passiveStunMultiplierPercent:
        number(profile.passiveStunMultiplierPercent, 0) +
        engineParty.stunMultiplier +
        agent.stunMultiplier,
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
    flatAttackBuff:
      shared.flatAttackBuff + number(profile.passiveFlatAttack, 0),
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
        number(profile.passiveCritRatePercent, 0) +
        shared.partyCriticalRatePercent,
      0,
      100,
    ),
    enemyDefense: shared.enemyDefense,
    enemyDefenseIncreasePercent: 0,
    enemyDefenseReductionPercent:
      shared.enemyDefenseReductionPercent +
      number(profile.passiveDefenseReductionPercent, 0),
    enemyDefenseIgnorePercent:
      shared.enemyDefenseIgnorePercent +
      number(profile.passiveDefenseIgnorePercent, 0),
    penetrationPercent:
      character.penetrationRatio +
      resolved.enginePenetrationPercent +
      number(profile.passivePenetrationPercent, 0) +
      shared.partyPenetrationPercent,
    penetrationValue: 0,
    resistanceReductionPercent:
      shared.resistanceReductionPercent +
      number(profile.passiveResistanceReductionPercent, 0),
    resistanceIgnorePercent:
      number(profile.passiveResistanceIgnorePercent, 0) +
      shared.partyResistanceIgnorePercent,
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
      shared.additionalStunMultiplierPercent +
      number(profile.passiveStunMultiplierPercent, 0),
    receivedDamageIncreasePercent:
      shared.receivedDamageIncreasePercent +
      number(profile.passiveReceivedDamageIncreasePercent, 0),
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
    flatAttackBuff:
      shared.flatAttackBuff + number(profile.passiveFlatAttack, 0),
    characterBaseHp: character.hp,
    engineHpPercent: resolved.engineHpPercent,
    discHpPercent: number(profile.discHpPercent, 0),
    flatHpRolls: number(profile.flatHpRolls, 0),
    hpPercentBuff:
      shared.hpPercentBuff + number(profile.passiveHpPercent, 0),
    flatPenetrationBuff:
      shared.flatPenetrationBuff +
      number(profile.passiveFlatPenetration, 0),
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
        number(profile.passiveCritRatePercent, 0) +
        shared.partyCriticalRatePercent,
      0,
      100,
    ),
    resistanceReductionPercent:
      shared.resistanceReductionPercent +
      number(profile.passiveResistanceReductionPercent, 0),
    resistanceIgnorePercent:
      number(profile.passiveResistanceIgnorePercent, 0) +
      shared.partyResistanceIgnorePercent,
    enemyResistancePercent: shared.enemyResistancePercent,
    baseStunMultiplierPercent: shared.baseStunMultiplierPercent,
    additionalStunMultiplierPercent:
      shared.additionalStunMultiplierPercent +
      number(profile.passiveStunMultiplierPercent, 0),
    receivedDamageIncreasePercent:
      shared.receivedDamageIncreasePercent +
      number(profile.passiveReceivedDamageIncreasePercent, 0),
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
    flatAttackBuff:
      shared.flatAttackBuff + number(profile.passiveFlatAttack, 0),
    enemyDefense: shared.enemyDefense,
    enemyDefenseIncreasePercent: 0,
    enemyDefenseReductionPercent:
      shared.enemyDefenseReductionPercent +
      number(profile.passiveDefenseReductionPercent, 0),
    enemyDefenseIgnorePercent:
      shared.enemyDefenseIgnorePercent +
      number(profile.passiveDefenseIgnorePercent, 0),
    penetrationPercent:
      character.penetrationRatio +
      resolved.enginePenetrationPercent +
      number(profile.passivePenetrationPercent, 0) +
      shared.partyPenetrationPercent,
    penetrationValue: 0,
    resistanceReductionPercent:
      shared.resistanceReductionPercent +
      number(profile.passiveResistanceReductionPercent, 0),
    resistanceIgnorePercent:
      number(profile.passiveResistanceIgnorePercent, 0) +
      shared.partyResistanceIgnorePercent,
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
    ) + shared.partyAnomalyDamageBonusPercent,
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
    partyAnomalyProficiencyBuff:
      shared.partyAnomalyProficiencyBuff,
    assaultAnomalyProficiencyBuff: 0,
    stunned: Boolean(common.stunned),
    baseStunMultiplierPercent: shared.baseStunMultiplierPercent,
    additionalStunMultiplierPercent:
      shared.additionalStunMultiplierPercent +
      number(profile.passiveStunMultiplierPercent, 0),
    attackerLevel: 60,
    receivedDamageIncreasePercent:
      shared.receivedDamageIncreasePercent +
      number(profile.passiveReceivedDamageIncreasePercent, 0),
    receivedDamageReductionPercent: 0,
    baseAnomalyMastery: character.anomalyMastery,
    anomalyMasteryPercent:
      resolved.engineAnomalyMasteryPercent +
      number(profile.discAnomalyMasteryPercent, 0) +
      number(profile.passiveAnomalyMasteryPercent, 0) +
      (character.anomalyMastery > 0
        ? shared.partyAnomalyMasteryFlat /
          character.anomalyMastery *
          100
        : 0),
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

export function calculateInvestmentProfile(
  profile,
  common,
  { party = null, enemy = null } = {},
) {
  const mode = COMPARISON_MODES[common.mode] ? common.mode : "strong";
  const normalizedProfile = {
    ...profile,
    weaponRefinement: refinement(profile.weaponRefinement),
    weaponEffectMode: profile.weaponEffectMode === "off" ? "off" : "max",
    mindscapeEffectMode:
      profile.mindscapeEffectMode === "off" ? "off" : "max",
  };
  const resolved = resolveProfile(normalizedProfile);
  normalizeDiscSelections(
    normalizedProfile,
    resolved.character,
    mode,
  );
  const {
    discBuild,
    mindscape,
    agentEffects,
    weaponPassive,
    effectiveProfile,
  } = withAutomatedBuilds(
    normalizedProfile,
    common,
    resolved,
    party,
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
    agentEffects,
    weaponPassive,
    party,
    enemy,
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
  const savedCommon = state?.common ?? {};
  const common = {
    ...DEFAULT_COMMON,
    ...savedCommon,
    party: {
      member2: {
        ...DEFAULT_COMMON.party.member2,
        ...(savedCommon.party?.member2 ?? {}),
      },
      member3: {
        ...DEFAULT_COMMON.party.member3,
        ...(savedCommon.party?.member3 ?? {}),
      },
    },
  };
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
  const dealer = CHARACTER_BY_ID[sharedCharacterId];
  const party = resolveSharedParty(common, dealer, {
    mode: common.mode,
    skillType: common.skillType,
    stunned: Boolean(common.stunned),
  });
  const enemy = resolveEnemy(
    common.enemyId,
    characterElement(dealer.id),
  );
  const partyTotals = party.totals;
  const resolvedCommon = {
    ...common,
    enemyDefense: enemy.enemyDefense,
    enemyResistancePercent:
      enemy.enemyResistancePercent +
      number(common.enemyResistanceAdjustmentPercent),
    baseStunMultiplierPercent: enemy.baseStunMultiplierPercent,
    enemyDefenseReductionPercent:
      number(common.enemyDefenseReductionPercent) +
      partyTotals.defenseReduction,
    enemyDefenseIgnorePercent:
      number(common.enemyDefenseIgnorePercent) +
      partyTotals.defenseIgnore,
    resistanceReductionPercent:
      number(common.resistanceReductionPercent) +
      partyTotals.resistanceReduction,
    receivedDamageIncreasePercent:
      number(common.receivedDamageIncreasePercent) +
      partyTotals.receivedDamageIncrease,
    attackPercentBuff:
      number(common.attackPercentBuff) +
      partyTotals.attackPercent,
    flatAttackBuff:
      number(common.flatAttackBuff) +
      partyTotals.flatAttack,
    hpPercentBuff:
      number(common.hpPercentBuff) +
      partyTotals.hpPercent,
    flatPenetrationBuff:
      number(common.flatPenetrationBuff) +
      partyTotals.flatPenetration,
    partyDamageBonusPercent:
      number(common.partyDamageBonusPercent) +
      partyTotals.damageBonus,
    partyCriticalRatePercent:
      number(common.partyCriticalRatePercent) +
      partyTotals.critRate,
    partyCriticalDamagePercent:
      number(common.partyCriticalDamagePercent) +
      partyTotals.critDamage,
    partyPenetrationPercent:
      number(common.partyPenetrationPercent) +
      partyTotals.penetrationPercent,
    partyResistanceIgnorePercent:
      number(common.partyResistanceIgnorePercent) +
      partyTotals.resistanceIgnore,
    partyAnomalyProficiencyBuff:
      number(common.partyAnomalyProficiencyBuff) +
      partyTotals.anomalyProficiency,
    partyAnomalyMasteryFlat:
      number(common.partyAnomalyMasteryFlat) +
      partyTotals.anomalyMasteryFlat,
    partyAnomalyDamageBonusPercent:
      number(common.partyAnomalyDamageBonusPercent) +
      partyTotals.anomalyDamageBonus,
    additionalStunMultiplierPercent:
      number(common.additionalStunMultiplierPercent) +
      partyTotals.stunMultiplier,
  };
  const context = { party, enemy };
  const A = calculateInvestmentProfile(
    profileA,
    resolvedCommon,
    context,
  );
  const B = calculateInvestmentProfile(
    profileB,
    resolvedCommon,
    context,
  );
  const deltaRaw = B.rawDamage - A.rawDamage;
  const deltaPercent =
    A.rawDamage === 0 ? null : (deltaRaw / A.rawDamage) * 100;
  const winner =
    Math.abs(deltaRaw) < 1e-9 ? "tie" : deltaRaw > 0 ? "B" : "A";

  return {
    mode: common.mode,
    common: resolvedCommon,
    party,
    enemy,
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
  const savedVersion = number(saved?.version, 0);
  const preDiscPresetState = saved && savedVersion < 3;
  const preAutomaticPassiveState = saved && savedVersion < 4;
  const preMaximumDiscEffectState = saved && savedVersion < 6;
  const preMaximumPartyConditionState = savedVersion < 7;
  const mergeProfile = (id) => ({
    ...defaults.profiles[id],
    ...(saved?.profiles?.[id] ?? {}),
    ...(preDiscPresetState && saved?.profiles?.[id]
      ? { discBuildMode: "manual" }
      : {}),
    ...(preAutomaticPassiveState && saved?.profiles?.[id]
      ? {
          mindscapeEffectMode: "max",
          weaponEffectMode: "max",
          weaponRefinement: id === "B" ? 5 : 1,
        }
      : {}),
    ...(preMaximumDiscEffectState && saved?.profiles?.[id]
      ? { discEffectMode: "max" }
      : {}),
  });
  return {
    version: COMPARISON_STATE_VERSION,
    common: {
      ...defaults.common,
      ...(saved?.common ?? {}),
      enemyResistanceAdjustmentPercent:
        savedVersion >= 5
          ? number(
              saved?.common?.enemyResistanceAdjustmentPercent,
              defaults.common.enemyResistanceAdjustmentPercent,
            )
          : defaults.common.enemyResistanceAdjustmentPercent,
      stunned:
        preMaximumPartyConditionState ||
        saved?.common?.stunned === undefined
        ? defaults.common.stunned
        : Boolean(saved?.common?.stunned),
      party: {
        member2: {
          ...defaults.common.party.member2,
          ...(saved?.common?.party?.member2 ?? {}),
        },
        member3: {
          ...defaults.common.party.member3,
          ...(saved?.common?.party?.member3 ?? {}),
        },
      },
    },
    profiles: {
      A: mergeProfile("A"),
      B: mergeProfile("B"),
    },
  };
}
