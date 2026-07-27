import { characterElement } from "./media.js";

export const PARTY_WEAPON_EFFECTS_VERSION = "3.0";
export const PARTY_WEAPON_EFFECTS_SOURCE_BASE =
  "https://static.nanoka.cc/zzz/3.0/ko/weapon";

const values = (...items) => Object.freeze(items);

function effect(
  key,
  label,
  target,
  stat,
  refinementValues,
  options = {},
) {
  return Object.freeze({
    key,
    label,
    target,
    stat,
    values: Object.freeze([...refinementValues]),
    wearerElementsAny: Object.freeze([
      ...(options.wearerElementsAny ?? []),
    ]),
    dealerElementsAny: Object.freeze([
      ...(options.dealerElementsAny ?? []),
    ]),
    stackGroup: options.stackGroup ?? null,
    condition: options.condition ?? "",
    unsupportedReason: options.unsupportedReason ?? null,
  });
}

const party = (key, label, stat, refinementValues, options = {}) =>
  effect(key, label, "party", stat, refinementValues, options);
const enemy = (key, label, stat, refinementValues, options = {}) =>
  effect(key, label, "enemy", stat, refinementValues, options);
const self = (key, label, stat, refinementValues, options = {}) =>
  effect(key, label, "self", stat, refinementValues, options);

function unsupported(key, label, condition, reason) {
  return effect(
    key,
    label,
    "unsupported",
    "unsupported",
    values(0, 0, 0, 0, 0),
    { condition, unsupportedReason: reason },
  );
}

function defineWeapon(id, rows, selfEffects = []) {
  return Object.freeze({
    id,
    sourceUrl: `${PARTY_WEAPON_EFFECTS_SOURCE_BASE}/${id}.json`,
    effects: Object.freeze(
      rows.map((row) =>
        Object.freeze({ ...row, key: `${id}:${row.key}`, weaponId: id }),
      ),
    ),
    selfEffects: Object.freeze(
      selfEffects.map((row) =>
        Object.freeze({ ...row, key: `${id}:${row.key}`, weaponId: id }),
      ),
    ),
  });
}

