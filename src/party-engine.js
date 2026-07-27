import {
  CHARACTER_BY_ID,
  WEAPON_BY_ID,
  compatibleWeapons,
} from "./data/catalog.js";
import {
  AGENT_CORE_STATIC_STATS_BY_ID,
  AGENT_BUFF_CUTS_BY_ID,
  resolveAgentEffects,
} from "./data/agent-effects.js";
import { DISC_SET_BY_ID } from "./data/discs.js";
import {
  characterElement,
  ELEMENT_LABELS,
} from "./data/media.js";
import { resolvePartyWeaponEffects } from "./data/party-weapon-effects.js";
import { resolveWeaponPassiveEffects } from "./data/weapon-passives.js";

const ATTACK_FLAT_FROM_DISCS = 316;
const HP_FLAT_FROM_DISCS = 2200;
const ATTACK_PERCENT_PER_ROLL = 3;
const HP_PERCENT_PER_ROLL = 3;
const CRIT_RATE_PER_ROLL = 2.4;
const EPSILON = 1e-9;

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampRefinement = (value) =>
  Math.min(5, Math.max(1, Math.trunc(number(value, 1))));

function weaponSkillTypes(selectedSkillType) {
  const values = {
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
    return [...new Set(Object.values(values).flat())];
  }
  return values[selectedSkillType] ?? [selectedSkillType];
}

const TWO_PIECE_STATS = Object.freeze({
  "31000": Object.freeze({ critRatePercent: 8 }),
  "31100": Object.freeze({ penetrationRatio: 8 }),
  "31200": Object.freeze({ impactPercent: 6 }),
  "31300": Object.freeze({ anomalyProficiency: 30 }),
  "31400": Object.freeze({ attackPercent: 10 }),
  "31600": Object.freeze({ energyRegenPercent: 20 }),
  "31800": Object.freeze({ anomalyProficiency: 30 }),
  "31900": Object.freeze({}),
  "32800": Object.freeze({ attackPercent: 10 }),
  "33000": Object.freeze({ anomalyMasteryPercent: 8 }),
  "33100": Object.freeze({ hpPercent: 10 }),
  "33200": Object.freeze({}),
  "33400": Object.freeze({ energyRegenPercent: 20 }),
  "33700": Object.freeze({ hpPercent: 10 }),
});

const SUPPORT_TEMPLATES = Object.freeze({
  "1131": Object.freeze({
    twoPieceId: "32800",
    mains: Object.freeze({ attackPercent: 1 }),
  }),
  "1151": Object.freeze({
    twoPieceId: "32800",
    mains: Object.freeze({ attackPercent: 1, energyRegenPercent: 1 }),
  }),
  "1161": Object.freeze({
    twoPieceId: "31200",
    mains: Object.freeze({ impactPercent: 1, critRatePercent: 1 }),
    selfImpactPercent: 20,
  }),
  "1211": Object.freeze({
    twoPieceId: "31100",
    mains: Object.freeze({ penetrationRatio: 1, energyRegenPercent: 1 }),
  }),
  "1251": Object.freeze({
    twoPieceId: "31000",
    mains: Object.freeze({ critRatePercent: 1, impactPercent: 1 }),
  }),
  "1311": Object.freeze({
    twoPieceId: "32800",
    mains: Object.freeze({ attackPercent: 2, energyRegenPercent: 1 }),
  }),
  "1341": Object.freeze({
    twoPieceId: "33100",
    mains: Object.freeze({ hpPercent: 2 }),
  }),
  "1391": Object.freeze({
    twoPieceId: "32800",
    mains: Object.freeze({ attackPercent: 2, impactPercent: 1 }),
  }),
  "1411": Object.freeze({
    twoPieceId: "32800",
    mains: Object.freeze({
      attackPercent: 2,
      anomalyMasteryPercent: 1,
    }),
  }),
  "1421": Object.freeze({
    twoPieceId: "32800",
    mains: Object.freeze({ attackPercent: 2 }),
  }),
  "1491": Object.freeze({
    twoPieceId: "32800",
    mains: Object.freeze({ attackPercent: 2, energyRegenPercent: 1 }),
  }),
  "1521": Object.freeze({
    twoPieceId: "31600",
    mains: Object.freeze({ energyRegenPercent: 1 }),
  }),
  "1561": Object.freeze({
    twoPieceId: "31600",
    mains: Object.freeze({
      energyRegenPercent: 1,
      anomalyMasteryPercent: 1,
    }),
  }),
});

