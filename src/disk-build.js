import { DISC_SET_BY_ID, DISC_SETS } from "./data/discs.js";
import { characterElement } from "./data/media.js";

export const DISC_ROLL_VALUES = Object.freeze({
  attackPercent: 3,
  critRatePercent: 2.4,
  critDamagePercent: 4.8,
  anomalyProficiency: 9,
});

export const DISC_PRESET_SCORES = Object.freeze({
  anomaly: Object.freeze([20, 25, 30]),
  attack: Object.freeze([30, 35, 40]),
});

const SKILL_TAG_BY_TYPE = Object.freeze({
  normal: "basic",
  dash: "dash",
  counter: "dodgeCounter",
  ex: "exSpecial",
  chain: "chain",
  ultimate: "ultimate",
  assist: "assist",
  aftershock: "aftershock",
  all: "all",
});

export const MODELED_DISC_EFFECT_STATS = Object.freeze([
  "attackPercent",
  "hpPercent",
  "critRatePercent",
  "critDamagePercent",
  "penetrationRatioPercent",
  "anomalyProficiency",
  "anomalyMasteryPercent",
  "damageBonusPercent",
  "anomalyDamageBonusPercent",
  "penetrationDamageBonusPercent",
]);
const MODELED_DISC_EFFECT_STAT_SET = new Set(MODELED_DISC_EFFECT_STATS);

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const add = (target, key, value) => {
  target[key] = number(target[key]) + number(value);
};

export function discPresetType(profile, mode) {
  if (profile?.discBuildMode === "manual") return "manual";
  if (profile?.discBuildMode === "attack") return "attack";
  if (profile?.discBuildMode === "anomaly") return "anomaly";
  return mode === "anomaly" ? "anomaly" : "attack";
}

export function recommendedDiscSets(character, mode) {
  const element = characterElement(character?.id);
  if (mode === "mingpo") {
    return { fourPieceId: "33100", twoPieceId: "31000" };
  }
  if (mode === "anomaly") {
    const anomalyFourPiece = {
      physical: "32600",
      fire: "31800",
      electric: "31800",
      ice: "33800",
      wind: "33900",
      ether: "33000",
    };
    return {
      fourPieceId: anomalyFourPiece[element] ?? "31300",
      twoPieceId:
        anomalyFourPiece[element] === "31300" ? "31800" : "31300",
    };
  }
  const attackFourPiece = {
    physical: "32600",
    fire: "32200",
    electric: "32400",
    ice: "32500",
    ether: "32300",
    wind: "31000",
  };
  return {
    fourPieceId: attackFourPiece[element] ?? "31000",
    twoPieceId:
      attackFourPiece[element] === "31000" ? "31400" : "31000",
  };
}

export function normalizeDiscSelections(profile, character, mode) {
  const recommended = recommendedDiscSets(character, mode);
  if (!DISC_SET_BY_ID[profile.discFourPieceId]) {
    profile.discFourPieceId = recommended.fourPieceId;
  }
  if (
    !DISC_SET_BY_ID[profile.discTwoPieceId] ||
    profile.discTwoPieceId === profile.discFourPieceId
  ) {
    profile.discTwoPieceId =
      recommended.twoPieceId === profile.discFourPieceId
        ? DISC_SETS.find((set) => set.id !== profile.discFourPieceId)?.id
        : recommended.twoPieceId;
  }
}

function scopeMatches(scope, { element, skillType }) {
  if (!scope) return true;
  if (
    scope.attributesAny &&
    !scope.attributesAny.includes(element)
  ) {
    return false;
  }
  if (scope.skillTagsAny) {
    const currentTag = SKILL_TAG_BY_TYPE[skillType] ?? skillType;
    if (
      currentTag !== "all" &&
      !scope.skillTagsAny.includes(currentTag)
    ) {
      return false;
    }
  }
  return true;
}

