import {
  COMPARISON_MODES,
  compareInvestments,
  createDefaultComparisonState,
  mergeComparisonState,
} from "./comparison-engine.js";
import { NORMAL_ANOMALY_COEFFICIENTS } from "./calculators.js";
import {
  CATALOG_VERIFIED_AT,
  CHARACTER_BY_ID,
  CHARACTERS,
  WEAPON_BY_ID,
  compatibleWeapons,
} from "./data/catalog.js";

const STORAGE_KEY = "new-eridu-investment-comparison:v1";
const formatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 0,
});
const decimalFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 2,
});

let comparisonState;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    const merged = mergeComparisonState(saved);
    if (
      saved?.common?.characterId === undefined &&
      CHARACTER_BY_ID[saved?.profiles?.A?.characterId]
    ) {
      merged.common.characterId = saved.profiles.A.characterId;
    }
    return merged;
  } catch {
    return createDefaultComparisonState();
  }
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(comparisonState));
  } catch {
    // 저장 공간이 차단되어도 계산 자체는 계속 동작한다.
  }
}

function alignProfileWeapon(profile) {
  const character = CHARACTER_BY_ID[profile.characterId] ?? CHARACTERS[0];
  const options = compatibleWeapons(character.specialty);
  if (
    profile.weaponId !== "custom" &&
    !options.some((weapon) => weapon.id === profile.weaponId)
  ) {
    const signatureId = `14${character.id.slice(0, 3)}`;
    profile.weaponId =
      options.find((weapon) => weapon.id === signatureId)?.id ??
      options[0]?.id ??
      "custom";
  }
}

function normalizeSelections() {
  const sharedCharacterId = CHARACTER_BY_ID[comparisonState.common.characterId]
    ? comparisonState.common.characterId
    : "1041";
  comparisonState.common.characterId = sharedCharacterId;
  comparisonState.profiles.A.characterId = sharedCharacterId;
  comparisonState.profiles.B.characterId = sharedCharacterId;
  alignProfileWeapon(comparisonState.profiles.A);
  alignProfileWeapon(comparisonState.profiles.B);
}

function attributes(scope, key, type = "text") {
  return `data-compare-scope="${scope}" data-compare-key="${key}" data-compare-type="${type}"`;
}

function selectField({
  label,
  value,
  options,
  scope,
  key,
  hint = "",
  wide = false,
}) {
  const optionHtml = options
    .map(
      ({ value: optionValue, label: optionLabel, disabled = false }) =>
        `<option value="${escapeHtml(optionValue)}" ${
          String(optionValue) === String(value) ? "selected" : ""
        } ${disabled ? "disabled" : ""}>${escapeHtml(optionLabel)}</option>`,
    )
    .join("");
  return `
    <label class="compare-field ${wide ? "compare-field--wide" : ""}">
      <span>${escapeHtml(label)}${hint ? `<small>${escapeHtml(hint)}</small>` : ""}</span>
      <select ${attributes(scope, key, "text")}>${optionHtml}</select>
    </label>
  `;
}

function numberField({
  label,
  value,
  scope,
  key,
  unit = "",
  step = "0.1",
  hint = "",
  wide = false,
}) {
  return `
    <label class="compare-field ${wide ? "compare-field--wide" : ""}">
      <span>${escapeHtml(label)}${hint ? `<small>${escapeHtml(hint)}</small>` : ""}</span>
      <span class="compare-control">
        <input
          type="number"
          step="${step}"
          value="${escapeHtml(value)}"
          ${attributes(scope, key, "number")}
        />
        ${unit ? `<b>${escapeHtml(unit)}</b>` : ""}
      </span>
      <small class="compare-input-error" aria-live="polite"></small>
    </label>
  `;
}

function textField({ label, value, scope, key, wide = false }) {
  return `
    <label class="compare-field ${wide ? "compare-field--wide" : ""}">
      <span>${escapeHtml(label)}</span>
      <input
        type="text"
        value="${escapeHtml(value)}"
        ${attributes(scope, key, "text")}
      />
    </label>
  `;
}

