export const WEAPON_PASSIVE_DATA_VERSION = "3.0";
export const WEAPON_PASSIVE_SOURCE_BASE =
  "https://static.nanoka.cc/zzz/3.0/ko/weapon";

export const WEAPON_PASSIVE_SUPPORTED_STATS = Object.freeze([
  "attackPercent",
  "hpPercent",
  "critRate",
  "critDamage",
  "damageBonus",
  "penetrationPercent",
  "defenseReduction",
  "resistanceIgnore",
  "resistanceReduction",
  "anomalyProficiency",
  "anomalyMastery",
  "anomalyMasteryFlat",
  "anomalyDamageBonus",
  "penetrationDamageBonus",
  "flatPenetration",
]);

const SUPPORTED_STATS = new Set(WEAPON_PASSIVE_SUPPORTED_STATS);
const VALID_ACTIVATIONS = new Set(["always", "toggle", "stacks"]);
const values = (...entries) => Object.freeze(entries);

function effect(key, label, stat, refinementValues, options = {}) {
  if (refinementValues.length !== 5) {
    throw new Error(`${key}: W-엔진 재련 수치는 R1~R5가 필요합니다.`);
  }
  return Object.freeze({
    key,
    label,
    stat,
    values: Object.freeze([...refinementValues]),
    unit: options.unit ?? "percent",
    activation: options.activation ?? "toggle",
    maxStacks: options.maxStacks ?? 1,
    maxActivationMultiplier: options.maxActivationMultiplier ?? 1,
    mode: options.mode ?? null,
    element: options.element ?? null,
    anomalyKey: options.anomalyKey ?? null,
    skillTypes: Object.freeze([...(options.skillTypes ?? [])]),
    characterId: options.characterId ? String(options.characterId) : null,
    triggerSkillTypes: Object.freeze([
      ...(options.triggerSkillTypes ?? []),
    ]),
    triggerElement: options.triggerElement ?? null,
    triggerAnomalyKey: options.triggerAnomalyKey ?? null,
    condition: options.condition ?? null,
    thresholdStacks: options.thresholdStacks ?? null,
    sharedStackGroup: options.sharedStackGroup ?? null,
    resourceMax: options.resourceMax ?? null,
    sourceNote: options.sourceNote ?? "",
    reason: options.reason ?? null,
  });
}

function always(key, label, stat, refinementValues, options = {}) {
  return effect(key, label, stat, refinementValues, {
    ...options,
    activation: "always",
  });
}

function toggle(key, label, stat, refinementValues, options = {}) {
  return effect(key, label, stat, refinementValues, {
    ...options,
    activation: "toggle",
  });
}

function stacks(
  key,
  label,
  stat,
  refinementValues,
  maxStacks,
  options = {},
) {
  return effect(key, label, stat, refinementValues, {
    ...options,
    activation: "stacks",
    maxStacks,
  });
}

function unsupported(
  key,
  label,
  refinementValues,
  reason,
  options = {},
) {
  return effect(key, label, "unsupported", refinementValues, {
    ...options,
    reason,
  });
}

function formatValue(entry, refinement) {
  const value = entry.values[refinement - 1];
  const unit = entry.unit === "percent" ? "%" : entry.unit === "flat" ? "pt" : "";
  const stackText =
    entry.maxStacks > 1 ? ` × 최대 ${entry.maxStacks}스택` : "";
  const multiplierText =
    entry.maxActivationMultiplier > 1
      ? ` × 조건 배율 ${entry.maxActivationMultiplier}`
      : "";
  return `${value}${unit}${stackText}${multiplierText}`;
}

function defineWeapon(id, name, specialty, title, rows) {
  const normalizedRows = Object.freeze(
    rows.map((row) =>
      Object.freeze({
        ...row,
        key: `${id}:${row.key}`,
        weaponId: id,
      }),
    ),
  );
  const refinements = Object.freeze(
    Array.from({ length: 5 }, (_, index) => {
      const refinement = index + 1;
      return Object.freeze({
        refinement,
        description: normalizedRows
          .map(
            (row) =>
              `${row.label} ${formatValue(row, refinement)}${
                row.sourceNote ? ` — ${row.sourceNote}` : ""
              }`,
          )
          .join(" · "),
      });
    }),
  );
  return Object.freeze({
    id,
    name,
    specialty,
    title,
    dataVersion: WEAPON_PASSIVE_DATA_VERSION,
    sourceUrl: `${WEAPON_PASSIVE_SOURCE_BASE}/${id}.json`,
    refinements,
    effects: normalizedRows,
  });
}

