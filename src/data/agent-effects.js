import { CHARACTER_BY_ID } from "./catalog.js";
import { characterElement } from "./media.js";

export const AGENT_EFFECTS_VERSION = "3.0";
export const AGENT_EFFECTS_VERIFIED_AT = "2026-07-28";
export const AGENT_EFFECTS_SOURCE_BASE =
  "https://static.nanoka.cc/zzz/3.0/ko/character";

// Level 60 core-skill enhancement stats that are not represented by the
// common character stat snapshot in catalog.js.
export const AGENT_CORE_STATIC_STATS_BY_ID = Object.freeze({
  "1031": Object.freeze({ energyRegenFlat: 0.36 }),
  "1121": Object.freeze({ energyRegenFlat: 0.36 }),
  "1131": Object.freeze({ energyRegenFlat: 0.36 }),
  "1151": Object.freeze({ energyRegenFlat: 0.36 }),
  "1171": Object.freeze({ energyRegenFlat: 0.36 }),
  "1271": Object.freeze({ energyRegenFlat: 0.36 }),
  "1281": Object.freeze({ energyRegenFlat: 0.36 }),
  "1301": Object.freeze({ energyRegenFlat: 0.36 }),
  "1311": Object.freeze({ energyRegenFlat: 0.36 }),
  "1341": Object.freeze({ hpPercent: 18 }),
  "1421": Object.freeze({ energyRegenFlat: 0.36 }),
  "1441": Object.freeze({ hpPercent: 18 }),
  "1451": Object.freeze({ energyRegenFlat: 0.36 }),
  "1491": Object.freeze({ attackPercent: 21 }),
  "1521": Object.freeze({ energyRegenFlat: 0.36 }),
});

export const AGENT_CAMPS_BY_ID = Object.freeze({
  "1011": 1, "1021": 1, "1031": 1, "1041": 5, "1051": 11,
  "1061": 2, "1071": 4, "1081": 1, "1091": 6, "1101": 3,
  "1111": 3, "1121": 3, "1131": 6, "1141": 2, "1151": 4,
  "1161": 4, "1171": 4, "1181": 3, "1191": 2, "1201": 6,
  "1211": 2, "1221": 6, "1241": 7, "1251": 7, "1261": 7,
  "1271": 7, "1281": 4, "1291": 9, "1301": 5, "1311": 8,
  "1321": 8, "1331": 9, "1341": 12, "1351": 4, "1361": 5,
  "1371": 10, "1381": 5, "1391": 10, "1401": 11, "1411": 11,
  "1421": 10, "1431": 10, "1441": 11, "1451": 11, "1461": 5,
  "1471": 12, "1481": 12, "1491": 13, "1501": 13, "1511": 13,
  "1521": 7, "1531": 1, "1541": 12, "1551": 15, "1561": 16,
  "1571": 16,
});

const effect = (
  key,
  label,
  origin,
  target,
  stat,
  amount,
  options = {},
) =>
  Object.freeze({
    key,
    label,
    origin,
    target,
    stat,
    amount,
    formula: options.formula ?? null,
    skillTypes: Object.freeze([...(options.skillTypes ?? [])]),
    dealerElementsAny: Object.freeze([
      ...(options.dealerElementsAny ?? []),
    ]),
    dealerSpecialtiesAny: Object.freeze([
      ...(options.dealerSpecialtiesAny ?? []),
    ]),
    eligibility: options.eligibility ?? null,
    requiresStunned: Boolean(options.requiresStunned),
    mode: options.mode ?? null,
    stackGroup: options.stackGroup ?? null,
    condition: options.condition ?? "",
    statRequirement: options.statRequirement ?? null,
    unsupportedReason: options.unsupportedReason ?? null,
  });

const core = (key, label, target, stat, amount, options = {}) =>
  effect(key, label, "core", target, stat, amount, options);
const additional = (key, label, target, stat, amount, options = {}) =>
  effect(key, label, "additional", target, stat, amount, options);
const skill = (key, label, target, stat, amount, options = {}) =>
  effect(key, label, "skill", target, stat, amount, options);
const unsupported = (key, label, origin, reason, options = {}) =>
  effect(key, label, origin, "unsupported", "unsupported", 0, {
    ...options,
    unsupportedReason: reason,
  });

const anyOf = (...requirements) =>
  Object.freeze({ any: Object.freeze(requirements) });
const sameElement = Object.freeze({ type: "sameElement" });
const sameCamp = Object.freeze({ type: "sameCamp" });
const specialties = (...items) =>
  Object.freeze({ type: "specialtiesAny", values: Object.freeze(items) });

