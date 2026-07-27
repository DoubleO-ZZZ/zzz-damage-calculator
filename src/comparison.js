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
  ENEMY_BY_ID,
  S_RANK_ENEMIES,
} from "./data/enemies.js";
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
const LIVE_PARTY_CHARACTERS = CHARACTERS.filter((character) =>
  character.version.includes("3.0 live"),
);
const PARTY_CHARACTER_PRIORITY = Object.freeze([
  "1311",
  "1161",
  "1031",
  "1151",
  "1211",
  "1341",
]);
const DEFAULT_PARTY_DISC_BY_SPECIALTY = Object.freeze({
  지원: "33400",
  격파: "33200",
  방어: "33700",
  이상: "31300",
  명파: "33700",
});
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

function signatureWeaponIds(character) {
  const prefix = character.id.slice(0, 3);
  return [`14${prefix}`, `13${prefix}`];
}

function alignProfileWeapon(profile, character) {
  const options = liveWeapons(character);
  if (
    profile.weaponId !== "custom" &&
    !options.some((weapon) => weapon.id === profile.weaponId)
  ) {
    profile.weaponId =
      options.find((weapon) =>
        signatureWeaponIds(character).includes(weapon.id),
      )?.id ??
      options[0]?.id ??
      "custom";
  }
}

