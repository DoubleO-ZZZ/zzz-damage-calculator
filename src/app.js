import {
  ADDITIONAL_MULTIPLIER_LOOKUPS,
  ALICE_ADDITIONAL_COEFFICIENTS,
  DEFAULT_ANOMALY_DEALERS,
  DISORDER_COEFFICIENTS,
  MAIN_ANOMALY_SLOT_DEFAULTS,
  MINGPO_DEFAULTS,
  NANKAI_CHARACTER_COEFFICIENTS,
  NANKAI_DEFAULT_SELECTIONS,
  NORMAL_ANOMALY_COEFFICIENTS,
  RADIANCE_SKILL_COEFFICIENTS,
  REMIEL_DEFAULTS,
  REMIEL_ENGINE_DAMAGE_BONUS,
  REMIEL_RADIANCE_DAMAGE_DEFAULTS,
  RESISTANCE_SCENARIO_MODIFIERS,
  STRONG_ATTACK_DEFAULTS,
  TURBULENCE_COEFFICIENTS,
  calculateAnomalyCoefficient,
  calculateDealerStats,
  calculateMainAnomalyDamage,
  calculateMingpo,
  calculateRemielRadianceDamage,
  calculateStrongAttack,
  getAdditionalMultiplier,
  getAliceAdditionalCoefficient,
} from "./calculators.js";
import { initComparison } from "./comparison.js";

const STORAGE_KEY = "new-eridu-combat-lab:v1";
const ELEMENTS = Object.keys(NORMAL_ANOMALY_COEFFICIENTS);
const RESISTANCE_SCENARIOS = Object.keys(RESISTANCE_SCENARIO_MODIFIERS);
const ANOMALY_KEYS = [
  ...ELEMENTS,
  "혼돈",
  ...ELEMENTS.map((element) => `${element}난개`),
  ...Object.keys(TURBULENCE_COEFFICIENTS).map(
    (element) => `${element}난류`,
  ),
];

const clone = (value) =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

const DEFAULT_STATE = {
  version: 2,
  ui: {
    activeTab: "compare",
    activeDetailTab: "strong",
  },
  strong: clone(STRONG_ATTACK_DEFAULTS),
  mingpo: clone(MINGPO_DEFAULTS),
  anomaly: {
    dealers: clone(DEFAULT_ANOMALY_DEALERS),
    slots: clone(MAIN_ANOMALY_SLOT_DEFAULTS),
    tools: {
      normal: {
        element: "풍화",
      },
      disorder: {
        element: "서리",
        remainingSeconds: 17,
        additionalCoefficient: 0,
      },
      turbulence: {
        element: "쇄빙",
        remainingSeconds: 13,
        additionalCoefficient: 0,
      },
      nankai: {
        character: "벨리나",
        selection: NANKAI_DEFAULT_SELECTIONS.벨리나,
        stat: NANKAI_CHARACTER_COEFFICIENTS.벨리나.defaultStat ?? 0,
      },
      additional: {
        character: "아리아",
        option: Object.keys(ADDITIONAL_MULTIPLIER_LOOKUPS.아리아)[0],
      },
      alice: {
        option: Object.keys(ALICE_ADDITIONAL_COEFFICIENTS)[0],
      },
    },
    remiel: clone(REMIEL_DEFAULTS),
    remielSlots: clone(REMIEL_RADIANCE_DAMAGE_DEFAULTS.slots),
  },
};

function mergeState(defaultValue, savedValue) {
  if (Array.isArray(defaultValue)) {
    if (!Array.isArray(savedValue)) return clone(defaultValue);
    return defaultValue.map((item, index) =>
      mergeState(item, savedValue[index]),
    );
  }

  if (
    defaultValue &&
    typeof defaultValue === "object" &&
    !Array.isArray(defaultValue)
  ) {
    const savedObject =
      savedValue && typeof savedValue === "object" && !Array.isArray(savedValue)
        ? savedValue
        : {};
    return Object.fromEntries(
      Object.entries(defaultValue).map(([key, value]) => [
        key,
        mergeState(value, savedObject[key]),
      ]),
    );
  }

  if (savedValue === undefined) return defaultValue;
  if (typeof defaultValue === "number") {
    const numeric = savedValue === "" ? Number.NaN : Number(savedValue);
    return Number.isFinite(numeric) ? numeric : defaultValue;
  }
  if (typeof defaultValue === "boolean") {
    if (savedValue === true || savedValue === "true") return true;
    if (savedValue === false || savedValue === "false") return false;
    return defaultValue;
  }
  if (typeof defaultValue === "string") {
    return typeof savedValue === "string" ? savedValue : defaultValue;
  }
  return savedValue;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    const merged = mergeState(DEFAULT_STATE, saved);
    if ((saved?.version ?? 1) < 2) {
      if (["strong", "mingpo", "anomaly"].includes(saved?.ui?.activeTab)) {
        merged.ui.activeDetailTab = saved.ui.activeTab;
      }
      merged.version = 2;
      merged.ui.activeTab = "compare";
    }
    return merged;
  } catch {
    return clone(DEFAULT_STATE);
  }
}

let state = loadState();
const invalidInputs = new Set();

function invalidKey(model, path) {
  return `${model}:${path}`;
}

function hasInvalidInput(...models) {
  return [...invalidInputs].some((key) =>
    models.some((model) => key.startsWith(`${model}:`)),
  );
}

function clearInvalidInputsFor(...models) {
  [...invalidInputs].forEach((key) => {
    if (models.some((model) => key.startsWith(`${model}:`))) {
      invalidInputs.delete(key);
    }
  });
}

function firstKey(object) {
  return Object.keys(object)[0];
}

function isChoice(value, choices) {
  return choices.includes(value);
}