function defaultTemplate(character, fourPieceId) {
  const specialty = character?.specialty;
  let twoPieceId =
    specialty === "지원"
      ? "31600"
      : specialty === "격파"
        ? "31000"
        : specialty === "방어" || specialty === "명파"
          ? "33100"
          : specialty === "이상"
            ? "31300"
            : "32800";
  if (twoPieceId === fourPieceId) {
    twoPieceId = specialty === "지원" ? "32800" : "31600";
  }
  return {
    twoPieceId,
    mains:
      specialty === "지원"
        ? { energyRegenPercent: 1 }
        : specialty === "격파"
          ? { impactPercent: 1 }
          : specialty === "방어" || specialty === "명파"
            ? { hpPercent: 1 }
            : specialty === "이상"
              ? { anomalyMasteryPercent: 1 }
              : { attackPercent: 1 },
  };
}

function resolveTemplate(
  character,
  fourPieceId,
  weapon,
  refinement,
) {
  let preferred =
    SUPPORT_TEMPLATES[character.id] ??
    defaultTemplate(character, fourPieceId);
  if (character.id === "1411") {
    preferred = {
      ...preferred,
      twoPieceId:
        weapon?.id === "14141" && refinement >= 3
          ? "32800"
          : "33000",
    };
  }
  if (preferred.twoPieceId !== fourPieceId) return preferred;
  const equivalent = {
    "31300": "31800",
    "31400": "32800",
    "31600": "33400",
    "31800": "31300",
    "32800": "31400",
    "33000": "32800",
    "33100": "33700",
    "33400": "31600",
    "33700": "33100",
  }[preferred.twoPieceId];
  if (equivalent && equivalent !== fourPieceId) {
    return { ...preferred, twoPieceId: equivalent };
  }
  const fallback = defaultTemplate(character, fourPieceId);
  return {
    ...preferred,
    twoPieceId: fallback.twoPieceId,
  };
}

function liveCompatibleWeapon(character, weaponId) {
  const requested = WEAPON_BY_ID[String(weaponId)];
  if (
    requested?.specialty === character.specialty &&
    requested.version.includes("3.0 live")
  ) {
    return requested;
  }
  const signature = [
    WEAPON_BY_ID[`14${character.id.slice(0, 3)}`],
    WEAPON_BY_ID[`13${character.id.slice(0, 3)}`],
  ].find((weapon) => weapon?.specialty === character.specialty);
  return (
    signature ??
    compatibleWeapons(character.specialty).find((weapon) =>
      weapon.version.includes("3.0 live"),
    ) ??
    null
  );
}

function weaponSecondary(weapon, name) {
  return weapon?.secondaryStat === name
    ? number(weapon.secondaryValue)
    : 0;
}

function addStats(target, source) {
  for (const [key, value] of Object.entries(source ?? {})) {
    target[key] = number(target[key]) + number(value);
  }
}

function mainStatTotals(mains) {
  return {
    attackPercent: number(mains.attackPercent) * 30,
    hpPercent: number(mains.hpPercent) * 30,
    critRatePercent: number(mains.critRatePercent) * 24,
    penetrationRatio: number(mains.penetrationRatio) * 24,
    impactPercent: number(mains.impactPercent) * 18,
    anomalyMasteryPercent:
      number(mains.anomalyMasteryPercent) * 30,
    energyRegenPercent:
      number(mains.energyRegenPercent) * 60,
  };
}