function defineAgent(id, rows) {
  return Object.freeze({
    id,
    sourceUrl: `${AGENT_EFFECTS_SOURCE_BASE}/${id}.json`,
    effects: Object.freeze(
      rows.map((row) =>
        Object.freeze({ ...row, key: `${id}:${row.key}`, characterId: id }),
      ),
    ),
  });
}

const agents = [
  defineAgent("1021", [
    core("ex-followup", "강화 특수 스킬 후 다음 공격 피해", "self", "damageBonus", 70, {
      skillTypes: ["ex"],
      condition: "강화 특수 스킬 후 2스택 최대",
    }),
  ]),
  defineAgent("1031", [
    core("defense-down", "에너지장 방어력 감소", "enemy", "defenseReduction", 40),
    additional("ether-damage", "에테르 피해", "party", "damageBonus", 25, {
      dealerElementsAny: ["ether"],
      eligibility: anyOf(sameElement, sameCamp),
    }),
  ]),
  defineAgent("1041", [
    core("fire-damage", "불 속성 피해", "self", "damageBonus", 10, {
      dealerElementsAny: ["fire"],
    }),
    core("stunned-fire-damage", "그로기 대상 불 속성 피해", "self", "damageBonus", 22.5, {
      dealerElementsAny: ["fire"],
      requiresStunned: true,
    }),
    additional("fire-suppression", "화염 진압 일반·대시 공격 피해", "self", "damageBonus", 70, {
      skillTypes: ["normal", "dash"],
    }),
  ]),
  defineAgent("1051", [
    core("hp-penetration", "HP 비례 관입력", "self", "flatPenetration", 0, {
      mode: "mingpo",
      formula: { type: "scale", stat: "combatHp", scale: 0.1 },
    }),
    core("low-hp-damage", "HP 50% 미만 피해", "self", "damageBonus", 100, {
      mode: "mingpo",
    }),
    additional("crit-damage", "치명타 피해", "self", "critDamage", 30, {
      mode: "mingpo",
    }),
  ]),
  defineAgent("1061", [
    core("channel-damage", "연속 베기 피해", "self", "damageBonus", 37.5),
    additional("stunned-damage", "그로기 대상 피해", "self", "damageBonus", 35, {
      requiresStunned: true,
    }),
  ]),
  defineAgent("1071", [
    core("shield-attack", "영광의 방패 · 출전 캐릭터 공격력", "active", "flatAttack", 1000),
    additional("enemy-vulnerability", "스킬 파훼 대상 받는 피해", "enemy", "receivedDamageIncrease", 25, {
      eligibility: anyOf(
        specialties("강공", "격파", "방어", "명파"),
        sameCamp,
      ),
    }),
  ]),
  defineAgent("1081", [
    core("crouching-damage", "웅크린 사격 피해", "self", "damageBonus", 50),
    additional("ultimate-damage", "궁극기 피해", "self", "damageBonus", 100, {
      skillTypes: ["ultimate"],
      condition: "최대 2스택",
    }),
  ]),
  defineAgent("1091", [
    core("moon-normal-damage", "서리달 일반 공격 피해", "self", "damageBonus", 60, {
      skillTypes: ["normal"],
    }),
    core("ice-res-ignore", "다음 서리달 자세 얼음 저항 무시", "self", "resistanceIgnore", 30, {
      dealerElementsAny: ["ice"],
      skillTypes: ["normal"],
    }),
    additional("anomaly-buildup-taken", "모든 속성 이상 축적 효율", "enemy", "unsupported", 20, {
      unsupportedReason: "이상 축적 속도는 단일 피해 스칼라가 아닙니다.",
    }),
  ]),
  defineAgent("1101", [
    additional("chain-damage", "콤보 스킬 피해", "self", "damageBonus", 70, {
      skillTypes: ["chain"],
      condition: "최대 2스택",
    }),
  ]),
  defineAgent("1111", [
    core("drill-damage", "드릴 공격 피해", "self", "damageBonus", 40),
  ]),
  defineAgent("1121", [
    core("shield-crit-rate", "실드 보유자 치명타 확률", "party", "critRate", 16, {
      eligibility: anyOf(sameElement, sameCamp),
      stackGroup: "agent:1121:shield-crit-rate",
    }),
  ]),
  defineAgent("1131", [
    core("banner-attack", "깃발 버프 공격력", "active", "flatAttack", 0, {
      formula: { type: "scale", stat: "initialAttack", scale: 0.4, cap: 1000 },
    }),
    additional("ice-damage", "파티 얼음 피해", "party", "damageBonus", 20, {
      dealerElementsAny: ["ice"],
      eligibility: anyOf(sameElement, sameCamp),
    }),
  ]),
  defineAgent("1141", [
    core("stun-multiplier", "그로기 약체 배율", "enemy", "stunMultiplier", 35, {
      requiresStunned: true,
    }),
    additional("ice-res-down", "얼음 저항 감소", "enemy", "resistanceReduction", 25, {
      dealerElementsAny: ["ice"],
      eligibility: anyOf(sameElement, sameCamp),
    }),
  ]),
  defineAgent("1151", [
    skill("fighting-attack", "「파이팅!」 파티 공격력", "party", "flatAttack", 0, {
      formula: {
        type: "scale",
        stat: "initialAttack",
        scale: 0.226,
        base: 88,
        cap: 600,
      },
    }),
  ]),
  defineAgent("1161", [
    core("ice-fire-res-down", "불·얼음 저항 감소", "enemy", "resistanceReduction", 15, {
      dealerElementsAny: ["fire", "ice"],
    }),
    core("ice-fire-damage", "충격력 비례 불·얼음 피해", "party", "damageBonus", 0, {
      dealerElementsAny: ["fire", "ice"],
      formula: {
        type: "steppedAbove",
        stat: "impact",
        threshold: 170,
        unit: 10,
        amount: 5,
        base: 25,
        cap: 75,
      },
    }),
  ]),
  defineAgent("1171", [
    unsupported("buildup", "불 속성 이상 축적 효율", "core", "이상 축적 속도는 단일 피해 스칼라가 아닙니다."),
  ]),
  defineAgent("1181", [
    additional("shock-damage-taken", "감전 피해 증가", "enemy", "anomalyDamageBonus", 36, {
      mode: "anomaly",
      dealerElementsAny: ["electric"],
      eligibility: anyOf(sameElement, sameCamp),
      condition: "최대 2스택",
    }),
  ]),
  defineAgent("1191", [
    core("ice-damage", "빙결 충전 얼음 피해", "self", "damageBonus", 30, {
      dealerElementsAny: ["ice"],
      condition: "최대 10스택",
    }),
    additional("specified-crit-damage", "지정 스킬 치명타 피해", "self", "critDamage", 100, {
      skillTypes: ["all"],
    }),
  ]),
  defineAgent("1201", [
    core("dash-crit-rate", "지정 대시 공격 치명타 확률", "self", "critRate", 25, {
      skillTypes: ["dash"],
    }),
    core("dash-crit-damage", "지정 대시 공격 치명타 피해", "self", "critDamage", 72, {
      skillTypes: ["dash"],
      condition: "최대 6스택",
    }),
    additional("dash-damage", "지정 대시 공격 피해", "self", "damageBonus", 40, {
      skillTypes: ["dash"],
    }),
  ]),
  defineAgent("1211", [
    core("penetration-share", "관통률 공유", "party", "penetrationPercent", 0, {
      formula: {
        type: "scale",
        stat: "penetrationRatio",
        scale: 0.25,
        base: 12,
        cap: 30,
      },
    }),
    additional("electric-damage", "파티 전기 피해", "party", "damageBonus", 10, {
      dealerElementsAny: ["electric"],
      eligibility: anyOf(sameElement, sameCamp),
    }),
  ]),
  defineAgent("1221", [
    core("electric-damage", "전기 피해", "self", "damageBonus", 20, {
      dealerElementsAny: ["electric"],
    }),
    unsupported("chaos-multiplier", "극성 혼돈 배율", "additional", "혼돈 전용 별도 결산 배율은 대표 단일 피해와 합산하지 않습니다."),
  ]),
  defineAgent("1241", [
    core("enhanced-shot-damage", "강화 산탄 피해", "self", "damageBonus", 40, {
      skillTypes: ["normal"],
    }),
    core("stunned-damage", "그로기 대상 피해", "self", "damageBonus", 40, {
      requiresStunned: true,
    }),
    additional("crit-rate", "지원 캐릭터 편성 치명타 확률", "self", "critRate", 30, {
      eligibility: specialties("지원"),
    }),
  ]),
  defineAgent("1251", [
    core("stun-multiplier", "정복 중첩 그로기 약체 배율", "enemy", "stunMultiplier", 80, {
      requiresStunned: true,
      condition: "최대 20스택",
    }),
  ]),
  defineAgent("1261", [
    core("anomaly-target-damage", "속성 이상 대상 피해", "self", "anomalyDamageBonus", 15, {
      mode: "anomaly",
    }),
    unsupported("assault-crit", "강타 전용 치명타 확률", "core", "강타 전용 치명타는 일반 치명타 확률 상한에 포함하지 않습니다."),
  ]),
  defineAgent("1271", [
    core("shield-ap", "실드 보유자 이상 마스터리", "active", "anomalyProficiency", 100),
    unsupported("buildup-res-down", "모든 속성 이상 축적 저항 감소", "additional", "이상 축적 저항은 단일 피해 스칼라가 아닙니다.", {
      eligibility: anyOf(sameElement, sameCamp),
    }),
  ]),
  defineAgent("1281", [
    additional("party-damage", "파티 피해", "party", "damageBonus", 18, {
      eligibility: anyOf(sameElement, sameCamp),
    }),
  ]),
  defineAgent("1291", [
    core("crit-rate", "암연 상태 치명타 확률", "self", "critRate", 12),
    core("crit-damage", "암연 상태 치명타 피해", "self", "critDamage", 25),
    core("breaker-attack", "격파 캐릭터 수 비례 공격력", "self", "flatAttack", 0, {
      formula: {
        type: "countSpecialty",
        specialty: "격파",
        values: [0, 300, 900],
      },
    }),
    additional("settlement-damage", "결산 공격 피해", "self", "damageBonus", 40, {
      skillTypes: ["ex", "ultimate"],
    }),
  ]),
  defineAgent("1301", [
    core("crit-rate", "에너지 순환 치명타 확률", "self", "critRate", 25),
    core("aftershock-damage", "여진 피해", "self", "damageBonus", 85, {
      skillTypes: ["aftershock"],
    }),
    core("party-attack", "에너지 자동 회복 비례 파티 공격력", "party", "flatAttack", 700),
    additional("aftershock-defense-ignore", "여진 방어력 무시", "enemy", "defenseIgnore", 25, {
      skillTypes: ["aftershock"],
      eligibility: specialties("격파", "지원"),
    }),
  ]),
  defineAgent("1311", [
    core("attack-share", "아이들릭 카덴차 공격력", "active", "flatAttack", 0, {
      formula: { type: "scale", stat: "initialAttack", scale: 0.35, cap: 1200 },
    }),
    skill("party-damage", "아이들릭 카덴차 파티 피해", "party", "damageBonus", 20),
    skill("party-crit-damage", "아이들릭 카덴차 파티 치명타 피해", "party", "critDamage", 25),
  ]),
  defineAgent("1321", [
    core("crit-rate", "뒤엉킨 금제 치명타 확률", "self", "critRate", 25),
    core("chain-ultimate-damage", "콤보·궁극기 피해", "self", "damageBonus", 30, {
      skillTypes: ["chain", "ultimate"],
    }),
    additional("high-crit-multiplier", "치명타 확률 80% 이상 스킬 배율", "self", "damageBonus", 25, {
      skillTypes: ["chain", "ultimate"],
      condition: "최종 치명타 확률 80% 이상",
      statRequirement: { stat: "critRate", minimum: 80 },
    }),
  ]),
  defineAgent("1331", [
    additional("corruption-damage", "침식·침식 혼돈 피해", "party", "anomalyDamageBonus", 12, {
      mode: "anomaly",
      dealerElementsAny: ["ether"],
      eligibility: anyOf(specialties("이상"), sameElement),
    }),
  ]),
  defineAgent("1341", [
    core("self-crit-rate", "초기 HP 비례 치명타 확률", "self", "critRate", 0, {
      formula: { type: "perUnit", stat: "initialHp", unit: 1000, amount: 1.4 },
    }),
    core("party-hp", "에테르 장막 파티 HP", "party", "hpPercent", 5),
    core("party-attack", "에테르 장막 파티 공격력", "party", "flatAttack", 1000),
    core("party-damage", "초기 HP 비례 파티 피해", "party", "damageBonus", 0, {
      formula: {
        type: "steppedAbove",
        stat: "initialHp",
        threshold: 15000,
        unit: 400,
        amount: 1,
        base: 10,
        cap: 40,
      },
    }),
  ]),
  defineAgent("1351", [
    additional("aftershock-vulnerability", "여진 받는 피해", "enemy", "receivedDamageIncrease", 30, {
      skillTypes: ["aftershock"],
      eligibility: anyOf(
        specialties("강공", "명파"),
        sameCamp,
      ),
    }),
  ]),
  defineAgent("1361", [
    core("stun-multiplier", "표식 그로기 약체 배율", "enemy", "stunMultiplier", 35, {
      requiresStunned: true,
    }),
    unsupported("crit-reference", "치명타 확률 참조 여진 그로기", "core", "치명타 확률을 올리는 효과가 아니라 그로기 수치 변환식입니다."),
  ]),
  defineAgent("1371", [
    core("hp-penetration", "HP 비례 관입력", "self", "flatPenetration", 0, {
      mode: "mingpo",
      formula: { type: "scale", stat: "combatHp", scale: 0.1 },
    }),
    core("damage", "의현 피해", "self", "damageBonus", 60, {
      mode: "mingpo",
    }),
    core("stunned-ex-damage", "그로기 대상 강화 특수 피해", "self", "damageBonus", 30, {
      mode: "mingpo",
      skillTypes: ["ex"],
      requiresStunned: true,
    }),
    additional("ultimate-crit-damage", "궁극기 치명타 피해", "self", "critDamage", 40, {
      mode: "mingpo",
      skillTypes: ["ultimate"],
    }),
  ]),
  defineAgent("1381", [
    core("crit-rate", "백뢰 치명타 확률", "self", "critRate", 10),
    core("self-damage", "백뢰 상태 피해", "self", "damageBonus", 25),
    additional("party-aftershock", "파티 여진 피해", "party", "damageBonus", 25, {
      skillTypes: ["aftershock"],
      eligibility: specialties("격파", "지원"),
    }),
    core("aftershock-crit-damage", "여진 대상 치명타 피해", "party", "critDamage", 15, {
      skillTypes: ["aftershock"],
      condition: "착용자 기본 치명타 피해 50% × 30%",
    }),
  ]),
  defineAgent("1391", [
    core("party-crit-damage", "초기 공격력 비례 파티 치명타 피해", "party", "critDamage", 0, {
      formula: {
        type: "steppedAbove",
        stat: "initialAttack",
        threshold: 2800,
        unit: 100,
        amount: 5,
        base: 20,
        cap: 50,
      },
    }),
    core("party-chain-damage", "파티 콤보 스킬 피해", "party", "damageBonus", 20, {
      skillTypes: ["chain"],
    }),
    core("party-ultimate-damage", "파티 궁극기 피해", "party", "damageBonus", 40, {
      skillTypes: ["ultimate"],
    }),
  ]),
  defineAgent("1401", [
    core("anomaly-proficiency", "이상 장악력 비례 이상 마스터리", "self", "anomalyProficiency", 0, {
      mode: "anomaly",
      formula: {
        type: "above",
        stat: "anomalyMastery",
        threshold: 140,
        scale: 1.6,
      },
    }),
  ]),
  defineAgent("1411", [
    core("party-attack", "초기 공격력 비례 파티 공격력", "party", "flatAttack", 0, {
      formula: { type: "scale", stat: "initialAttack", scale: 0.4, cap: 1200 },
    }),
    core("party-damage", "파티 피해", "party", "damageBonus", 15),
    additional("party-anomaly-damage", "이상 장악력 비례 이상·혼돈 피해", "party", "anomalyDamageBonus", 0, {
      mode: "anomaly",
      eligibility: anyOf(specialties("이상"), sameCamp),
      formula: {
        type: "above",
        stat: "anomalyMastery",
        threshold: 100,
        divisor: 1,
        scale: 0.2,
        cap: 20,
      },
    }),
    unsupported("party-buildup", "속성 이상 축적 효율", "additional", "이상 축적 효율은 단일 피해 스칼라가 아닙니다.", {
      eligibility: anyOf(specialties("이상"), sameCamp),
    }),
  ]),
  defineAgent("1421", [
    core("penetration-share", "초기 공격력 비례 관입력", "active", "flatPenetration", 0, {
      formula: { type: "scale", stat: "initialAttack", scale: 0.18, cap: 540 },
    }),
    additional("enemy-vulnerability", "받는 피해 증가", "enemy", "receivedDamageIncrease", 20, {
      eligibility: anyOf(specialties("명파"), sameCamp),
    }),
  ]),
  defineAgent("1431", [
    core("crit-rate", "합일 치명타 확률", "self", "critRate", 30),
    additional("damage", "합일 피해", "self", "damageBonus", 25),
  ]),
  defineAgent("1441", [
    core("hp-penetration", "HP 비례 관입력", "self", "flatPenetration", 0, {
      mode: "mingpo",
      formula: { type: "scale", stat: "combatHp", scale: 0.1 },
    }),
    core("crit-rate", "달궈진 칼날 치명타 확률", "self", "critRate", 10),
    core("specified-crit-damage", "지정 공격 치명타 피해", "self", "critDamage", 50, {
      skillTypes: ["all"],
    }),
    additional("fire-damage", "불 속성 피해", "self", "damageBonus", 20, {
      dealerElementsAny: ["fire"],
    }),
  ]),
  defineAgent("1451", [
    core("party-hp", "에테르 장막 파티 HP", "party", "hpPercent", 5),
    core("party-damage", "파티 피해", "party", "damageBonus", 20),
    additional("dark-break-crit-damage", "명파 캐릭터 치명타 피해", "party", "critDamage", 30, {
      dealerSpecialtiesAny: ["명파"],
      eligibility: specialties("명파", "격파"),
    }),
  ]),
  defineAgent("1461", [
    core("designated-attack", "지정 강공 캐릭터 공격력", "active", "flatAttack", 1000, {
      dealerSpecialtiesAny: ["강공"],
    }),
    core("designated-crit-damage", "지정 강공 캐릭터 치명타 피해", "active", "critDamage", 30, {
      dealerSpecialtiesAny: ["강공"],
    }),
    core("designated-damage", "지정 강공 캐릭터 피해", "active", "damageBonus", 25, {
      dealerSpecialtiesAny: ["강공"],
    }),
    additional("selected-skill-damage", "지정 스킬 피해", "party", "damageBonus", 30, {
      dealerSpecialtiesAny: ["강공"],
      skillTypes: ["all"],
      eligibility: specialties("강공"),
    }),
    additional("electric-res-ignore", "전기 저항 무시", "party", "resistanceIgnore", 25, {
      dealerElementsAny: ["electric"],
      eligibility: specialties("강공"),
    }),
  ]),
  defineAgent("1471", [
    core("hp-penetration", "HP 비례 관입력", "self", "flatPenetration", 0, {
      mode: "mingpo",
      formula: { type: "scale", stat: "combatHp", scale: 0.1, base: 300 },
    }),
    core("fire-damage", "불 속성 피해", "self", "damageBonus", 51, {
      dealerElementsAny: ["fire"],
    }),
    additional("crit-damage", "치명타 피해", "self", "critDamage", 36),
  ]),
  defineAgent("1481", [
    core("stun-multiplier", "그로기 약체 배율", "enemy", "stunMultiplier", 30, {
      requiresStunned: true,
    }),
    additional("party-damage", "강공·명파 파티 피해", "party", "damageBonus", 40, {
      dealerSpecialtiesAny: ["강공", "명파"],
      eligibility: specialties("강공", "명파"),
    }),
  ]),
  defineAgent("1491", [
    core("party-attack", "초기 공격력 비례 파티 공격력", "party", "flatAttack", 0, {
      formula: { type: "scale", stat: "initialAttack", scale: 0.3, cap: 1050 },
    }),
    skill("field-attack", "에테르 장막 추가 공격력", "party", "flatAttack", 50),
    additional("stun-multiplier", "그로기 약체 배율", "enemy", "stunMultiplier", 30, {
      requiresStunned: true,
      eligibility: anyOf(specialties("강공"), sameCamp),
    }),
  ]),
  defineAgent("1501", [
    core("anomaly-proficiency", "이상 마스터리", "self", "anomalyProficiency", 90, {
      mode: "anomaly",
    }),
  ]),
  defineAgent("1511", [
    core("anomaly-proficiency", "이상 마스터리", "self", "anomalyProficiency", 120),
    core("party-damage", "파티 피해", "party", "damageBonus", 25),
    additional("stun-multiplier", "그로기 약체 배율", "enemy", "stunMultiplier", 30, {
      requiresStunned: true,
      eligibility: anyOf(specialties("이상"), sameCamp),
    }),
    unsupported("stunned-buildup", "그로기 대상 이상 축적 효율", "additional", "이상 축적 효율은 단일 피해 스칼라가 아닙니다."),
  ]),
  defineAgent("1521", [
    core("corrode-bone-crit-rate", "「침투」 3스택 치명타 확률", "self", "critRate", 18, {
      condition: "「침투」 발동 시 치명타 확률 +6%, 최대 3스택",
    }),
    additional("party-crit-damage", "파티 치명타 피해", "party", "critDamage", 40, {
      eligibility: anyOf(specialties("격파"), sameElement),
    }),
    core("electric-defense-ignore", "에너지 자동 회복 비례 전기 방어력 무시", "enemy", "defenseIgnore", 0, {
      dealerElementsAny: ["electric"],
      condition: "기본 6%, 1.4 초과 0.12마다 +1%, 최대 25%",
      formula: {
        type: "steppedAbove",
        stat: "energyRegen",
        threshold: 1.4,
        unit: 0.12,
        amount: 1,
        base: 6,
        cap: 25,
      },
    }),
  ]),
  defineAgent("1531", [
    core("hp-penetration", "HP 비례 관입력", "self", "flatPenetration", 0, {
      mode: "mingpo",
      formula: { type: "scale", stat: "combatHp", scale: 0.1 },
    }),
    core("crit-damage", "별빛 무장 치명타 피해", "self", "critDamage", 90),
    additional("selected-damage", "지정 스킬 피해", "self", "damageBonus", 40, {
      skillTypes: ["all"],
      condition: "최대 2스택",
    }),
  ]),
  defineAgent("1541", [
    core("anomaly-proficiency", "이상 장악력 비례 이상 마스터리", "self", "anomalyProficiency", 0, {
      mode: "anomaly",
      formula: {
        type: "above",
        stat: "initialAnomalyMastery",
        threshold: 150,
        scale: 1.5,
      },
    }),
    unsupported("bloom-damage", "개화 피해·방어력 무시", "core", "개화 전용 별도 결산 효과는 대표 이상 피해에 섞지 않습니다."),
  ]),
  defineAgent("1551", [
    core("crit-damage", "치명타 피해", "self", "critDamage", 40),
    additional("branch-damage", "분기 공격 피해", "self", "damageBonus", 40, {
      skillTypes: ["all"],
    }),
  ]),
  defineAgent("1561", [
    core("energy-damage", "에너지 자동 회복 비례 피해", "self", "damageBonus", 0, {
      mode: "anomaly",
      formula: {
        type: "above",
        stat: "energyRegen",
        threshold: 1.2,
        scale: 0.21,
        divisor: 0.01,
        cap: 35,
      },
    }),
    core("energy-anomaly-mastery", "에너지 자동 회복 비례 이상 장악력", "self", "anomalyMasteryFlat", 0, {
      mode: "anomaly",
      formula: {
        type: "above",
        stat: "energyRegen",
        threshold: 1.2,
        scale: 0.5,
        divisor: 0.01,
        cap: 84,
      },
    }),
    unsupported("buildup-res-down", "바람·염색 이상 축적 저항 감소", "additional", "이상 축적 저항은 단일 피해 스칼라가 아닙니다."),
  ]),
  defineAgent("1571", [
    core("crit-reference", "초기 치명타 확률 비례 치명타 피해", "self", "critDamage", 0, {
      formula: {
        type: "above",
        stat: "initialCritRate",
        threshold: 50,
        scale: 1.7,
        cap: 85,
      },
    }),
    core("pen-attack", "관입력 비례 공격력", "self", "flatAttack", 0, {
      formula: {
        type: "scale",
        stat: "flatPenetration",
        scale: 1.25,
        cap: 1200,
      },
    }),
    core("stun-multiplier", "그로기 약체 배율", "enemy", "stunMultiplier", 30, {
      requiresStunned: true,
    }),
    additional("party-damage", "파티 피해", "party", "damageBonus", 20, {
      eligibility: anyOf(
        specialties("강공", "명파"),
        sameCamp,
      ),
    }),
  ]),
];