function checkboxField({ label, checked, scope, key, hint = "" }) {
  return `
    <label class="compare-toggle">
      <input
        type="checkbox"
        ${checked ? "checked" : ""}
        ${attributes(scope, key, "boolean")}
      />
      <span>
        <strong>${escapeHtml(label)}</strong>
        ${hint ? `<small>${escapeHtml(hint)}</small>` : ""}
      </span>
    </label>
  `;
}

function characterOptions() {
  return CHARACTERS.map((character) => ({
    value: character.id,
    label: `${character.rank} · ${character.name} · ${character.specialty}${
      character.version.includes("preview") ? " · 프리뷰" : ""
    }`,
  }));
}

function recommendedMode(character) {
  if (character.specialty === "명파") return "mingpo";
  if (character.specialty === "이상") return "anomaly";
  return "strong";
}

function weaponOptions(character, currentWeaponId) {
  const options = compatibleWeapons(character.specialty).map((weapon) => ({
    value: weapon.id,
    label: `${weapon.rank} · ${weapon.name} · 기초 ${weapon.baseAttack} · ${weapon.secondaryStat} ${weapon.secondaryValue}${weapon.secondaryUnit === "percent" ? "%" : ""}${
      weapon.version.includes("preview") ? " · 프리뷰" : ""
    }`,
  }));
  if (
    currentWeaponId !== "custom" &&
    !options.some((option) => option.value === currentWeaponId)
  ) {
    options.unshift({
      value: currentWeaponId,
      label: "현재 선택 엔진 · 특성 불일치",
    });
  }
  options.push({ value: "custom", label: "직접 입력" });
  return options;
}

function profileQuickFields(id, profile, mode) {
  const scope = `profile-${id}`;
  if (mode === "mingpo") {
    return [
      numberField({
        label: "대표 스킬 계수",
        value: profile.skillCoefficientPercent,
        scope,
        key: "skillCoefficientPercent",
        unit: "%",
      }),
      numberField({
        label: "디스크 공격력",
        value: profile.discAttackPercent,
        scope,
        key: "discAttackPercent",
        unit: "%",
      }),
      numberField({
        label: "공격력 깡옵 횟수",
        value: profile.flatAttackRolls,
        scope,
        key: "flatAttackRolls",
        unit: "회",
        step: "1",
      }),
      numberField({
        label: "디스크 HP",
        value: profile.discHpPercent,
        scope,
        key: "discHpPercent",
        unit: "%",
      }),
      numberField({
        label: "HP 깡옵 횟수",
        value: profile.flatHpRolls,
        scope,
        key: "flatHpRolls",
        unit: "회",
        step: "1",
      }),
      numberField({
        label: "디스크 치명타 확률",
        value: profile.discCritRatePercent,
        scope,
        key: "discCritRatePercent",
        unit: "%",
      }),
      numberField({
        label: "디스크 치명타 피해",
        value: profile.discCritDamagePercent,
        scope,
        key: "discCritDamagePercent",
        unit: "%",
      }),
      numberField({
        label: "관입 피해 보너스",
        value: profile.penetrationDamageBonusPercent,
        scope,
        key: "penetrationDamageBonusPercent",
        unit: "%",
      }),
      numberField({
        label: "피해 보너스",
        value: profile.damageBonusPercent,
        scope,
        key: "damageBonusPercent",
        unit: "%",
      }),
    ].join("");
  }

  if (mode === "anomaly") {
    return [
      numberField({
        label: "이상 계수 보정",
        value: profile.anomalyCoefficientMultiplier,
        scope,
        key: "anomalyCoefficientMultiplier",
        unit: "×",
        hint: "선택한 기본 계수에 곱함",
      }),
      numberField({
        label: "디스크 공격력",
        value: profile.discAttackPercent,
        scope,
        key: "discAttackPercent",
        unit: "%",
      }),
      numberField({
        label: "공격력 깡옵 횟수",
        value: profile.flatAttackRolls,
        scope,
        key: "flatAttackRolls",
        unit: "회",
        step: "1",
      }),
      numberField({
        label: "디스크 이상 마스터리",
        value: profile.discAnomalyProficiency,
        scope,
        key: "discAnomalyProficiency",
        unit: "pt",
      }),
      numberField({
        label: "디스크 이상 장악력",
        value: profile.discAnomalyMasteryPercent,
        scope,
        key: "discAnomalyMasteryPercent",
        unit: "%",
      }),
      numberField({
        label: "피해 보너스",
        value: profile.damageBonusPercent,
        scope,
        key: "damageBonusPercent",
        unit: "%",
      }),
      numberField({
        label: "이상 피해 보너스",
        value: profile.anomalyDamageBonusPercent,
        scope,
        key: "anomalyDamageBonusPercent",
        unit: "%",
      }),
    ].join("");
  }

  return [
    numberField({
      label: "대표 스킬 계수",
      value: profile.skillCoefficientPercent,
      scope,
      key: "skillCoefficientPercent",
      unit: "%",
    }),
    numberField({
      label: "디스크 공격력",
      value: profile.discAttackPercent,
      scope,
      key: "discAttackPercent",
      unit: "%",
    }),
    numberField({
      label: "디스크 치명타 확률",
      value: profile.discCritRatePercent,
      scope,
      key: "discCritRatePercent",
      unit: "%",
    }),
    numberField({
      label: "디스크 치명타 피해",
      value: profile.discCritDamagePercent,
      scope,
      key: "discCritDamagePercent",
      unit: "%",
    }),
    numberField({
      label: "피해 보너스",
      value: profile.damageBonusPercent,
      scope,
      key: "damageBonusPercent",
      unit: "%",
    }),
    numberField({
      label: "공격력 깡옵 횟수",
      value: profile.flatAttackRolls,
      scope,
      key: "flatAttackRolls",
      unit: "회",
      step: "1",
    }),
  ].join("");
}