function calculateSupportStats({
  character,
  weapon,
  fourPieceId,
  twoPieceId,
  mains,
  selfEngineRows,
  attackRolls = 0,
  hpRolls = 0,
  critRateRolls = 0,
  selfImpactPercent = 0,
  externalCritRatePercent = 0,
}) {
  const staticStats = {
    attackPercent: weaponSecondary(weapon, "공격력"),
    hpPercent: weaponSecondary(weapon, "HP"),
    critRatePercent: weaponSecondary(weapon, "치명타 확률"),
    penetrationRatio: weaponSecondary(weapon, "관통률"),
    impactPercent: weaponSecondary(weapon, "충격력"),
    anomalyMasteryPercent: weaponSecondary(weapon, "이상 장악력"),
    anomalyMasteryFlat: weaponSecondary(weapon, "이상 마스터리"),
    energyRegenPercent: weaponSecondary(weapon, "에너지 자동 회복"),
  };
  const coreStatic =
    AGENT_CORE_STATIC_STATS_BY_ID[character.id] ?? {};
  addStats(staticStats, {
    attackPercent: coreStatic.attackPercent,
    hpPercent: coreStatic.hpPercent,
  });
  addStats(staticStats, TWO_PIECE_STATS[fourPieceId]);
  addStats(staticStats, TWO_PIECE_STATS[twoPieceId]);
  addStats(staticStats, mainStatTotals(mains));
  staticStats.impactPercent += selfImpactPercent;

  for (const row of selfEngineRows ?? []) {
    // Initial ATK/HP cuts use the status-screen value. Conditional combat
    // ATK/HP from W-Engine passives therefore does not lower those cuts.
    if (row.stat === "impactPercent") {
      staticStats.impactPercent += row.amount;
    } else if (row.stat === "impactFlat") {
      staticStats.impactFlat =
        number(staticStats.impactFlat) + row.amount;
    } else if (row.stat === "anomalyMasteryFlat") {
      staticStats.anomalyMasteryFlat += row.amount;
    } else if (row.stat === "anomalyProficiency") {
      staticStats.anomalyProficiency =
        number(staticStats.anomalyProficiency) + row.amount;
    }
  }

  const baseAttack = character.attack + (weapon?.baseAttack ?? 0);
  const energyRegenBase =
    1.2 + number(coreStatic.energyRegenFlat);
  const attackPercent =
    staticStats.attackPercent + attackRolls * ATTACK_PERCENT_PER_ROLL;
  const hpPercent =
    staticStats.hpPercent + hpRolls * HP_PERCENT_PER_ROLL;
  const critRate =
    character.critRate +
    staticStats.critRatePercent +
    number(externalCritRatePercent) +
    critRateRolls * CRIT_RATE_PER_ROLL;
  const initialCritRate =
    character.critRate +
    staticStats.critRatePercent +
    critRateRolls * CRIT_RATE_PER_ROLL;
  const initialAnomalyMastery =
    character.anomalyMastery *
    (1 + staticStats.anomalyMasteryPercent / 100);
  return {
    baseAttack,
    initialAttack:
      baseAttack * (1 + attackPercent / 100) +
      ATTACK_FLAT_FROM_DISCS,
    initialHp:
      character.hp * (1 + hpPercent / 100) +
      HP_FLAT_FROM_DISCS,
    critRate,
    initialCritRate,
    penetrationRatio:
      character.penetrationRatio + staticStats.penetrationRatio,
    flatPenetration: number(staticStats.flatPenetration),
    impact:
      character.impact * (1 + staticStats.impactPercent / 100) +
      number(staticStats.impactFlat),
    anomalyMastery:
      initialAnomalyMastery +
      staticStats.anomalyMasteryFlat,
    initialAnomalyMastery,
    anomalyProficiency:
      character.anomalyProficiency +
      number(staticStats.anomalyProficiency),
    energyRegen:
      energyRegenBase *
      (1 + staticStats.energyRegenPercent / 100),
    energyRegenBase,
    attackPercent,
    hpPercent,
    staticStats,
  };
}

function minimumRolls(threshold, before, perRoll, maxRolls = 30) {
  if (before + EPSILON >= threshold) return 0;
  if (perRoll <= 0) return null;
  const rolls = Math.max(
    0,
    Math.ceil((threshold - before - EPSILON) / perRoll),
  );
  return rolls <= maxRolls ? rolls : null;
}