export const AGENT_EFFECTS_BY_ID = Object.freeze(
  Object.fromEntries(agents.map((entry) => [entry.id, entry])),
);

export const AGENT_BUFF_CUTS_BY_ID = Object.freeze({
  "1131": Object.freeze([{ stat: "initialAttack", threshold: 2500, label: "공격력 버프 상한" }]),
  "1151": Object.freeze([{ stat: "initialAttack", threshold: 2266, label: "「파이팅!」 600pt 상한" }]),
  "1161": Object.freeze([{ stat: "impact", threshold: 270, label: "불·얼음 피해 75% 상한" }]),
  "1211": Object.freeze([{ stat: "penetrationRatio", threshold: 72, label: "관통률 공유 30% 상한" }]),
  "1311": Object.freeze([{ stat: "initialAttack", threshold: 3429, label: "공격력 공유 1200pt 상한" }]),
  "1341": Object.freeze([{ stat: "initialHp", threshold: 27000, label: "파티 피해 40% 상한" }]),
  "1391": Object.freeze([{ stat: "initialAttack", threshold: 3400, label: "파티 치명타 피해 50% 상한" }]),
  "1411": Object.freeze([
    { stat: "initialAttack", threshold: 3000, label: "공격력 공유 1200pt 상한" },
    { stat: "anomalyMastery", threshold: 200, label: "이상계 버프 상한" },
  ]),
  "1421": Object.freeze([{ stat: "initialAttack", threshold: 3000, label: "관입력 공유 540pt 상한" }]),
  "1491": Object.freeze([{ stat: "initialAttack", threshold: 3500, label: "공격력 공유 1050pt 상한" }]),
  "1521": Object.freeze([{ stat: "energyRegen", threshold: 3.68, label: "전기 방어력 무시 25% 상한" }]),
  "1561": Object.freeze([{ stat: "energyRegen", threshold: 2.88, label: "피해·장악력 상한" }]),
});

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function requirementSatisfied(requirement, owner, team) {
  const others = team.filter((member) => member?.id !== owner?.id);
  if (requirement?.type === "sameElement") {
    const element = characterElement(owner?.id);
    return others.some((member) => characterElement(member.id) === element);
  }
  if (requirement?.type === "sameCamp") {
    const camp = AGENT_CAMPS_BY_ID[owner?.id];
    return camp !== undefined &&
      others.some((member) => AGENT_CAMPS_BY_ID[member.id] === camp);
  }
  if (requirement?.type === "specialtiesAny") {
    return others.some((member) =>
      requirement.values?.includes(member.specialty),
    );
  }
  return false;
}