const STRONG_WEAPONS = [
  defineWeapon("13001", "거리의 슈퍼스타", "강공", "뜨거운 노래", [
    stacks(
      "ultimate-charge",
      "궁극기 피해 증가",
      "damageBonus",
      values(15, 17.2, 19.5, 21.7, 24),
      3,
      {
        mode: "strong",
        skillTypes: ["ultimate"],
        triggerSkillTypes: ["chain"],
        sourceNote:
          "파티원이 콤보 스킬을 시전할 때 충전하고 자신의 궁극기에서 전부 소비",
      },
    ),
  ]),
  defineWeapon("13004", "별빛 엔진", "강공", "기사 연타", [
    toggle(
      "attack",
      "공격력 증가",
      "attackPercent",
      values(12, 13.8, 15.6, 17.4, 19.2),
      {
        triggerSkillTypes: ["dodge-counter", "quick-assist"],
        sourceNote: "회피 반격 또는 빠른 지원 시전 후 12초",
      },
    ),
  ]),
  defineWeapon("13013", "도금된 화신풍", "강공", "초규격 방범 조치", [
    always(
      "attack",
      "공격력 증가",
      "attackPercent",
      values(6, 6.9, 7.8, 8.7, 9.6),
      { sourceNote: "상시 적용" },
    ),
    always(
      "ex-damage",
      "강화 특수 스킬 피해 증가",
      "damageBonus",
      values(15, 17.2, 19.5, 21.8, 24),
      {
        mode: "strong",
        skillTypes: ["ex", "ex-special"],
        sourceNote: "강화 특수 스킬에만 적용",
      },
    ),
  ]),
  defineWeapon("13015", "열망의 악센트", "강공", "들썩이는 스테이지", [
    toggle(
      "attack",
      "공격력 증가",
      "attackPercent",
      values(6, 6.9, 7.8, 8.7, 9.6),
      {
        triggerSkillTypes: ["ex", "ex-special", "chain"],
        sourceNote: "강화 특수 또는 콤보 스킬 명중 후 8초",
      },
    ),
    toggle(
      "attack-anomaly-target",
      "속성 이상 대상 추가 공격력",
      "attackPercent",
      values(6, 6.9, 7.8, 8.7, 9.6),
      {
        condition: "target-anomaly",
        sourceNote: "대상이 속성 이상 상태일 때 같은 공격력 보너스를 추가 적용",
      },
    ),
  ]),
  defineWeapon("13106", "하우스키퍼", "강공", "가정용 안심 절단기", [
    unsupported(
      "off-field-energy",
      "대기 중 에너지 자동 회복",
      values(0.45, 0.52, 0.58, 0.65, 0.72),
      "에너지 회복은 단일 피해 스냅샷에 환산할 수 없습니다.",
      {
        unit: "per-second",
        condition: "off-field",
        sourceNote: "초당 에너지 회복",
      },
    ),
    stacks(
      "physical-damage",
      "물리 피해 증가",
      "damageBonus",
      values(3, 3.5, 4, 4.4, 4.8),
      15,
      {
        element: "물리",
        triggerSkillTypes: ["ex", "ex-special"],
        sourceNote: "강화 특수 스킬 명중 시 스택, 1초",
      },
    ),
  ]),
  defineWeapon("13108", "별빛 엔진 레플리카", "강공", "기사 에너지 빔: 개조", [
    toggle(
      "physical-damage",
      "물리 피해 증가",
      "damageBonus",
      values(36, 41, 46.5, 52, 57.5),
      {
        element: "물리",
        triggerSkillTypes: ["basic", "dash"],
        condition: "distance-at-least-6m",
        sourceNote: "6m 이상 거리에서 일반/대시 공격 명중 후 해당 대상에 8초",
      },
    ),
  ]),
  defineWeapon("13111", "굴착기-붉은 축", "강공", "붉은 연꽃 모터", [
    toggle(
      "electric-basic-dash",
      "전기 일반·대시 공격 피해 증가",
      "damageBonus",
      values(50, 57.5, 65, 72.5, 80),
      {
        mode: "strong",
        element: "전기",
        skillTypes: ["basic", "dash"],
        triggerSkillTypes: ["ex", "ex-special", "chain"],
        sourceNote: "강화 특수/콤보 스킬 시전 후 10초, 재사용 15초",
      },
    ),
  ]),
  defineWeapon("14001", "캐논 로터", "강공", "구경 규격 초과", [
    always(
      "attack",
      "공격력 증가",
      "attackPercent",
      values(7.5, 8.6, 9.7, 10.8, 12),
      { sourceNote: "상시 적용" },
    ),
    unsupported(
      "critical-proc",
      "치명타 추가 피해",
      values(200, 200, 200, 200, 200),
      "공격력 200%의 별도 추가 피해는 타격 횟수와 회전율 모델이 필요합니다.",
      {
        mode: "strong",
        unit: "percent",
        condition: "critical-hit",
        sourceNote: "재사용 대기시간 R1~R5: 8/7.5/7/6.5/6초",
      },
    ),
  ]),
  defineWeapon("14102", "스틸 쿠션", "강공", "합금 고양이 발톱", [
    always(
      "physical-damage",
      "물리 피해 증가",
      "damageBonus",
      values(20, 25, 30, 35, 40),
      { element: "물리", sourceNote: "상시 적용" },
    ),
    toggle(
      "rear-damage",
      "후면 공격 피해 증가",
      "damageBonus",
      values(25, 31.5, 38, 44, 50),
      {
        condition: "rear-hit",
        sourceNote: "적의 후면을 공격할 때 적용",
      },
    ),
  ]),
  defineWeapon("14104", "유황석", "강공", "뜨거운 숨결", [
    stacks(
      "attack",
      "공격력 증가",
      "attackPercent",
      values(3.5, 4.4, 5.2, 6, 7),
      8,
      {
        triggerSkillTypes: ["basic", "dash", "dodge-counter"],
        sourceNote: "일반/대시/회피 반격 명중 시, 스택별 8초",
      },
    ),
  ]),
  defineWeapon("14119", "심해 방문객", "강공", "바다의 왕", [
    always(
      "ice-damage",
      "얼음 피해 증가",
      "damageBonus",
      values(25, 31.5, 38, 44.5, 50),
      { element: "얼음", sourceNote: "상시 적용" },
    ),
    toggle(
      "basic-crit",
      "일반 공격 발동 치명타 확률",
      "critRate",
      values(10, 12.5, 15, 17.5, 20),
      {
        triggerSkillTypes: ["basic"],
        sourceNote: "일반 공격 명중 후 8초",
      },
    ),
    toggle(
      "dash-crit",
      "얼음 대시 공격 발동 치명타 확률",
      "critRate",
      values(10, 12.5, 15, 17.5, 20),
      {
        triggerSkillTypes: ["dash"],
        triggerElement: "얼음",
        sourceNote: "얼음 대시 공격 명중 후 별도 15초",
      },
    ),
  ]),
  defineWeapon("14120", "잔심의 청낭", "강공", "인내의 공덕", [
    always(
      "crit",
      "치명타 확률",
      "critRate",
      values(10, 11.5, 13, 14.5, 16),
      { sourceNote: "상시 적용" },
    ),
    always(
      "electric-dash",
      "전기 대시 공격 피해",
      "damageBonus",
      values(40, 46, 52, 58, 64),
      {
        mode: "strong",
        element: "전기",
        skillTypes: ["dash"],
        sourceNote: "전기 대시 공격에 적용",
      },
    ),
    toggle(
      "conditional-crit",
      "추가 치명타 확률",
      "critRate",
      values(10, 11.5, 13, 14.5, 16),
      {
        condition: "party-anomaly-or-stun",
        sourceNote: "파티원이 속성 이상을 부여하거나 적을 그로기 상태로 만들면 15초",
      },
    ),
  ]),
  defineWeapon("14124", "서프레서 Ⅵ형", "강공", "안전순찰", [
    always(
      "crit",
      "치명타 확률",
      "critRate",
      values(15, 18.8, 22.6, 26.4, 30),
      { sourceNote: "상시 적용" },
    ),
    toggle(
      "ether-charge-hit",
      "에테르 일반·대시 공격 피해",
      "damageBonus",
      values(35, 43.5, 52, 60.5, 70),
      {
        mode: "strong",
        element: "에테르",
        skillTypes: ["basic", "dash"],
        triggerSkillTypes: ["ex", "ex-special"],
        resourceMax: 8,
        sourceNote:
          "강화 특수 스킬로 충전 8개 획득, 해당 적중마다 1개 소비(8배 합산 아님)",
      },
    ),
  ]),
  defineWeapon("14129", "천변하는 태양의 몰락", "강공", "거짓된 수많은 나", [
    always(
      "crit-damage",
      "치명타 피해",
      "critDamage",
      values(45, 51.75, 58.5, 65.25, 72),
      { sourceNote: "상시 적용" },
    ),
    unsupported(
      "defense-ignore",
      "방어력 무시",
      values(25, 28.75, 32.5, 36.25, 40),
      "방어력 무시는 방어력 감소와 별개이며 현재 공통 totals에 안전한 필드가 없습니다.",
      {
        mode: "strong",
        triggerSkillTypes: ["ex", "ex-special", "chain", "ultimate"],
        triggerElement: "얼음",
        sourceNote: "얼음 피해로 발동 후 3초",
      },
    ),
  ]),
  defineWeapon("14130", "소란한 총성과 화염", "강공", "화염을 삼키는 재잘거림", [
    always(
      "crit",
      "치명타 확률",
      "critRate",
      values(20, 23, 26, 29, 32),
      { sourceNote: "상시 적용" },
    ),
    unsupported(
      "defense-ignore",
      "방어력 무시",
      values(15, 17.2, 19.5, 21.7, 24),
      "방어력 무시는 방어력 감소와 별개이며 현재 공통 totals에 안전한 필드가 없습니다.",
      {
        mode: "strong",
        maxStacks: 2,
        triggerSkillTypes: ["aftershock"],
        triggerElement: "불",
        sourceNote: "불 속성 추가 공격 발동 시 스택, 8초",
      },
    ),
  ]),
  defineWeapon("14132", "심금을 울리는 야상곡", "강공", "현의 울림을 타고", [
    always(
      "crit-damage",
      "치명타 피해",
      "critDamage",
      values(50, 57.5, 65, 72.5, 80),
      { sourceNote: "상시 적용" },
    ),
    stacks(
      "fire-res-ignore",
      "불 속성 피해 저항 무시",
      "resistanceIgnore",
      values(12.5, 14.5, 16.5, 18.5, 20),
      2,
      {
        mode: "strong",
        element: "불",
        skillTypes: ["chain", "ultimate"],
        triggerSkillTypes: ["chain", "ultimate"],
        sourceNote: "교전 진입/콤보/궁극기로 스택, 콤보와 궁극기에 적용",
      },
    ),
  ]),
  defineWeapon("14138", "순결한 희생", "강공", "고요한 빛과 시린 꽃", [
    always(
      "crit-damage",
      "치명타 피해",
      "critDamage",
      values(30, 34.5, 39, 43.5, 48),
      { sourceNote: "상시 적용" },
    ),
    stacks(
      "stack-crit-damage",
      "추가 치명타 피해",
      "critDamage",
      values(10, 11.5, 13, 14.5, 16),
      3,
      {
        sharedStackGroup: "14138-buff",
        triggerSkillTypes: ["basic", "special", "aftershock"],
        sourceNote: "일반/특수/추가 공격 명중 시 스택, 스택별 30초",
      },
    ),
    toggle(
      "max-stack-electric",
      "3스택 전기 피해",
      "damageBonus",
      values(20, 23, 26, 29, 32),
      {
        element: "전기",
        thresholdStacks: 3,
        sharedStackGroup: "14138-buff",
        sourceNote: "공유 버프 3스택일 때 적용",
      },
    ),
  ]),
  defineWeapon("14143", "구름을 헤친 빛", "강공", "옥처럼 맑은 마음", [
    always(
      "physical-res-ignore",
      "물리 피해 저항 무시",
      "resistanceIgnore",
      values(20, 22, 24, 26, 28),
      { element: "물리", sourceNote: "상시 적용" },
    ),
    toggle(
      "veil-damage",
      "에테르 베일 피해 증가",
      "damageBonus",
      values(25, 28.7, 32.5, 36.2, 40),
      {
        condition: "ether-veil",
        sourceNote: "에테르 베일 활성화 후 40초",
      },
    ),
    toggle(
      "veil-crit-damage",
      "에테르 베일 치명타 피해",
      "critDamage",
      values(25, 28.7, 32.5, 36.2, 40),
      {
        condition: "ether-veil",
        sourceNote: "에테르 베일 활성화 후 40초",
      },
    ),
  ]),
  defineWeapon("14146", "기계 심장에 내린 씨앗", "강공", "싹 틔운 코어", [
    always(
      "crit",
      "치명타 확률",
      "critRate",
      values(15, 17, 19, 21, 23),
      { sourceNote: "상시 적용" },
    ),
    stacks(
      "electric-damage",
      "전기 피해 증가",
      "damageBonus",
      values(12.5, 14.5, 16.5, 18.5, 20),
      2,
      {
        element: "전기",
        sharedStackGroup: "14146-buff",
        triggerSkillTypes: ["basic", "ex", "ex-special"],
        sourceNote: "일반/강화 특수 스킬로 스택, 스택별 40초",
      },
    ),
    unsupported(
      "defense-ignore",
      "일반·궁극기 방어력 무시",
      values(20, 23, 26, 29, 32),
      "방어력 무시는 방어력 감소와 별개이며 현재 공통 totals에 안전한 필드가 없습니다.",
      {
        mode: "strong",
        skillTypes: ["basic", "ultimate"],
        thresholdStacks: 2,
        sharedStackGroup: "14146-buff",
        sourceNote: "공유 버프 2스택일 때 적용",
      },
    ),
  ]),
  defineWeapon("14152", "추적하는 송곳니", "강공", "바이오닉 톡신", [
    always(
      "crit",
      "치명타 확률",
      "critRate",
      values(25, 28.8, 32.5, 36.3, 40),
      { sourceNote: "상시 적용" },
    ),
    unsupported(
      "defense-ignore",
      "전기 피해 방어력 무시",
      values(28, 31.5, 35, 38.5, 42),
      "방어력 무시는 방어력 감소와 별개이며 현재 공통 totals에 안전한 필드가 없습니다.",
      {
        element: "전기",
        condition: "consume-20-energy",
        sourceNote: "에너지 20pt 이상 소비 또는 교전 진입 시 활성화",
      },
    ),
  ]),
  defineWeapon("14155", "태양의 유체", "강공", "일식 효과", [
    always(
      "crit",
      "치명타 확률",
      "critRate",
      values(20, 20, 20, 20, 20),
      { sourceNote: "상시 적용" },
    ),
    toggle(
      "pyrois-ether-res-ignore",
      "에테르 피해 저항 무시",
      "resistanceIgnore",
      values(16, 17.5, 19, 20.5, 22),
      {
        element: "에테르",
        characterId: "1551",
        triggerSkillTypes: ["ultimate"],
        condition: "eclipse",
        sourceNote: "피로이스 전용, 교전 진입/궁극기로 일식 활성화 후 45초",
      },
    ),
  ]),
];