function supportDiscEffects(build) {
  const setId = build.fourPieceId;
  const specialty = build.character.specialty;
  const rows = [];
  const append = (
    key,
    label,
    stat,
    amount,
    active = true,
    condition = "",
  ) => {
    rows.push({
      key: `disc:${setId}:${key}`,
      sourceId: setId,
      sourceType: "disc",
      sourceName: DISC_SET_BY_ID[setId]?.name ?? setId,
      target: "party",
      stat,
      amount: active ? amount : 0,
      active,
      stackGroup: `disc:${setId}:${key}`,
      label,
      condition,
    });
  };
  if (setId === "31600") {
    append("party-damage", "스윙 재즈 · 파티 피해", "damageBonus", 15);
  } else if (setId === "31900") {
    append("party-damage", "원시 펑크 · 파티 피해", "damageBonus", 15);
  } else if (setId === "32800") {
    append("party-damage", "고요 속의 별 3스택 · 출전 캐릭터 피해", "damageBonus", 24);
  } else if (setId === "33200") {
    const stunWearer = specialty === "격파";
    append(
      "party-crit-damage",
      "산림의 왕 · 파티 치명타 피해",
      "critDamage",
      15,
      stunWearer,
      "격파 캐릭터가 강화 특수·콤보 스킬 사용",
    );
    append(
      "party-crit-damage-threshold",
      "산림의 왕 · 치확 50% 추가 치명타 피해",
      "critDamage",
      15,
      stunWearer && build.stats.critRate >= 50 - EPSILON,
      "착용자 치명타 확률 50% 이상",
    );
  } else if (setId === "33400") {
    append(
      "party-damage",
      "달빛 기사의 칭송 · 파티 피해",
      "damageBonus",
      18,
      specialty === "지원",
      "지원 캐릭터가 강화 특수·궁극기 사용",
    );
  } else if (setId === "33700") {
    append(
      "party-damage",
      "이상한 나라의 눈토끼 3스택 · 파티 피해",
      "damageBonus",
      18,
      specialty === "방어",
      "방어 캐릭터의 강화 특수·방어·회피 지원",
    );
  } else if (setId === "31300") {
    rows.push({
      key: "disc:31300:anomaly-buildup-resistance",
      sourceId: "31300",
      sourceType: "disc",
      sourceName: DISC_SET_BY_ID[setId]?.name ?? setId,
      target: "unsupported",
      stat: "unsupported",
      amount: 0,
      active: false,
      stackGroup: "disc:31300:anomaly-buildup-resistance",
      label: "자유의 블루스 · 속성 이상 축적 저항 감소",
      condition: "속성 이상 축적 속도는 단일 피해 스칼라가 아님",
      unsupportedReason:
        "속성 이상 축적 저항은 대표 1회 피해식에 합산하지 않습니다.",
    });
  }
  return rows;
}