function normalizeStateChoices() {
  if (!["compare", "details"].includes(state.ui.activeTab)) {
    state.ui.activeTab = "compare";
  }
  if (!["strong", "mingpo", "anomaly"].includes(state.ui.activeDetailTab)) {
    state.ui.activeDetailTab = "strong";
  }

  state.anomaly.dealers.A.id = "A";
  state.anomaly.dealers.B.id = "B";

  state.anomaly.slots.forEach((slot, index) => {
    const defaults = MAIN_ANOMALY_SLOT_DEFAULTS[index];
    if (!isChoice(slot.snapshotDealer, ["A", "B"])) {
      slot.snapshotDealer = defaults.snapshotDealer;
    }
    if (!isChoice(slot.realtimeDealer, ["A", "B"])) {
      slot.realtimeDealer = defaults.realtimeDealer;
    }
    if (!isChoice(slot.anomalyKey, ANOMALY_KEYS)) {
      slot.anomalyKey = defaults.anomalyKey;
    }
    if (!isChoice(slot.resistanceScenario, RESISTANCE_SCENARIOS)) {
      slot.resistanceScenario = defaults.resistanceScenario;
    }
  });

  const tools = state.anomaly.tools;
  if (!isChoice(tools.normal.element, ELEMENTS)) {
    tools.normal.element = "풍화";
  }
  if (!isChoice(tools.disorder.element, Object.keys(DISORDER_COEFFICIENTS))) {
    tools.disorder.element = "서리";
  }
  if (
    !isChoice(
      tools.turbulence.element,
      Object.keys(TURBULENCE_COEFFICIENTS),
    )
  ) {
    tools.turbulence.element = "쇄빙";
  }

  if (!(tools.nankai.character in NANKAI_CHARACTER_COEFFICIENTS)) {
    tools.nankai.character = "벨리나";
  }
  const nankaiConfig =
    NANKAI_CHARACTER_COEFFICIENTS[tools.nankai.character];
  if (!(tools.nankai.selection in nankaiConfig.values)) {
    tools.nankai.selection =
      NANKAI_DEFAULT_SELECTIONS[tools.nankai.character] ??
      firstKey(nankaiConfig.values);
  }
  if (!Number.isFinite(Number(tools.nankai.stat))) {
    tools.nankai.stat = nankaiConfig.defaultStat ?? 0;
  }

  if (!(tools.additional.character in ADDITIONAL_MULTIPLIER_LOOKUPS)) {
    tools.additional.character = firstKey(ADDITIONAL_MULTIPLIER_LOOKUPS);
  }
  const additionalOptions =
    ADDITIONAL_MULTIPLIER_LOOKUPS[tools.additional.character];
  if (!(tools.additional.option in additionalOptions)) {
    tools.additional.option = firstKey(additionalOptions);
  }
  if (!(tools.alice.option in ALICE_ADDITIONAL_COEFFICIENTS)) {
    tools.alice.option = firstKey(ALICE_ADDITIONAL_COEFFICIENTS);
  }

  if (!(state.anomaly.remiel.skill in RADIANCE_SKILL_COEFFICIENTS)) {
    state.anomaly.remiel.skill = REMIEL_DEFAULTS.skill;
  }
  if (
    !Object.hasOwn(
      RADIANCE_SKILL_COEFFICIENTS[state.anomaly.remiel.skill],
      state.anomaly.remiel.skillLevel,
    )
  ) {
    state.anomaly.remiel.skillLevel = REMIEL_DEFAULTS.skillLevel;
  }
  if (!(state.anomaly.remiel.engine in REMIEL_ENGINE_DAMAGE_BONUS)) {
    state.anomaly.remiel.engine = REMIEL_DEFAULTS.engine;
  }
  if (
    !isChoice(
      state.anomaly.remiel.resistanceScenario,
      RESISTANCE_SCENARIOS,
    )
  ) {
    state.anomaly.remiel.resistanceScenario =
      REMIEL_DEFAULTS.resistanceScenario;
  }
  state.anomaly.remielSlots.forEach((slot, index) => {
    const defaults = REMIEL_RADIANCE_DAMAGE_DEFAULTS.slots[index];
    if (!isChoice(slot.snapshotDealer, ["A", "B"])) {
      slot.snapshotDealer = defaults.snapshotDealer;
    }
    if (!isChoice(slot.resistanceScenario, RESISTANCE_SCENARIOS)) {
      slot.resistanceScenario = defaults.resistanceScenario;
    }
  });
}

normalizeStateChoices();

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 공간이 차단되어도 계산 기능은 계속 사용할 수 있다.
  }
}

const numberField = (key, label, unit = "", hint = "") => ({
  key,
  label,
  unit,
  hint,
  type: "number",
});

const selectField = (key, label, options, hint = "") => ({
  key,
  label,
  options,
  hint,
  type: "select",
});

const booleanField = (
  key,
  label,
  trueLabel = "적용",
  falseLabel = "미적용",
  hint = "",
) => ({
  key,
  label,
  trueLabel,
  falseLabel,
  hint,
  type: "boolean",
});

const STRONG_SECTIONS = [
  {
    title: "공격력",
    description: "캐릭터·엔진·디스크의 마을 공격력과 전투 버프",
    fields: [
      numberField("characterBaseAttack", "캐릭터 기초 공격력"),
      numberField("engineBaseAttack", "엔진 기초 공격력"),
      numberField("engineAttackPercent", "엔진 공격력", "%"),
      numberField("discAttackPercent", "디스크 공격력", "%"),
      numberField("flatAttackRolls", "깡공 유효 횟수", "회"),
      numberField("attackPercentBuff", "전투 중 공격력 버프", "%"),
      numberField("flatAttackBuff", "전투 중 깡공 버프"),
    ],
  },
  {
    title: "스킬 · 치명타",
    description: "스킬 계수와 치명타 확률·피해 보정",
    fields: [
      numberField("skillCoefficientPercent", "스킬 계수", "%"),
      numberField("criticalChancePercent", "치명타 확률", "%"),
      numberField("selfCriticalDamagePercent", "본인 치명타 피해", "%"),
      numberField("support1CriticalDamagePercent", "지원 1 치명타 피해", "%"),
      numberField("support2CriticalDamagePercent", "지원 2 치명타 피해", "%"),
      numberField("assaultCriticalDamagePercent", "강공 치명타 피해", "%"),
      numberField("gimmickCriticalDamagePercent", "기믹 치명타 피해", "%"),
      numberField("criticalDamageReductionPercent", "치명타 피해 감소", "%"),
    ],
  },
  {
    title: "방어 · 관통",
    description: "적 방어력과 방어 감소·관통 적용값",
    fields: [
      numberField("enemyDefense", "적 방어력"),
      numberField("enemyDefenseIncreasePercent", "적 방어력 증가", "%"),
      numberField("enemyDefenseReductionPercent", "적 방어력 감소", "%"),
      numberField("penetrationPercent", "관통률", "%"),
      numberField("penetrationValue", "관통 수치"),
    ],
  },
  {
    title: "저항",
    description: "속성 저항 감소·무시와 적 저항",
    fields: [
      numberField("resistanceReductionPercent", "저항 감소", "%"),
      numberField("resistanceIgnorePercent", "저항 무시", "%"),
      numberField("enemyResistancePercent", "적 저항", "%"),
    ],
  },
  {
    title: "피해 보너스",
    description: "출처별 피해 증가를 합산합니다.",
    fields: [
      numberField("selfDamageBonusPercent", "본인 피해 보너스", "%"),
      numberField("support1DamageBonusPercent", "지원 1 피해 보너스", "%"),
      numberField("support2DamageBonusPercent", "지원 2 피해 보너스", "%"),
      numberField("assaultDamageBonusPercent", "강습 피해 보너스", "%"),
      numberField("otherDamageBonusPercent", "기타 피해 보너스", "%"),
    ],
  },
  {
    title: "그로기 · 받는 피해",
    description: "그로기 배율과 적이 받는 피해 보정",
    fields: [
      numberField("baseStunMultiplierPercent", "기본 그로기 배율", "%"),
      numberField(
        "additionalStunMultiplierPercent",
        "추가 그로기 배율",
        "%",
      ),
      numberField("receivedDamageIncreasePercent", "받는 피해 증가", "%"),
      numberField("receivedDamageReductionPercent", "받는 피해 감소", "%"),
    ],
  },
];