const MINGPO_WEAPONS = [
  defineWeapon("13012", "기변의 큐브", "명파", "독창적인 기술", [
    toggle(
      "crit-damage",
      "치명타 피해",
      "critDamage",
      values(16, 18.4, 20.8, 23.2, 25.6),
      {
        mode: "mingpo",
        triggerSkillTypes: ["ex", "ex-special"],
        sourceNote: "강화 특수 스킬 시전 후 12초",
      },
    ),
    toggle(
      "low-hp-ex-damage",
      "저체력 대상 강화 특수 피해",
      "damageBonus",
      values(20, 23, 26, 29, 32),
      {
        mode: "mingpo",
        skillTypes: ["ex", "ex-special"],
        condition: "target-hp-below-50",
        sourceNote: "대상 HP가 50% 미만일 때 강화 특수 스킬에 적용",
      },
    ),
  ]),
  defineWeapon("13014", "일렉트로 워크", "명파", "자유로운 발걸음", [
    stacks(
      "sheer-force",
      "관입력 증가",
      "flatPenetration",
      values(80, 92, 104, 116, 128),
      3,
      {
        mode: "mingpo",
        unit: "flat",
        triggerSkillTypes: ["chain", "ultimate"],
        sourceNote: "콤보/궁극기로 스택, 스택별 12초",
      },
    ),
  ]),
  defineWeapon("13019", "푸른 물결의 솥", "명파", "영혼을 깨우는 소리", [
    stacks(
      "damage",
      "피해 증가",
      "damageBonus",
      values(4, 4.6, 5.2, 5.8, 6.4),
      3,
      {
        mode: "mingpo",
        sharedStackGroup: "13019-buff",
        triggerSkillTypes: ["ex", "ex-special"],
        sourceNote: "강화 특수 스킬로 스택, 20초",
      },
    ),
    toggle(
      "max-stack-crit",
      "3스택 치명타 확률",
      "critRate",
      values(6.5, 7.5, 8.5, 9.4, 10.4),
      {
        mode: "mingpo",
        thresholdStacks: 3,
        sharedStackGroup: "13019-buff",
        sourceNote: "공유 버프 3스택일 때 적용",
      },
    ),
  ]),
  defineWeapon("13144", "어스름한 밤의 화염", "명파", "새장 속 불", [
    always(
      "fire-damage",
      "불 피해 증가",
      "damageBonus",
      values(15, 17.25, 19.5, 21.75, 24),
      { mode: "mingpo", element: "불", sourceNote: "상시 적용" },
    ),
    toggle(
      "hp-loss-crit",
      "HP 감소 후 치명타 확률",
      "critRate",
      values(15, 17.25, 19.5, 21.75, 24),
      {
        mode: "mingpo",
        condition: "own-hp-decreased",
        sourceNote: "HP 감소 후 5초",
      },
    ),
  ]),
  defineWeapon("14105", "크라켄의 요람", "명파", "마음을 다한 포옹", [
    stacks(
      "ice-sheer",
      "얼음 관입 피해",
      "penetrationDamageBonus",
      values(6, 7, 8, 9, 10),
      3,
      {
        mode: "mingpo",
        element: "얼음",
        condition: "own-hp-decreased",
        sourceNote: "HP 감소 시 스택, 스택별 25초",
      },
    ),
    toggle(
      "low-hp-crit",
      "저체력 치명타 확률",
      "critRate",
      values(20, 23, 26, 29, 32),
      {
        mode: "mingpo",
        condition: "own-hp-at-most-50",
        sourceNote: "HP가 최대치의 50% 이하일 때 적용",
      },
    ),
  ]),
  defineWeapon("14137", "청명의 보금자리", "명파", "흐르는 구름을 따라", [
    always(
      "crit",
      "치명타 확률",
      "critRate",
      values(20, 23, 26, 29, 32),
      { mode: "mingpo", sourceNote: "상시 적용" },
    ),
    stacks(
      "ether-damage",
      "에테르 피해",
      "damageBonus",
      values(8, 9.2, 10.4, 11.6, 12.8),
      2,
      {
        mode: "mingpo",
        element: "에테르",
        sharedStackGroup: "14137-buff",
        triggerSkillTypes: ["ex", "ex-special"],
        sourceNote: "교전 진입 시 2스택, 강화 특수 스킬로 갱신",
      },
    ),
    stacks(
      "ether-sheer",
      "궁극기·강화 특수 에테르 관입 피해",
      "penetrationDamageBonus",
      values(10, 11.5, 13, 14.5, 16),
      2,
      {
        mode: "mingpo",
        element: "에테르",
        skillTypes: ["ultimate", "ex", "ex-special"],
        sharedStackGroup: "14137-buff",
        triggerSkillTypes: ["ex", "ex-special"],
        sourceNote: "에테르 피해와 같은 스택을 공유",
      },
    ),
  ]),
  defineWeapon("14147", "성난 눈의 금강", "명파", "타오르는 업화", [
    always(
      "crit",
      "치명타 확률",
      "critRate",
      values(20, 23, 26, 29, 32),
      { mode: "mingpo", sourceNote: "상시 적용" },
    ),
    stacks(
      "fire-sheer",
      "불 관입 피해",
      "penetrationDamageBonus",
      values(9, 10.35, 11.7, 13.05, 14.4),
      2,
      {
        mode: "mingpo",
        element: "불",
        triggerSkillTypes: ["ex", "ex-special"],
        sourceNote: "강화 특수 스킬 시전 시 스택, 스택별 20초",
      },
    ),
  ]),
  defineWeapon("14153", "별빛 기사의 가면", "명파", "기사의 기세", [
    always(
      "crit",
      "치명타 확률",
      "critRate",
      values(20, 23, 26, 29, 32),
      { mode: "mingpo", sourceNote: "상시 적용" },
    ),
    stacks(
      "physical-sheer",
      "물리 관입 피해",
      "penetrationDamageBonus",
      values(10, 11.5, 13, 14.5, 16),
      2,
      {
        mode: "mingpo",
        element: "물리",
        triggerSkillTypes: ["special"],
        sourceNote: "특수 스킬 시전 시 스택, 30초",
      },
    ),
  ]),
];