export function resolveSupportBuild(
  member,
  {
    dealer = null,
    team = [],
    mode = "strong",
    skillType = "normal",
    stunned = false,
    incomingCritRatePercent = 0,
    resolvedPartyCritRatePercent = null,
  } = {},
) {
  const character = CHARACTER_BY_ID[String(member?.characterId)] ?? null;
  if (!character || !character.version.includes("3.0 live")) return null;
  const weapon = liveCompatibleWeapon(character, member?.weaponId);
  if (!weapon) return null;
  const fourPieceId = DISC_SET_BY_ID[String(member?.discFourPieceId)]
    ? String(member.discFourPieceId)
    : character.specialty === "지원"
      ? "33400"
      : character.specialty === "격파"
        ? "33200"
        : character.specialty === "방어"
          ? "33700"
          : "31900";
  const refinement = clampRefinement(member?.weaponRefinement);
  const template = resolveTemplate(
    character,
    fourPieceId,
    weapon,
    refinement,
  );
  const engineEffects = resolvePartyWeaponEffects(
    weapon.id,
    refinement,
    {
      wearer: character,
      dealer,
      maxActivation: true,
    },
  );
  const selfWeaponPassive = resolveWeaponPassiveEffects(
    weapon.id,
    refinement,
    {
      mode,
      element:
        ELEMENT_LABELS[characterElement(character.id)] ?? null,
      skillType: weaponSkillTypes(skillType),
      characterId: character.id,
      maxActivation: true,
    },
  );
  const ownEnginePartyCritRate = engineEffects.applied
    .filter(
      (row) =>
        row.stat === "critRate" &&
        (row.target === "party" || row.target === "active"),
    )
    .reduce((sum, row) => sum + number(row.amount), 0);
  const hasResolvedPartyCritRate =
    resolvedPartyCritRatePercent !== null &&
    Number.isFinite(Number(resolvedPartyCritRatePercent));
  const baseArgs = {
    character,
    weapon,
    fourPieceId,
    twoPieceId: template.twoPieceId,
    mains: template.mains,
    selfEngineRows: engineEffects.selfApplied,
    selfImpactPercent: number(template.selfImpactPercent),
    externalCritRatePercent:
      number(selfWeaponPassive.totals.critRate) +
      (hasResolvedPartyCritRate
        ? number(resolvedPartyCritRatePercent)
        : ownEnginePartyCritRate +
          number(incomingCritRatePercent)),
  };
  const preAgentStats = calculateSupportStats(baseArgs);
  const preAgentEffects = resolveAgentEffects(character.id, {
    owner: character,
    dealer,
    team,
    mode,
    skillType,
    stunned,
    stats: preAgentStats,
    maxActivation: true,
  });
  baseArgs.externalCritRatePercent += preAgentEffects.applied
    .filter(
      (row) =>
        row.stat === "critRate" &&
        (row.target === "self" ||
          (!hasResolvedPartyCritRate &&
            (row.target === "party" ||
              row.target === "active"))),
    )
    .reduce((sum, row) => sum + number(row.amount), 0);
  let attackRolls = 0;
  let hpRolls = 0;
  let critRateRolls = 0;
  let stats = calculateSupportStats(baseArgs);
  const requestedCuts = [
    ...(AGENT_BUFF_CUTS_BY_ID[character.id] ?? []),
    ...(fourPieceId === "33200" &&
    character.specialty === "격파"
      ? [
          {
            stat: "critRate",
            threshold: 50,
            label: "산림의 왕 추가 치명타 피해",
          },
        ]
      : []),
  ];
  const cuts = [];

  for (const cut of requestedCuts) {
    const beforeRolls = number(stats[cut.stat]);
    let rolls = 0;
    let attainable = true;
    if (cut.stat === "initialAttack") {
      const perRoll =
        stats.baseAttack * ATTACK_PERCENT_PER_ROLL / 100;
      const totalNeeded = minimumRolls(
        cut.threshold,
        beforeRolls,
        perRoll,
        Math.max(0, 30 - attackRolls),
      );
      if (totalNeeded === null) {
        attainable = false;
        rolls = Math.max(0, 30 - attackRolls);
        attackRolls += rolls;
      } else {
        rolls = totalNeeded;
        attackRolls += rolls;
      }
    } else if (cut.stat === "initialHp") {
      const perRoll =
        character.hp * HP_PERCENT_PER_ROLL / 100;
      const totalNeeded = minimumRolls(
        cut.threshold,
        beforeRolls,
        perRoll,
        Math.max(0, 30 - hpRolls),
      );
      if (totalNeeded === null) {
        attainable = false;
        rolls = Math.max(0, 30 - hpRolls);
        hpRolls += rolls;
      } else {
        rolls = totalNeeded;
        hpRolls += rolls;
      }
    } else if (cut.stat === "critRate") {
      const totalNeeded = minimumRolls(
        cut.threshold,
        beforeRolls,
        CRIT_RATE_PER_ROLL,
        Math.max(0, 30 - critRateRolls),
      );
      if (totalNeeded === null) {
        attainable = false;
        rolls = Math.max(0, 30 - critRateRolls);
        critRateRolls += rolls;
      } else {
        rolls = totalNeeded;
        critRateRolls += rolls;
      }
    } else {
      attainable = beforeRolls + EPSILON >= cut.threshold;
    }
    stats = calculateSupportStats({
      ...baseArgs,
      attackRolls,
      hpRolls,
      critRateRolls,
    });
    const actual = number(stats[cut.stat]);
    cuts.push({
      ...cut,
      beforeRolls,
      actual,
      rolls,
      reached: actual + EPSILON >= cut.threshold,
      attainable,
    });
  }

  const discEffects = supportDiscEffects({
    character,
    weapon,
    fourPieceId,
    twoPieceId: template.twoPieceId,
    stats,
  });
  const agentEffects = resolveAgentEffects(character.id, {
    owner: character,
    dealer,
    team,
    mode,
    skillType,
    stunned,
    stats,
    maxActivation: true,
  });
  return {
    slot: member?.slot ?? null,
    character,
    weapon,
    refinement,
    fourPieceId,
    twoPieceId: template.twoPieceId,
    mains: { ...template.mains },
    rolls: {
      attackPercent: attackRolls,
      hpPercent: hpRolls,
      critRatePercent: critRateRolls,
      total: attackRolls + hpRolls + critRateRolls,
    },
    stats,
    cuts,
    engineEffects,
    selfWeaponPassive,
    agentEffects,
    discEffects,
  };
}