const MINGPO_SECTIONS = [
  {
    title: "공격력",
    description: "관입력의 공격력 기여분을 계산합니다.",
    fields: [
      numberField("characterBaseAttack", "캐릭터 기초 공격력"),
      numberField("engineBaseAttack", "엔진 기초 공격력"),
      numberField("engineAttackPercent", "엔진 공격력", "%"),
      numberField("discAttackPercent", "디스크 공격력", "%"),
      numberField("flatAttackRolls", "깡공 유효 횟수", "회"),
      numberField("attackPercentBuff", "전투 중 공격력 버프", "%"),
      numberField("flatAttackBuff", "전투 중 깡공 버프"),
    ],
  },
  {
    title: "체력",
    description: "관입력의 체력 기여분을 계산합니다.",
    fields: [
      numberField("characterBaseHp", "캐릭터 기초 체력"),
      numberField("engineHpPercent", "엔진 체력", "%"),
      numberField("discHpPercent", "디스크 체력", "%"),
      numberField("flatHpRolls", "깡체력 유효 횟수", "회"),
      numberField("hpPercentBuff", "전투 중 체력 버프", "%"),
    ],
  },
  {
    title: "관입력 · 스킬",
    description: "관입력 버프와 명파 스킬 배율",
    fields: [
      numberField("flatPenetrationBuff", "전투 중 관입력 버프"),
      numberField(
        "penetrationDamageBonusPercent",
        "관입력 피해 보너스",
        "%",
      ),
      numberField("skillCoefficientPercent", "스킬 계수", "%"),
    ],
  },
  {
    title: "피해 보너스",
    description: "출처별 피해 증가를 합산합니다.",
    fields: [
      numberField("selfDamageBonusPercent", "본인 피해 보너스", "%"),
      numberField("support1DamageBonusPercent", "지원 1 피해 보너스", "%"),
      numberField("support2DamageBonusPercent", "지원 2 피해 보너스", "%"),
      numberField("assaultDamageBonusPercent", "강습 피해 보너스", "%"),
      numberField("otherDamageBonusPercent", "기타 피해 보너스", "%"),
    ],
  },
  {
    title: "치명타",
    description: "치명타 확률과 피해 보정",
    fields: [
      numberField("criticalChancePercent", "치명타 확률", "%"),
      numberField("selfCriticalDamagePercent", "본인 치명타 피해", "%"),
      numberField("support1CriticalDamagePercent", "지원 1 치명타 피해", "%"),
      numberField("support2CriticalDamagePercent", "지원 2 치명타 피해", "%"),
      numberField("assaultCriticalDamagePercent", "강공 치명타 피해", "%"),
      numberField("gimmickCriticalDamagePercent", "기믹 치명타 피해", "%"),
      numberField("criticalDamageReductionPercent", "치명타 피해 감소", "%"),
    ],
  },
  {
    title: "저항 · 그로기",
    description: "저항, 그로기, 받는 피해 보정",
    fields: [
      numberField("resistanceReductionPercent", "저항 감소", "%"),
      numberField("resistanceIgnorePercent", "저항 무시", "%"),
      numberField("enemyResistancePercent", "적 저항", "%"),
      numberField("baseStunMultiplierPercent", "기본 그로기 배율", "%"),
      numberField(
        "additionalStunMultiplierPercent",
        "추가 그로기 배율",
        "%",
      ),
      numberField("receivedDamageIncreasePercent", "받는 피해 증가", "%"),
      numberField("receivedDamageReductionPercent", "받는 피해 감소", "%"),
    ],
  },
];

const DEALER_GROUPS = [
  {
    title: "공격력",
    open: true,
    fields: [
      numberField("characterBaseAttack", "캐릭터 기초 공격력"),
      numberField("engineBaseAttack", "엔진 기초 공격력"),
      numberField("engineAttackPercent", "엔진 공격력", "%"),
      numberField("discAttackPercent", "디스크 공격력", "%"),
      numberField("flatAttackRolls", "깡공 유효 횟수", "회"),
      numberField("attackPercentBuff", "전투 중 공격력 버프", "%"),
      numberField("flatAttackBuff", "전투 중 깡공 버프"),
    ],
  },
  {
    title: "방어 · 관통",
    fields: [
      numberField("enemyDefense", "적 방어력"),
      numberField("enemyDefenseIncreasePercent", "적 방어력 증가", "%"),
      numberField("enemyDefenseReductionPercent", "적 방어력 감소", "%"),
      numberField("penetrationPercent", "관통률", "%"),
      numberField("penetrationValue", "관통 수치"),
    ],
  },
  {
    title: "저항",
    fields: [
      numberField("resistanceReductionPercent", "저항 감소", "%"),
      numberField("resistanceIgnorePercent", "저항 무시", "%"),
      numberField(
        "assaultResistanceReductionPercent",
        "강습 저항 감소",
        "%",
      ),
    ],
  },
  {
    title: "피해 보너스",
    fields: [
      numberField("selfDamageBonusPercent", "본인 피해 보너스", "%"),
      numberField("support1DamageBonusPercent", "지원 1 피해 보너스", "%"),
      numberField("support2DamageBonusPercent", "지원 2 피해 보너스", "%"),
      numberField("assaultDamageBonusPercent", "강습 피해 보너스", "%"),
      numberField("otherDamageBonusPercent", "기타 피해 보너스", "%"),
    ],
  },
  {
    title: "이상 피해 보너스",
    fields: [
      numberField(
        "baseAnomalyDamageBonusPercent",
        "기본 이상 피해 보너스",
        "%",
      ),
      numberField(
        "assaultAnomalyDamageBonusPercent",
        "강습 이상 피해 보너스",
        "%",
      ),
      numberField(
        "assaultDisorderDamageBonusPercent",
        "강공 혼돈 피해 보너스",
        "%",
      ),
      numberField(
        "disseminationDamageBonusPercent",
        "난개 피해 보너스",
        "%",
      ),
      numberField(
        "turbulenceDamageBonusPercent",
        "난류 피해 보너스",
        "%",
      ),
    ],
  },
  {
    title: "속성별 피해 보너스",
    fields: ELEMENTS.map((element) =>
      numberField(
        `elementDamageBonusPercent.${element}`,
        `${element} 피해 보너스`,
        "%",
      ),
    ),
  },
  {
    title: "변이",
    fields: [
      numberField(
        "lumenAnomalyProficiency",
        "루멘 속성 이상 마스터리",
      ),
      numberField(
        "mutationPercentPerProficiency",
        "이상 마스터리 1pt당 증가",
        "%",
      ),
      numberField("additionalMutationPercent", "추가 변이 계수", "%"),
      booleanField("lumenIncluded", "루멘 편성", "편성", "미편성"),
    ],
  },
  {
    title: "이상 마스터리 · 그로기",
    fields: [
      numberField("townAnomalyProficiency", "마을 이상 마스터리"),
      numberField(
        "selfAnomalyProficiencyBuff",
        "본인 이상 마스터리 버프",
      ),
      numberField(
        "partyAnomalyProficiencyBuff",
        "파티 이상 마스터리 버프",
      ),
      numberField(
        "assaultAnomalyProficiencyBuff",
        "강습 이상 마스터리 버프",
      ),
      booleanField("stunned", "적 상태", "그로기", "비그로기"),
      numberField("baseStunMultiplierPercent", "기본 그로기 배율", "%"),
      numberField(
        "additionalStunMultiplierPercent",
        "추가 그로기 배율",
        "%",
      ),
      numberField("attackerLevel", "공격자 레벨", "Lv."),
      numberField("receivedDamageIncreasePercent", "받는 피해 증가", "%"),
      numberField("receivedDamageReductionPercent", "받는 피해 감소", "%"),
    ],
  },
  {
    title: "이상 장악력",
    fields: [
      numberField("baseAnomalyMastery", "기초 이상 장악력"),
      numberField("anomalyMasteryPercent", "이상 장악력 증가", "%"),
      numberField("selfAnomalyMasteryBuff", "본인 이상 장악력 버프"),
      numberField("anomalyMasteryBuff", "추가 이상 장악력 버프"),
    ],
  },
];