function profileAdvancedFields(id, profile, mode) {
  const scope = `profile-${id}`;
  const fields = [
    numberField({
      label: "전투 중 공격력",
      value: profile.passiveAttackPercent,
      scope,
      key: "passiveAttackPercent",
      unit: "%",
    }),
    numberField({
      label: "조건부 피해 보너스",
      value: profile.passiveDamageBonusPercent,
      scope,
      key: "passiveDamageBonusPercent",
      unit: "%",
    }),
    numberField({
      label: "저항 무시",
      value: profile.passiveResistanceIgnorePercent,
      scope,
      key: "passiveResistanceIgnorePercent",
      unit: "%",
    }),
  ];

  if (mode === "mingpo") {
    fields.splice(
      1,
      0,
      numberField({
        label: "전투 중 HP",
        value: profile.passiveHpPercent,
        scope,
        key: "passiveHpPercent",
        unit: "%",
      }),
    );
  }

  if (mode === "strong" || mode === "mingpo") {
    fields.splice(
      mode === "mingpo" ? 2 : 1,
      0,
      numberField({
        label: "조건부 치확",
        value: profile.passiveCritRatePercent,
        scope,
        key: "passiveCritRatePercent",
        unit: "%",
      }),
      numberField({
        label: "조건부 치피",
        value: profile.passiveCritDamagePercent,
        scope,
        key: "passiveCritDamagePercent",
        unit: "%",
      }),
    );
  }

  if (mode === "strong" || mode === "anomaly") {
    fields.push(
      numberField({
        label: "관통률",
        value: profile.passivePenetrationPercent,
        scope,
        key: "passivePenetrationPercent",
        unit: "%",
      }),
      numberField({
        label: "방어력 감소",
        value: profile.passiveDefenseReductionPercent,
        scope,
        key: "passiveDefenseReductionPercent",
        unit: "%",
      }),
    );
  }

  if (mode === "anomaly") {
    fields.push(
      numberField({
        label: "추가 이상 마스터리",
        value: profile.passiveAnomalyProficiency,
        scope,
        key: "passiveAnomalyProficiency",
        unit: "pt",
      }),
      numberField({
        label: "추가 이상 장악력",
        value: profile.passiveAnomalyMasteryPercent,
        scope,
        key: "passiveAnomalyMasteryPercent",
        unit: "%",
      }),
    );
  }

  return fields.join("");
}