const definitions = [
  defineWeapon(
    "14157",
    [
      party(
        "party-damage",
        "불 속성 강화 특수 스킬 2스택 · 파티 피해",
        "damageBonus",
        values(25, 28.8, 32.6, 36.2, 40),
        {
          wearerElementsAny: ["fire"],
          stackGroup: "wengine:14157:party-damage",
          condition: "강화 특수 스킬로 불 속성 피해 · 최대 2스택",
        },
      ),
    ],
    [
      self(
        "impact-flat",
        "착용자 충격력",
        "impactFlat",
        values(30, 33, 36, 39, 42),
      ),
      unsupported(
        "fire-resistance-ignore",
        "착용자 불 속성 피해 저항 무시",
        "착용자가 주는 피해",
        "착용자 전용 속성 저항 무시는 파티 버프 합산 대상이 아닙니다.",
      ),
    ],
  ),
  defineWeapon(
    "14156",
    [
      party(
        "party-anomaly-proficiency",
        "바람 속성 강화 특수 스킬 2스택 · 파티 이상 마스터리",
        "anomalyProficiency",
        values(60, 69, 78, 87, 96),
        {
          wearerElementsAny: ["wind"],
          stackGroup: "wengine:14156:party-anomaly-proficiency",
          condition: "강화 특수 스킬로 바람 속성 피해 · 정확히 2스택",
        },
      ),
    ],
    [
      self(
        "anomaly-proficiency",
        "착용자 이상 마스터리",
        "anomalyProficiency",
        values(70, 80, 90, 100, 110),
      ),
      unsupported(
        "turbulence-weathering-damage",
        "착용자 난류·풍화 피해",
        "바람 속성 강화 특수 스킬 · 최대 2스택",
        "난류·풍화 전용 피해 증가는 공용 파티 피해 보너스로 환산하지 않습니다.",
      ),
    ],
  ),
  defineWeapon(
    "14151",
    [
      party(
        "party-damage",
        "에테르 공격 2스택 · 파티 피해",
        "damageBonus",
        values(30, 34, 39, 42, 48),
        {
          wearerElementsAny: ["ether"],
          stackGroup: "wengine:14151:party-damage",
          condition: "강화 특수 스킬·일반 공격으로 에테르 피해 · 최대 2스택",
        },
      ),
    ],
    [
      self(
        "anomaly-proficiency-base",
        "착용자 이상 마스터리 · 상시",
        "anomalyProficiency",
        values(90, 103, 117, 130, 145),
      ),
      self(
        "anomaly-proficiency-two-stacks",
        "착용자 이상 마스터리 · 2스택 추가",
        "anomalyProficiency",
        values(60, 69, 78, 87, 96),
        { condition: "파티 피해 버프 2스택" },
      ),
    ],
  ),
  defineWeapon(
    "14149",
    [
      party(
        "party-damage",
        "물리 강화 특수 스킬 2스택 · 파티 피해",
        "damageBonus",
        values(25, 28.6, 32.2, 35.8, 40),
        {
          wearerElementsAny: ["physical"],
          stackGroup: "wengine:14149:party-damage",
          condition: "강화 특수 스킬로 물리 피해 · 최대 2스택",
        },
      ),
      party(
        "party-attack",
        "물리 강화 특수 스킬 2스택 · 파티 공격력",
        "attackPercent",
        values(10, 11.5, 13, 14.5, 16),
        {
          wearerElementsAny: ["physical"],
          stackGroup: "wengine:14149:party-attack",
          condition: "피해 버프가 정확히 2스택일 때",
        },
      ),
    ],
    [
      self(
        "party-attack-self",
        "파티 효과를 포함한 착용자 공격력",
        "attackPercent",
        values(10, 11.5, 13, 14.5, 16),
      ),
      unsupported(
        "off-field-energy",
        "대기 중 착용자 에너지 자동 회복",
        "착용자가 조작 중인 캐릭터가 아닐 때",
        "초당 에너지 회복은 직접 피해 스탯 합산 대상이 아닙니다.",
      ),
    ],
  ),
  defineWeapon(
    "14148",
    [
      party(
        "party-crit-damage",
        "그로기 버프 3스택 · 파티 치명타 피해",
        "critDamage",
        values(30, 34.5, 39, 43.5, 48),
        {
          wearerElementsAny: ["physical"],
          stackGroup: "wengine:14148:party-crit-damage",
          condition: "물리 강화 특수 스킬로 그로기 버프 3스택 도달",
        },
      ),
    ],
    [
      unsupported(
        "self-daze",
        "착용자 공격 그로기 수치",
        "물리 강화 특수 스킬 · 최대 3스택",
        "착용자의 그로기 수치 증가는 충격력 스탯으로 환산하지 않습니다.",
      ),
    ],
  ),
  defineWeapon(
    "14145",
    [
      party(
        "party-damage",
        "에테르 장막 · 파티 피해",
        "damageBonus",
        values(25, 28.8, 32.5, 36.3, 40),
        {
          stackGroup: "wengine:14145:party-damage",
          condition: "에테르 장막 발동 또는 연장",
        },
      ),
      party(
        "party-hp",
        "에테르 장막 · 파티 최대 HP",
        "hpPercent",
        values(15, 17.3, 19.5, 21.8, 24),
        {
          stackGroup: "wengine:14145:party-hp",
          condition: "에테르 장막 발동 또는 연장",
        },
      ),
    ],
    [
      self(
        "party-hp-self",
        "파티 효과를 포함한 착용자 최대 HP",
        "hpPercent",
        values(15, 17.3, 19.5, 21.8, 24),
      ),
    ],
  ),
  defineWeapon(
    "14141",
    [
      party(
        "party-anomaly-proficiency",
        "여진 명중 · 파티 이상 마스터리",
        "anomalyProficiency",
        values(60, 69, 78, 87, 96),
        {
          stackGroup: "wengine:14141:party-anomaly-proficiency",
          condition: "착용자의 여진 공격 명중",
        },
      ),
    ],
    [
      self(
        "anomaly-mastery-flat",
        "착용자 이상 장악력",
        "anomalyMasteryFlat",
        values(30, 34, 39, 43, 48),
        { condition: "강화 특수 스킬·궁극기로 물리 피해" },
      ),
      self(
        "party-anomaly-proficiency-self",
        "파티 효과를 포함한 착용자 이상 마스터리",
        "anomalyProficiency",
        values(60, 69, 78, 87, 96),
      ),
    ],
  ),
  defineWeapon(
    "14139",
    [
      party(
        "party-damage",
        "불 속성 콤보·궁극기 2스택 · 파티 피해",
        "damageBonus",
        values(20, 23, 26, 29, 32),
        {
          wearerElementsAny: ["fire"],
          stackGroup: "wengine:14139:party-damage",
          condition: "콤보 스킬·궁극기로 불 속성 피해 · 최대 2스택",
        },
      ),
    ],
    [
      unsupported(
        "self-daze",
        "착용자 강화 특수·콤보·궁극기 그로기 수치",
        "해당 공격 유형",
        "공격 유형 한정 그로기 수치는 충격력 스탯으로 환산하지 않습니다.",
      ),
    ],
  ),
  defineWeapon(
    "14136",
    [
      enemy(
        "enemy-defense",
        "전기 여진 · 방어력 감소",
        "defenseReduction",
        values(25, 28.75, 32.5, 36.25, 40),
        {
          wearerElementsAny: ["electric"],
          stackGroup: "wengine:14136:enemy-defense",
          condition: "여진으로 전기 피해 명중",
        },
      ),
    ],
    [
      self(
        "impact-percent",
        "혼의 사슬 최대 · 착용자 충격력",
        "impactPercent",
        values(20, 23, 26, 29, 32),
      ),
    ],
  ),
  defineWeapon(
    "14134",
    [
      party(
        "party-attack",
        "파티 공격력",
        "attackPercent",
        values(10, 11.5, 13, 14.5, 16),
        { stackGroup: "wengine:14134:party-attack" },
      ),
      party(
        "party-hp",
        "파티 최대 HP",
        "hpPercent",
        values(10, 11.5, 13, 14.5, 16),
        { stackGroup: "wengine:14134:party-hp" },
      ),
      party(
        "party-crit-damage",
        "에테르 장막 · 파티 치명타 피해",
        "critDamage",
        values(30, 34.5, 39, 43.5, 48),
        {
          stackGroup: "wengine:14134:party-crit-damage",
          condition: "에테르 장막 발동 또는 연장",
        },
      ),
    ],
    [
      self(
        "party-hp-self",
        "파티 효과를 포함한 착용자 최대 HP",
        "hpPercent",
        values(10, 11.5, 13, 14.5, 16),
      ),
      self(
        "party-attack-self",
        "파티 효과를 포함한 착용자 공격력",
        "attackPercent",
        values(10, 11.5, 13, 14.5, 16),
      ),
      self(
        "party-crit-damage-self",
        "파티 효과를 포함한 착용자 치명타 피해",
        "critDamage",
        values(30, 34.5, 39, 43.5, 48),
      ),
    ],
  ),
  defineWeapon(
    "14131",
    [
      party(
        "party-damage",
        "에너지 소모 2스택 · 파티 피해",
        "damageBonus",
        values(20, 23, 26, 29, 32),
        {
          stackGroup: "wengine:14131:party-damage",
          condition: "에너지 25pt 이상 소모 · 최대 2스택",
        },
      ),
    ],
    [
      unsupported(
        "energy-refund",
        "착용자 에너지 회복",
        "파티원이 지원 행동으로 전장 진입",
        "에너지 회복은 직접 피해 스탯 합산 대상이 아닙니다.",
      ),
    ],
  ),
  defineWeapon(
    "14125",
    [
      party(
        "party-damage",
        "찻기운 15스택 · 파티 피해",
        "damageBonus",
        values(20, 23, 26, 29, 32),
        {
          stackGroup: "wengine:14125:party-damage",
          condition: "일반 공격으로 찻기운 15스택 이상",
        },
      ),
    ],
    [
      self(
        "impact-percent",
        "찻기운 30스택 · 착용자 충격력",
        "impactPercent",
        values(21, 26.4, 31.5, 36.6, 42),
      ),
    ],
  ),
  defineWeapon(
    "14121",
    [
      enemy(
        "enemy-damage-taken",
        "공격 명중 · 받는 피해 증가",
        "receivedDamageIncrease",
        values(20.2, 24.5, 30, 35.5, 39.8),
        {
          stackGroup: "wengine:14121:enemy-damage-taken",
          condition: "공격 명중 후 3초 · 시간 경과 최대",
        },
      ),
    ],
    [
      unsupported(
        "off-field-energy",
        "대기 중 착용자 에너지 자동 회복",
        "착용자가 대기 캐릭터일 때",
        "초당 에너지 회복은 직접 피해 스탯 합산 대상이 아닙니다.",
      ),
    ],
  ),
  defineWeapon(
    "14116",
    [
      party(
        "enemy-ice-fire-crit-damage",
        "침체 20스택 · 얼음·불 치명타 피해",
        "critDamage",
        values(30, 34.4, 39, 43.4, 48),
        {
          dealerElementsAny: ["ice", "fire"],
          stackGroup: "wengine:14116:enemy-ice-fire-crit-damage",
          condition: "일반 공격으로 침체 20스택",
        },
      ),
    ],
    [
      self(
        "impact-percent",
        "빠른·극한 지원 · 착용자 충격력",
        "impactPercent",
        values(25, 28.75, 32.5, 36.25, 40),
      ),
    ],
  ),
  defineWeapon(
    "14114",
    [
      unsupported(
        "self-normal-damage-daze",
        "착용자 일반 공격 피해·그로기 수치",
        "공격 명중 · 최대 5스택",
        "착용자 일반 공격 전용 효과라 파티 버프 합산 대상이 아닙니다.",
      ),
    ],
  ),
  defineWeapon(
    "14110",
    [
      unsupported(
        "no-party-effect",
        "파티에 전달되는 직접 피해 효과 없음",
        "착용자 대기·강화 특수 스킬",
        "에너지 회복과 착용자 충격력만 제공하는 엔진입니다.",
      ),
    ],
    [
      self(
        "impact-percent",
        "강화 특수 스킬 2스택 · 착용자 충격력",
        "impactPercent",
        values(20, 25, 30, 35, 40),
      ),
    ],
  ),
  defineWeapon(
    "14107",
    [
      party(
        "party-damage",
        "스킬 파훼·극한 회피 · 파티 피해",
        "damageBonus",
        values(18, 22.5, 27, 31.5, 36),
        {
          stackGroup: "wengine:14107:party-damage",
          condition: "파티원이 스킬 파훼 또는 극한 회피",
        },
      ),
      unsupported(
        "party-daze",
        "스킬 파훼·극한 회피 · 파티 그로기 수치",
        "파티원이 스킬 파훼 또는 극한 회피",
        "파티 그로기 수치 보너스는 현재 피해 배율 합산 모델이 지원하지 않습니다.",
      ),
    ],
    [
      unsupported(
        "shield-strength",
        "착용자 실드량",
        "상시",
        "실드량은 직접 피해 스탯 합산 대상이 아닙니다.",
      ),
    ],
  ),
  defineWeapon(
    "14003",
    [
      unsupported(
        "self-ex-daze",
        "충전 소모 · 착용자 강화 특수 스킬 그로기 수치",
        "6스택 소모",
        "착용자 강화 특수 스킬 전용 그로기 효과라 파티 합산 대상이 아닙니다.",
      ),
    ],
  ),
  defineWeapon(
    "14002",
    [
      party(
        "enemy-crit-rate",
        "속성 상성 · 대상 치명타 확률",
        "critRate",
        values(12, 13.5, 15.5, 17.5, 20),
        {
          stackGroup: "wengine:14002:enemy-crit-rate",
          condition: "착용자의 공격에서 속성 상성 발동",
        },
      ),
    ],
  ),
  defineWeapon(
    "13142",
    [
      unsupported(
        "self-skill-damage-energy",
        "착용자 강화 특수·궁극기 피해 및 에너지 회복",
        "파티원이 피해를 받거나 HP 회복",
        "착용자 전용 스킬 피해와 에너지 회복은 파티 합산 대상이 아닙니다.",
      ),
    ],
  ),
  defineWeapon(
    "13135",
    [
      unsupported(
        "self-aftershock-damage-daze",
        "여진 · 착용자 물리 피해·그로기 수치",
        "여진 공격 시전",
        "착용자 여진 전용 피해·그로기 효과라 파티 합산 대상이 아닙니다.",
      ),
    ],
  ),
  defineWeapon(
    "13127",
    [
      unsupported(
        "self-energy-buildup",
        "착용자 에너지 회복·속성 이상 축적",
        "실드 보유·강화 특수 스킬·지원 돌격",
        "에너지 회복과 속성 이상 축적 보너스는 현재 파티 피해 합산 모델이 지원하지 않습니다.",
      ),
    ],
  ),
  defineWeapon(
    "13115",
    [
      party(
        "party-attack",
        "아군 명중 4스택 · 파티 공격력",
        "attackPercent",
        values(10, 11.2, 12.8, 14.4, 16),
        {
          stackGroup: "wengine:13115:party-attack",
          condition: "아군 유닛 명중 · 최대 4스택",
        },
      ),
    ],
    [
      self(
        "party-attack-self",
        "파티 효과를 포함한 착용자 공격력",
        "attackPercent",
        values(10, 11.2, 12.8, 14.4, 16),
      ),
    ],
  ),
  defineWeapon(
    "13113",
    [
      party(
        "party-attack",
        "강화 특수 스킬 4스택 · 파티 공격력",
        "attackPercent",
        values(8, 9.2, 10.4, 11.6, 12.8),
        {
          stackGroup: "wengine:13113:party-attack",
          condition: "강화 특수 스킬 시전 · 최대 4스택",
        },
      ),
    ],
    [
      self(
        "party-attack-self",
        "파티 효과를 포함한 착용자 공격력",
        "attackPercent",
        values(8, 9.2, 10.4, 11.6, 12.8),
      ),
      unsupported(
        "ice-damage",
        "착용자 얼음 속성 피해",
        "상시",
        "착용자 전용 속성 피해는 파티 버프 합산 대상이 아닙니다.",
      ),
    ],
  ),
  defineWeapon(
    "13112",
    [
      unsupported(
        "self-reduction-extra-hit",
        "착용자 받는 피해 감소·방어력 비례 추가타",
        "피격 후 다음 공격",
        "피해 감소와 별도 추가타는 공용 파티 피해 배율로 환산하지 않습니다.",
      ),
    ],
  ),
  defineWeapon(
    "13103",
    [
      enemy(
        "enemy-damage-taken",
        "에테르 스킬 · 받는 피해 증가",
        "receivedDamageIncrease",
        values(15, 17.5, 20, 22, 24),
        {
          wearerElementsAny: ["ether"],
          stackGroup: "wengine:13103:enemy-damage-taken",
          condition: "강화 특수·콤보·궁극기로 에테르 피해",
        },
      ),
    ],
  ),
  defineWeapon(
    "13101",
    [
      unsupported(
        "self-electric-damage-energy",
        "착용자 전기 피해·에너지 획득 효율",
        "회피 반격·지원 공격 명중",
        "착용자 전용 속성 피해와 에너지 획득 효율은 파티 합산 대상이 아닙니다.",
      ),
    ],
  ),
  defineWeapon(
    "13020",
    [
      unsupported(
        "self-damage-daze",
        "지원 돌격 · 착용자 피해·그로기 수치",
        "지원 돌격 시전",
        "착용자 전용 피해·그로기 효과라 파티 합산 대상이 아닙니다.",
      ),
    ],
  ),
  defineWeapon(
    "13016",
    [
      unsupported(
        "party-defense",
        "파티 받는 피해·미아즈마 오염 감소",
        "파티원의 HP가 50% 이상",
        "방어 유틸리티는 현재 직접 피해 합산 모델이 지원하지 않습니다.",
      ),
    ],
  ),
  defineWeapon(
    "13011",
    [
      unsupported(
        "active-energy-transfer",
        "현재 조작 캐릭터에게 에너지 획득 효율 전달",
        "피격 후 착용자가 대기 캐릭터로 전환",
        "에너지 획득 효율 전달은 직접 피해 스탯 합산 대상이 아닙니다.",
      ),
    ],
  ),
  defineWeapon(
    "13010",
    [
      unsupported(
        "no-party-effect",
        "파티에 전달되는 직접 피해 효과 없음",
        "착용자 실드 보유",
        "최대 HP와 공격력 모두 착용자 전용입니다.",
      ),
    ],
    [
      self(
        "hp-percent",
        "착용자 최대 HP",
        "hpPercent",
        values(8, 9.2, 10.4, 11.6, 12.8),
      ),
      self(
        "shield-attack",
        "실드 보유 · 착용자 공격력",
        "attackPercent",
        values(10, 11.5, 13, 14.5, 16),
      ),
    ],
  ),
  defineWeapon(
    "13007",
    [
      unsupported(
        "no-party-effect",
        "파티에 전달되는 직접 피해 효과 없음",
        "착용자 피격",
        "최대 HP와 충격력 모두 착용자 전용입니다.",
      ),
    ],
    [
      self(
        "hp-percent",
        "착용자 최대 HP",
        "hpPercent",
        values(8, 9, 10, 11, 12.5),
      ),
      self(
        "impact-percent",
        "피격 · 착용자 충격력",
        "impactPercent",
        values(10, 11.5, 13, 14.5, 16),
      ),
    ],
  ),
  defineWeapon(
    "13006",
    [
      unsupported(
        "self-daze",
        "적 HP 조건 · 착용자 그로기 수치",
        "적 HP 75% 이상에서 최대",
        "착용자 전용 그로기 효과라 파티 합산 대상이 아닙니다.",
      ),
    ],
  ),
  defineWeapon(
    "13005",
    [
      unsupported(
        "no-party-effect",
        "파티에 전달되는 직접 피해 효과 없음",
        "에너지 80pt 보유 · 최대 8스택",
        "충격력 증가는 착용자에게만 적용됩니다.",
      ),
    ],
    [
      self(
        "impact-percent",
        "에너지 80pt · 착용자 충격력",
        "impactPercent",
        values(16, 18.4, 20.8, 23.2, 25.6),
      ),
    ],
  ),
  defineWeapon(
    "13002",
    [
      unsupported(
        "party-decibel-energy",
        "데시벨 추가 획득·착용자 에너지 회복",
        "회피 반격·강화 특수·지원 공격·콤보 스킬",
        "데시벨과 에너지 회복은 직접 피해 스탯 합산 대상이 아닙니다.",
      ),
    ],
  ),
];