const REMIEL_COEFFICIENT_FIELDS = [
  selectField("skill", "스킬", Object.keys(RADIANCE_SKILL_COEFFICIENTS)),
  selectField(
    "skillLevel",
    "스킬 레벨",
    Object.keys(RADIANCE_SKILL_COEFFICIENTS[REMIEL_DEFAULTS.skill]).map(Number),
  ),
  numberField("remielAnomalyProficiency", "레미엘 이상 마스터리"),
  booleanField("mindscape4", "4돌 효과", "4돌 이상", "4돌 미만"),
];

const REMIEL_GROUPS = [
  {
    title: "저항 조건",
    open: true,
    fields: [
      numberField("resistanceReductionPercent", "저항 감소", "%"),
      numberField("resistanceIgnorePercent", "저항 무시", "%"),
      numberField(
        "assaultResistanceReductionPercent",
        "강습 저항 감소",
        "%",
      ),
      booleanField("mindscape1", "1돌 효과", "1돌 이상", "1돌 미만"),
    ],
  },
  {
    title: "변이 · 이상 피해",
    fields: [
      booleanField(
        "threeAnomalyParty",
        "이상 3인 파티",
        "편성",
        "미편성",
      ),
      booleanField("mindscape2", "2돌 효과", "2돌 이상", "2돌 미만"),
      numberField(
        "mutationPercentPerProficiency",
        "이상 마스터리 1pt당 증가",
        "%",
      ),
      numberField(
        "baseAnomalyDamageMultiplier",
        "기본 이상 피해 배율",
        "×",
      ),
      numberField(
        "anomalyDamageAdjustmentPercent",
        "이상 피해 보정",
        "%",
      ),
      numberField(
        "assaultAnomalyDamageBonusPercent",
        "강습 이상 피해 보너스",
        "%",
      ),
      selectField(
        "engine",
        "엔진",
        Object.keys(REMIEL_ENGINE_DAMAGE_BONUS),
      ),
    ],
  },
  {
    title: "그로기 · 받는 피해",
    fields: [
      booleanField("stunned", "적 상태", "그로기", "비그로기"),
      numberField("baseStunMultiplierPercent", "기본 그로기 배율", "%"),
      numberField(
        "additionalStunMultiplierPercent",
        "추가 그로기 배율",
        "%",
      ),
      numberField("receivedDamageIncreasePercent", "받는 피해 증가", "%"),
      numberField("receivedDamageReductionPercent", "받는 피해 감소", "%"),
    ],
  },
];

const dom = {
  strongFields: document.querySelector("#strong-fields"),
  strongResult: document.querySelector("#strong-result"),
  strongRaw: document.querySelector("#strong-raw"),
  strongMetrics: document.querySelector("#strong-metrics"),
  mingpoFields: document.querySelector("#mingpo-fields"),
  mingpoResult: document.querySelector("#mingpo-result"),
  mingpoRaw: document.querySelector("#mingpo-raw"),
  mingpoMetrics: document.querySelector("#mingpo-metrics"),
  dealerFields: document.querySelector("#anomaly-dealer-fields"),
  anomalySlots: document.querySelector("#anomaly-damage-slots"),
  coefficientTools: document.querySelector("#anomaly-coefficient-tools"),
  radiance: document.querySelector("#radiance-calculator"),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPath(object, path) {
  return path.split(".").reduce((current, key) => current?.[key], object);
}

function setPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== "object") current[key] = {};
    return current[key];
  }, object);
  target[last] = value;
}

function normalizedOptions(options) {
  return options.map((option) =>
    typeof option === "object"
      ? option
      : {
          value: option,
          label: option,
        },
  );
}

function inputId(model, path) {
  return `field-${model}-${path}`.replace(/[^a-zA-Z0-9가-힣_-]/g, "-");
}

function renderField(field, model, values, extraClass = "") {
  const path = field.key;
  const value = getPath(values, path);
  const id = inputId(model, path);
  const errorId = `${id}-error`;
  const hint = field.hint
    ? `<span class="hint">${escapeHtml(field.hint)}</span>`
    : "";
  let control;

  if (field.type === "boolean") {
    control = `
      <select
        id="${id}"
        name="${escapeHtml(path)}"
        data-model="${escapeHtml(model)}"
        data-path="${escapeHtml(path)}"
        data-value-type="boolean"
        aria-describedby="${errorId}"
      >
        <option value="true" ${value === true ? "selected" : ""}>${escapeHtml(field.trueLabel)}</option>
        <option value="false" ${value === false ? "selected" : ""}>${escapeHtml(field.falseLabel)}</option>
      </select>
    `;
  } else if (field.type === "select") {
    control = `
      <select
        id="${id}"
        name="${escapeHtml(path)}"
        data-model="${escapeHtml(model)}"
        data-path="${escapeHtml(path)}"
        data-value-type="${typeof value === "number" ? "number" : "string"}"
        aria-describedby="${errorId}"
      >
        ${normalizedOptions(field.options)
          .map(
            (option) => `
              <option
                value="${escapeHtml(option.value)}"
                ${String(option.value) === String(value) ? "selected" : ""}
              >${escapeHtml(option.label)}</option>
            `,
          )
          .join("")}
      </select>
    `;
  } else {
    control = `
      <input
        id="${id}"
        name="${escapeHtml(path)}"
        type="number"
        step="any"
        inputmode="decimal"
        autocomplete="off"
        value="${escapeHtml(value)}"
        data-model="${escapeHtml(model)}"
        data-path="${escapeHtml(path)}"
        data-value-type="number"
        aria-describedby="${errorId}"
      />
    `;
  }

  return `
    <div class="field ${extraClass}">
      <label for="${id}">
        <span>${escapeHtml(field.label)}</span>
        ${hint}
      </label>
      <div class="control-wrap">
        ${control}
        ${field.unit ? `<span class="control-unit">${escapeHtml(field.unit)}</span>` : ""}
      </div>
      <span class="error-note" id="${errorId}" aria-live="polite"></span>
    </div>
  `;
}

function renderFieldSection(section, model, values) {
  const wide = section.fields.length > 6 ? " field-section--wide" : "";
  return `
    <section class="field-section${wide}">
      <h3>${escapeHtml(section.title)}</h3>
      <p>${escapeHtml(section.description)}</p>
      <div class="field-grid">
        ${section.fields
          .map((field) => renderField(field, model, values))
          .join("")}
      </div>
    </section>
  `;
}

function renderAccordion(group, model, values) {
  return `
    <details class="field-accordion" ${group.open ? "open" : ""}>
      <summary>${escapeHtml(group.title)}</summary>
      <div class="field-grid">
        ${group.fields
          .map((field) => renderField(field, model, values))
          .join("")}
      </div>
    </details>
  `;
}

function renderStrongFields() {
  dom.strongFields.innerHTML = STRONG_SECTIONS.map((section) =>
    renderFieldSection(section, "strong", state.strong),
  ).join("");
}

function renderMingpoFields() {
  dom.mingpoFields.innerHTML = MINGPO_SECTIONS.map((section) =>
    renderFieldSection(section, "mingpo", state.mingpo),
  ).join("");
}