function hasManualInvestmentEffects(profile, mode) {
  const keys = [
    "passiveAttackPercent",
    "passiveDamageBonusPercent",
    "passiveResistanceIgnorePercent",
  ];
  if (mode === "mingpo") keys.push("passiveHpPercent");
  if (mode === "strong" || mode === "mingpo") {
    keys.push("passiveCritRatePercent", "passiveCritDamagePercent");
  }
  if (mode === "strong" || mode === "anomaly") {
    keys.push("passivePenetrationPercent", "passiveDefenseReductionPercent");
  }
  if (mode === "anomaly") {
    keys.push(
      "passiveAnomalyProficiency",
      "passiveAnomalyMasteryPercent",
    );
  }
  return keys.some((key) => Number(profile[key]) !== 0);
}

function renderProfile(id) {
  const profile = comparisonState.profiles[id];
  const character =
    CHARACTER_BY_ID[comparisonState.common.characterId] ?? CHARACTER_BY_ID["1041"];
  const weapon =
    profile.weaponId === "custom" ? null : WEAPON_BY_ID[profile.weaponId];
  const scope = `profile-${id}`;
  const preview = character.version.includes("preview");
  const needsMindscapeValues =
    Number(profile.mindscape) > 0 &&
    !hasManualInvestmentEffects(profile, comparisonState.common.mode);
  return `
    <article
      class="investment-card investment-card--${id.toLowerCase()}"
      aria-labelledby="investment-title-${id.toLowerCase()}"
    >
      <header class="investment-card__header">
        <span class="investment-badge">PLAN ${id}</span>
        <div>
          <h4 id="investment-title-${id.toLowerCase()}">${escapeHtml(profile.label)}</h4>
          <small>${escapeHtml(character.name)} · M${profile.mindscape} · ${escapeHtml(character.specialty)} · ${
            preview ? "프리뷰" : "라이브"
          }</small>
        </div>
      </header>

      <div class="investment-card__body">
        <div class="compare-field-grid compare-field-grid--identity">
          ${textField({
            label: "비교안 이름",
            value: profile.label,
            scope,
            key: "label",
            wide: true,
          })}
          ${selectField({
            label: "시네마 단계 (기록용)",
            value: profile.mindscape,
            options: Array.from({ length: 7 }, (_, value) => ({
              value,
              label: `M${value}`,
            })),
            scope,
            key: "mindscape",
            hint: "자동 계산 안 됨",
          })}
          ${selectField({
            label: "W-엔진",
            value: profile.weaponId,
            options: weaponOptions(character, profile.weaponId),
            scope,
            key: "weaponId",
            hint: "기초·고급 속성 자동",
          })}
          ${
            profile.weaponId === "custom"
              ? numberField({
                  label: "직접 입력 기초 공격력",
                  value: profile.customEngineBaseAttack,
                  scope,
                  key: "customEngineBaseAttack",
                  wide: true,
                })
              : ""
          }
        </div>

        <div class="base-stat-strip">
          <span><small>기초 공격력</small><strong>${formatter.format(character.attack)}</strong></span>
          <span><small>기초 HP</small><strong>${formatter.format(character.hp)}</strong></span>
          <span><small>치확 / 치피</small><strong>${decimalFormatter.format(character.critRate)} / ${decimalFormatter.format(character.critDamage)}</strong></span>
          <span><small>이상 마스터리</small><strong>${formatter.format(character.anomalyProficiency)}</strong></span>
        </div>

        <div class="compare-field-grid compare-field-grid--quick">
          ${profileQuickFields(id, profile, comparisonState.common.mode)}
        </div>

        ${
          needsMindscapeValues
            ? `<p class="manual-effect-warning">
                M${profile.mindscape} 효과 수치가 아직 입력되지 않았습니다.
                아래 항목에 실제 발동값을 입력하기 전에는 M0와 같은 결과가 나옵니다.
              </p>`
            : ""
        }

        <details
          class="compare-advanced"
          data-compare-plan="${id}"
          ${profile.advancedOpen || Number(profile.mindscape) > 0 ? "open" : ""}
        >
          <summary>돌파·엔진 패시브 조건 직접 반영</summary>
          <p>
            엔진 선택은 기초 공격력과 고급 속성만 자동 반영합니다.
            시네마와 조건부 패시브의 실제 발동 수치는 아래에 입력해 주세요.
          </p>
          <div class="compare-field-grid">
            ${profileAdvancedFields(id, profile, comparisonState.common.mode)}
          </div>
        </details>

        <div class="catalog-sources">
          <a
            class="catalog-source"
            href="${escapeHtml(character.sourceUrl)}"
            target="_blank"
            rel="noreferrer"
          >${escapeHtml(character.name)} 수치 ↗</a>
          ${
            weapon
              ? `<a
                  class="catalog-source"
                  href="${escapeHtml(weapon.sourceUrl)}"
                  target="_blank"
                  rel="noreferrer"
                >${escapeHtml(weapon.name)} 수치 ↗</a>`
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function renderCommon() {
  const common = comparisonState.common;
  const character =
    CHARACTER_BY_ID[common.characterId] ?? CHARACTER_BY_ID["1041"];
  const suggestedMode = recommendedMode(character);
  return `
    <section class="comparison-common">
      <div class="comparison-common__heading">
        <div>
          <span class="compare-step">01 · SHARED CONDITIONS</span>
          <h3>공통 전투 조건</h3>
          <p>두 비교안에 동일하게 적용되는 조건입니다.</p>
        </div>
        <div class="comparison-actions">
          <button type="button" data-compare-action="copy-a-to-b">A를 B로 복사</button>
          <button type="button" data-compare-action="swap">A ↔ B</button>
        </div>
      </div>

      ${
        common.mode !== suggestedMode
          ? `<p class="comparison-model-warning">
              ${escapeHtml(character.name)}의 특성은 ${escapeHtml(character.specialty)}입니다.
              현재 계산식은 수동 선택 상태이므로 대표 피해 해석에 주의하세요.
            </p>`
          : ""
      }

      <div class="compare-field-grid compare-field-grid--common">
        ${selectField({
          label: "비교 캐릭터",
          value: common.characterId,
          options: characterOptions(),
          scope: "common",
          key: "characterId",
          hint: "두 투자안에 공통 적용",
          wide: true,
        })}
        ${selectField({
          label: "비교 계산식",
          value: common.mode,
          options: Object.entries(COMPARISON_MODES).map(([value, label]) => ({
            value,
            label,
          })),
          scope: "common",
          key: "mode",
        })}
        ${
          common.mode === "anomaly"
            ? selectField({
                label: "이상 종류",
                value: common.anomalyKey,
                options: ["연소", "침식", "감전", "쇄빙", "강타", "풍화"].map(
                  (value) => ({
                    value,
                    label: `${value} · ${decimalFormatter.format(
                      NORMAL_ANOMALY_COEFFICIENTS[value] / 100,
                    )}×`,
                  }),
                ),
                scope: "common",
                key: "anomalyKey",
              })
            : ""
        }
        ${
          common.mode !== "mingpo"
            ? [
                numberField({
                  label: "적 방어력",
                  value: common.enemyDefense,
                  scope: "common",
                  key: "enemyDefense",
                  unit: "pt",
                }),
                numberField({
                  label: "공통 방어력 감소",
                  value: common.enemyDefenseReductionPercent,
                  scope: "common",
                  key: "enemyDefenseReductionPercent",
                  unit: "%",
                }),
              ].join("")
            : ""
        }
        ${numberField({
          label: "적 속성 저항",
          value: common.enemyResistancePercent,
          scope: "common",
          key: "enemyResistancePercent",
          unit: "%",
        })}
        ${numberField({
          label: "공통 저항 감소",
          value: common.resistanceReductionPercent,
          scope: "common",
          key: "resistanceReductionPercent",
          unit: "%",
        })}
        ${numberField({
          label: "파티 공격력 버프",
          value: common.attackPercentBuff,
          scope: "common",
          key: "attackPercentBuff",
          unit: "%",
        })}
        ${numberField({
          label: "파티 고정 공격력",
          value: common.flatAttackBuff,
          scope: "common",
          key: "flatAttackBuff",
          unit: "pt",
        })}
        ${
          common.mode === "mingpo"
            ? [
                numberField({
                  label: "파티 HP 버프",
                  value: common.hpPercentBuff,
                  scope: "common",
                  key: "hpPercentBuff",
                  unit: "%",
                }),
                numberField({
                  label: "파티 고정 관입력",
                  value: common.flatPenetrationBuff,
                  scope: "common",
                  key: "flatPenetrationBuff",
                  unit: "pt",
                }),
              ].join("")
            : ""
        }
        ${numberField({
          label: "파티 피해 보너스",
          value: common.partyDamageBonusPercent,
          scope: "common",
          key: "partyDamageBonusPercent",
          unit: "%",
        })}
        ${
          common.mode !== "anomaly"
            ? numberField({
                label: "파티 치명타 피해",
                value: common.partyCriticalDamagePercent,
                scope: "common",
                key: "partyCriticalDamagePercent",
                unit: "%",
              })
            : ""
        }
        ${checkboxField({
          label: "그로기 상태",
          checked: common.stunned,
          scope: "common",
          key: "stunned",
          hint: "켜면 그로기 배율을 적용합니다.",
        })}
      </div>
    </section>
  `;
}

function resultMetric(label, value) {
  if (value === undefined || value === null || Number.isNaN(value)) return "";
  return `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>`;
}

function renderInvalidInputError(target) {
  target.innerHTML = `
    <div class="comparison-error">
      <strong>빈 입력값이 있습니다.</strong>
      <p>표시된 필드에 숫자를 입력하면 비교 결과가 다시 계산됩니다.</p>
    </div>
  `;
}

function renderResult() {
  const target = document.querySelector("#comparison-result");
  if (!target) return;
  if (document.querySelector('#compare-app [aria-invalid="true"]')) {
    renderInvalidInputError(target);
    return;
  }
  let result;
  try {
    result = compareInvestments(comparisonState);
  } catch (error) {
    target.innerHTML = `
      <div class="comparison-error">
        <strong>계산할 수 없는 입력입니다.</strong>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
    return;
  }

  const winnerLabel =
    result.winner === "tie"
      ? "동일"
      : `${result.winner}안 우세`;
  const deltaPercent =
    result.deltaPercent === null
      ? "기준값 없음"
      : `${result.deltaPercent >= 0 ? "+" : ""}${decimalFormatter.format(
          result.deltaPercent,
        )}%`;
  const previewUsed = [result.A, result.B].some(
    (item) =>
      item.character.version.includes("preview") ||
      item.weapon.version?.includes("preview"),
  );

  const profileResult = (id, profileResult) => `
    <article
      class="comparison-result__plan comparison-result__plan--${id.toLowerCase()}"
      aria-labelledby="result-title-${id.toLowerCase()}"
    >
      <span id="result-title-${id.toLowerCase()}">PLAN ${id} · ${escapeHtml(profileResult.profile.label)}</span>
      <p class="comparison-build-summary">
        ${escapeHtml(profileResult.character.name)} · M${profileResult.profile.mindscape} ·
        ${escapeHtml(profileResult.weapon.name)}
      </p>
      <strong>${formatter.format(profileResult.displayedDamage)}</strong>
      <small>${escapeHtml(profileResult.modelLabel)} 기대 피해</small>
      <div class="result-mini-metrics">
        ${resultMetric(
          "마을 공격력",
          profileResult.townAttack === undefined
            ? null
            : formatter.format(profileResult.townAttack),
        )}
        ${resultMetric(
          "전투 공격력",
          profileResult.combatAttack === undefined
            ? null
            : formatter.format(profileResult.combatAttack),
        )}
        ${resultMetric(
          "전투 HP",
          profileResult.calculation.combatHp === undefined
            ? null
            : formatter.format(profileResult.calculation.combatHp),
        )}
        ${resultMetric(
          "관입력",
          profileResult.combatPenetration === undefined
            ? null
            : formatter.format(profileResult.combatPenetration),
        )}
        ${resultMetric(
          "이상 마스터리",
          profileResult.anomalyProficiency === undefined
            ? null
            : decimalFormatter.format(profileResult.anomalyProficiency),
        )}
      </div>
    </article>
  `;

  target.innerHTML = `
    <div class="comparison-result__heading">
      <div>
        <span class="compare-step">03 · VERDICT</span>
        <h3>비교 결과</h3>
      </div>
      <span
        class="verdict-chip verdict-chip--${result.winner}"
        role="status"
        aria-live="polite"
      >${winnerLabel} · ${deltaPercent}</span>
    </div>
    <div class="comparison-result__grid">
      ${profileResult("A", result.A)}
      <div class="comparison-delta">
        <span>B − A</span>
        <strong>${deltaPercent}</strong>
        <small>${result.deltaDisplayed >= 0 ? "+" : ""}${formatter.format(
          result.deltaDisplayed,
        )} 피해</small>
      </div>
      ${profileResult("B", result.B)}
    </div>
    <div class="comparison-assumptions">
      <strong>자동 반영 범위</strong>
      <p>
        에이전트 60레벨 기초 수치, W-엔진 60레벨 기초 공격력과 고급 속성,
        디스크·공통 조건·직접 입력한 조건부 효과를 반영했습니다.
        시네마 단계는 비교 기록에만 사용하며, 시네마 효과와 W-엔진 패시브는
        고급 설정에 직접 입력한 수치만 반영합니다.
      </p>
      ${
        previewUsed
          ? "<p class=\"preview-warning\">프리뷰 데이터가 포함되어 출시 전 변경될 수 있습니다.</p>"
          : ""
      }
    </div>
  `;
}