export const PARTY_WEAPON_EFFECTS = Object.freeze(
  Object.fromEntries(definitions.map((entry) => [entry.id, entry])),
);

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function inScope(entry, wearer, dealer) {
  const wearerElement = characterElement(wearer?.id);
  const dealerElement = characterElement(dealer?.id);
  return (
    (!entry.wearerElementsAny.length ||
      entry.wearerElementsAny.includes(wearerElement)) &&
    (!entry.dealerElementsAny.length ||
      entry.dealerElementsAny.includes(dealerElement))
  );
}

export function resolvePartyWeaponEffects(
  weaponId,
  refinement = 1,
  { wearer = null, dealer = null, maxActivation = true } = {},
) {
  const definition = PARTY_WEAPON_EFFECTS[String(weaponId)];
  const rank = Math.min(5, Math.max(1, Math.trunc(number(refinement, 1))));
  const rows = [];
  const selfRows = [];

  if (definition) {
    for (const entry of definition.effects) {
      const scoped = inScope(entry, wearer, dealer);
      const active =
        maxActivation && scoped && !entry.unsupportedReason;
      rows.push({
        ...entry,
        active,
        amount: active ? entry.values[rank - 1] : 0,
        skippedReason: active
          ? null
          : entry.unsupportedReason
            ? "unsupported"
          : !maxActivation
            ? "inactive"
            : "scope",
        sourceUrl: definition.sourceUrl,
      });
    }
    for (const entry of definition.selfEffects) {
      const scoped = inScope(entry, wearer, dealer);
      const active =
        maxActivation && scoped && !entry.unsupportedReason;
      selfRows.push({
        ...entry,
        active,
        amount: active ? entry.values[rank - 1] : 0,
        skippedReason: active
          ? null
          : entry.unsupportedReason
            ? "unsupported"
          : !maxActivation
            ? "inactive"
            : "scope",
        sourceUrl: definition.sourceUrl,
      });
    }
  }

  return {
    definition: definition ?? null,
    refinement: rank,
    applied: rows.filter((entry) => entry.active),
    skipped: rows.filter((entry) => !entry.active),
    selfApplied: selfRows.filter((entry) => entry.active),
    unsupported: [...rows, ...selfRows].filter(
      (entry) => entry.unsupportedReason,
    ),
  };
}