function suggestedPlanWeapons(character) {
  const options = liveWeapons(character);
  const primary =
    options.find((weapon) =>
      signatureWeaponIds(character).includes(weapon.id),
    ) ??
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

function defaultPartyDisc(character) {
  return (
    DEFAULT_PARTY_DISC_BY_SPECIALTY[character?.specialty] ??
    "31900"
  );
}

function alignPartyMember(member, character, { resetDisc = false } = {}) {
  const options = liveWeapons(character);
  if (!options.some((weapon) => weapon.id === member.weaponId)) {
    member.weaponId =
      options.find((weapon) =>
        signatureWeaponIds(character).includes(weapon.id),
      )?.id ??
      options[0]?.id ??
      "";
  }
  const refinement = Math.trunc(Number(member.weaponRefinement));
  member.weaponRefinement = Number.isFinite(refinement)
    ? Math.min(5, Math.max(1, refinement))
    : 1;
  if (
    resetDisc ||
    !DISC_SET_BY_ID[String(member.discFourPieceId)]
  ) {
    member.discFourPieceId = defaultPartyDisc(character);
  }
}

function fallbackPartyCharacter(used) {
  return (
    PARTY_CHARACTER_PRIORITY.map((id) => CHARACTER_BY_ID[id]).find(
      (character) => character && !used.has(character.id),
    ) ??
    LIVE_PARTY_CHARACTERS.find((character) => !used.has(character.id)) ??
    LIVE_PARTY_CHARACTERS[0]
  );
}

function normalizeSelections() {
  const character =
    LIVE_CHARACTERS.find(
      (item) => item.id === comparisonState.common.characterId,
    ) ?? CHARACTER_BY_ID["1041"];
  comparisonState.common.characterId = character.id;
  comparisonState.common.enemyId = ENEMY_BY_ID[
    String(comparisonState.common.enemyId)
  ]
    ? String(comparisonState.common.enemyId)
    : "30032";
  comparisonState.common.party ??= {};
  const usedPartyCharacters = new Set([character.id]);
  for (const [slotKey, slot] of [
    ["member2", 2],
    ["member3", 3],
  ]) {
    const member = {
      ...(comparisonState.common.party[slotKey] ?? {}),
      slot,
    };
    let memberCharacter = LIVE_PARTY_CHARACTERS.find(
      (item) =>
        item.id === String(member.characterId) &&
        !usedPartyCharacters.has(item.id),
    );
    if (!memberCharacter) {
      memberCharacter = fallbackPartyCharacter(usedPartyCharacters);
      member.characterId = memberCharacter.id;
      alignPartyMember(member, memberCharacter, { resetDisc: true });
    } else {
      member.characterId = memberCharacter.id;
      alignPartyMember(member, memberCharacter);
    }
    usedPartyCharacters.add(memberCharacter.id);
    comparisonState.common.party[slotKey] = member;
  }
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
  if (scope === "party-2") return comparisonState.common.party.member2;
  if (scope === "party-3") return comparisonState.common.party.member3;
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

const SUPPORT_STAT_LABELS = Object.freeze({
  initialAttack: "초기 공격력",
  initialHp: "초기 HP",
  critRate: "치명타 확률",
  penetrationRatio: "관통률",
  impact: "충격력",
  anomalyMastery: "이상 장악력",
  energyRegen: "에너지 자동 회복",
});

const PARTY_EFFECT_STAT_LABELS = Object.freeze({
  attackPercent: "공격력",
  flatAttack: "고정 공격력",
  hpPercent: "HP",
  flatPenetration: "관입력",
  critRate: "치명타 확률",
  critDamage: "치명타 피해",
  damageBonus: "피해 보너스",
  penetrationPercent: "관통률",
  defenseReduction: "방어력 감소",
  defenseIgnore: "방어력 무시",
  resistanceReduction: "저항 감소",
  resistanceIgnore: "저항 무시",
  receivedDamageIncrease: "받는 피해 증가",
  anomalyProficiency: "이상 마스터리",
  anomalyMasteryFlat: "이상 장악력",
  anomalyDamageBonus: "이상 피해",
  stunMultiplier: "그로기 약체 배율",
});

function supportStatValue(stat, value) {
  const formatted = decimalFormatter.format(value);
  if (
    stat === "critRate" ||
    stat === "penetrationRatio"
  ) {
    return `${formatted}%`;
  }
  if (stat === "energyRegen") return formatted;
  return formatted;
}

function partyEffectValue(stat, value) {
  const formatted = decimalFormatter.format(value);
  return ["flatAttack", "flatPenetration", "anomalyProficiency", "anomalyMasteryFlat"]
    .includes(stat)
    ? `+${formatted}`
    : `+${formatted}%`;
}

function partySkippedReason(reason) {
  if (reason === "non-stacking-duplicate") {
    return "같은 효과는 가장 높은 수치만 적용";
  }
  if (reason === "inactive") return "최대 발동 옵션이 꺼짐";
  if (reason === "eligibility") return "추가 능력의 파티 편성 조건 불충족";
  if (reason?.startsWith("scope:")) {
    return "속성·직군·공격 유형 적용 조건 불충족";
  }
  if (reason === "scope") return "착용자 또는 딜러의 속성 조건 불충족";
  if (reason === "condition") return "발동 조건 불충족";
  return reason || "현재 조합에서 비활성";
}

function renderEnemyPicker(character, enemy) {
  const element = characterElement(character.id);
  const elementLabel = ELEMENT_LABELS[element] ?? element;
  const selected = enemy ?? ENEMY_BY_ID[comparisonState.common.enemyId];
  return `
    <article class="enemy-picker">
      <div class="enemy-picker__visual">
        ${imageMarkup(
          selected.icon,
          selected.name,
          "enemy-picker__image",
        )}
        <span>S</span>
      </div>
      <div class="enemy-picker__body">
        <span class="build-selector__label">비교 대상</span>
        <h4>${escapeHtml(selected.name)}</h4>
        <p>
          Lv.70 환산 방어력 ${formatter.format(selected.defenseAt60)}
          · ${escapeHtml(elementLabel)} 저항
          ${selected.resistances[element] > 0 ? "+" : ""}${decimalFormatter.format(
            selected.resistances[element] ?? 0,
          )}%
          · 그로기 ${decimalFormatter.format(
            selected.stunMultiplierPercent,
          )}%
        </p>
        ${selectField({
          label: "S급 몬스터",
          value: selected.id,
          options: S_RANK_ENEMIES.map((item) => ({
            value: item.id,
            label: `${item.name} · 방어 ${formatter.format(item.defenseAt60)}`,
          })),
          scope: "common",
          key: "enemyId",
          hint: `${S_RANK_ENEMIES.length}종 · 속성 저항 자동 적용`,
          wide: true,
        })}
      </div>
      <a
        class="catalog-source"
        href="${escapeHtml(selected.sourceUrl)}"
        target="_blank"
        rel="noreferrer"
      >적 데이터 원문 ↗</a>
    </article>
  `;
}

function renderPartyMember(slot, partyMember) {
  const scope = `party-${slot}`;
  const slotKey = `member${slot}`;
  const member = comparisonState.common.party[slotKey];
  const character = CHARACTER_BY_ID[member.characterId];
  const weaponOptions = liveWeapons(character);
  const weapon =
    WEAPON_BY_ID[member.weaponId] ?? weaponOptions[0];
  const disc = DISC_SET_BY_ID[member.discFourPieceId];
  const build = partyMember?.build;
  const mainLabels = {
    attackPercent: "공격력%",
    hpPercent: "HP%",
    critRatePercent: "치확",
    penetrationRatio: "관통률",
    impactPercent: "충격력",
    anomalyMasteryPercent: "이상 장악력",
    energyRegenPercent: "에너지 회복",
  };
  const mains = Object.entries(build?.mains ?? {})
    .filter(([, count]) => Number(count) > 0)
    .map(([key, count]) => `${mainLabels[key] ?? key}${count > 1 ? ` ×${count}` : ""}`)
    .join(" · ");
  const cuts = build?.cuts ?? [];
  return `
    <article class="party-member-card">
      <header>
        <span>PARTY ${slot}</span>
        <div>
          <h4>${escapeHtml(character.name)}</h4>
          <small>${escapeHtml(character.rank)} · ${escapeHtml(
            ELEMENT_LABELS[characterElement(character.id)] ?? "",
          )} · ${escapeHtml(character.specialty)}</small>
        </div>
      </header>
      <div class="party-member-card__visuals">
        ${imageMarkup(
          characterImage(character.id),
          character.name,
          "party-member-card__portrait",
        )}
        ${imageMarkup(
          weaponImage(weapon.id),
          weapon.name,
          "party-member-card__equipment",
        )}
        ${imageMarkup(
          discImage(disc.id),
          disc.name,
          "party-member-card__equipment",
        )}
      </div>
      <div class="party-member-card__controls">
        ${selectField({
          label: "캐릭터",
          value: character.id,
          options: LIVE_PARTY_CHARACTERS.map((item) => ({
            value: item.id,
            label: `${item.name} · ${item.specialty}`,
          })),
          scope,
          key: "characterId",
          wide: true,
        })}
        ${selectField({
          label: "W-엔진",
          value: weapon.id,
          options: weaponOptions.map((item) => ({
            value: item.id,
            label: `${item.name} · ${item.rank}`,
          })),
          scope,
          key: "weaponId",
          wide: true,
        })}
        ${selectField({
          label: "디스크 4세트",
          value: disc.id,
          options: DISC_SETS.map((item) => ({
            value: item.id,
            label: item.name,
          })),
          scope,
          key: "discFourPieceId",
          wide: true,
        })}
      </div>
      ${segmentedChoices({
        scope,
        key: "weaponRefinement",
        value: member.weaponRefinement,
        type: "number",
        options: Array.from({ length: 5 }, (_, index) => ({
          value: index + 1,
          label: `R${index + 1}`,
        })),
        label: "엔진 재련",
      })}
      <div class="party-auto-build">
        <div>
          <strong>자동 세팅</strong>
          <span>${escapeHtml(
            DISC_SET_BY_ID[build?.twoPieceId]?.name ?? "추천 2세트",
          )} 2세트</span>
          ${mains ? `<span>주옵 ${escapeHtml(mains)}</span>` : ""}
          <span>컷까지 유효 부옵 ${formatter.format(
            build?.rolls?.total ?? 0,
          )}타</span>
        </div>
        ${
          cuts.length
            ? `<ul class="buff-cut-list">
                ${cuts
                  .map(
                    (cut) => `<li class="${
                      cut.reached ? "is-reached" : "is-unreached"
                    }">
                      <span>${escapeHtml(cut.label)}</span>
                      <strong>${supportStatValue(
                        cut.stat,
                        cut.actual,
                      )} / ${supportStatValue(
                        cut.stat,
                        cut.threshold,
                      )}</strong>
                      <small>${
                        cut.reached
                          ? `컷 충족 · ${cut.rolls}타 추가`
                          : cut.attainable
                            ? "부옵 한도 내 미달"
                            : "현재 장비로 상한 도달 불가"
                      }</small>
                    </li>`,
                  )
                  .join("")}
              </ul>`
            : `<p class="party-auto-build__note">
                별도 버프 컷 없음 · 역할 주옵과 2세트를 자동 배치합니다.
              </p>`
        }
      </div>
    </article>
  `;
}

function renderPartyLedger(party) {
  const active = party?.active ?? [];
  const skipped = party?.skipped ?? [];
  const unsupported = party?.unsupported ?? [];
  if (!party) return "";
  return `
    <div class="party-ledger">
      <div>
        <strong>파티 버프 ${active.length}개 자동 적용</strong>
        <small>요구 스탯을 충족한 핵심 패시브·추가 능력·스킬·엔진·4세트의 최대 발동 기준</small>
      </div>
      ${
        active.length
          ? `<ul>
              ${active
                .map(
                  (effect) => `<li>
                    <span>${escapeHtml(effect.ownerName || effect.sourceName)} · ${escapeHtml(
                      effect.label,
                    )}</span>
                    <strong>${escapeHtml(
                      PARTY_EFFECT_STAT_LABELS[effect.stat] ?? effect.stat,
                    )} ${partyEffectValue(effect.stat, effect.amount)}</strong>
                  </li>`,
                )
                .join("")}
            </ul>`
          : "<p>현재 조합에서 적용되는 파티 버프가 없습니다.</p>"
      }
      ${
        skipped.length
          ? `<details>
              <summary>현재 조합에서 미적용 ${skipped.length}개</summary>
              <ul>${skipped
                .map(
                  (effect) =>
                    `<li><span>${escapeHtml(
                      effect.ownerName || effect.sourceName,
                    )} · ${escapeHtml(effect.label)}</span><small>${escapeHtml(
                      partySkippedReason(effect.skippedReason),
                    )}</small></li>`,
                )
                .join("")}</ul>
            </details>`
          : ""
      }
      ${
        unsupported.length
          ? `<details>
              <summary>대표 1회 피해식에서 별도 처리 ${unsupported.length}개</summary>
              <ul>${unsupported
                .map(
                  (effect) =>
                    `<li><span>${escapeHtml(
                      effect.ownerName || effect.sourceName,
                    )} · ${escapeHtml(effect.label)}</span><small>${escapeHtml(
                      effect.unsupportedReason ?? "별도 전투 지표",
                    )}</small></li>`,
                )
                .join("")}</ul>
            </details>`
          : ""
      }
    </div>
  `;
}

function renderPartyBuilder(result) {
  const party = result?.party;
  return `
    <section class="party-builder">
      <div class="party-builder__heading">
        <div>
          <span class="compare-step">02 · BUILD PARTY</span>
          <h3>파티 조합</h3>
          <p>
            파티원은 캐릭터·엔진·4세트만 고르세요. 2세트·주옵·부옵은
            각 캐릭터의 버프 상한을 넘기는 최소치로 자동 배치됩니다.
          </p>
        </div>
        <span class="max-activation-badge">충족 가능한 버프 최대 활성</span>
      </div>
      <div class="party-member-grid">
        ${renderPartyMember(2, party?.members?.[0])}
        ${renderPartyMember(3, party?.members?.[1])}
      </div>
      ${renderPartyLedger(party)}
    </section>
  `;
}

function renderCommon(character, result = null) {
  const common = comparisonState.common;
  const suggestedMode = recommendedMode(character);
  return `
    ${renderCharacterPicker(character)}
    ${renderPartyBuilder(result)}
    <section class="comparison-common">
      <div class="comparison-common__heading">
        <div>
          <span class="compare-step">03 · SHARED CONDITIONS</span>
          <h3>대표 피해 조건</h3>
          <p>공격 종류와 S급 적만 고르면 두 투자안에 똑같이 적용됩니다.</p>
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
      ${renderEnemyPicker(character, result?.enemy)}
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
          hint: "그로기 배율·조건 효과 최대 적용",
        })}
      </div>
      <details class="compare-advanced compare-advanced--common">
        <summary>추가 보정 수치 직접 조정</summary>
        <p>선택한 적과 파티 효과에 더할 외부 보정이 있을 때만 사용하세요.</p>
        <div class="compare-field-grid">
          ${
            common.mode !== "mingpo"
              ? numberField({
                  label: "추가 방어력 감소",
                  value: common.enemyDefenseReductionPercent,
                  scope: "common",
                  key: "enemyDefenseReductionPercent",
                  unit: "%",
                })
              : ""
          }
          ${numberField({
            label: "적 저항 추가 보정",
            value: common.enemyResistanceAdjustmentPercent,
            scope: "common",
            key: "enemyResistanceAdjustmentPercent",
            unit: "%",
          })}
          ${numberField({
            label: "추가 저항 감소",
            value: common.resistanceReductionPercent,
            scope: "common",
            key: "resistanceReductionPercent",
            unit: "%",
          })}
          ${numberField({
            label: "추가 파티 공격력",
            value: common.attackPercentBuff,
            scope: "common",
            key: "attackPercentBuff",
            unit: "%",
          })}
          ${numberField({
            label: "추가 고정 공격력",
            value: common.flatAttackBuff,
            scope: "common",
            key: "flatAttackBuff",
            unit: "pt",
          })}
          ${numberField({
            label: "추가 피해 보너스",
            value: common.partyDamageBonusPercent,
            scope: "common",
            key: "partyDamageBonusPercent",
            unit: "%",
          })}
          ${
            common.mode !== "anomaly"
              ? numberField({
                  label: "추가 치명타 피해",
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
                  label: "추가 파티 HP",
                  value: common.hpPercentBuff,
                  scope: "common",
                  key: "hpPercentBuff",
                  unit: "%",
                }) +
                numberField({
                  label: "추가 고정 관입력",
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
        ? `6번 ${build.critMainStat === "critDamage" ? "치피" : "치확"} 주옵 · 치확 ${build.rolls.critRatePercent}타 · 치피 ${build.rolls.critDamagePercent}타 · 공격력 ${build.rolls.attackPercent}타`
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
  const agentEffects = profileResult.agentEffects;
  const appliedAgent = (agentEffects?.applied ?? []).filter(
    (effect) =>
      ["self", "party", "active", "enemy"].includes(effect.target),
  );
  const unsupportedAgent = agentEffects?.unsupported ?? [];
  const scopedOutMindscape = (mindscape?.skipped ?? []).filter((effect) =>
    effect.skippedReason?.startsWith("scope:"),
  );
  const scopedOutWeapon = (weaponPassive?.skipped ?? []).filter((effect) =>
    effect.skippedReason?.startsWith("scope:"),
  );
  const scopedOutAgent = (agentEffects?.skipped ?? []).filter(
    (effect) =>
      effect.skippedReason?.startsWith("scope:") ||
      effect.skippedReason?.startsWith("stat:") ||
      effect.skippedReason === "eligibility",
  );
  const originLabel = (origin) =>
    ({
      core: "핵심 패시브",
      additional: "추가 능력",
      skill: "스킬",
    })[origin] ?? "캐릭터 효과";
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
      skill: "대표 공격",
      specialty: "딜러 특성",
      stunned: "그로기 상태",
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
              appliedWeapon.length +
              appliedAgent.length ===
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
                ${appliedAgent
                  .map(
                    (effect) =>
                      `<li>${escapeHtml(originLabel(effect.origin))} · ${escapeHtml(
                        effect.label,
                      )}</li>`,
                  )
                  .join("")}
              </ul>`
        }
      </div>
      ${
        unsupportedMindscape.length +
          unsupportedDiscEffects.length +
          unsupportedWeapon.length +
          unsupportedAgent.length
          ? `<details>
              <summary>현재 대표식에서 제외 ${
                unsupportedMindscape.length +
                unsupportedDiscEffects.length +
                unsupportedWeapon.length +
                unsupportedAgent.length
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
                .join("")}${unsupportedAgent
                .map(
                  (effect) =>
                    `<li>${escapeHtml(originLabel(effect.origin))} · ${escapeHtml(
                      effect.label,
                    )} — ${escapeHtml(
                      effect.unsupportedReason ?? "별도 피해식 필요",
                    )}</li>`,
                )
                .join("")}</ul>
            </details>`
          : ""
      }
      ${
        scopedOutMindscape.length +
          scopedOutWeapon.length +
          scopedOutAgent.length
          ? `<details>
              <summary>선택 조건에서 미적용 ${
                scopedOutMindscape.length +
                scopedOutWeapon.length +
                scopedOutAgent.length
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
                .join("")}${scopedOutAgent
                .map(
                  (effect) =>
                    `<li>${escapeHtml(originLabel(effect.origin))} · ${escapeHtml(
                      effect.label,
                    )} — ${escapeHtml(
                      effect.skippedReason === "eligibility"
                        ? "파티 편성 조건 불일치"
                        : effect.skippedReason?.startsWith("stat:")
                          ? "요구 능력치 미달"
                        : `${scopeReason(effect.skippedReason)} 불일치`,
                    )}</li>`,
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
        ${resultMetric(
          "치명타 확률",
          data.discBuild?.type === "attack"
            ? `${decimalFormatter.format(
                Math.min(100, data.discBuild.totalCritRate),
              )}%`
            : null,
        )}
      </div>
    </article>`;
  target.innerHTML = `
    <div class="comparison-result__heading">
      <div><span class="compare-step">05 · VERDICT</span><h3>비교 결과</h3></div>
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
        라이브 3.0의 핵심 패시브·추가 능력·스킬, 파티원 엔진과 디스크,
        딜러 엔진 재련·시네마·디스크를 합산했습니다. 치확은 이 고정 효과를
        먼저 더한 뒤 100%를 넘지 않는 범위에서만 부옵을 배분합니다.
        파티 조건부 버프는 요구 스탯을 충족한 효과를 최대 활성화한 상한 비교입니다.
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
      ${renderCommon(character, null)}
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
    ${renderCommon(character, result)}
    <section class="comparison-plans">
      <div class="comparison-plans__heading">
        <div>
          <span class="compare-step">04 · BUILD TWO PLANS</span>
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

function applyPartyCharacterChoice(scope, characterId) {
  const target = stateTarget(scope);
  const character = LIVE_PARTY_CHARACTERS.find(
    (item) => item.id === String(characterId),
  );
  if (!target || !character) return;
  target.characterId = character.id;
  target.weaponId = "";
  alignPartyMember(target, character, { resetDisc: true });
  target.weaponRefinement =
    WEAPON_BY_ID[target.weaponId]?.rank === "S급" ? 1 : 5;
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

  if (
    key === "characterId" &&
    button.dataset.compareScope === "common"
  ) {
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
  const scope = input.dataset.compareScope;
  const key = input.dataset.compareKey;
  if (scope.startsWith("party-") && key === "characterId") {
    applyPartyCharacterChoice(scope, value);
  }
  if (
    scope.startsWith("party-") &&
    key === "weaponId" &&
    WEAPON_BY_ID[value]
  ) {
    target.weaponRefinement =
      WEAPON_BY_ID[value].rank === "S급" ? 1 : 5;
  }
  if (
    scope === "common" &&
    key === "mode"
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