function render() {
  const root = document.querySelector("#compare-app");
  if (!root) return;
  root.innerHTML = `
    ${renderCommon()}
    <section class="comparison-plans">
      <div class="comparison-plans__heading">
        <div>
          <span class="compare-step">02 · BUILD TWO PLANS</span>
          <h3>투자안 A/B</h3>
          <p>엔진 고급 속성까지 자동 반영하고 조건부 효과는 직접 조정합니다.</p>
        </div>
      </div>
      <div class="investment-grid">
        ${renderProfile("A")}
        ${renderProfile("B")}
      </div>
    </section>
    <section class="comparison-result" id="comparison-result"></section>
    <p class="catalog-note">
      기본 수치 출처:
      <a href="https://zzz.nanoka.cc/" target="_blank" rel="noreferrer">zzz.nanoka.cc ↗</a>
      · 라이브 3.0 / 일부 프리뷰 3.1.12 · ${CATALOG_VERIFIED_AT} 확인
    </p>
  `;
  renderResult();
}

function stateTarget(scope) {
  if (scope === "common") return comparisonState.common;
  if (scope === "profile-A") return comparisonState.profiles.A;
  if (scope === "profile-B") return comparisonState.profiles.B;
  return null;
}

function restoreFieldFocus(scope, key) {
  document
    .querySelector(
      `#compare-app [data-compare-scope="${scope}"][data-compare-key="${key}"]`,
    )
    ?.focus();
}