const ANOMALY_WEAPONS = [
  defineWeapon("13003", "우림의 식객", "이상", "식사시간이야!", [
    stacks(
      "attack",
      "공격력 증가",
      "attackPercent",
      values(2.5, 2.8, 3.2, 3.6, 4),
      10,
      {
        condition: "consume-10-energy-per-stack",
        sourceNote: "에너지 10pt 소비마다 스택, 스택별 10초",
      },
    ),
  ]),
  defineWeapon("13008", "쌍둥이의 눈물", "이상", "구슬픈 여음", [
    stacks(
      "anomaly-proficiency",
      "이상 마스터리",
      "anomalyProficiency",
      values(30, 34, 38, 42, 48),
      4,
      {
        mode: "anomaly",
        condition: "party-inflicts-anomaly",
        sourceNote: "파티원이 속성 이상 부여 시 스택, 그로기 회복/처치 시 해제",
      },
    ),
  ]),
  defineWeapon("13009", "감전 립글로스", "이상", "치명적인 입맞춤", [
    toggle(
      "attack",
      "공격력 증가",
      "attackPercent",
      values(10, 11.5, 13, 14.5, 16),
      {
        condition: "anomalous-enemy-on-field",
        sourceNote: "필드에 속성 이상 상태의 적이 있을 때",
      },
    ),
    toggle(
      "damage",
      "속성 이상 대상 피해",
      "damageBonus",
      values(15, 17.5, 20, 22.5, 25),
      {
        condition: "target-anomaly",
        sourceNote: "속성 이상 상태의 대상에게 적용",
      },
    ),
  ]),
  defineWeapon("13018", "둥둥 메아리", "이상", "낭랑한 북소리", [
    unsupported(
      "energy",
      "난류 발동 에너지 회복",
      values(2, 2.3, 2.6, 2.9, 3.2),
      "에너지 회복은 단일 피해 스냅샷에 환산할 수 없습니다.",
      {
        mode: "anomaly",
        unit: "flat",
        triggerAnomalyKey: "난류",
        sourceNote: "난류 발동 시, 재사용 10초",
      },
    ),
    toggle(
      "damage",
      "속성 이상 대상 피해",
      "damageBonus",
      values(11.5, 13.2, 15, 16.7, 18.4),
      {
        condition: "target-anomaly",
        sourceNote: "속성 이상 상태의 대상에게 적용",
      },
    ),
  ]),
  defineWeapon("13128", "뛰뛰빵빵", "이상", "충돌 위치 에너지", [
    toggle(
      "random-attack",
      "랜덤 버프 공격력",
      "attackPercent",
      values(8, 9.2, 10.4, 11.6, 12.8),
      {
        triggerSkillTypes: ["ex", "ex-special"],
        condition: "random-one-of-three",
        sourceNote: "강화 특수 스킬 명중 시 3종 중 무작위, 최대 조건은 3종 동시 유지",
      },
    ),
    toggle(
      "random-proficiency",
      "랜덤 버프 이상 마스터리",
      "anomalyProficiency",
      values(40, 46, 52, 58, 64),
      {
        mode: "anomaly",
        triggerSkillTypes: ["ex", "ex-special"],
        condition: "random-one-of-three",
        sourceNote: "같은 종류 중첩 불가, 서로 다른 종류는 동시 유지 가능",
      },
    ),
    unsupported(
      "random-buildup",
      "랜덤 버프 이상 축적 효율",
      values(25, 28, 32, 36, 40),
      "속성 이상 축적 효율은 단일 이상 피해량에 포함되지 않습니다.",
      {
        mode: "anomaly",
        triggerSkillTypes: ["ex", "ex-special"],
        condition: "random-one-of-three",
        sourceNote: "5초, 재사용 0.3초",
      },
    ),
  ]),
  defineWeapon("14109", "싸락눈 내린 별각", "이상", "서리로 물든 별", [
    always(
      "crit-damage",
      "치명타 피해",
      "critDamage",
      values(50, 57, 65, 72, 80),
      { sourceNote: "상시 적용" },
    ),
    stacks(
      "ice-damage",
      "얼음 피해",
      "damageBonus",
      values(20, 23, 26, 29, 32),
      2,
      {
        element: "얼음",
        triggerSkillTypes: ["ex", "ex-special"],
        condition: "ex-or-party-anomaly",
        sourceNote: "강화 특수 스킬 또는 파티 속성 이상 부여 시, 스택별 15초",
      },
    ),
  ]),
  defineWeapon("14117", "타오르는 셰이커", "이상", "퓨엘 주입", [
    unsupported(
      "off-field-energy",
      "대기 중 에너지 자동 회복",
      values(0.6, 0.75, 0.9, 1.05, 1.2),
      "에너지 회복은 단일 피해 스냅샷에 환산할 수 없습니다.",
      {
        unit: "per-second",
        condition: "off-field",
        sourceNote: "초당 에너지 회복",
      },
    ),
    stacks(
      "damage",
      "피해 증가",
      "damageBonus",
      values(3.5, 4.4, 5.2, 6.1, 7),
      10,
      {
        maxActivationMultiplier: 2,
        triggerSkillTypes: ["ex", "ex-special", "assist", "assist-attack"],
        sourceNote: "강화 특수/지원 공격 명중 시, 대기 중 스택 효과 2배",
      },
    ),
    toggle(
      "proficiency",
      "5스택 이상 이상 마스터리",
      "anomalyProficiency",
      values(50, 62, 75, 87, 100),
      {
        mode: "anomaly",
        thresholdStacks: 5,
        sourceNote: "피해 증가 효과가 5스택 이상이면 6초",
      },
    ),
  ]),
  defineWeapon("14118", "감입 컴파일러", "이상", "데이터 홍수", [
    always(
      "attack",
      "공격력 증가",
      "attackPercent",
      values(12, 15, 18, 21, 24),
      { sourceNote: "상시 적용" },
    ),
    stacks(
      "proficiency",
      "이상 마스터리",
      "anomalyProficiency",
      values(25, 31, 37, 43, 50),
      3,
      {
        mode: "anomaly",
        triggerSkillTypes: ["special", "ex", "ex-special"],
        sourceNote: "특수/강화 특수 스킬 시전 시, 스택별 8초",
      },
    ),
  ]),
  defineWeapon("14122", "시류의 현자", "이상", "시간을 삼키는 계책", [
    unsupported(
      "electric-buildup",
      "전기 이상 축적 효율",
      values(30, 35, 40, 45, 50),
      "속성 이상 축적 효율은 단일 이상 피해량에 포함되지 않습니다.",
      {
        mode: "anomaly",
        element: "전기",
        sourceNote: "상시 적용",
      },
    ),
    toggle(
      "proficiency",
      "이상 마스터리",
      "anomalyProficiency",
      values(75, 85, 95, 105, 115),
      {
        mode: "anomaly",
        triggerSkillTypes: ["special", "ex", "ex-special"],
        condition: "target-anomaly",
        sourceNote: "속성 이상 상태의 적에게 특수/강화 특수 명중 후 15초",
      },
    ),
    unsupported(
      "disorder-damage",
      "혼돈 피해 증가",
      values(25, 27.5, 30, 32.5, 35),
      "혼돈 전용 피해식과 이상 마스터리 375pt 임계 조건이 연결되지 않았습니다.",
      {
        mode: "anomaly",
        anomalyKey: "혼돈",
        condition: "anomaly-proficiency-at-least-375",
        sourceNote: "이상 마스터리 375pt 이상일 때 혼돈 피해에 적용",
      },
    ),
  ]),
  defineWeapon("14126", "예리한 집게칼", "이상", "제멋대로 수렵심", [
    stacks(
      "physical-damage",
      "물리 피해",
      "damageBonus",
      values(12, 15, 18, 21, 24),
      3,
      {
        element: "물리",
        triggerSkillTypes: ["dash"],
        sourceNote: "대시 공격으로 스택, 교전 진입/극한 회피 시 3스택",
      },
    ),
    unsupported(
      "buildup",
      "3스택 이상 축적 효율",
      values(40, 50, 60, 70, 80),
      "속성 이상 축적 효율은 단일 이상 피해량에 포함되지 않습니다.",
      {
        mode: "anomaly",
        thresholdStacks: 3,
        sourceNote: "수렵심 최대 스택일 때 적용",
      },
    ),
  ]),
  defineWeapon("14133", "별빛 꿈을 누비는 새", "이상", "은빛 가시와 날개", [
    unsupported(
      "buildup",
      "이상 축적 효율",
      values(40, 46, 52, 58, 64),
      "속성 이상 축적 효율은 단일 이상 피해량에 포함되지 않습니다.",
      { mode: "anomaly", sourceNote: "상시 적용" },
    ),
    stacks(
      "proficiency",
      "이상 마스터리",
      "anomalyProficiency",
      values(20, 23, 26, 29, 32),
      6,
      {
        mode: "anomaly",
        triggerElement: "에테르",
        sourceNote: "에테르 피해를 줄 때 스택, 5초",
      },
    ),
  ]),
  defineWeapon("14140", "완벽하게 단조된 별", "이상", "무수한 별을 줄게", [
    always(
      "mastery-flat",
      "이상 장악력",
      "anomalyMasteryFlat",
      values(60, 69, 78, 87, 96),
      {
        unit: "flat",
        sourceNote: "상시 고정 수치 증가(%가 아님)",
      },
    ),
    stacks(
      "physical-damage",
      "물리 피해",
      "damageBonus",
      values(20, 23, 26, 29, 32),
      2,
      {
        element: "물리",
        triggerAnomalyKey: "강타",
        sourceNote: "강타 발동 시 스택, 교전 진입 시 즉시 2스택",
      },
    ),
  ]),
  defineWeapon("14150", "껍데기 속 영혼", "이상", "활기찬 일격", [
    always(
      "proficiency",
      "이상 마스터리",
      "anomalyProficiency",
      values(90, 103, 117, 130, 144),
      { mode: "anomaly", unit: "flat", sourceNote: "상시 적용" },
    ),
    toggle(
      "anomalous-target-damage",
      "속성 이상 대상 피해",
      "damageBonus",
      values(20, 23, 26, 29, 32),
      {
        element: "에테르",
        condition: "on-field-special-or-ex-and-target-anomaly",
        sourceNote: "에테르 착용자가 출전/특수/강화 특수 시전 후 15초",
      },
    ),
    toggle(
      "anomaly-damage",
      "속성 이상·혼돈 피해",
      "anomalyDamageBonus",
      values(10, 11.5, 13, 14.5, 16),
      {
        mode: "anomaly",
        element: "에테르",
        condition: "on-field-special-or-ex",
        sourceNote: "모든 속성 이상 및 혼돈 피해에 적용",
      },
    ),
  ]),
  defineWeapon("14154", "삭월에 끊어지는 서리", "이상", "종말의 심판", [
    stacks(
      "ice-damage",
      "얼음 피해",
      "damageBonus",
      values(20, 23, 26, 29, 32),
      2,
      {
        element: "얼음",
        triggerSkillTypes: ["special", "ex", "ex-special"],
        sharedStackGroup: "14154-buff",
        sourceNote: "얼음 착용자의 특수/강화 특수 스킬로 스택, 40초",
      },
    ),
    toggle(
      "abloom-damage",
      "난개 피해",
      "anomalyDamageBonus",
      values(35, 38.5, 42, 45.5, 50),
      {
        mode: "anomaly",
        element: "얼음",
        anomalyKey: "난개",
        thresholdStacks: 2,
        sharedStackGroup: "14154-buff",
        sourceNote: "공유 버프 2스택일 때 난개 피해에 추가 적용",
      },
    ),
  ]),
  defineWeapon("14156", "영롱한 금빛 마음", "이상", "빈틈없는 예의", [
    always(
      "proficiency",
      "이상 마스터리",
      "anomalyProficiency",
      values(70, 80, 90, 100, 110),
      { mode: "anomaly", unit: "flat", sourceNote: "상시 적용" },
    ),
    stacks(
      "wind-anomaly-damage",
      "난류·풍화 피해",
      "anomalyDamageBonus",
      values(7, 8, 9, 10, 11),
      2,
      {
        mode: "anomaly",
        element: "바람",
        anomalyKey: ["난류", "풍화"],
        triggerSkillTypes: ["ex", "ex-special"],
        triggerElement: "바람",
        sharedStackGroup: "14156-buff",
        sourceNote: "바람 강화 특수 스킬로 스택, 40초",
      },
    ),
    toggle(
      "party-proficiency",
      "2스택 파티 이상 마스터리",
      "anomalyProficiency",
      values(60, 69, 78, 87, 96),
      {
        mode: "anomaly",
        element: "바람",
        thresholdStacks: 2,
        sharedStackGroup: "14156-buff",
        sourceNote: "공유 버프 2스택일 때 파티 전체(착용자 포함)에 적용",
      },
    ),
  ]),
];

