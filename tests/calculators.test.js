import assert from "node:assert/strict";
import test from "node:test";

import {
  ANOMALY_DEALER_A_DEFAULTS,
  ANOMALY_DEALER_B_DEFAULTS,
  calculateAnomalyCoefficient,
  calculateDealerStats,
  calculateMainAnomalyDamage,
  calculateMainAnomalyDamageSlot,
  calculateMingpo,
  calculateRemielRadianceCoefficient,
  calculateRemielRadianceDamage,
  calculateStrongAttack,
  getAdditionalMultiplier,
  getAnomalyDamageBonusMultiplier,
} from "../src/calculators.js";

const closeTo = (actual, expected, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

test("강공 기본값이 원본 시트의 중간값과 표기 데미지를 재현한다", () => {
  const result = calculateStrongAttack();

  assert.equal(result.baseAttack, 1681);
  assert.equal(result.townAttack, 3346);
  closeTo(result.combatAttack, 5449.8);
  closeTo(result.defenseMultiplier, 0.6014458941, 1e-10);
  closeTo(result.damageMultiplier, 2.98);
  closeTo(result.criticalMultiplier, 3.934);
  closeTo(result.resistanceMultiplier, 1.35);
  closeTo(result.stunMultiplier, 2.1);
  closeTo(result.rawDamage, 4194126.657, 0.001);
  assert.equal(result.displayedDamage, 4194127);
});

test("명파 기본값이 원본 시트의 체력·관입력과 표기 데미지를 재현한다", () => {
  const result = calculateMingpo();

  assert.equal(result.baseAttack, 1615);
  assert.equal(result.townAttack, 2036);
  assert.equal(result.townHp, 19561);
  closeTo(result.combatHp, 23473.2);
  assert.equal(result.townPenetration, 2566);
  closeTo(result.combatPenetration, 3857.22);
  closeTo(result.penetrationDamageMultiplier, 1.45);
  closeTo(result.damageMultiplier, 3.24);
  closeTo(result.criticalMultiplier, 4.112);
  closeTo(result.rawDamage, 6686517.347, 0.001);
  assert.equal(result.displayedDamage, 6686518);
});

test("이상 계산기의 딜러 A/B 상단 스탯을 정확히 계산한다", () => {
  const dealerA = calculateDealerStats(ANOMALY_DEALER_A_DEFAULTS);
  const dealerB = calculateDealerStats(ANOMALY_DEALER_B_DEFAULTS);

  assert.equal(dealerA.townAttack, 2775);
  assert.equal(dealerA.combatAttack, 4375);
  closeTo(dealerA.defenseMultiplier, 0.5324827916, 1e-10);
  closeTo(dealerA.damageMultiplier, 2.11);
  assert.equal(dealerA.anomalyProficiency, 615);
  closeTo(dealerA.mutationMultiplier, 1.2406);
  assert.equal(dealerA.initialAnomalyMastery, 112);
  assert.equal(dealerA.combatAnomalyMastery, 196);

  assert.equal(dealerB.townAttack, 2756);
  assert.equal(dealerB.combatAttack, 4356);
  closeTo(dealerB.defenseMultiplier, 0.459278112, 1e-10);
  closeTo(dealerB.damageMultiplier, 2.28);
  assert.equal(dealerB.anomalyProficiency, 675);
  assert.equal(dealerB.initialAnomalyMastery, 248);
  assert.equal(dealerB.combatAnomalyMastery, 248);
});

test("일반·혼돈·난류 이상계수 룩업과 잔여시간 내림을 재현한다", () => {
  assert.equal(
    calculateAnomalyCoefficient({ kind: "normal", element: "풍화" })
      .finalCoefficient,
    1250,
  );
  const disorder = calculateAnomalyCoefficient({
    kind: "혼돈",
    element: "서리",
    remainingSeconds: 17.9,
  });
  assert.equal(disorder.remainingSeconds, 17);
  assert.equal(disorder.finalCoefficient, 1875);

  const turbulence = calculateAnomalyCoefficient({
    kind: "난류",
    element: "쇄빙",
    remainingSeconds: 13.8,
  });
  assert.equal(turbulence.remainingSeconds, 13);
  assert.equal(turbulence.finalCoefficient, 1397.5);

  assert.equal(
    calculateAnomalyCoefficient({ kind: "혼돈" }).finalCoefficient,
    1875,
  );
  assert.equal(
    calculateAnomalyCoefficient({ kind: "난류" }).finalCoefficient,
    1397.5,
  );
});

test("난개 캐릭터별 고정·스탯 보정 계수를 재현한다", () => {
  assert.equal(
    calculateAnomalyCoefficient({ kind: "난개" }).finalCoefficient,
    255,
  );
  assert.equal(
    calculateAnomalyCoefficient({
      kind: "난개",
      character: "벨리나",
      skill: "광역 사이클론",
    }).finalCoefficient,
    255,
  );
  assert.equal(
    calculateAnomalyCoefficient({
      kind: "난개",
      character: "프로미아",
      skill: "처형식·단행",
    }).finalCoefficient,
    635,
  );
  assert.equal(
    calculateAnomalyCoefficient({
      kind: "난개",
      character: "남궁우",
      element: "쇄빙",
    }).finalCoefficient,
    450,
  );
  closeTo(
    calculateAnomalyCoefficient({
      kind: "난개",
      character: "아리아",
      element: "침식",
      stat: 253,
    }).finalCoefficient,
    434.84375,
  );
  closeTo(
    calculateAnomalyCoefficient({
      kind: "난개",
      character: "비비안",
      element: "강타",
      stat: 666,
    }).finalCoefficient,
    356.1435,
  );

  const workbookRows = {
    벨리나: 255,
    프로미아: 635,
    남궁우: 450,
    아리아: 434.84375,
    그레이스: 350,
    버니스: 300,
    비비안: 356.1435,
  };
  for (const [character, expected] of Object.entries(workbookRows)) {
    closeTo(
      calculateAnomalyCoefficient({ kind: "난개", character })
        .finalCoefficient,
      expected,
    );
  }
  assert.equal(getAdditionalMultiplier("남궁우", "(M2) 4스택"), 2.4);
});

test("이상피증 룩업은 딜러·종류별 기본 표기를 재현한다", () => {
  const dealerA = calculateDealerStats("A");
  const dealerB = calculateDealerStats("B");

  closeTo(getAnomalyDamageBonusMultiplier(dealerA, "풍화난개"), 2.333);
  closeTo(getAnomalyDamageBonusMultiplier(dealerB, "풍화난개"), 2.443);
  closeTo(getAnomalyDamageBonusMultiplier(dealerA, "쇄빙난류"), 1.99);
  closeTo(getAnomalyDamageBonusMultiplier(dealerB, "쇄빙난류"), 1.75);
  closeTo(getAnomalyDamageBonusMultiplier(dealerA, "혼돈"), 1.25);

  const correctedWorkbook = calculateDealerStats({
    ...ANOMALY_DEALER_A_DEFAULTS,
    elementDamageBonusPercent: { 침식: 5, 감전: 30 },
  });
  closeTo(
    getAnomalyDamageBonusMultiplier(correctedWorkbook, "감전난류"),
    2.29,
  );
});

test("메인 이상 데미지 비교 두 슬롯의 기본 출력을 재현한다", () => {
  const result = calculateMainAnomalyDamage();

  closeTo(result.slotA.rawDamage, 1483577.899, 0.001);
  assert.equal(result.slotA.displayedDamage, 1483578);
  assert.equal(result.slotA.snapshotDealer, "A");
  assert.equal(result.slotA.realtimeDealer, "B");
  closeTo(result.slotB.rawDamage, 3250576.084, 0.001);
  assert.equal(result.slotB.displayedDamage, 3250577);
  assert.equal(result.slotB.snapshotDealer, "B");
  assert.equal(result.slotB.realtimeDealer, "A");

  assert.equal(
    calculateMainAnomalyDamageSlot().displayedDamage,
    result.slotA.displayedDamage,
  );
});

test("레미엘 휘광 계수의 스킬 레벨·4돌 보정을 적용한다", () => {
  const defaultCoefficient = calculateRemielRadianceCoefficient();
  assert.equal(defaultCoefficient.baseCoefficient, 336);
  closeTo(defaultCoefficient.anomalyProficiencyMultiplier, 2.378);
  closeTo(defaultCoefficient.finalCoefficient, 799.008);

  const mindscape4 = calculateRemielRadianceCoefficient({
    mindscape4: true,
  });
  closeTo(mindscape4.finalCoefficient, 894.88896);
});

test("레미엘 휘광피해 전용 계산기의 두 기본 출력을 재현한다", () => {
  const result = calculateRemielRadianceDamage();

  closeTo(result.remiel.anomalyDamageMultiplier, 2.1);
  closeTo(result.remiel.resistanceMultiplier, 1.35);
  closeTo(result.remiel.mutationMultiplier, 1.2378);
  closeTo(result.slotA.rawDamage, 2161404.519, 0.001);
  assert.equal(result.slotA.displayedDamage, 2161405);
  closeTo(result.slotB.rawDamage, 2201390.506, 0.001);
  assert.equal(result.slotB.displayedDamage, 2201391);

  const splitResistance = calculateRemielRadianceDamage({
    slots: [
      { snapshotDealer: "A", resistanceScenario: "비약점" },
      { snapshotDealer: "B", resistanceScenario: "약점" },
    ],
  });
  closeTo(splitResistance.slotA.resistanceMultiplier, 1.15);
  closeTo(splitResistance.slotB.resistanceMultiplier, 1.35);

  const notStunned = calculateRemielRadianceDamage({
    remiel: { stunned: false },
  });
  closeTo(
    notStunned.slotA.rawDamage,
    result.slotA.rawDamage / result.remiel.stunMultiplier,
    0.001,
  );
});

test("정의되지 않은 룩업 값은 조용히 잘못 계산하지 않고 오류를 낸다", () => {
  assert.throws(
    () =>
      calculateAnomalyCoefficient({
        kind: "난류",
        element: "풍화",
        remainingSeconds: 1,
      }),
    /unsupported value/,
  );
  assert.throws(
    () =>
      calculateAnomalyCoefficient({
        kind: "난개",
        character: "아리아",
        element: "서리",
      }),
    /unsupported value/,
  );
});