function renderDealerCards() {
  dom.dealerFields.innerHTML = ["A", "B"]
    .map((dealerId) => {
      const dealer = state.anomaly.dealers[dealerId];
      return `
        <article class="dealer-card dealer-card--${dealerId.toLowerCase()}">
          <div class="dealer-card__heading">
            <div>
              <h4>딜러 ${dealerId}</h4>
              <p>${dealerId === "A" ? "첫 번째 스냅샷 기준 스탯" : "두 번째 스냅샷 기준 스탯"}</p>
            </div>
            <span class="dealer-badge">DEALER ${dealerId}</span>
          </div>
          <div class="dealer-card__body">
            <div class="derived-strip" id="dealer-derived-${dealerId}" aria-live="polite"></div>
            ${DEALER_GROUPS.map((group) =>
              renderAccordion(group, `dealer-${dealerId}`, dealer),
            ).join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAnomalyDamageCards() {
  const dealerOptions = [
    { value: "A", label: "딜러 A" },
    { value: "B", label: "딜러 B" },
  ];
  const slotFields = [
    selectField("snapshotDealer", "스냅샷 딜러", dealerOptions),
    selectField("realtimeDealer", "실시간 딜러", dealerOptions),
    selectField("anomalyKey", "이상 종류", ANOMALY_KEYS),
    selectField(
      "resistanceScenario",
      "적 저항 조건",
      RESISTANCE_SCENARIOS,
    ),
    numberField(
      "coefficientPercent",
      "이상계수",
      "×",
      "원본 시트처럼 입력값을 직접 배율로 사용합니다.",
    ),
    numberField("additionalMultiplier", "추가 배율", "×"),
  ];

  dom.anomalySlots.innerHTML = state.anomaly.slots
    .map(
      (slot, index) => `
        <article class="comparison-card comparison-card--${index === 0 ? "a" : "b"}">
          <div class="comparison-card__heading">
            <div>
              <h4>데미지 슬롯 ${index === 0 ? "A" : "B"}</h4>
              <p>스냅샷 딜러 × 실시간 적용 조건</p>
            </div>
            <span class="dealer-badge">SLOT ${index === 0 ? "A" : "B"}</span>
          </div>
          <div class="comparison-card__body">
            <div class="slot-result" aria-live="polite">
              <span>표기 이상 데미지</span>
              <strong id="anomaly-slot-${index}-result">—</strong>
              <small id="anomaly-slot-${index}-raw">정밀 계산 —</small>
            </div>
            <div class="field-grid">
              ${slotFields
                .map((field) =>
                  renderField(field, `slot-${index}`, slot),
                )
                .join("")}
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderLabCard({
  id,
  title,
  description,
  fields,
  model,
  values,
  wide = false,
  note = "",
}) {
  return `
    <article class="lab-card${wide ? " lab-card--wide" : ""}">
      <div class="lab-card__heading">
        <div>
          <h4>${escapeHtml(title)}</h4>
          <p>${escapeHtml(description)}</p>
        </div>
      </div>
      <div class="lab-card__body">
        <div class="field-grid">
          ${fields.map((field) => renderField(field, model, values)).join("")}
        </div>
        <div class="lab-output" aria-live="polite">
          <span>도출 계수</span>
          <strong id="${id}">—</strong>
        </div>
        ${note ? `<p class="helper-note">${escapeHtml(note)}</p>` : ""}
      </div>
    </article>
  `;
}

function renderCoefficientTools() {
  normalizeStateChoices();
  const tools = state.anomaly.tools;
  const nankaiConfig =
    NANKAI_CHARACTER_COEFFICIENTS[tools.nankai.character];
  const nankaiFields = [
    selectField(
      "character",
      "캐릭터",
      Object.keys(NANKAI_CHARACTER_COEFFICIENTS),
    ),
    selectField("selection", "스킬·속성", Object.keys(nankaiConfig.values)),
  ];
  if (nankaiConfig.kind === "scaled") {
    nankaiFields.push(
      numberField(
        "stat",
        nankaiConfig.requiredStat,
        "",
        "해당 스탯에 따라 계수가 비례합니다.",
      ),
    );
  }
  const additionalOptions =
    ADDITIONAL_MULTIPLIER_LOOKUPS[tools.additional.character];

  dom.coefficientTools.innerHTML = [
    renderLabCard({
      id: "tool-normal-output",
      title: "일반 속성이상",
      description: "속성별 기본 이상계수",
      model: "tool-normal",
      values: tools.normal,
      fields: [
        selectField("element", "속성", Object.keys(NORMAL_ANOMALY_COEFFICIENTS)),
      ],
    }),
    renderLabCard({
      id: "tool-disorder-output",
      title: "혼돈",
      description: "남은 시간과 추가계수 반영",
      model: "tool-disorder",
      values: tools.disorder,
      fields: [
        selectField("element", "선행 이상", Object.keys(DISORDER_COEFFICIENTS)),
        numberField("remainingSeconds", "남은 시간", "초"),
        numberField("additionalCoefficient", "추가 계수"),
      ],
    }),
    renderLabCard({
      id: "tool-turbulence-output",
      title: "난류",
      description: "속성과 남은 시간별 계수",
      model: "tool-turbulence",
      values: tools.turbulence,
      fields: [
        selectField(
          "element",
          "선행 이상",
          Object.keys(TURBULENCE_COEFFICIENTS),
        ),
        numberField("remainingSeconds", "남은 시간", "초"),
        numberField("additionalCoefficient", "추가 계수"),
      ],
    }),
    renderLabCard({
      id: "tool-nankai-output",
      title: "난개",
      description: "캐릭터별 스킬·속성 계수",
      model: "tool-nankai",
      values: tools.nankai,
      fields: nankaiFields,
      wide: true,
      note:
        nankaiConfig.kind === "scaled"
          ? `${nankaiConfig.requiredStat} 10당 기본 계수가 적용됩니다.`
          : "선택한 스킬 또는 속성의 원본 계수를 표시합니다.",
    }),
    renderLabCard({
      id: "tool-additional-output",
      title: "추가 배율",
      description: "캐릭터 조건별 최종 추가 배율",
      model: "tool-additional",
      values: tools.additional,
      fields: [
        selectField(
          "character",
          "캐릭터",
          Object.keys(ADDITIONAL_MULTIPLIER_LOOKUPS),
        ),
        selectField("option", "조건", Object.keys(additionalOptions)),
      ],
    }),
    renderLabCard({
      id: "tool-alice-output",
      title: "앨리스 추가계수",
      description: "지속 시간에 따른 추가 계수",
      model: "tool-alice",
      values: tools.alice,
      fields: [
        selectField(
          "option",
          "지속 시간",
          Object.keys(ALICE_ADDITIONAL_COEFFICIENTS),
        ),
      ],
    }),
  ].join("");
}

function renderRadiance() {
  const remiel = state.anomaly.remiel;
  const slotFields = [
    selectField("snapshotDealer", "스냅샷 딜러", [
      { value: "A", label: "딜러 A" },
      { value: "B", label: "딜러 B" },
    ]),
    selectField(
      "resistanceScenario",
      "적 저항 조건",
      RESISTANCE_SCENARIOS,
    ),
    numberField("additionalMultiplier", "추가 배율", "×"),
  ];

  dom.radiance.innerHTML = `
    <div class="radiance-summary">
      <article class="radiance-coefficient">
        <h4>휘광 계수</h4>
        <div class="field-grid">
          ${REMIEL_COEFFICIENT_FIELDS.map((field) =>
            renderField(field, "remiel", remiel),
          ).join("")}
        </div>
        <div class="lab-output" aria-live="polite">
          <span>최종 휘광 계수</span>
          <strong id="radiance-coefficient-output">—</strong>
        </div>
      </article>
      ${[0, 1]
        .map(
          (index) => `
            <div class="radiance-output" aria-live="polite">
              <span>슬롯 ${index === 0 ? "A" : "B"} 표기 데미지</span>
              <strong id="radiance-slot-${index}-result">—</strong>
              <small id="radiance-slot-${index}-raw">정밀 계산 —</small>
            </div>
          `,
        )
        .join("")}
    </div>
    <div class="radiance-grid">
      <article class="radiance-card">
        <div class="radiance-card__heading">
          <div>
            <h4>레미엘 전투 조건</h4>
            <p>변이, 저항, 엔진과 그로기 조건</p>
          </div>
        </div>
        <div class="radiance-card__body">
          ${REMIEL_GROUPS.map((group) =>
            renderAccordion(group, "remiel", remiel),
          ).join("")}
        </div>
      </article>
      <article class="radiance-card">
        <div class="radiance-card__heading">
          <div>
            <h4>슬롯별 적용 조건</h4>
            <p>딜러 스냅샷과 저항·추가 배율</p>
          </div>
        </div>
        <div class="radiance-card__body">
          ${state.anomaly.remielSlots
            .map(
              (slot, index) => `
                <details class="field-accordion" ${index === 0 ? "open" : ""}>
                  <summary>휘광 슬롯 ${index === 0 ? "A" : "B"}</summary>
                  <div class="field-grid">
                    ${slotFields
                      .map((field) =>
                        renderField(field, `remiel-slot-${index}`, slot),
                      )
                      .join("")}
                  </div>
                </details>
              `,
            )
            .join("")}
        </div>
      </article>
    </div>
  `;
}

function formatNumber(value, maximumFractionDigits = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString("ko-KR", {
    maximumFractionDigits,
  });
}

function formatInteger(value) {
  return formatNumber(value, 0);
}

function formatMultiplier(value, digits = 4) {
  return `${formatNumber(value, digits)}×`;
}

function metricMarkup(entries) {
  return entries
    .map(
      ([label, value]) => `
        <div class="metric">
          <span title="${escapeHtml(label)}">${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");
}

function derivedMarkup(entries) {
  return entries
    .map(
      ([label, value]) => `
        <div class="derived-item">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");
}

function setCalculationError(resultNode, detailNode, metricsNode, error) {
  resultNode.textContent = "입력 확인";
  detailNode.textContent = `계산 오류 · ${error.message}`;
  if (metricsNode) metricsNode.innerHTML = "";
}

function renderStrongResult() {
  if (hasInvalidInput("strong")) {
    setCalculationError(
      dom.strongResult,
      dom.strongRaw,
      dom.strongMetrics,
      new Error("유효하지 않은 입력이 있습니다."),
    );
    return;
  }
  try {
    const result = calculateStrongAttack(state.strong);
    dom.strongResult.textContent = formatInteger(result.displayedDamage);
    dom.strongRaw.textContent = `정밀 계산 ${formatNumber(result.rawDamage, 3)}`;
    dom.strongMetrics.innerHTML = metricMarkup([
      ["기초 공격력", formatNumber(result.baseAttack)],
      ["마을 공격력", formatNumber(result.townAttack)],
      ["전투 공격력", formatNumber(result.combatAttack)],
      ["스킬 배율", formatMultiplier(result.skillMultiplier)],
      ["방어 배율", formatMultiplier(result.defenseMultiplier)],
      ["피해 배율", formatMultiplier(result.damageMultiplier)],
      ["치명 배율", formatMultiplier(result.criticalMultiplier)],
      ["저항 배율", formatMultiplier(result.resistanceMultiplier)],
      ["그로기 배율", formatMultiplier(result.stunMultiplier)],
      ["받는 피해", formatMultiplier(result.receivedDamageMultiplier)],
    ]);
  } catch (error) {
    setCalculationError(
      dom.strongResult,
      dom.strongRaw,
      dom.strongMetrics,
      error,
    );
  }
}

function renderMingpoResult() {
  if (hasInvalidInput("mingpo")) {
    setCalculationError(
      dom.mingpoResult,
      dom.mingpoRaw,
      dom.mingpoMetrics,
      new Error("유효하지 않은 입력이 있습니다."),
    );
    return;
  }
  try {
    const result = calculateMingpo(state.mingpo);
    dom.mingpoResult.textContent = formatInteger(result.displayedDamage);
    dom.mingpoRaw.textContent = `정밀 계산 ${formatNumber(result.rawDamage, 3)}`;
    dom.mingpoMetrics.innerHTML = metricMarkup([
      ["마을 공격력", formatNumber(result.townAttack)],
      ["전투 공격력", formatNumber(result.combatAttack)],
      ["마을 체력", formatNumber(result.townHp)],
      ["전투 체력", formatNumber(result.combatHp)],
      ["마을 관입력", formatNumber(result.townPenetration)],
      ["전투 관입력", formatNumber(result.combatPenetration)],
      ["관입 피해", formatMultiplier(result.penetrationDamageMultiplier)],
      ["피해 배율", formatMultiplier(result.damageMultiplier)],
      ["치명 배율", formatMultiplier(result.criticalMultiplier)],
      ["저항 배율", formatMultiplier(result.resistanceMultiplier)],
      ["그로기 배율", formatMultiplier(result.stunMultiplier)],
      ["스킬 배율", formatMultiplier(result.skillMultiplier)],
    ]);
  } catch (error) {
    setCalculationError(
      dom.mingpoResult,
      dom.mingpoRaw,
      dom.mingpoMetrics,
      error,
    );
  }
}

function renderDealerDerived() {
  ["A", "B"].forEach((dealerId) => {
    const target = document.querySelector(`#dealer-derived-${dealerId}`);
    if (!target) return;
    if (hasInvalidInput(`dealer-${dealerId}`)) {
      target.innerHTML = derivedMarkup([
        ["계산 오류", "유효하지 않은 입력이 있습니다."],
      ]);
      return;
    }
    try {
      const result = calculateDealerStats(state.anomaly.dealers[dealerId]);
      target.innerHTML = derivedMarkup([
        ["전투 공격력", formatNumber(result.combatAttack)],
        ["방어 배율", formatMultiplier(result.defenseMultiplier)],
        ["이상 마스터리", formatNumber(result.anomalyProficiency)],
        ["변이 배율", formatMultiplier(result.mutationMultiplier)],
        ["전투 장악력", formatNumber(result.combatAnomalyMastery)],
        ["그로기 배율", formatMultiplier(result.stunMultiplier)],
      ]);
    } catch (error) {
      target.innerHTML = derivedMarkup([["계산 오류", error.message]]);
    }
  });
}

function renderAnomalyDamageResults() {
  if (
    hasInvalidInput(
      "dealer-A",
      "dealer-B",
      "slot-0",
      "slot-1",
    )
  ) {
    state.anomaly.slots.forEach((_, index) => {
      const resultNode = document.querySelector(
        `#anomaly-slot-${index}-result`,
      );
      const rawNode = document.querySelector(`#anomaly-slot-${index}-raw`);
      if (resultNode) resultNode.textContent = "입력 확인";
      if (rawNode) {
        rawNode.textContent =
          "계산 오류 · 유효하지 않은 입력이 있습니다.";
      }
    });
    return;
  }
  try {
    const result = calculateMainAnomalyDamage({
      dealers: state.anomaly.dealers,
      slots: state.anomaly.slots,
    });
    result.slots.forEach((slot, index) => {
      const resultNode = document.querySelector(
        `#anomaly-slot-${index}-result`,
      );
      const rawNode = document.querySelector(`#anomaly-slot-${index}-raw`);
      if (!resultNode || !rawNode) return;
      resultNode.textContent = formatInteger(slot.displayedDamage);
      rawNode.textContent = `정밀 ${formatNumber(slot.rawDamage, 3)} · 이상 피해 ${formatMultiplier(slot.anomalyDamageMultiplier)}`;
    });
  } catch (error) {
    state.anomaly.slots.forEach((_, index) => {
      const resultNode = document.querySelector(
        `#anomaly-slot-${index}-result`,
      );
      const rawNode = document.querySelector(`#anomaly-slot-${index}-raw`);
      if (resultNode) resultNode.textContent = "입력 확인";
      if (rawNode) rawNode.textContent = `계산 오류 · ${error.message}`;
    });
  }
}

function updateToolOutput(id, calculation, suffix = "") {
  const target = document.querySelector(`#${id}`);
  if (!target) return;
  try {
    const value = calculation();
    target.textContent = `${formatNumber(value, 6)}${suffix}`;
    target.title = "";
  } catch (error) {
    target.textContent = "입력 확인";
    target.title = error.message;
  }
}

function renderToolOutputs() {
  const tools = state.anomaly.tools;
  const update = (model, id, calculation, suffix = "") => {
    if (hasInvalidInput(model)) {
      const target = document.querySelector(`#${id}`);
      if (target) {
        target.textContent = "입력 확인";
        target.title = "유효하지 않은 입력이 있습니다.";
      }
      return;
    }
    updateToolOutput(id, calculation, suffix);
  };
  update(
    "tool-normal",
    "tool-normal-output",
    () =>
      calculateAnomalyCoefficient({
        kind: "normal",
        ...tools.normal,
      }).finalCoefficient,
    "%",
  );
  update(
    "tool-disorder",
    "tool-disorder-output",
    () =>
      calculateAnomalyCoefficient({
        kind: "disorder",
        ...tools.disorder,
      }).finalCoefficient,
    "%",
  );
  update(
    "tool-turbulence",
    "tool-turbulence-output",
    () =>
      calculateAnomalyCoefficient({
        kind: "turbulence",
        ...tools.turbulence,
      }).finalCoefficient,
    "%",
  );
  update(
    "tool-nankai",
    "tool-nankai-output",
    () =>
      calculateAnomalyCoefficient({
        kind: "nankai",
        ...tools.nankai,
      }).finalCoefficient,
    "%",
  );
  update(
    "tool-additional",
    "tool-additional-output",
    () =>
      getAdditionalMultiplier(
        tools.additional.character,
        tools.additional.option,
      ),
    "×",
  );
  update(
    "tool-alice",
    "tool-alice-output",
    () => getAliceAdditionalCoefficient(tools.alice.option),
    "%",
  );
}

function renderRadianceResults() {
  if (
    hasInvalidInput(
      "dealer-A",
      "dealer-B",
      "remiel",
      "remiel-slot-0",
      "remiel-slot-1",
    )
  ) {
    const coefficient = document.querySelector(
      "#radiance-coefficient-output",
    );
    if (coefficient) {
      coefficient.textContent = "입력 확인";
      coefficient.title = "유효하지 않은 입력이 있습니다.";
    }
    state.anomaly.remielSlots.forEach((_, index) => {
      const resultNode = document.querySelector(
        `#radiance-slot-${index}-result`,
      );
      const rawNode = document.querySelector(`#radiance-slot-${index}-raw`);
      if (resultNode) resultNode.textContent = "입력 확인";
      if (rawNode) {
        rawNode.textContent =
          "계산 오류 · 유효하지 않은 입력이 있습니다.";
      }
    });
    return;
  }
  try {
    const result = calculateRemielRadianceDamage({
      dealers: state.anomaly.dealers,
      remiel: state.anomaly.remiel,
      slots: state.anomaly.remielSlots,
    });
    const coefficient = document.querySelector(
      "#radiance-coefficient-output",
    );
    if (coefficient) {
      coefficient.textContent = `${formatNumber(result.coefficient.finalCoefficient, 6)}%`;
      coefficient.title = "";
    }
    result.slots.forEach((slot, index) => {
      const resultNode = document.querySelector(
        `#radiance-slot-${index}-result`,
      );
      const rawNode = document.querySelector(`#radiance-slot-${index}-raw`);
      if (!resultNode || !rawNode) return;
      resultNode.textContent = formatInteger(slot.displayedDamage);
      rawNode.textContent = `정밀 ${formatNumber(slot.rawDamage, 3)}`;
    });
  } catch (error) {
    const coefficient = document.querySelector(
      "#radiance-coefficient-output",
    );
    if (coefficient) {
      coefficient.textContent = "입력 확인";
      coefficient.title = error.message;
    }
    state.anomaly.remielSlots.forEach((_, index) => {
      const resultNode = document.querySelector(
        `#radiance-slot-${index}-result`,
      );
      const rawNode = document.querySelector(`#radiance-slot-${index}-raw`);
      if (resultNode) resultNode.textContent = "입력 확인";
      if (rawNode) rawNode.textContent = `계산 오류 · ${error.message}`;
    });
  }
}

function renderAnomalyResults() {
  renderDealerDerived();
  renderAnomalyDamageResults();
  renderToolOutputs();
  renderRadianceResults();
}

function renderAll() {
  renderStrongFields();
  renderMingpoFields();
  renderDealerCards();
  renderAnomalyDamageCards();
  renderCoefficientTools();
  renderRadiance();
  renderStrongResult();
  renderMingpoResult();
  renderAnomalyResults();
}

function bindingTarget(model) {
  if (model === "strong") return state.strong;
  if (model === "mingpo") return state.mingpo;
  if (model === "dealer-A") return state.anomaly.dealers.A;
  if (model === "dealer-B") return state.anomaly.dealers.B;
  if (model.startsWith("slot-")) {
    return state.anomaly.slots[Number(model.slice(5))];
  }
  if (model.startsWith("tool-")) {
    return state.anomaly.tools[model.slice(5)];
  }
  if (model === "remiel") return state.anomaly.remiel;
  if (model.startsWith("remiel-slot-")) {
    return state.anomaly.remielSlots[Number(model.slice(12))];
  }
  return null;
}

function clearFieldError(input) {
  input.removeAttribute("aria-invalid");
  const error = document.querySelector(`#${CSS.escape(input.id)}-error`);
  if (error) error.textContent = "";
}

function setFieldError(input, message) {
  input.setAttribute("aria-invalid", "true");
  const error = document.querySelector(`#${CSS.escape(input.id)}-error`);
  if (error) error.textContent = message;
}

function normalizeDependentTool(model, path) {
  if (model === "tool-nankai" && path === "character") {
    const tool = state.anomaly.tools.nankai;
    const config = NANKAI_CHARACTER_COEFFICIENTS[tool.character];
    clearInvalidInputsFor(model);
    tool.selection =
      NANKAI_DEFAULT_SELECTIONS[tool.character] ?? firstKey(config.values);
    tool.stat = config.defaultStat ?? 0;
    renderCoefficientTools();
    renderToolOutputs();
    document
      .querySelector(`#${CSS.escape(inputId(model, path))}`)
      ?.focus();
    return true;
  }

  if (model === "tool-additional" && path === "character") {
    const tool = state.anomaly.tools.additional;
    clearInvalidInputsFor(model);
    tool.option = firstKey(ADDITIONAL_MULTIPLIER_LOOKUPS[tool.character]);
    renderCoefficientTools();
    renderToolOutputs();
    document
      .querySelector(`#${CSS.escape(inputId(model, path))}`)
      ?.focus();
    return true;
  }

  return false;
}

function updateResultsFor(model) {
  if (model === "strong") {
    renderStrongResult();
    return;
  }
  if (model === "mingpo") {
    renderMingpoResult();
    return;
  }
  if (model.startsWith("dealer-")) {
    renderDealerDerived();
    renderAnomalyDamageResults();
    renderRadianceResults();
    return;
  }
  if (model.startsWith("slot-")) {
    renderAnomalyDamageResults();
    return;
  }
  if (model.startsWith("tool-")) {
    renderToolOutputs();
    return;
  }
  if (model === "remiel" || model.startsWith("remiel-slot-")) {
    renderRadianceResults();
  }
}

function handleBoundInput(event) {
  const input = event.target.closest("[data-model][data-path]");
  if (!input) return;
  if (event.type === "input" && input.tagName === "SELECT") return;
  if (event.type === "change" && input.tagName !== "SELECT") return;

  const model = input.dataset.model;
  const path = input.dataset.path;
  const target = bindingTarget(model);
  if (!target) return;

  let value = input.value;
  if (input.dataset.valueType === "number") {
    if (value.trim() === "" || !Number.isFinite(Number(value))) {
      invalidInputs.add(invalidKey(model, path));
      setFieldError(input, "유효한 숫자를 입력해 주세요.");
      updateResultsFor(model);
      return;
    }
    value = Number(value);
  } else if (input.dataset.valueType === "boolean") {
    value = value === "true";
  }

  invalidInputs.delete(invalidKey(model, path));
  clearFieldError(input);
  setPath(target, path, value);
  const rerendered = normalizeDependentTool(model, path);
  persistState();
  if (!rerendered) updateResultsFor(model);
}

function bindFormEvents() {
  document
    .querySelectorAll("#strong-form, #mingpo-form, #anomaly-form")
    .forEach((form) => {
      form.addEventListener("submit", (event) => event.preventDefault());
      form.addEventListener("input", handleBoundInput);
      form.addEventListener("change", handleBoundInput);
    });
}

function activateTab(name, moveFocus = false) {
  const tabs = [...document.querySelectorAll("[data-calculator-tab]")];
  const panels = [
    ...document.querySelectorAll("[data-calculator-panel]"),
  ];
  const targetTab = tabs.find((tab) => tab.dataset.calculatorTab === name);
  if (!targetTab) return;

  tabs.forEach((tab) => {
    const active = tab === targetTab;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  panels.forEach((panel) => {
    const active = panel.dataset.calculatorPanel === name;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
  state.ui.activeTab = name;
  persistState();
  if (moveFocus) targetTab.focus();
}

function bindTabs() {
  const tabs = [...document.querySelectorAll("[data-calculator-tab]")];
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () =>
      activateTab(tab.dataset.calculatorTab),
    );
    tab.addEventListener("keydown", (event) => {
      let nextIndex;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
      }
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;
      if (nextIndex === undefined) return;
      event.preventDefault();
      activateTab(tabs[nextIndex].dataset.calculatorTab, true);
    });
  });
  activateTab(state.ui.activeTab);
}

function activateDetailTab(name, moveFocus = false) {
  const tabs = [...document.querySelectorAll("[data-detail-tab]")];
  const panels = [...document.querySelectorAll("[data-detail-panel]")];
  const targetTab = tabs.find((tab) => tab.dataset.detailTab === name);
  if (!targetTab) return;

  tabs.forEach((tab) => {
    const active = tab === targetTab;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  panels.forEach((panel) => {
    const active = panel.dataset.detailPanel === name;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
  state.ui.activeDetailTab = name;
  persistState();
  if (moveFocus) targetTab.focus();
}

function bindDetailTabs() {
  const tabs = [...document.querySelectorAll("[data-detail-tab]")];
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () =>
      activateDetailTab(tab.dataset.detailTab),
    );
    tab.addEventListener("keydown", (event) => {
      let nextIndex;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
      }
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;
      if (nextIndex === undefined) return;
      event.preventDefault();
      activateDetailTab(tabs[nextIndex].dataset.detailTab, true);
    });
  });
  activateDetailTab(state.ui.activeDetailTab);
}

function resetCalculator(name) {
  if (name === "strong") {
    clearInvalidInputsFor("strong");
    state.strong = clone(STRONG_ATTACK_DEFAULTS);
    renderStrongFields();
    renderStrongResult();
  } else if (name === "mingpo") {
    clearInvalidInputsFor("mingpo");
    state.mingpo = clone(MINGPO_DEFAULTS);
    renderMingpoFields();
    renderMingpoResult();
  } else if (name === "anomaly") {
    clearInvalidInputsFor(
      "dealer-A",
      "dealer-B",
      "slot-0",
      "slot-1",
      "tool-normal",
      "tool-disorder",
      "tool-turbulence",
      "tool-nankai",
      "tool-additional",
      "tool-alice",
      "remiel",
      "remiel-slot-0",
      "remiel-slot-1",
    );
    state.anomaly = clone(DEFAULT_STATE.anomaly);
    normalizeStateChoices();
    renderDealerCards();
    renderAnomalyDamageCards();
    renderCoefficientTools();
    renderRadiance();
    renderAnomalyResults();
  }
  persistState();
}

function bindResetButtons() {
  document.querySelectorAll("[data-reset]").forEach((button) => {
    button.addEventListener("click", () =>
      resetCalculator(button.dataset.reset),
    );
  });
}

function bindAnomalyNavigation() {
  const chips = [...document.querySelectorAll("[data-anomaly-jump]")];
  const setActiveChip = (name) => {
    chips.forEach((chip) => {
      const active = chip.dataset.anomalyJump === name;
      chip.classList.toggle("is-active", active);
      if (active) chip.setAttribute("aria-current", "location");
      else chip.removeAttribute("aria-current");
    });
  };
  setActiveChip("dealers");

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const name = chip.dataset.anomalyJump;
      const section = document.querySelector(`[data-anomaly-section="${name}"]`);
      if (!section) return;
      setActiveChip(name);
      section.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveChip(visible.target.dataset.anomalySection);
      },
      {
        rootMargin: "-145px 0px -55% 0px",
        threshold: [0.05, 0.25, 0.5],
      },
    );
    document
      .querySelectorAll("[data-anomaly-section]")
      .forEach((section) => observer.observe(section));
  }
}

renderAll();
initComparison();
bindFormEvents();
bindTabs();
bindDetailTabs();
bindResetButtons();
bindAnomalyNavigation();
persistState();