function handleInput(event) {
  const input = event.target.closest("[data-compare-scope][data-compare-key]");
  if (!input) return;
  const isSelect = input.tagName === "SELECT";
  const isCheckbox = input.type === "checkbox";
  if (event.type === "input" && (isSelect || isCheckbox)) return;
  if (event.type === "change" && !isSelect && !isCheckbox) return;

  const target = stateTarget(input.dataset.compareScope);
  if (!target) return;
  const key = input.dataset.compareKey;
  const type = input.dataset.compareType;
  const errorNote = input
    .closest(".compare-field")
    ?.querySelector(".compare-input-error");
  let value;
  if (type === "boolean") {
    value = input.checked;
  } else if (type === "number") {
    if (input.value.trim() === "") {
      input.setAttribute("aria-invalid", "true");
      if (errorNote) errorNote.textContent = "값을 입력해 주세요.";
      renderResult();
      return;
    }
    value = Number(input.value);
    if (!Number.isFinite(value)) {
      input.setAttribute("aria-invalid", "true");
      if (errorNote) errorNote.textContent = "유효한 숫자를 입력해 주세요.";
      renderResult();
      return;
    }
  } else {
    value = input.value;
  }
  input.removeAttribute("aria-invalid");
  if (errorNote) errorNote.textContent = "";
  target[key] = value;
  if (key === "characterId") {
    comparisonState.profiles.A.characterId = value;
    comparisonState.profiles.B.characterId = value;
    alignProfileWeapon(comparisonState.profiles.A);
    alignProfileWeapon(comparisonState.profiles.B);
    comparisonState.common.mode = recommendedMode(
      CHARACTER_BY_ID[value] ?? CHARACTER_BY_ID["1041"],
    );
  }
  persistState();

  const needsFullRender = [
    "mode",
    "characterId",
    "weaponId",
    "mindscape",
  ].includes(key);
  if (needsFullRender) {
    render();
    restoreFieldFocus(input.dataset.compareScope, key);
  } else {
    if (key === "label") {
      input
        .closest(".investment-card")
        ?.querySelector(".investment-card__header h4")
        ?.replaceChildren(document.createTextNode(value));
    }
    renderResult();
  }
}