function conditionSatisfied(condition, context) {
  if (!condition || typeof condition === "string") return false;
  if (condition.type === "attribute") {
    return condition.attributesAny?.includes(context.element) ?? false;
  }
  if (condition.type === "statThreshold") {
    return number(context[condition.stat]) >= number(condition.gte);
  }
  if (condition.type === "all") {
    return condition.requirements.every((requirement) =>
      typeof requirement === "string"
        ? context.effectMode === "max"
        : conditionSatisfied(requirement, context),
    );
  }
  return false;
}

function selectedDiscEffects(profile, context) {
  const fourPiece = DISC_SET_BY_ID[profile.discFourPieceId];
  const twoPiece = DISC_SET_BY_ID[profile.discTwoPieceId];
  const entries = [];
  const append = (set, pieceCount, effects) => {
    if (!set) return;
    for (const entry of effects) {
      entries.push({ set, pieceCount, entry });
    }
  };

  append(fourPiece, 2, fourPiece?.twoPiece ?? []);
  append(fourPiece, 4, fourPiece?.fourPiece ?? []);
  if (twoPiece?.id !== fourPiece?.id) {
    append(twoPiece, 2, twoPiece?.twoPiece ?? []);
  }

  return entries.map(({ set, pieceCount, entry }) => {
    const inScope = scopeMatches(entry.scope, context);
    const automatic =
      entry.always ||
      conditionSatisfied(entry.condition, {
        ...context,
        effectMode: "off",
      });
    const conditionMet =
      typeof entry.condition === "string"
        ? context.effectMode === "max"
        : conditionSatisfied(entry.condition, context);
    const active = inScope && (entry.always || conditionMet);
    const multiplier = active
      ? entry.stacks
        ? entry.stacks.max
        : 1
      : 0;
    return {
      key: `${set.id}:${pieceCount}:${entry.id}`,
      setId: set.id,
      setName: set.name,
      pieceCount,
      label: entry.label,
      condition: entry.condition,
      scope: entry.scope,
      inScope,
      automatic,
      active,
      multiplier,
      effects: entry.effects,
      modeledStats: Object.keys(entry.effects).filter((stat) =>
        MODELED_DISC_EFFECT_STAT_SET.has(stat),
      ),
      unsupportedStats: Object.keys(entry.effects).filter(
        (stat) => !MODELED_DISC_EFFECT_STAT_SET.has(stat),
      ),
    };
  });
}

function aggregateSetEffects(resolvedEffects) {
  const totals = {
    discAttackPercent: 0,
    discHpPercent: 0,
    discCritRatePercent: 0,
    discCritDamagePercent: 0,
    discAnomalyProficiency: 0,
    discAnomalyMasteryPercent: 0,
    passiveAttackPercent: 0,
    passiveCritRatePercent: 0,
    passiveCritDamagePercent: 0,
    passiveDamageBonusPercent: 0,
    passivePenetrationPercent: 0,
    passiveAnomalyProficiency: 0,
    passiveAnomalyMasteryPercent: 0,
    anomalyDamageBonusPercent: 0,
    penetrationDamageBonusPercent: 0,
  };

  for (const resolved of resolvedEffects) {
    if (!resolved.active) continue;
    for (const [stat, rawValue] of Object.entries(resolved.effects)) {
      const value = number(rawValue) * resolved.multiplier;
      const twoPiece = resolved.pieceCount === 2;
      if (stat === "attackPercent") {
        add(
          totals,
          twoPiece ? "discAttackPercent" : "passiveAttackPercent",
          value,
        );
      } else if (stat === "hpPercent") {
        add(totals, "discHpPercent", value);
      } else if (stat === "critRatePercent") {
        add(
          totals,
          twoPiece ? "discCritRatePercent" : "passiveCritRatePercent",
          value,
        );
      } else if (stat === "critDamagePercent") {
        add(
          totals,
          twoPiece ? "discCritDamagePercent" : "passiveCritDamagePercent",
          value,
        );
      } else if (stat === "penetrationRatioPercent") {
        add(totals, "passivePenetrationPercent", value);
      } else if (stat === "anomalyProficiency") {
        add(
          totals,
          twoPiece
            ? "discAnomalyProficiency"
            : "passiveAnomalyProficiency",
          value,
        );
      } else if (stat === "anomalyMasteryPercent") {
        add(
          totals,
          twoPiece
            ? "discAnomalyMasteryPercent"
            : "passiveAnomalyMasteryPercent",
          value,
        );
      } else if (stat === "damageBonusPercent") {
        add(totals, "passiveDamageBonusPercent", value);
      } else if (stat === "anomalyDamageBonusPercent") {
        add(totals, "anomalyDamageBonusPercent", value);
      } else if (stat === "penetrationDamageBonusPercent") {
        add(totals, "penetrationDamageBonusPercent", value);
      }
    }
  }
  return totals;
}