export function agentEligibilitySatisfied(eligibility, owner, team) {
  if (!eligibility) return true;
  if (eligibility.any) {
    return eligibility.any.some((requirement) =>
      requirementSatisfied(requirement, owner, team),
    );
  }
  return requirementSatisfied(eligibility, owner, team);
}

function formulaAmount(formula, stats, team) {
  if (!formula) return 0;
  const value = number(stats?.[formula.stat]);
  let result = 0;
  if (formula.type === "scale") {
    result = value * number(formula.scale) + number(formula.base);
  } else if (formula.type === "perUnit") {
    result =
      Math.floor(value / number(formula.unit, 1)) * number(formula.amount);
  } else if (formula.type === "linearRange") {
    const start = number(formula.start);
    const end = number(formula.end, start + 1);
    const progress = Math.min(1, Math.max(0, (value - start) / (end - start)));
    result =
      number(formula.min) +
      progress * (number(formula.max) - number(formula.min));
  } else if (formula.type === "above") {
    result =
      Math.max(0, value - number(formula.threshold)) /
      number(formula.divisor, 1) *
      number(formula.scale);
  } else if (formula.type === "steppedAbove") {
    const steps = Math.floor(
      (Math.max(0, value - number(formula.threshold)) + 1e-9) /
        number(formula.unit, 1),
    );
    result =
      number(formula.base) +
      steps * number(formula.amount);
  } else if (formula.type === "countSpecialty") {
    const count = team.filter(
      (member) => member?.specialty === formula.specialty,
    ).length;
    const values = formula.values ?? [0];
    result = values[Math.min(values.length - 1, count)] ?? 0;
  }
  if (formula.cap !== undefined) result = Math.min(result, formula.cap);
  if (formula.floor !== undefined) result = Math.max(result, formula.floor);
  return result;
}