function normalizedPartyMember(raw, slot, dealer, seen) {
  const character = CHARACTER_BY_ID[String(raw?.characterId)] ?? null;
  if (!character || !character.version.includes("3.0 live")) {
    return { slot, skippedReason: "unknown-character" };
  }
  if (character.id === dealer?.id || seen.has(character.id)) {
    return { slot, character, skippedReason: "duplicate-character" };
  }
  seen.add(character.id);
  return {
    slot,
    character,
    state: {
      ...raw,
      slot,
      characterId: character.id,
    },
  };
}

function effectLedgerRow(row, owner, sourceType, sourceId, sourceName) {
  return {
    key: row.key,
    ownerId: owner?.id ?? null,
    ownerName: owner?.name ?? "",
    sourceType,
    sourceId,
    sourceName,
    target: row.target,
    stat: row.stat,
    amount: number(row.amount),
    label: row.label,
    condition: row.condition ?? "",
    stackGroup: row.stackGroup ?? null,
    active: Boolean(row.active),
    skippedReason: row.skippedReason ?? null,
    unsupportedReason: row.unsupportedReason ?? null,
    sourceUrl: row.sourceUrl ?? "",
  };
}

function dedupeLedger(rows) {
  const ungrouped = [];
  const grouped = new Map();
  for (const row of rows) {
    if (!row.active || !row.stackGroup) {
      ungrouped.push(row);
      continue;
    }
    const current = grouped.get(row.stackGroup);
    if (
      !current ||
      row.amount > current.amount + EPSILON ||
      (Math.abs(row.amount - current.amount) <= EPSILON &&
        `${row.sourceId}:${row.ownerId}` <
          `${current.sourceId}:${current.ownerId}`)
    ) {
      if (current) {
        ungrouped.push({
          ...current,
          active: false,
          skippedReason: "non-stacking-duplicate",
        });
      }
      grouped.set(row.stackGroup, row);
    } else {
      ungrouped.push({
        ...row,
        active: false,
        skippedReason: "non-stacking-duplicate",
      });
    }
  }
  return [...ungrouped, ...grouped.values()];
}

function sumPartyTotals(ledger) {
  const totals = {
    attackPercent: 0,
    flatAttack: 0,
    hpPercent: 0,
    flatPenetration: 0,
    critRate: 0,
    critDamage: 0,
    damageBonus: 0,
    penetrationPercent: 0,
    defenseReduction: 0,
    defenseIgnore: 0,
    resistanceReduction: 0,
    resistanceIgnore: 0,
    receivedDamageIncrease: 0,
    anomalyProficiency: 0,
    anomalyMasteryFlat: 0,
    anomalyDamageBonus: 0,
    stunMultiplier: 0,
  };
  for (const row of ledger) {
    if (!row.active || row.target === "unsupported") continue;
    if (Object.hasOwn(totals, row.stat)) {
      totals[row.stat] += number(row.amount);
    }
  }
  return totals;
}