function anomalyPreset(score) {
  const anomalyRolls = Math.ceil(score / 2);
  const attackRolls = Math.floor(score / 2);
  return {
    type: "anomaly",
    score,
    rolls: {
      anomalyProficiency: anomalyRolls,
      attackPercent: attackRolls,
      critRatePercent: 0,
      critDamagePercent: 0,
    },
    discAttackPercent:
      attackRolls * DISC_ROLL_VALUES.attackPercent,
    discHpPercent: 0,
    discCritRatePercent: 0,
    discCritDamagePercent: 0,
    discAnomalyProficiency:
      92 + anomalyRolls * DISC_ROLL_VALUES.anomalyProficiency,
    discAnomalyMasteryPercent: 30,
    damageBonusPercent: 30,
    critCapReached: false,
    critOverflowPercent: 0,
  };
}

function attackPreset(score, nonSubstatCritRate) {
  const critRollCapacity = 30;
  const neededCritRolls = Math.max(
    0,
    Math.ceil((100 - nonSubstatCritRate - 1e-9) /
      DISC_ROLL_VALUES.critRatePercent),
  );
  const critRateRolls = Math.min(score, critRollCapacity, neededCritRolls);
  const remaining = score - critRateRolls;
  const critDamageRolls = Math.ceil(remaining / 2);
  const attackRolls = Math.floor(remaining / 2);
  const discCritRatePercent =
    24 + critRateRolls * DISC_ROLL_VALUES.critRatePercent;
  const totalCritRate = nonSubstatCritRate +
    critRateRolls * DISC_ROLL_VALUES.critRatePercent;

  return {
    type: "attack",
    score,
    rolls: {
      anomalyProficiency: 0,
      attackPercent: attackRolls,
      critRatePercent: critRateRolls,
      critDamagePercent: critDamageRolls,
    },
    discAttackPercent:
      30 + attackRolls * DISC_ROLL_VALUES.attackPercent,
    discHpPercent: 0,
    discCritRatePercent,
    discCritDamagePercent:
      critDamageRolls * DISC_ROLL_VALUES.critDamagePercent,
    discAnomalyProficiency: 0,
    discAnomalyMasteryPercent: 0,
    damageBonusPercent: 30,
    critCapReached: totalCritRate >= 100 - 1e-9,
    critOverflowPercent: Math.max(0, totalCritRate - 100),
  };
}

