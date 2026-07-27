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
import { DISC_SET_BY_ID, DISC_SETS } from "./data/discs.js";
import {
  characterElement,
  characterImage,
  discImage,
  ELEMENT_LABELS,
  weaponImage,
} from "./data/media.js";
import {
  DISC_PRESET_SCORES,
  discPresetType,
  normalizeDiscSelections,
  recommendedDiscSets,
} from "./disk-build.js";

const STORAGE_KEY = "new-eridu-investment-comparison:v1";
const COMPARISON_SPECIALTIES = new Set(["강공", "이상", "명파"]);
const LIVE_CHARACTERS = CHARACTERS.filter(
  (character) =>
    character.version.includes("3.0 live") &&
    COMPARISON_SPECIALTIES.has(character.specialty),
);
const formatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 0,
});
const decimalFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 2,
});
const SKILL_TYPE_OPTIONS = Object.freeze([
  { value: "normal", label: "일반 공격" },
  { value: "dash", label: "대시 공격" },
  { value: "counter", label: "회피 반격" },
  { value: "ex", label: "강화 특수" },
  { value: "chain", label: "콤보 스킬" },
  { value: "ultimate", label: "궁극기" },
  { value: "assist", label: "지원 공격" },
  { value: "aftershock", label: "여진 공격" },
  { value: "all", label: "상한 추정 · 전용 전체" },
]);
const ANOMALY_KEY_BY_ELEMENT = Object.freeze({
  physical: "강타",
  fire: "연소",
  electric: "감전",
  ice: "쇄빙",
  ether: "침식",
  wind: "풍화",
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

function imageMarkup(src, alt, className = "") {
  return `<img
    class="${escapeHtml(className)}"
    src="${escapeHtml(src)}"
    alt="${escapeHtml(alt)}"
    width="142"
    height="142"
    loading="lazy"
    decoding="async"
  />`;
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
    // 저장 공간이 차단되어도 계산은 계속 동작한다.
  }
}

function recommendedMode(character) {
  if (character.specialty === "명파") return "mingpo";
  if (character.specialty === "이상") return "anomaly";
  return "strong";
}

function liveWeapons(character) {
  return compatibleWeapons(character.specialty).filter((weapon) =>
    weapon.version.includes("3.0 live"),
  );
}

function alignProfileWeapon(profile, character) {
  const options = liveWeapons(character);
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

function suggestedPlanWeapons(character) {
  const options = liveWeapons(character);
  const signatureId = `14${character.id.slice(0, 3)}`;
  const primary =
    options.find((weapon) => weapon.id === signatureId) ??
    options.find((weapon) => weapon.rank === "S급") ??
    options[0];
  const alternative =
    options.find(
      (weapon) => weapon.rank === "A급" && weapon.id !== primary?.id,
    ) ??
    options.find((weapon) => weapon.id !== primary?.id) ??
    primary;
  return {
    A: primary?.id ?? "custom",
    B: alternative?.id ?? "custom",
  };
}

function normalizeSelections() {
  const character =
    LIVE_CHARACTERS.find(
      (item) => item.id === comparisonState.common.characterId,
    ) ?? CHARACTER_BY_ID["1041"];
  comparisonState.common.characterId = character.id;
  for (const profile of Object.values(comparisonState.profiles)) {
    profile.characterId = character.id;
    const refinement = Math.trunc(Number(profile.weaponRefinement));
    profile.weaponRefinement = Number.isFinite(refinement)
      ? Math.min(5, Math.max(1, refinement))
      : 1;
    profile.weaponEffectMode =
      profile.weaponEffectMode === "off" ? "off" : "max";
    profile.mindscapeEffectMode =
      profile.mindscapeEffectMode === "off" ? "off" : "max";
    alignProfileWeapon(profile, character);
    normalizeDiscSelections(
      profile,
      character,
      comparisonState.common.mode,
    );
    const presetType = discPresetType(profile, comparisonState.common.mode);
    if (presetType !== "manual") {
      const allowedScores = DISC_PRESET_SCORES[presetType];
      if (!allowedScores.includes(Number(profile.discScore))) {
        profile.discScore = 30;
      }
    }
  }
}

function applyModeChoice(mode) {
  if (!COMPARISON_MODES[mode]) return;
  comparisonState.common.mode = mode;
  const character = CHARACTER_BY_ID[comparisonState.common.characterId];
  if (mode === "anomaly") {
    comparisonState.common.anomalyKey =
      ANOMALY_KEY_BY_ELEMENT[characterElement(character.id)] ?? "강타";
  }
  for (const profile of Object.values(comparisonState.profiles)) {
    const recommended = recommendedDiscSets(character, mode);
    profile.discFourPieceId = recommended.fourPieceId;
    profile.discTwoPieceId = recommended.twoPieceId;
    const presetType = discPresetType(profile, mode);
    if (presetType !== "manual") {
      const allowedScores = DISC_PRESET_SCORES[presetType];
      if (!allowedScores.includes(Number(profile.discScore))) {
        profile.discScore = 30;
      }
    }
  }
}

function stateTarget(scope) {
  if (scope === "common") return comparisonState.common;
  if (scope === "profile-A") return comparisonState.profiles.A;
  if (scope === "profile-B") return comparisonState.profiles.B;
  return null;
}

function attributes(scope, key, type = "text") {
  return `data-compare-scope="${scope}" data-compare-key="${key}" data-compare-type="${type}"`;
}

function choiceAttributes(scope, key, value, type = "text") {
  return [
    'data-compare-choice="true"',
    `data-compare-scope="${scope}"`,
    `data-compare-key="${key}"`,
    `data-compare-value="${escapeHtml(value)}"`,
    `data-compare-type="${type}"`,
  ].join(" ");
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
  return `
    <label class="compare-field ${wide ? "compare-field--wide" : ""}">
      <span>${escapeHtml(label)}${
        hint ? `<small>${escapeHtml(hint)}</small>` : ""
      }</span>
      <select ${attributes(scope, key, "text")}>
        ${options
          .map(
            (option) => `<option
              value="${escapeHtml(option.value)}"
              ${String(option.value) === String(value) ? "selected" : ""}
            >${escapeHtml(option.label)}</option>`,
          )
          .join("")}
      </select>
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
      <span>${escapeHtml(label)}${
        hint ? `<small>${escapeHtml(hint)}</small>` : ""
      }</span>
      <span class="compare-control">
        <input
          type="number"
          step="${escapeHtml(step)}"
          value="${escapeHtml(value)}"
          ${attributes(scope, key, "number")}
        />
        ${unit ? `<b>${escapeHtml(unit)}</b>` : ""}
      </span>
      <small class="compare-input-error" aria-live="polite"></small>
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

function segmentedChoices({
  scope,
  key,
  value,
  options,
  type = "text",
  label,
}) {
  return `
    <div class="compare-segment-group">
      ${label ? `<span>${escapeHtml(label)}</span>` : ""}
      <div class="compare-segments" role="group" aria-label="${escapeHtml(
        label || key,
      )}">
        ${options
          .map(
            (option) => `<button
              type="button"
              class="${String(value) === String(option.value) ? "is-active" : ""}"
              aria-pressed="${
                String(value) === String(option.value) ? "true" : "false"
              }"
              ${choiceAttributes(scope, key, option.value, type)}
            >${escapeHtml(option.label)}</button>`,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderCharacterPicker(character) {
  const element = characterElement(character.id);
  return `
    <section class="character-stage" aria-labelledby="selected-character-name">
      <div class="character-stage__selected">
        ${imageMarkup(
          characterImage(character.id),
          character.name,
          "character-stage__portrait",
        )}
        <div>
          <span class="compare-step">01 · SELECT AGENT</span>
          <h3 id="selected-character-name">${escapeHtml(character.name)}</h3>
          <p>
            ${escapeHtml(character.rank)} ·
            ${escapeHtml(ELEMENT_LABELS[element])} ·
            ${escapeHtml(character.specialty)}
          </p>
        </div>
        <div class="character-stage__stats" aria-label="기초 능력치">
          <span><small>공격력</small><strong>${formatter.format(
            character.attack,
          )}</strong></span>
          <span><small>HP</small><strong>${formatter.format(
            character.hp,
          )}</strong></span>
          <span><small>치확</small><strong>${decimalFormatter.format(
            character.critRate,
          )}%</strong></span>
          <span><small>이상 마스터리</small><strong>${formatter.format(
            character.anomalyProficiency,
          )}</strong></span>
        </div>
      </div>
      <details class="visual-picker visual-picker--character">
        <summary>
          캐릭터 변경
          <small>라이브 3.0 · ${LIVE_CHARACTERS.length}명</small>
        </summary>
        <div class="visual-picker__grid visual-picker__grid--characters">
          ${LIVE_CHARACTERS.map((item) => {
            const selected = item.id === character.id;
            return `<button
              type="button"
              class="visual-option ${selected ? "is-selected" : ""}"
              aria-pressed="${selected}"
              ${choiceAttributes("common", "characterId", item.id)}
            >
              ${imageMarkup(
                characterImage(item.id),
                "",
                "visual-option__image",
              )}
              <strong>${escapeHtml(item.name)}</strong>
              <small>${escapeHtml(item.specialty)}</small>
            </button>`;
          }).join("")}
        </div>
      </details>
    </section>
  `;
}

function renderCommon(character) {
  const common = comparisonState.common;
  const suggestedMode = recommendedMode(character);
  return `
    ${renderCharacterPicker(character)}
    <section class="comparison-common">
      <div class="comparison-common__heading">
        <div>
          <span class="compare-step">02 · SHARED CONDITIONS</span>
          <h3>대표 피해 조건</h3>
          <p>피해 종류만 고르면 두 투자안에 똑같이 적용됩니다.</p>
        </div>
        <div class="comparison-actions">
          <button type="button" data-compare-action="copy-a-to-b">A를 B로 복사</button>
          <button type="button" data-compare-action="swap">A ↔ B</button>
        </div>
      </div>
      ${
        common.mode !== suggestedMode
          ? `<p class="comparison-model-warning">
              ${escapeHtml(character.name)}의 기본 추천식은
              ${escapeHtml(COMPARISON_MODES[suggestedMode])}입니다.
            </p>`
          : ""
      }
      <div class="compare-quick-row">
        ${selectField({
          label: "계산식",
          value: common.mode,
          options: Object.entries(COMPARISON_MODES).map(([value, label]) => ({
            value,
            label,
          })),
          scope: "common",
          key: "mode",
        })}
        ${selectField({
          label: "대표 공격",
          value: common.skillType,
          options: SKILL_TYPE_OPTIONS,
          scope: "common",
          key: "skillType",
          hint: "스킬 한정 효과 자동 판정",
        })}
        ${
          common.mode === "anomaly"
            ? selectField({
                label: "이상 종류",
                value: common.anomalyKey,
                options: [
                  "연소",
                  "침식",
                  "감전",
                  "쇄빙",
                  "강타",
                  "풍화",
                ].map((value) => ({
                  value,
                  label: `${value} · ${decimalFormatter.format(
                    NORMAL_ANOMALY_COEFFICIENTS[value] / 100,
                  )}×`,
                })),
                scope: "common",
                key: "anomalyKey",
              })
            : ""
        }
        ${checkboxField({
          label: "적 그로기",
          checked: common.stunned,
          scope: "common",
          key: "stunned",
          hint: "그로기 배율 적용",
        })}
      </div>
      <details class="compare-advanced compare-advanced--common">
        <summary>적·파티 수치 직접 조정</summary>
        <p>기본 비교에는 열 필요가 없습니다. 실제 파티 버프를 맞출 때만 사용하세요.</p>
        <div class="compare-field-grid">
          ${
            common.mode !== "mingpo"
              ? numberField({
                  label: "적 방어력",
                  value: common.enemyDefense,
                  scope: "common",
                  key: "enemyDefense",
                  unit: "pt",
                }) +
                numberField({
                  label: "방어력 감소",
                  value: common.enemyDefenseReductionPercent,
                  scope: "common",
                  key: "enemyDefenseReductionPercent",
                  unit: "%",
                })
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
            label: "파티 공격력",
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
          ${
            common.mode === "mingpo"
              ? numberField({
                  label: "파티 HP",
                  value: common.hpPercentBuff,
                  scope: "common",
                  key: "hpPercentBuff",
                  unit: "%",
                }) +
                numberField({
                  label: "파티 고정 관입력",
                  value: common.flatPenetrationBuff,
                  scope: "common",
                  key: "flatPenetrationBuff",
                  unit: "pt",
                })
              : ""
          }
        </div>
      </details>
    </section>
  `;
}

function renderWeaponPicker(id, character, profile, profileResult) {
  const scope = `profile-${id}`;
  const weapon =
    profile.weaponId === "custom" ? null : WEAPON_BY_ID[profile.weaponId];
  const weaponPassive = profileResult?.weaponPassive;
  const options = liveWeapons(character);
  return `
    <div class="build-selector">
      <span class="build-selector__label">W-엔진</span>
      ${
        weapon
          ? `<div class="selected-build-item">
              ${imageMarkup(
                weaponImage(weapon.id),
                weapon.name,
                "selected-build-item__image",
              )}
              <div>
                <strong>${escapeHtml(weapon.name)}</strong>
                <small>${escapeHtml(weapon.rank)} · 기초 ${formatter.format(
                  weapon.baseAttack,
                )} · ${escapeHtml(weapon.secondaryStat)}
                ${decimalFormatter.format(weapon.secondaryValue)}${
                  weapon.secondaryUnit === "percent" ? "%" : ""
                }</small>
                <span class="selected-build-item__status">
                  R${profile.weaponRefinement} · ${
                    profile.weaponEffectMode === "max"
                      ? "조건 최대 적용"
                      : "상시 효과만 적용"
                  }
                </span>
              </div>
            </div>`
          : `<div class="selected-build-item selected-build-item--manual">
              <div><strong>직접 입력 엔진</strong><small>고급 설정의 기초 공격력 사용</small></div>
            </div>`
      }
      ${
        weapon
          ? `<div class="engine-tuning">
              ${segmentedChoices({
                scope,
                key: "weaponRefinement",
                value: profile.weaponRefinement,
                type: "number",
                options: Array.from({ length: 5 }, (_, index) => ({
                  value: index + 1,
                  label: `R${index + 1}`,
                })),
                label: "재련 단계",
              })}
              ${segmentedChoices({
                scope,
                key: "weaponEffectMode",
                value: profile.weaponEffectMode,
                options: [
                  { value: "off", label: "조건 미발동" },
                  { value: "max", label: "조건 최대" },
                ],
                label: "엔진 조건부 효과",
              })}
              <div class="weapon-passive-preview">
                <strong>${escapeHtml(
                  weaponPassive?.title ?? "엔진 패시브",
                )}</strong>
                <small>${escapeHtml(
                  weaponPassive?.description ??
                    "선택한 재련 단계의 수치 효과를 계산합니다.",
                )}</small>
              </div>
            </div>`
          : ""
      }
      <details class="visual-picker">
        <summary>엔진 변경 <small>${options.length}개 호환</small></summary>
        <div class="visual-picker__grid">
          ${options
            .map((item) => {
              const selected = item.id === profile.weaponId;
              return `<button
                type="button"
                class="visual-option ${selected ? "is-selected" : ""}"
                aria-pressed="${selected}"
                ${choiceAttributes(scope, "weaponId", item.id)}
              >
                ${imageMarkup(
                  weaponImage(item.id),
                  "",
                  "visual-option__image",
                )}
                <strong>${escapeHtml(item.name)}</strong>
                <small>${escapeHtml(item.rank)} · ${escapeHtml(
                  item.secondaryStat,
                )}</small>
              </button>`;
            })
            .join("")}
          <button
            type="button"
            class="visual-option visual-option--manual ${
              profile.weaponId === "custom" ? "is-selected" : ""
            }"
            aria-pressed="${profile.weaponId === "custom"}"
            ${choiceAttributes(scope, "weaponId", "custom")}
          >
            <span aria-hidden="true">＋</span>
            <strong>직접 입력</strong>
            <small>기초 공격력 수동</small>
          </button>
        </div>
      </details>
    </div>
  `;
}

function renderDiscPicker(id, profile, pieceCount) {
  const scope = `profile-${id}`;
  const key = pieceCount === 4 ? "discFourPieceId" : "discTwoPieceId";
  const selected = DISC_SET_BY_ID[profile[key]];
  const options = DISC_SETS.filter(
    (set) => pieceCount === 4 || set.id !== profile.discFourPieceId,
  );
  const description = pieceCount === 4 ? selected?.desc4 : selected?.desc2;
  return `
    <div class="build-selector build-selector--disc">
      <span class="build-selector__label">${pieceCount}세트</span>
      <div class="selected-build-item">
        ${imageMarkup(
          discImage(selected?.id ?? options[0].id),
          selected?.name ?? "디스크",
          "selected-build-item__image",
        )}
        <div>
          <strong>${escapeHtml(selected?.name ?? "선택 안 됨")}</strong>
          <small>${escapeHtml(description ?? "")}</small>
        </div>
      </div>
      <details class="visual-picker">
        <summary>${pieceCount}세트 변경 <small>라이브 3.0</small></summary>
        <div class="visual-picker__grid">
          ${options
            .map((set) => {
              const isSelected = set.id === profile[key];
              return `<button
                type="button"
                class="visual-option ${isSelected ? "is-selected" : ""}"
                aria-pressed="${isSelected}"
                ${choiceAttributes(scope, key, set.id)}
              >
                ${imageMarkup(
                  discImage(set.id),
                  "",
                  "visual-option__image",
                )}
                <strong>${escapeHtml(set.name)}</strong>
                <small>${escapeHtml(
                  pieceCount === 4 ? set.desc4 : set.desc2,
                )}</small>
              </button>`;
            })
            .join("")}
        </div>
      </details>
    </div>
  `;
}

function renderDiscPreset(id, profile, profileResult, mode) {
  const scope = `profile-${id}`;
  const build = profileResult.discBuild;
  const type = discPresetType(profile, mode);
  const scoreType = type === "manual"
    ? mode === "anomaly"
      ? "anomaly"
      : "attack"
    : type;
  const scores = DISC_PRESET_SCORES[scoreType];
  const rollSummary =
    build.rolls && build.type === "anomaly"
      ? `이상마 ${build.rolls.anomalyProficiency}타 · 공격력 ${build.rolls.attackPercent}타`
      : build.rolls
        ? `치확 ${build.rolls.critRatePercent}타 · 치피 ${build.rolls.critDamagePercent}타 · 공격력 ${build.rolls.attackPercent}타`
        : "직접 입력 수치 사용";
  return `
    <section class="disc-workbench">
      <div class="disc-workbench__heading">
        <div>
          <span class="build-selector__label">디스크 프리셋</span>
          <h5>${build.type === "anomaly" ? "이상형" : build.type === "attack" ? "치명형" : "수동형"}</h5>
        </div>
        <small>1점 = S급 +15 유효 부옵 1타</small>
      </div>
      ${segmentedChoices({
        scope,
        key: "discBuildMode",
        value: profile.discBuildMode,
        options: [
          { value: "auto", label: "역할 자동" },
          { value: "anomaly", label: "이상형" },
          { value: "attack", label: "치명형" },
          { value: "manual", label: "수동" },
        ],
        label: "분배 방식",
      })}
      ${
        type !== "manual"
          ? segmentedChoices({
              scope,
              key: "discScore",
              value: build.score,
              type: "number",
              options: scores.map((score) => ({
                value: score,
                label: `${score}점`,
              })),
              label: "유효 부옵",
            })
          : ""
      }
      <div class="preset-stat-strip">
        <span><small>공격력</small><strong>+${decimalFormatter.format(
          build.discAttackPercent + build.setTotals.discAttackPercent,
        )}%</strong></span>
        ${
          build.type === "anomaly"
            ? `<span><small>이상 마스터리</small><strong>+${decimalFormatter.format(
                build.discAnomalyProficiency +
                  build.setTotals.discAnomalyProficiency,
              )}</strong></span>
              <span><small>이상 장악력</small><strong>+${decimalFormatter.format(
                build.discAnomalyMasteryPercent +
                  build.setTotals.discAnomalyMasteryPercent,
              )}%</strong></span>`
            : `<span><small>치확</small><strong>+${decimalFormatter.format(
                build.discCritRatePercent +
                  build.setTotals.discCritRatePercent +
                  build.setTotals.passiveCritRatePercent,
              )}%</strong></span>
              <span><small>치피</small><strong>+${decimalFormatter.format(
                build.discCritDamagePercent +
                  build.setTotals.discCritDamagePercent +
                  build.setTotals.passiveCritDamagePercent,
              )}%</strong></span>`
        }
      </div>
      <p class="preset-roll-summary">
        ${escapeHtml(rollSummary)}
        ${
          build.type === "attack"
            ? build.fixedCritOverflowPercent > 0
              ? ` · 고정 효과만으로 치확 ${decimalFormatter.format(
                  build.totalCritRate,
                )}%`
              : build.critUpperBoundReached
                ? ` · 치확 상한 배분 ${decimalFormatter.format(
                    build.totalCritRate,
                  )}% (초과 방지)`
              : " · 부옵 한도 내 만치확 미달"
            : " · 이상마/공퍼 1:1"
        }
      </p>
    </section>
  `;
}

function renderEffectSummary(profileResult) {
  const activeDiscEffects = profileResult.discBuild.effects.filter(
    (effect) => effect.active && effect.modeledStats.length > 0,
  );
  const unsupportedDiscEffects = profileResult.discBuild.effects.filter(
    (effect) => effect.active && effect.unsupportedStats.length > 0,
  );
  const mindscape = profileResult.mindscape;
  const appliedMindscape = mindscape?.applied ?? [];
  const unsupportedMindscape = mindscape?.unsupported ?? [];
  const weaponPassive = profileResult.weaponPassive;
  const appliedWeapon = weaponPassive?.applied ?? [];
  const unsupportedWeapon = weaponPassive?.unsupported ?? [];
  const scopedOutMindscape = (mindscape?.skipped ?? []).filter((effect) =>
    effect.skippedReason?.startsWith("scope:"),
  );
  const scopedOutWeapon = (weaponPassive?.skipped ?? []).filter((effect) =>
    effect.skippedReason?.startsWith("scope:"),
  );
  const weaponEffectLabel = (effect) =>
    effect?.label ?? effect?.title ?? effect?.stat ?? weaponPassive?.title ??
    "엔진 효과";
  const scopeReason = (reason) => {
    const key = reason?.replace("scope:", "");
    return {
      mode: "선택 계산식",
      element: "캐릭터 속성",
      anomalyKey: "이상 종류",
      skillType: "대표 공격",
      characterId: "장착 캐릭터",
    }[key] ?? "선택 조건";
  };
  return `
    <div class="auto-effect-summary">
      <div>
        <strong>자동 반영 중</strong>
        ${
          activeDiscEffects.length +
              appliedMindscape.length +
              appliedWeapon.length ===
            0
            ? "<small>상시 효과 없음 · 조건부는 미발동</small>"
            : `<ul>
                ${activeDiscEffects
                  .map(
                    (effect) =>
                      `<li>${escapeHtml(effect.setName)} · ${escapeHtml(
                        effect.label,
                      )}${effect.multiplier > 1 ? ` ×${effect.multiplier}` : ""}</li>`,
                  )
                  .join("")}
                ${appliedMindscape
                  .map(
                    (effect) =>
                      `<li>M${effect.level} · ${escapeHtml(effect.label)}</li>`,
                  )
                  .join("")}
                ${appliedWeapon
                  .map(
                    (effect) =>
                      `<li>${escapeHtml(
                        profileResult.weapon.name,
                      )} R${weaponPassive.refinement} · ${escapeHtml(
                        weaponEffectLabel(effect),
                      )}${
                        effect.activeStacks > 1
                          ? ` ×${effect.activeStacks}`
                          : ""
                      }</li>`,
                  )
                  .join("")}
              </ul>`
        }
      </div>
      ${
        unsupportedMindscape.length +
          unsupportedDiscEffects.length +
          unsupportedWeapon.length
          ? `<details>
              <summary>현재 대표식에서 제외 ${
                unsupportedMindscape.length +
                unsupportedDiscEffects.length +
                unsupportedWeapon.length
              }개</summary>
              <ul>${unsupportedDiscEffects
                .map(
                  (effect) =>
                    `<li>${escapeHtml(effect.setName)} · ${escapeHtml(
                      effect.label,
                    )} — 별도 전투 지표</li>`,
                )
                .join("")}${unsupportedMindscape
                .map(
                  (effect) =>
                    `<li>M${effect.level} · ${escapeHtml(
                      effect.label,
                    )} — ${escapeHtml(effect.reason ?? "별도 피해식 필요")}</li>`,
                )
                .join("")}${unsupportedWeapon
                .map(
                  (effect) =>
                    `<li>${escapeHtml(
                      profileResult.weapon.name,
                    )} · ${escapeHtml(
                      weaponEffectLabel(effect),
                    )} — ${escapeHtml(
                      effect.reason ?? "별도 피해식 필요",
                    )}</li>`,
                )
                .join("")}</ul>
            </details>`
          : ""
      }
      ${
        scopedOutMindscape.length + scopedOutWeapon.length
          ? `<details>
              <summary>선택 조건에서 미적용 ${
                scopedOutMindscape.length + scopedOutWeapon.length
              }개</summary>
              <ul>${scopedOutMindscape
                .map(
                  (effect) =>
                    `<li>M${effect.level} · ${escapeHtml(
                      effect.label,
                    )} — ${escapeHtml(
                      scopeReason(effect.skippedReason),
                    )} 불일치</li>`,
                )
                .join("")}${scopedOutWeapon
                .map(
                  (effect) =>
                    `<li>${escapeHtml(
                      profileResult.weapon.name,
                    )} · ${escapeHtml(
                      weaponEffectLabel(effect),
                    )} — ${escapeHtml(
                      scopeReason(effect.skippedReason),
                    )} 불일치</li>`,
                )
                .join("")}</ul>
            </details>`
          : ""
      }
    </div>
  `;
}

function renderManualFields(id, profile, mode, manualDisc) {
  const scope = `profile-${id}`;
  const fields = [];
  if (manualDisc) {
    fields.push(
      numberField({
        label: "디스크 공격력",
        value: profile.discAttackPercent,
        scope,
        key: "discAttackPercent",
        unit: "%",
      }),
      numberField({
        label: "디스크 치확",
        value: profile.discCritRatePercent,
        scope,
        key: "discCritRatePercent",
        unit: "%",
      }),
      numberField({
        label: "디스크 치피",
        value: profile.discCritDamagePercent,
        scope,
        key: "discCritDamagePercent",
        unit: "%",
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
        label: "디스크 HP",
        value: profile.discHpPercent,
        scope,
        key: "discHpPercent",
        unit: "%",
      }),
      numberField({
        label: "기본 피해 보너스",
        value: profile.damageBonusPercent,
        scope,
        key: "damageBonusPercent",
        unit: "%",
      }),
    );
  }
  fields.push(
    numberField({
      label: "대표 스킬 계수",
      value: profile.skillCoefficientPercent,
      scope,
      key: "skillCoefficientPercent",
      unit: "%",
    }),
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
    numberField({
      label: "저항 감소",
      value: profile.passiveResistanceReductionPercent,
      scope,
      key: "passiveResistanceReductionPercent",
      unit: "%",
    }),
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
  if (mode !== "anomaly") {
    fields.push(
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
  } else {
    fields.push(
      numberField({
        label: "추가 이상 마스터리",
        value: profile.passiveAnomalyProficiency,
        scope,
        key: "passiveAnomalyProficiency",
        unit: "pt",
      }),
      numberField({
        label: "이상 피해 보너스",
        value: profile.anomalyDamageBonusPercent,
        scope,
        key: "anomalyDamageBonusPercent",
        unit: "%",
      }),
    );
  }
  if (mode === "mingpo") {
    fields.push(
      numberField({
        label: "전투 중 HP",
        value: profile.passiveHpPercent,
        scope,
        key: "passiveHpPercent",
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
        label: "추가 고정 관입력",
        value: profile.passiveFlatPenetration,
        scope,
        key: "passiveFlatPenetration",
        unit: "pt",
      }),
    );
  }
  return fields.join("");
}

function renderProfile(id, character, profileResult) {
  const profile = comparisonState.profiles[id];
  const scope = `profile-${id}`;
  const type = discPresetType(profile, comparisonState.common.mode);
  return `
    <article class="investment-card investment-card--${id.toLowerCase()}">
      <header class="investment-card__header">
        <span class="investment-badge">PLAN ${id}</span>
        <div>
          <h4>투자안 ${id}</h4>
          <small>${escapeHtml(character.name)} · M${profile.mindscape} · ${
            type === "anomaly" ? "이상형" : type === "attack" ? "치명형" : "수동형"
          }</small>
        </div>
      </header>
      <div class="investment-card__body">
        <section class="cinema-selector">
          <div class="cinema-selector__heading">
            <span class="build-selector__label">시네마</span>
            <small>선택 단계까지 누적</small>
          </div>
          ${segmentedChoices({
            scope,
            key: "mindscape",
            value: profile.mindscape,
            type: "number",
            options: Array.from({ length: 7 }, (_, value) => ({
              value,
              label: `M${value}`,
            })),
            label: "시네마 단계",
          })}
          ${segmentedChoices({
            scope,
            key: "mindscapeEffectMode",
            value: profile.mindscapeEffectMode,
            options: [
              { value: "off", label: "조건 미발동" },
              { value: "max", label: "조건 최대" },
            ],
            label: "조건부 효과",
          })}
        </section>
        ${renderWeaponPicker(id, character, profile, profileResult)}
        ${renderDiscPreset(
          id,
          profile,
          profileResult,
          comparisonState.common.mode,
        )}
        <div class="disc-set-grid">
          ${renderDiscPicker(id, profile, 4)}
          ${renderDiscPicker(id, profile, 2)}
        </div>
        ${segmentedChoices({
          scope,
          key: "discEffectMode",
          value: profile.discEffectMode,
          options: [
            { value: "off", label: "4세트 조건 미발동" },
            { value: "max", label: "4세트 최대 발동" },
          ],
          label: "4세트 조건",
        })}
        ${renderEffectSummary(profileResult)}
        <details
          class="compare-advanced"
          data-compare-plan="${id}"
          ${profile.advancedOpen ? "open" : ""}
        >
          <summary>수동 수치·대표 계수 조정</summary>
          <p>
            프리셋에 없는 파티 효과나 자동 환산 제외 효과를 직접 보정할 때만
            사용합니다. 엔진·시네마 자동 수치와 별도 층으로 합산됩니다.
          </p>
          <div class="compare-field-grid">
            ${
              profile.weaponId === "custom"
                ? numberField({
                    label: "엔진 기초 공격력",
                    value: profile.customEngineBaseAttack,
                    scope,
                    key: "customEngineBaseAttack",
                    unit: "pt",
                  })
                : ""
            }
            ${renderManualFields(
              id,
              profile,
              comparisonState.common.mode,
              type === "manual",
            )}
          </div>
        </details>
        <div class="catalog-sources">
          <a class="catalog-source" href="${escapeHtml(
            character.sourceUrl,
          )}" target="_blank" rel="noreferrer">${escapeHtml(
            character.name,
          )} 원본 수치 ↗</a>
          ${
            profileResult.weapon.id === "custom"
              ? ""
              : `<a class="catalog-source" href="${escapeHtml(
                  profileResult.weapon.sourceUrl,
                )}" target="_blank" rel="noreferrer">${escapeHtml(
                  profileResult.weapon.name,
                )} 원문 ↗</a>`
          }
          <a class="catalog-source" href="${escapeHtml(
            DISC_SET_BY_ID[profile.discFourPieceId]?.sourceUrl ?? "#",
          )}" target="_blank" rel="noreferrer">디스크 원문 ↗</a>
        </div>
      </div>
    </article>
  `;
}

function resultMetric(label, value) {
  if (value === undefined || value === null || Number.isNaN(value)) return "";
  return `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(
    value,
  )}</strong></span>`;
}

function renderResult(providedResult) {
  const target = document.querySelector("#comparison-result");
  if (!target) return;
  if (document.querySelector('#compare-app [aria-invalid="true"]')) {
    target.innerHTML = `
      <div class="comparison-error">
        <strong>빈 입력값이 있습니다.</strong>
        <p>표시된 수동 필드에 숫자를 입력하면 결과가 다시 계산됩니다.</p>
      </div>`;
    return;
  }
  let result = providedResult;
  try {
    result ??= compareInvestments(comparisonState);
  } catch (error) {
    target.innerHTML = `
      <div class="comparison-error">
        <strong>계산할 수 없는 입력입니다.</strong>
        <p>${escapeHtml(error.message)}</p>
      </div>`;
    return;
  }
  const winnerLabel = result.winner === "tie"
    ? "동일"
    : `${result.winner}안 우세`;
  const deltaPercent = result.deltaPercent === null
    ? "기준값 없음"
    : `${result.deltaPercent >= 0 ? "+" : ""}${decimalFormatter.format(
        result.deltaPercent,
      )}%`;
  const plan = (id, data) => `
    <article class="comparison-result__plan comparison-result__plan--${id.toLowerCase()}">
      <span>PLAN ${id} · 투자안 ${id}</span>
      <p class="comparison-build-summary">
        M${data.profile.mindscape} · ${escapeHtml(data.weapon.name)}${
          data.weapon.id === "custom"
            ? ""
            : ` R${data.profile.weaponRefinement}`
        } ·
        ${data.discBuild.type === "manual" ? "수동 디스크" : `${data.discBuild.score}점 ${data.discBuild.type === "anomaly" ? "이상형" : "치명형"}`}
      </p>
      <strong>${formatter.format(data.displayedDamage)}</strong>
      <small>${escapeHtml(data.modelLabel)} 기대 피해</small>
      <div class="result-mini-metrics">
        ${resultMetric(
          "마을 공격력",
          data.townAttack === undefined
            ? null
            : formatter.format(data.townAttack),
        )}
        ${resultMetric(
          "전투 공격력",
          data.combatAttack === undefined
            ? null
            : formatter.format(data.combatAttack),
        )}
        ${resultMetric(
          "전투 HP",
          data.calculation.combatHp === undefined
            ? null
            : formatter.format(data.calculation.combatHp),
        )}
        ${resultMetric(
          "이상 마스터리",
          data.anomalyProficiency === undefined
            ? null
            : decimalFormatter.format(data.anomalyProficiency),
        )}
      </div>
    </article>`;
  target.innerHTML = `
    <div class="comparison-result__heading">
      <div><span class="compare-step">04 · VERDICT</span><h3>비교 결과</h3></div>
      <span class="verdict-chip verdict-chip--${result.winner}" role="status">
        ${winnerLabel} · ${deltaPercent}
      </span>
    </div>
    <div class="comparison-result__grid">
      ${plan("A", result.A)}
      <div class="comparison-delta">
        <span>B − A</span>
        <strong>${deltaPercent}</strong>
        <small>${result.deltaDisplayed >= 0 ? "+" : ""}${formatter.format(
          result.deltaDisplayed,
        )} 피해</small>
      </div>
      ${plan("B", result.B)}
    </div>
    <div class="comparison-assumptions">
      <strong>자동 반영 범위</strong>
      <p>
        라이브 3.0의 60레벨 기초 수치, 엔진 기초·고급 속성과 재련별 패시브,
        디스크 주옵·유효 부옵 프리셋, 2·4세트 효과와 적용 가능한 시네마
        수치를 합산했습니다. 조건부 효과는 각 투자안의 ‘조건 최대’ 선택 때
        최대치로 계산합니다.
      </p>
    </div>
  `;
}

function render() {
  const root = document.querySelector("#compare-app");
  if (!root) return;
  normalizeSelections();
  const character =
    CHARACTER_BY_ID[comparisonState.common.characterId] ??
    CHARACTER_BY_ID["1041"];
  let result;
  let calculationError;
  try {
    result = compareInvestments(comparisonState);
  } catch (error) {
    calculationError = error;
  }
  if (!result) {
    root.innerHTML = `
      ${renderCommon(character)}
      <div class="comparison-error">
        <strong>저장된 비교 조건을 계산할 수 없습니다.</strong>
        <p>${escapeHtml(
          calculationError?.message ?? "비교 기본값을 복원해 주세요.",
        )}</p>
      </div>
    `;
    return;
  }
  root.innerHTML = `
    ${renderCommon(character)}
    <section class="comparison-plans">
      <div class="comparison-plans__heading">
        <div>
          <span class="compare-step">03 · BUILD TWO PLANS</span>
          <h3>투자안 A/B</h3>
          <p>이미지로 엔진과 4+2세트를 고르고, 프리셋 점수만 선택하세요.</p>
        </div>
      </div>
      <div class="investment-grid">
        ${renderProfile(
          "A",
          character,
          result.A,
        )}
        ${renderProfile(
          "B",
          character,
          result.B,
        )}
      </div>
    </section>
    <section class="comparison-result" id="comparison-result"></section>
    <p class="catalog-note">
      수치·설명 참고:
      <a href="https://zzz.nanoka.cc/" target="_blank" rel="noreferrer">zzz.nanoka.cc ↗</a>
      · 라이브 3.0 고정 · ${CATALOG_VERIFIED_AT} 확인 · 이미지는 로컬 제공
    </p>
  `;
  renderResult(result);
}

function applyCharacterChoice(characterId) {
  const character = LIVE_CHARACTERS.find((item) => item.id === characterId);
  if (!character) return;
  comparisonState.common.characterId = character.id;
  comparisonState.common.mode = recommendedMode(character);
  if (comparisonState.common.mode === "anomaly") {
    comparisonState.common.anomalyKey =
      ANOMALY_KEY_BY_ELEMENT[characterElement(character.id)] ?? "강타";
  }
  const planWeapons = suggestedPlanWeapons(character);
  for (const [id, profile] of Object.entries(comparisonState.profiles)) {
    profile.characterId = character.id;
    profile.weaponId = planWeapons[id];
    profile.weaponRefinement = id === "B" ? 5 : 1;
    const recommended = recommendedDiscSets(
      character,
      comparisonState.common.mode,
    );
    profile.discFourPieceId = recommended.fourPieceId;
    profile.discTwoPieceId = recommended.twoPieceId;
    if (profile.discBuildMode === "auto") {
      profile.discScore =
        comparisonState.common.mode === "anomaly" ? 30 : 30;
    }
  }
}

function handleChoice(event) {
  const button = event.target.closest("[data-compare-choice]");
  if (!button) return false;
  const target = stateTarget(button.dataset.compareScope);
  if (!target) return true;
  const key = button.dataset.compareKey;
  const type = button.dataset.compareType;
  const value =
    type === "number"
      ? Number(button.dataset.compareValue)
      : button.dataset.compareValue;
  target[key] = value;

  if (key === "characterId") {
    applyCharacterChoice(String(value));
  }
  if (key === "mode") {
    applyModeChoice(value);
  }
  if (key === "weaponId" && value !== "custom") {
    target.weaponRefinement =
      WEAPON_BY_ID[value]?.rank === "S급" ? 1 : 5;
  }
  if (key === "discBuildMode" && value !== "manual") {
    const effectiveType =
      value === "auto"
        ? comparisonState.common.mode === "anomaly"
          ? "anomaly"
          : "attack"
        : value;
    const allowed = DISC_PRESET_SCORES[effectiveType];
    if (!allowed.includes(Number(target.discScore))) {
      target.discScore = allowed[allowed.length - 1];
    }
  }
  if (key === "discFourPieceId" || key === "discTwoPieceId") {
    const character = CHARACTER_BY_ID[comparisonState.common.characterId];
    normalizeDiscSelections(
      target,
      character,
      comparisonState.common.mode,
    );
  }
  persistState();
  render();
  return true;
}

function handleInput(event) {
  const input = event.target.closest("[data-compare-scope][data-compare-key]");
  if (!input) return;
  const isSelect = input.tagName === "SELECT";
  const isCheckbox = input.type === "checkbox";
  if (event.type === "input" && (isSelect || isCheckbox)) return;
  const target = stateTarget(input.dataset.compareScope);
  if (!target) return;
  const type = input.dataset.compareType;
  let value;
  if (type === "boolean") {
    value = input.checked;
  } else if (type === "number") {
    if (input.value.trim() === "" || !Number.isFinite(Number(input.value))) {
      input.setAttribute("aria-invalid", "true");
      const note = input
        .closest(".compare-field")
        ?.querySelector(".compare-input-error");
      if (note) note.textContent = "숫자를 입력해 주세요.";
      renderResult();
      return;
    }
    value = Number(input.value);
  } else {
    value = input.value;
  }
  input.removeAttribute("aria-invalid");
  const note = input
    .closest(".compare-field")
    ?.querySelector(".compare-input-error");
  if (note) note.textContent = "";
  target[input.dataset.compareKey] = value;
  if (
    input.dataset.compareScope === "common" &&
    input.dataset.compareKey === "mode"
  ) {
    applyModeChoice(value);
  }
  persistState();
  if (isSelect || isCheckbox || event.type === "change") {
    render();
  } else {
    renderResult();
  }
}

function handleAction(event) {
  if (handleChoice(event)) return;
  const action = event.target.closest("[data-compare-action]")?.dataset
    .compareAction;
  if (!action) return;
  if (action === "copy-a-to-b") {
    comparisonState.profiles.B = {
      ...comparisonState.profiles.A,
      label: `${comparisonState.profiles.A.label} 복사본`,
    };
  } else if (action === "swap") {
    const profileA = comparisonState.profiles.A;
    comparisonState.profiles.A = comparisonState.profiles.B;
    comparisonState.profiles.B = profileA;
  }
  persistState();
  render();
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