function handleAction(event) {
  const action = event.target.closest("[data-compare-action]")?.dataset
    .compareAction;
  if (!action) return;
  if (action === "copy-a-to-b") {
    comparisonState.profiles.B = {
      ...comparisonState.profiles.A,
      label: `${comparisonState.profiles.A.label} 복사본`,
    };
  } else if (action === "swap") {
    const A = comparisonState.profiles.A;
    comparisonState.profiles.A = comparisonState.profiles.B;
    comparisonState.profiles.B = A;
  } else if (action === "reset") {
    comparisonState = createDefaultComparisonState();
  }
  persistState();
  render();
  document
    .querySelector(`[data-compare-action="${action}"]`)
    ?.focus();
}

function handleAdvancedToggle(event) {
  const details = event.target.closest(".compare-advanced[data-compare-plan]");
  if (!details) return;
  const profile = comparisonState.profiles[details.dataset.comparePlan];
  if (!profile) return;
  profile.advancedOpen = details.open;
  persistState();
}

export function initComparison() {
  const root = document.querySelector("#compare-app");
  if (!root) return;
  comparisonState = loadState();
  normalizeSelections();
  persistState();
  root.addEventListener("input", handleInput);
  root.addEventListener("change", handleInput);
  root.addEventListener("click", handleAction);
  root.addEventListener("toggle", handleAdvancedToggle, true);
  document
    .querySelector('[data-reset="compare"]')
    ?.addEventListener("click", () => {
      comparisonState = createDefaultComparisonState();
      persistState();
      render();
    });
  render();
}