export function resolveDiscBuild({
  profile,
  character,
  weaponCritRatePercent = 0,
  weaponAnomalyMasteryPercent = 0,
  mindscapeCritRatePercent = 0,
  mindscapeAnomalyMasteryPercent = 0,
  mode = "strong",
  skillType = "normal",
}) {
  const type = discPresetType(profile, mode);
  if (type === "manual") {
    const manualAnomalyMasteryPercent =
      number(profile.discAnomalyMasteryPercent) +
      weaponAnomalyMasteryPercent +
      mindscapeAnomalyMasteryPercent +
      number(profile.passiveAnomalyMasteryPercent);
    const manualContext = {
      element: characterElement(character.id),
      skillType,
      effectMode: profile.discEffectMode,
      anomalyMastery:
        character.anomalyMastery *
        (1 + manualAnomalyMasteryPercent / 100),
      critRate:
        character.critRate +
        weaponCritRatePercent +
        mindscapeCritRatePercent +
        number(profile.discCritRatePercent) +
        number(profile.passiveCritRatePercent),
    };
    let effects = selectedDiscEffects(profile, manualContext);
    let setTotals = aggregateSetEffects(effects);
    effects = selectedDiscEffects(profile, {
      ...manualContext,
      anomalyMastery:
        character.anomalyMastery *
        (1 +
          (manualAnomalyMasteryPercent +
            setTotals.discAnomalyMasteryPercent +
            setTotals.passiveAnomalyMasteryPercent) /
            100),
      critRate:
        manualContext.critRate +
        setTotals.discCritRatePercent +
        setTotals.passiveCritRatePercent,
    });
    setTotals = aggregateSetEffects(effects);
    return {
      type,
      score: null,
      rolls: null,
      discAttackPercent: number(profile.discAttackPercent),
      discHpPercent: number(profile.discHpPercent),
      discCritRatePercent: number(profile.discCritRatePercent),
      discCritDamagePercent: number(profile.discCritDamagePercent),
      discAnomalyProficiency: number(profile.discAnomalyProficiency),
      discAnomalyMasteryPercent: number(
        profile.discAnomalyMasteryPercent,
      ),
      damageBonusPercent: number(profile.damageBonusPercent),
      setTotals,
      effects,
    };
  }

  const allowedScores = DISC_PRESET_SCORES[type];
  const requestedScore = number(profile.discScore, allowedScores[0]);
  const score = allowedScores.includes(requestedScore)
    ? requestedScore
    : allowedScores[0];
  const basePreset = type === "anomaly"
    ? anomalyPreset(score)
    : {
        discAnomalyMasteryPercent: 0,
        discCritRatePercent: 24,
      };
  const element = characterElement(character.id);
  const presetAnomalyMasteryPercent =
    basePreset.discAnomalyMasteryPercent +
    weaponAnomalyMasteryPercent +
    mindscapeAnomalyMasteryPercent +
    number(profile.passiveAnomalyMasteryPercent);
  const context = {
    element,
    skillType,
    effectMode: profile.discEffectMode === "max" ? "max" : "off",
    anomalyMastery:
      character.anomalyMastery *
      (1 + presetAnomalyMasteryPercent / 100),
    critRate:
      character.critRate +
      weaponCritRatePercent +
      basePreset.discCritRatePercent +
      mindscapeCritRatePercent,
  };
  let effects = selectedDiscEffects(profile, context);
  let setTotals = aggregateSetEffects(effects);
  effects = selectedDiscEffects(profile, {
    ...context,
    anomalyMastery:
      character.anomalyMastery *
      (1 +
        (presetAnomalyMasteryPercent +
          setTotals.discAnomalyMasteryPercent +
          setTotals.passiveAnomalyMasteryPercent) /
          100),
    critRate:
      context.critRate +
      setTotals.discCritRatePercent +
      setTotals.passiveCritRatePercent,
  });
  setTotals = aggregateSetEffects(effects);
  const nonSubstatCritRate =
    character.critRate +
    weaponCritRatePercent +
    24 +
    mindscapeCritRatePercent +
    number(profile.passiveCritRatePercent) +
    setTotals.discCritRatePercent +
    setTotals.passiveCritRatePercent;
  const preset = type === "anomaly"
    ? basePreset
    : attackPreset(score, nonSubstatCritRate);

  return {
    ...preset,
    nonSubstatCritRate,
    setTotals,
    effects,
  };
}