export const WEAPON_PASSIVES = Object.freeze(
  Object.fromEntries(
    [...STRONG_WEAPONS, ...MINGPO_WEAPONS, ...ANOMALY_WEAPONS].map(
      (entry) => [entry.id, entry],
    ),
  ),
);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function asArray(value) {
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function intersects(left, right) {
  const rightSet = new Set(right.map(String));
  return left.map(String).some((value) => rightSet.has(value));
}

function scopeMismatch(entry, context) {
  if (entry.mode && context.mode !== entry.mode) return "mode";

  if (entry.element) {
    const expected = asArray(entry.element);
    const selected = asArray(context.element);
    if (selected.length === 0 || !intersects(expected, selected)) {
      return "element";
    }
  }

  if (entry.anomalyKey) {
    const expected = asArray(entry.anomalyKey);
    const selected = asArray(context.anomalyKey);
    if (selected.length === 0 || !intersects(expected, selected)) {
      return "anomalyKey";
    }
  }

  if (entry.skillTypes.length > 0) {
    const selected = asArray(context.skillType);
    if (selected.length === 0 || !intersects(entry.skillTypes, selected)) {
      return "skillType";
    }
  }

  if (
    entry.characterId &&
    String(context.characterId ?? "") !== entry.characterId
  ) {
    return "characterId";
  }

  return null;
}

function emptyTotals() {
  return Object.fromEntries(
    WEAPON_PASSIVE_SUPPORTED_STATS.map((stat) => [stat, 0]),
  );
}

export function getWeaponPassive(weaponId) {
  return WEAPON_PASSIVES[String(weaponId)] ?? null;
}

/**
 * Resolve a live 3.0 W-Engine passive at refinement R1-R5.
 *
 * Always-on rows apply immediately. Conditional/timed/stacked rows only
 * apply when context.maxActivation is true; this intentionally represents a
 * snapshot maximum rather than claiming rotation uptime. Trigger metadata is
 * preserved separately from skillTypes, which scopes the hit being compared.
 */
export function resolveWeaponPassiveEffects(
  weaponId,
  refinement = 1,
  context = {},
) {
  const passive = getWeaponPassive(weaponId);
  const selectedRefinement = clamp(
    Math.trunc(Number(refinement) || 1),
    1,
    5,
  );
  const totals = emptyTotals();

  if (!passive) {
    return {
      weaponId: String(weaponId),
      refinement: selectedRefinement,
      title: "",
      description: "",
      applied: [],
      unsupported: [],
      skipped: [],
      totals,
    };
  }

  const applied = [];
  const unsupportedRows = [];
  const skipped = [];

  for (const row of passive.effects) {
    const selected = {
      ...row,
      value: row.values[selectedRefinement - 1],
      refinement: selectedRefinement,
    };
    const mismatch = scopeMismatch(selected, context);
    if (mismatch) {
      skipped.push({ ...selected, skippedReason: `scope:${mismatch}` });
      continue;
    }

    if (
      selected.stat === "unsupported" ||
      !SUPPORTED_STATS.has(selected.stat)
    ) {
      unsupportedRows.push(selected);
      continue;
    }

    if (!VALID_ACTIVATIONS.has(selected.activation)) {
      unsupportedRows.push({
        ...selected,
        reason: `지원하지 않는 activation "${selected.activation}"`,
      });
      continue;
    }

    if (
      selected.activation !== "always" &&
      !Boolean(context.maxActivation)
    ) {
      skipped.push({ ...selected, skippedReason: "inactive" });
      continue;
    }

    const activeStacks =
      selected.activation === "stacks" ? selected.maxStacks : 1;
    const activationMultiplier =
      selected.activation === "always"
        ? 1
        : Boolean(context.maxActivation)
          ? selected.maxActivationMultiplier
          : 1;
    const amount = selected.value * activeStacks * activationMultiplier;
    totals[selected.stat] += amount;
    applied.push({
      ...selected,
      activeStacks,
      activationMultiplier,
      amount,
    });
  }

  return {
    weaponId: passive.id,
    refinement: selectedRefinement,
    title: passive.title,
    description:
      passive.refinements[selectedRefinement - 1]?.description ?? "",
    applied,
    unsupported: unsupportedRows,
    skipped,
    totals,
  };
}