function rowInScope(row, owner, dealer, team, context) {
  if (row.mode && row.mode !== context.mode) return "scope:mode";
  if (
    row.skillTypes.length &&
    !row.skillTypes.includes("all") &&
    context.skillType !== "all" &&
    !row.skillTypes.includes(context.skillType)
  ) {
    return "scope:skill";
  }
  const dealerElement = characterElement(dealer?.id);
  if (
    row.dealerElementsAny.length &&
    !row.dealerElementsAny.includes(dealerElement)
  ) {
    return "scope:element";
  }
  if (
    row.dealerSpecialtiesAny.length &&
    !row.dealerSpecialtiesAny.includes(dealer?.specialty)
  ) {
    return "scope:specialty";
  }
  if (row.requiresStunned && !context.stunned) return "scope:stunned";
  if (
    row.statRequirement &&
    number(context.stats?.[row.statRequirement.stat]) + 1e-9 <
      number(row.statRequirement.minimum)
  ) {
    return `stat:${row.statRequirement.stat}`;
  }
  if (!agentEligibilitySatisfied(row.eligibility, owner, team)) {
    return "eligibility";
  }
  return null;
}

export function resolveAgentEffects(
  characterId,
  {
    owner = CHARACTER_BY_ID[String(characterId)] ?? null,
    dealer = owner,
    team = owner ? [owner] : [],
    mode = "strong",
    skillType = "normal",
    stunned = false,
    stats = {},
    maxActivation = true,
  } = {},
) {
  const definition = AGENT_EFFECTS_BY_ID[String(characterId)] ?? null;
  const resolved = [];
  for (const row of definition?.effects ?? []) {
    const skippedReason = rowInScope(row, owner, dealer, team, {
      mode,
      skillType,
      stunned,
      stats,
    });
    const active =
      maxActivation && !skippedReason && !row.unsupportedReason;
    const amount = active
      ? row.formula
        ? formulaAmount(row.formula, stats, team)
        : number(row.amount)
      : 0;
    resolved.push({
      ...row,
      amount,
      active,
      skippedReason:
        row.unsupportedReason
          ? "unsupported"
          : !maxActivation
            ? "inactive"
            : skippedReason,
      sourceUrl: definition?.sourceUrl ?? "",
    });
  }
  return {
    definition,
    applied: resolved.filter((row) => row.active),
    skipped: resolved.filter(
      (row) => !row.active && !row.unsupportedReason,
    ),
    unsupported: resolved.filter((row) => row.unsupportedReason),
  };
}