export function resolveSharedParty(
  common,
  dealer,
  {
    mode = common?.mode ?? "strong",
    skillType = common?.skillType ?? "normal",
    stunned = Boolean(common?.stunned),
  } = {},
) {
  const seen = new Set();
  if (dealer?.id) seen.add(dealer.id);
  const rawMembers = [
    common?.party?.member2 ?? {},
    common?.party?.member3 ?? {},
  ];
  const normalized = rawMembers.map((raw, index) =>
    normalizedPartyMember(raw, index + 2, dealer, seen),
  );
  const team = [
    dealer,
    ...normalized
      .filter((entry) => !entry.skippedReason)
      .map((entry) => entry.character),
  ].filter(Boolean);
  let members = normalized.map((entry) => {
    if (entry.skippedReason) return entry;
    const build = resolveSupportBuild(entry.state, {
      dealer,
      team,
      mode,
      skillType,
      stunned,
    });
    return build
      ? { ...entry, build }
      : { ...entry, skippedReason: "invalid-build" };
  });
  const rows = [];

  const dealerEffects = resolveAgentEffects(dealer?.id, {
    owner: dealer,
    dealer,
    team,
    mode,
    skillType,
    stunned,
    stats: {
      initialAttack: dealer?.attack ?? 0,
      initialHp: dealer?.hp ?? 0,
      critRate: dealer?.critRate ?? 0,
      initialCritRate: dealer?.critRate ?? 0,
      penetrationRatio: dealer?.penetrationRatio ?? 0,
      flatPenetration: 0,
      impact: dealer?.impact ?? 0,
      anomalyMastery: dealer?.anomalyMastery ?? 0,
      initialAnomalyMastery: dealer?.anomalyMastery ?? 0,
    },
    maxActivation: true,
  });

  // A wearer-side threshold such as King of the Summit's 50% crit check can
  // be satisfied by another party member. Resolve those incoming crit buffs
  // once, then rebuild each support preset with the shared party value.
  const preliminaryCritRows = [];
  for (const row of dealerEffects.applied) {
    if (
      row.stat === "critRate" &&
      (row.target === "party" || row.target === "active")
    ) {
      preliminaryCritRows.push(
        effectLedgerRow(
          row,
          dealer,
          "agent",
          dealer.id,
          dealer.name,
        ),
      );
    }
  }
  for (const member of members) {
    const build = member.build;
    if (!build) continue;
    for (const row of build.agentEffects.applied) {
      if (
        row.stat === "critRate" &&
        (row.target === "party" || row.target === "active")
      ) {
        preliminaryCritRows.push(
          effectLedgerRow(
            row,
            build.character,
            "agent",
            build.character.id,
            build.character.name,
          ),
        );
      }
    }
    for (const row of build.engineEffects.applied) {
      if (
        row.stat === "critRate" &&
        (row.target === "party" || row.target === "active")
      ) {
        preliminaryCritRows.push(
          effectLedgerRow(
            row,
            build.character,
            "weapon",
            build.weapon.id,
            build.weapon.name,
          ),
        );
      }
    }
  }
  const resolvedPartyCritRatePercent =
    dedupeLedger(preliminaryCritRows)
      .filter((row) => row.active)
      .reduce((sum, row) => sum + number(row.amount), 0) +
    number(common?.partyCriticalRatePercent);
  members = members.map((entry) => {
    if (!entry.build) return entry;
    const build = resolveSupportBuild(entry.state, {
      dealer,
      team,
      mode,
      skillType,
      stunned,
      resolvedPartyCritRatePercent,
    });
    return build
      ? { ...entry, build }
      : { ...entry, build: null, skippedReason: "invalid-build" };
  });
  for (const member of members) {
    const build = member.build;
    if (!build) continue;
    for (const row of build.agentEffects.applied) {
      if (row.target === "party" || row.target === "active" || row.target === "enemy") {
        rows.push(
          effectLedgerRow(
            row,
            build.character,
            "agent",
            build.character.id,
            build.character.name,
          ),
        );
      }
    }
    for (const row of build.agentEffects.skipped) {
      if (
        row.target === "party" ||
        row.target === "active" ||
        row.target === "enemy"
      ) {
        rows.push(
          effectLedgerRow(
            row,
            build.character,
            "agent",
            build.character.id,
            build.character.name,
          ),
        );
      }
    }
    for (const row of build.engineEffects.applied) {
      rows.push(
        effectLedgerRow(
          row,
          build.character,
          "weapon",
          build.weapon.id,
          build.weapon.name,
        ),
      );
    }
    for (const row of build.engineEffects.skipped) {
      if (row.unsupportedReason) continue;
      rows.push(
        effectLedgerRow(
          row,
          build.character,
          "weapon",
          build.weapon.id,
          build.weapon.name,
        ),
      );
    }
    for (const row of build.engineEffects.unsupported) {
      rows.push(
        effectLedgerRow(
          row,
          build.character,
          "weapon",
          build.weapon.id,
          build.weapon.name,
        ),
      );
    }
    for (const row of build.discEffects) {
      rows.push(
        effectLedgerRow(
          row,
          build.character,
          "disc",
          build.fourPieceId,
          DISC_SET_BY_ID[build.fourPieceId]?.name ?? build.fourPieceId,
        ),
      );
    }
    for (const row of build.agentEffects.unsupported) {
      rows.push(
        effectLedgerRow(
          row,
          build.character,
          "agent",
          build.character.id,
          build.character.name,
        ),
      );
    }
  }
  const ledger = dedupeLedger(rows);
  return {
    dealer,
    team,
    members,
    ledger,
    active: ledger.filter((row) => row.active),
    skipped: ledger.filter(
      (row) => !row.active && !row.unsupportedReason,
    ),
    unsupported: ledger.filter((row) => row.unsupportedReason),
    totals: sumPartyTotals(ledger),
  };
}
