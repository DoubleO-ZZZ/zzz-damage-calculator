/**
 * Drive Disc set snapshot for ZZZ 3.0 live.
 *
 * Source: https://zzz.nanoka.cc/equipment
 * Verified: 2026-07-27
 *
 * Conditional 4-piece effects intentionally start disabled (or at 0 stacks).
 * A caller must opt in after confirming the combat condition. Effects with a
 * skill/attribute scope are kept explicit so they are not applied globally.
 */

export const DISC_DATA_VERIFIED_AT = "2026-07-27";

const imagePath = (id) => `./assets/nanoka/discs/${id}.webp`;

const effect = ({
  id,
  label,
  effects = {},
  condition = null,
  scope = null,
  stacks = null,
  always = false,
}) =>
  Object.freeze({
    id,
    label,
    effects: Object.freeze({ ...effects }),
    condition,
    scope,
    always,
    defaultActive: always,
    ...(stacks
      ? {
          stacks: Object.freeze({
            min: 0,
            default: 0,
            ...stacks,
          }),
        }
      : {}),
  });

const disc = ({
  id,
  name,
  nameEn,
  desc2,
  desc4,
  twoPiece = [],
  fourPiece = [],
}) =>
  Object.freeze({
    id,
    name,
    nameEn,
    image: imagePath(id),
    sourceUrl: `https://zzz.nanoka.cc/equipment/${id}`,
    version: "3.0 live",
    desc2,
    desc4,
    twoPiece: Object.freeze(twoPiece),
    fourPiece: Object.freeze(fourPiece),
  });

export const DISC_SETS = Object.freeze([
  disc({
    id: "31000",
    name: "딱따구리 일렉트로",
    nameEn: "Woodpecker Electro",
    desc2: "치명타 확률 +8%",
    desc4:
      "일반 공격·회피 반격·강화 특수 스킬이 치명타로 적중하면 해당 스킬별로 공격력 +9%, 6초 지속",
    twoPiece: [
      effect({
        id: "crit-rate",
        label: "치명타 확률 +8%",
        effects: { critRatePercent: 8 },
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "skill-crit-atk",
        label: "치명타를 낸 스킬 종류당 공격력 +9%",
        effects: { attackPercent: 9 },
        condition: "일반 공격·회피 반격·강화 특수 스킬로 치명타 적중",
        stacks: { max: 3 },
      }),
    ],
  }),
  disc({
    id: "31100",
    name: "복어 일렉트로",
    nameEn: "Puffer Electro",
    desc2: "관통률 +8%",
    desc4: "궁극기 피해 +20%. 궁극기 시전 후 공격력 +15%, 12초 지속",
    twoPiece: [
      effect({
        id: "pen-ratio",
        label: "관통률 +8%",
        effects: { penetrationRatioPercent: 8 },
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "ultimate-dmg",
        label: "궁극기 피해 +20%",
        effects: { damageBonusPercent: 20 },
        scope: Object.freeze({ skillTagsAny: ["ultimate"] }),
        always: true,
      }),
      effect({
        id: "after-ultimate-atk",
        label: "궁극기 시전 후 공격력 +15%",
        effects: { attackPercent: 15 },
        condition: "궁극기 시전 후 12초",
      }),
    ],
  }),
  disc({
    id: "31200",
    name: "쇼크스타 디스코",
    nameEn: "Shockstar Disco",
    desc2: "충격력 +6%",
    desc4: "일반 공격·대시 공격·회피 반격이 주 대상에게 주는 그로기 수치 +20%",
    twoPiece: [
      effect({
        id: "impact",
        label: "충격력 +6%",
        effects: { impactPercent: 6 },
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "daze",
        label: "주 대상에게 주는 그로기 수치 +20%",
        effects: { dazeBonusPercent: 20 },
        scope: Object.freeze({
          skillTagsAny: ["basic", "dash", "dodgeCounter"],
        }),
        always: true,
      }),
    ],
  }),
  disc({
    id: "31300",
    name: "자유의 블루스",
    nameEn: "Freedom Blues",
    desc2: "이상 마스터리 +30pt",
    desc4:
      "강화 특수 스킬 적중 시 대상의 착용자 속성 이상 축적 저항 -20%, 8초 지속",
    twoPiece: [
      effect({
        id: "anomaly-proficiency",
        label: "이상 마스터리 +30pt",
        effects: { anomalyProficiency: 30 },
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "anomaly-buildup-res",
        label: "같은 속성의 이상 축적 저항 -20%",
        effects: { anomalyBuildupResistanceReductionPercent: 20 },
        condition: "강화 특수 스킬 적중 후 8초",
      }),
    ],
  }),
  disc({
    id: "31400",
    name: "호르몬 펑크",
    nameEn: "Hormone Punk",
    desc2: "공격력 +10%",
    desc4: "전투 진입 또는 교대 출전 시 공격력 +25%, 10초 지속",
    twoPiece: [
      effect({
        id: "atk",
        label: "공격력 +10%",
        effects: { attackPercent: 10 },
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "entry-atk",
        label: "전투 진입·교대 출전 후 공격력 +25%",
        effects: { attackPercent: 25 },
        condition: "전투 진입 또는 교대 출전 후 10초",
      }),
    ],
  }),
  disc({
    id: "31500",
    name: "소울 록",
    nameEn: "Soul Rock",
    desc2: "방어력 +16%",
    desc4: "피격으로 HP 감소 시 받는 피해 -40%, 2.5초 지속",
    twoPiece: [
      effect({
        id: "def",
        label: "방어력 +16%",
        effects: { defensePercent: 16 },
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "after-hit-damage-taken",
        label: "피격 후 받는 피해 -40%",
        effects: { damageTakenReductionPercent: 40 },
        condition: "적에게 피격되어 HP가 감소한 후 2.5초",
      }),
    ],
  }),
  disc({
    id: "31600",
    name: "스윙 재즈",
    nameEn: "Swing Jazz",
    desc2: "에너지 자동 회복 +20%",
    desc4: "콤보 스킬 또는 궁극기 시전 시 모든 파티원이 주는 피해 +15%, 12초 지속",
    twoPiece: [
      effect({
        id: "energy-regen",
        label: "에너지 자동 회복 +20%",
        effects: { energyRegenPercent: 20 },
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "party-dmg",
        label: "파티가 주는 피해 +15%",
        effects: { damageBonusPercent: 15 },
        condition: "콤보 스킬 또는 궁극기 시전 후 12초",
      }),
    ],
  }),
  disc({
    id: "31800",
    name: "카오스 재즈",
    nameEn: "Chaos Jazz",
    desc2: "이상 마스터리 +30pt",
    desc4:
      "불·전기 피해 +15%. 오프필드 강화 특수·지원 공격 피해 +20%, 복귀 후 5초까지 유지",
    twoPiece: [
      effect({
        id: "anomaly-proficiency",
        label: "이상 마스터리 +30pt",
        effects: { anomalyProficiency: 30 },
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "fire-electric-dmg",
        label: "불·전기 피해 +15%",
        effects: { damageBonusPercent: 15 },
        scope: Object.freeze({ attributesAny: ["fire", "electric"] }),
        always: true,
      }),
      effect({
        id: "off-field-skill-dmg",
        label: "오프필드 강화 특수·지원 공격 피해 +20%",
        effects: { damageBonusPercent: 20 },
        condition: "오프필드 또는 복귀 후 5초 이내",
        scope: Object.freeze({
          skillTagsAny: ["exSpecial", "assist"],
        }),
      }),
    ],
  }),
  disc({
    id: "31900",
    name: "원시 펑크",
    nameEn: "Proto Punk",
    desc2: "실드 획득량 +15%",
    desc4: "파티원이 방어·회피 지원 발동 시 모든 파티원이 주는 피해 +15%, 10초 지속",
    twoPiece: [
      effect({
        id: "shield",
        label: "실드 획득량 +15%",
        effects: { shieldEffectPercent: 15 },
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "assist-party-dmg",
        label: "파티가 주는 피해 +15%",
        effects: { damageBonusPercent: 15 },
        condition: "방어 지원 또는 회피 지원 발동 후 10초",
      }),
    ],
  }),
  disc({
    id: "32200",
    name: "불지옥 메탈",
    nameEn: "Inferno Metal",
    desc2: "불 속성 피해 +10%",
    desc4: "연소 상태 적 적중 시 치명타 확률 +28%, 8초 지속",
    twoPiece: [
      effect({
        id: "fire-dmg",
        label: "불 속성 피해 +10%",
        effects: { damageBonusPercent: 10 },
        scope: Object.freeze({ attributesAny: ["fire"] }),
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "burning-crit",
        label: "연소 상태 적 적중 시 치명타 확률 +28%",
        effects: { critRatePercent: 28 },
        condition: "연소 상태 적 적중 후 8초",
      }),
    ],
  }),
  disc({
    id: "32300",
    name: "카오스 메탈",
    nameEn: "Chaotic Metal",
    desc2: "에테르 피해 +10%",
    desc4:
      "치명타 피해 +20%. 파티가 침식 추가 피해 발동 시 치명타 피해가 중첩당 +5.5%, 최대 6중첩",
    twoPiece: [
      effect({
        id: "ether-dmg",
        label: "에테르 피해 +10%",
        effects: { damageBonusPercent: 10 },
        scope: Object.freeze({ attributesAny: ["ether"] }),
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "crit-dmg",
        label: "치명타 피해 +20%",
        effects: { critDamagePercent: 20 },
        always: true,
      }),
      effect({
        id: "corruption-crit-dmg",
        label: "침식 추가 피해 발동당 치명타 피해 +5.5%",
        effects: { critDamagePercent: 5.5 },
        condition: "파티원이 침식 추가 피해 발동 후 8초",
        stacks: { max: 6 },
      }),
    ],
  }),
  disc({
    id: "32400",
    name: "썬더 메탈",
    nameEn: "Thunder Metal",
    desc2: "전기 속성 피해 +10%",
    desc4: "전투 중 감전 상태의 적이 존재하면 공격력 +28%",
    twoPiece: [
      effect({
        id: "electric-dmg",
        label: "전기 속성 피해 +10%",
        effects: { damageBonusPercent: 10 },
        scope: Object.freeze({ attributesAny: ["electric"] }),
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "shocked-atk",
        label: "감전 상태 적 존재 시 공격력 +28%",
        effects: { attackPercent: 28 },
        condition: "전투 중 감전 상태의 적 존재",
      }),
    ],
  }),
  disc({
    id: "32500",
    name: "극지 메탈",
    nameEn: "Polar Metal",
    desc2: "얼음 속성 피해 +10%",
    desc4:
      "일반·대시 공격 피해 +20%. 파티가 빙결 또는 쇄빙 발동 시 추가 +20%, 12초 지속",
    twoPiece: [
      effect({
        id: "ice-dmg",
        label: "얼음 속성 피해 +10%",
        effects: { damageBonusPercent: 10 },
        scope: Object.freeze({ attributesAny: ["ice"] }),
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "basic-dash-dmg",
        label: "일반·대시 공격 피해 +20%",
        effects: { damageBonusPercent: 20 },
        scope: Object.freeze({ skillTagsAny: ["basic", "dash"] }),
        always: true,
      }),
      effect({
        id: "freeze-basic-dash-dmg",
        label: "빙결·쇄빙 후 일반·대시 공격 피해 추가 +20%",
        effects: { damageBonusPercent: 20 },
        condition: "파티원이 빙결 또는 쇄빙 발동 후 12초",
        scope: Object.freeze({ skillTagsAny: ["basic", "dash"] }),
      }),
    ],
  }),
  disc({
    id: "32600",
    name: "송곳니 메탈",
    nameEn: "Fanged Metal",
    desc2: "물리 피해 +10%",
    desc4: "파티가 강타를 부여한 대상에게 주는 피해 +35%, 12초 지속",
    twoPiece: [
      effect({
        id: "physical-dmg",
        label: "물리 피해 +10%",
        effects: { damageBonusPercent: 10 },
        scope: Object.freeze({ attributesAny: ["physical"] }),
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "assault-target-dmg",
        label: "강타 대상에게 주는 피해 +35%",
        effects: { damageBonusPercent: 35 },
        condition: "파티원이 대상에게 강타를 부여한 후 12초",
      }),
    ],
  }),
  disc({
    id: "32700",
    name: "나뭇가지 검의 노래",
    nameEn: "Branch & Blade Song",
    desc2: "치명타 피해 +16%",
    desc4:
      "이상 장악력 115pt 이상이면 치명타 피해 +30%. 파티가 빙결·쇄빙 발동 시 치명타 확률 +12%, 15초 지속",
    twoPiece: [
      effect({
        id: "crit-dmg",
        label: "치명타 피해 +16%",
        effects: { critDamagePercent: 16 },
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "mastery-threshold-crit-dmg",
        label: "이상 장악력 115pt 이상 시 치명타 피해 +30%",
        effects: { critDamagePercent: 30 },
        condition: Object.freeze({
          type: "statThreshold",
          stat: "anomalyMastery",
          gte: 115,
        }),
      }),
      effect({
        id: "freeze-crit-rate",
        label: "빙결·쇄빙 후 치명타 확률 +12%",
        effects: { critRatePercent: 12 },
        condition: "파티원이 빙결 또는 쇄빙 발동 후 15초",
      }),
    ],
  }),
  disc({
    id: "32800",
    name: "고요 속의 별",
    nameEn: "Astral Voice",
    desc2: "공격력 +10%",
    desc4:
      "파티원이 빠른 지원으로 출전할 때 별빛 중첩 획득. 출전 캐릭터가 주는 피해가 중첩당 +8%, 최대 3중첩",
    twoPiece: [
      effect({
        id: "atk",
        label: "공격력 +10%",
        effects: { attackPercent: 10 },
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "astral-dmg",
        label: "별빛 중첩당 주는 피해 +8%",
        effects: { damageBonusPercent: 8 },
        condition: "빠른 지원으로 출전 후 15초",
        stacks: { max: 3 },
      }),
    ],
  }),
  disc({
    id: "32900",
    name: "그림자처럼 함께",
    nameEn: "Shadow Harmony",
    desc2: "여진·대시 공격 피해 +15%",
    desc4:
      "같은 속성의 여진·대시 공격 적중 시 공격력과 치명타 확률이 중첩당 +4%, 최대 3중첩",
    twoPiece: [
      effect({
        id: "aftershock-dash-dmg",
        label: "여진·대시 공격 피해 +15%",
        effects: { damageBonusPercent: 15 },
        scope: Object.freeze({ skillTagsAny: ["aftershock", "dash"] }),
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "aftershock-dash-stack",
        label: "같은 속성 적중당 공격력·치명타 확률 +4%",
        effects: { attackPercent: 4, critRatePercent: 4 },
        condition: "착용자 속성과 같은 여진 또는 대시 공격 적중",
        scope: Object.freeze({ skillTagsAny: ["aftershock", "dash"] }),
        stacks: { max: 3 },
      }),
    ],
  }),
  disc({
    id: "33000",
    name: "파에톤의 노래",
    nameEn: "Phaethon's Melody",
    desc2: "이상 장악력 +8%",
    desc4:
      "파티가 강화 특수 스킬 시전 시 착용자의 이상 마스터리 +45pt. 타인이 시전하면 에테르 피해 +25%",
    twoPiece: [
      effect({
        id: "anomaly-mastery",
        label: "이상 장악력 +8%",
        effects: { anomalyMasteryPercent: 8 },
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "party-ex-ap",
        label: "파티의 강화 특수 스킬 후 이상 마스터리 +45pt",
        effects: { anomalyProficiency: 45 },
        condition: "파티원이 강화 특수 스킬 시전 후 8초",
      }),
      effect({
        id: "other-ex-ether-dmg",
        label: "타인의 강화 특수 스킬 후 에테르 피해 +25%",
        effects: { damageBonusPercent: 25 },
        condition: "착용자가 아닌 파티원이 강화 특수 스킬 시전",
        scope: Object.freeze({ attributesAny: ["ether"] }),
      }),
    ],
  }),
  disc({
    id: "33100",
    name: "운규 이야기",
    nameEn: "Yunkui Tales",
    desc2: "HP +10%",
    desc4:
      "강화 특수·콤보·궁극기 사용 시 치명타 확률이 중첩당 +4%, 최대 3중첩. 3중첩 시 명파 피해 +10%",
    twoPiece: [
      effect({
        id: "hp",
        label: "HP +10%",
        effects: { hpPercent: 10 },
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "skill-crit-stack",
        label: "스킬 사용당 치명타 확률 +4%",
        effects: { critRatePercent: 4 },
        condition: "강화 특수 스킬·콤보 스킬·궁극기 사용 후 15초",
        stacks: { max: 3 },
      }),
      effect({
        id: "three-stack-sheer-dmg",
        label: "3중첩 시 명파 피해 +10%",
        effects: { penetrationDamageBonusPercent: 10 },
        condition: "치명타 확률 효과 3중첩",
      }),
    ],
  }),
  disc({
    id: "33200",
    name: "산림의 왕",
    nameEn: "King of the Summit",
    desc2: "공격이 주는 그로기 수치 +6%",
    desc4:
      "격파 캐릭터가 강화 특수·콤보 스킬 사용 시 파티 치명타 피해 +15%. 치명타 확률 50% 이상이면 추가 +15%",
    twoPiece: [
      effect({
        id: "daze",
        label: "공격이 주는 그로기 수치 +6%",
        effects: { dazeBonusPercent: 6 },
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "stun-skill-party-crit-dmg",
        scope: Object.freeze({ specialtiesAny: ["격파"] }),
        label: "격파 스킬 사용 후 파티 치명타 피해 +15%",
        effects: { critDamagePercent: 15 },
        condition: "격파 캐릭터가 강화 특수 또는 콤보 스킬 사용 후 15초",
      }),
      effect({
        id: "crit-threshold-party-crit-dmg",
        scope: Object.freeze({ specialtiesAny: ["격파"] }),
        label: "치명타 확률 50% 이상이면 파티 치명타 피해 추가 +15%",
        effects: { critDamagePercent: 15 },
        condition: Object.freeze({
          type: "all",
          requirements: [
            "격파 캐릭터가 강화 특수 또는 콤보 스킬 사용 후 15초",
            Object.freeze({
              type: "statThreshold",
              stat: "critRate",
              gte: 50,
            }),
          ],
        }),
      }),
    ],
  }),
  disc({
    id: "33300",
    name: "여명의 꽃",
    nameEn: "Dawn's Bloom",
    desc2: "일반 공격 피해 +15%",
    desc4:
      "일반 공격 피해 +20%. 강공 캐릭터가 강화 특수·궁극기 사용 시 추가 +20%, 25초 지속",
    twoPiece: [
      effect({
        id: "basic-dmg",
        label: "일반 공격 피해 +15%",
        effects: { damageBonusPercent: 15 },
        scope: Object.freeze({ skillTagsAny: ["basic"] }),
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "basic-dmg",
        label: "일반 공격 피해 +20%",
        effects: { damageBonusPercent: 20 },
        scope: Object.freeze({ skillTagsAny: ["basic"] }),
        always: true,
      }),
      effect({
        id: "attack-ex-ultimate-basic-dmg",
        label: "강공 스킬 사용 후 일반 공격 피해 추가 +20%",
        effects: { damageBonusPercent: 20 },
        condition: "강공 캐릭터가 강화 특수 스킬 또는 궁극기 사용 후 25초",
        scope: Object.freeze({
          skillTagsAny: ["basic"],
          specialtiesAny: ["강공"],
        }),
      }),
    ],
  }),
  disc({
    id: "33400",
    name: "달빛 기사의 칭송",
    nameEn: "Moonlight Lullaby",
    desc2: "에너지 자동 회복 +20%",
    desc4:
      "지원 캐릭터가 강화 특수 스킬·궁극기 사용 시 모든 파티원이 주는 피해 +18%, 25초 지속",
    twoPiece: [
      effect({
        id: "energy-regen",
        label: "에너지 자동 회복 +20%",
        effects: { energyRegenPercent: 20 },
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "support-party-dmg",
        scope: Object.freeze({ specialtiesAny: ["지원"] }),
        label: "지원 스킬 사용 후 파티가 주는 피해 +18%",
        effects: { damageBonusPercent: 18 },
        condition: "지원 캐릭터가 강화 특수 스킬 또는 궁극기 사용 후 25초",
      }),
    ],
  }),
  disc({
    id: "33500",
    name: "물빛 노랫소리",
    nameEn: "White Water Ballad",
    desc2: "물리 피해 +10%",
    desc4:
      "에테르 베일 안에서 치명타 확률 +10%. 강공 캐릭터가 베일을 활성·연장하면 치명타 확률·공격력 추가 +10%",
    twoPiece: [
      effect({
        id: "physical-dmg",
        label: "물리 피해 +10%",
        effects: { damageBonusPercent: 10 },
        scope: Object.freeze({ attributesAny: ["physical"] }),
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "ether-veil-crit",
        label: "에테르 베일 안에서 치명타 확률 +10%",
        effects: { critRatePercent: 10 },
        condition: "에테르 베일 내부 또는 이탈 후 15초",
      }),
      effect({
        id: "attack-ether-veil-crit-atk",
        scope: Object.freeze({ specialtiesAny: ["강공"] }),
        label: "강공 캐릭터의 베일 활성·연장 후 치명타 확률·공격력 +10%",
        effects: { critRatePercent: 10, attackPercent: 10 },
        condition: "강공 캐릭터가 에테르 베일을 활성화하거나 지속시간 연장 후 30초",
      }),
    ],
  }),
  disc({
    id: "33600",
    name: "빛의 아리아",
    nameEn: "Shining Aria",
    desc2: "에테르 피해 +10%",
    desc4:
      "일반 공격 적중 시 이상 마스터리 +36pt, 8초 지속. 적이 그로기 상태면 주는 피해 +25%, 18초 지속",
    twoPiece: [
      effect({
        id: "ether-dmg",
        label: "에테르 피해 +10%",
        effects: { damageBonusPercent: 10 },
        scope: Object.freeze({ attributesAny: ["ether"] }),
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "basic-hit-ap",
        label: "일반 공격 적중 후 이상 마스터리 +36pt",
        effects: { anomalyProficiency: 36 },
        condition: "일반 공격 적중 후 8초",
      }),
      effect({
        id: "stunned-enemy-dmg",
        label: "적이 그로기 상태면 주는 피해 +25%",
        effects: { damageBonusPercent: 25 },
        condition: "필드의 적이 그로기 상태인 동안 및 발동 후 18초",
      }),
    ],
  }),
  disc({
    id: "33700",
    name: "이상한 나라의 눈토끼",
    nameEn: "Bunny in Wonderland",
    desc2: "HP +10%",
    desc4:
      "방어 캐릭터의 강화 특수 또는 파티의 방어·회피 지원 발동 시 파티가 주는 피해가 중첩당 +6%, 최대 3중첩",
    twoPiece: [
      effect({
        id: "hp",
        label: "HP +10%",
        effects: { hpPercent: 10 },
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "defense-assist-party-dmg",
        scope: Object.freeze({ specialtiesAny: ["방어"] }),
        label: "방어·지원 발동당 파티가 주는 피해 +6%",
        effects: { damageBonusPercent: 6 },
        condition: "방어 캐릭터의 강화 특수 또는 방어·회피 지원 발동",
        stacks: { max: 3 },
      }),
    ],
  }),
  disc({
    id: "33800",
    name: "수감자 수기",
    nameEn: "Notes From the Chained",
    desc2: "얼음 속성 피해 +10%",
    desc4:
      "개화 발동 시 이상 마스터리 +48pt. 빙결 발동 시 모든 속성 이상·혼돈 피해 +16%, 각각 30초 지속",
    twoPiece: [
      effect({
        id: "ice-dmg",
        label: "얼음 속성 피해 +10%",
        effects: { damageBonusPercent: 10 },
        scope: Object.freeze({ attributesAny: ["ice"] }),
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "abloom-ap",
        label: "개화 발동 후 이상 마스터리 +48pt",
        effects: { anomalyProficiency: 48 },
        condition: "착용자가 개화 발동 후 30초",
      }),
      effect({
        id: "freeze-anomaly-dmg",
        label: "빙결 발동 후 이상·혼돈 피해 +16%",
        effects: { anomalyDamageBonusPercent: 16 },
        condition: "착용자가 빙결 발동 후 30초",
      }),
    ],
  }),
  disc({
    id: "33900",
    name: "울부짖는 살롱",
    nameEn: "Wuthering Salon",
    desc2: "바람 피해 +10%",
    desc4:
      "강화 특수 스킬 사용 시 이상 마스터리가 중첩당 +25pt, 최대 2중첩. 풍화 발동 시 주는 피해 +18%",
    twoPiece: [
      effect({
        id: "wind-dmg",
        label: "바람 피해 +10%",
        effects: { damageBonusPercent: 10 },
        scope: Object.freeze({ attributesAny: ["wind"] }),
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "ex-ap",
        label: "강화 특수 스킬 사용당 이상 마스터리 +25pt",
        effects: { anomalyProficiency: 25 },
        condition: "강화 특수 스킬 사용 후 40초",
        stacks: { max: 2 },
      }),
      effect({
        id: "windswept-dmg",
        label: "풍화 발동 후 주는 피해 +18%",
        effects: { damageBonusPercent: 18 },
        condition: "착용자가 풍화 발동 후 40초",
      }),
    ],
  }),
  disc({
    id: "34000",
    name: "새벽녘 여행기",
    nameEn: "The Sky Ablaze",
    desc2: "에테르 피해 +10%",
    desc4:
      "에테르 캐릭터면 치명타 피해 +30%. 강화 특수 스킬·궁극기 사용 시 공격력 +10%, 30초 지속",
    twoPiece: [
      effect({
        id: "ether-dmg",
        label: "에테르 피해 +10%",
        effects: { damageBonusPercent: 10 },
        scope: Object.freeze({ attributesAny: ["ether"] }),
        always: true,
      }),
    ],
    fourPiece: [
      effect({
        id: "ether-crit-dmg",
        label: "에테르 캐릭터 치명타 피해 +30%",
        effects: { critDamagePercent: 30 },
        condition: Object.freeze({
          type: "attribute",
          attributesAny: ["ether"],
        }),
      }),
      effect({
        id: "ex-ultimate-atk",
        label: "강화 특수·궁극기 사용 후 공격력 +10%",
        effects: { attackPercent: 10 },
        condition: "강화 특수 스킬 또는 궁극기 사용 후 30초",
      }),
    ],
  }),
]);

export const DISC_SET_BY_ID = Object.freeze(
  Object.fromEntries(DISC_SETS.map((set) => [set.id, set])),
);

// Short aliases match the naming used by the character/W-Engine catalog.
export const DISCS = DISC_SETS;
export const DISC_BY_ID = DISC_SET_BY_ID;

export function getDiscSet(id) {
  return DISC_SET_BY_ID[String(id)] ?? null;
}

/**
 * Return the effects that a comparison engine can inspect or apply.
 *
 * Always-on effects are enabled. Conditional effects are enabled only when
 * their stable key (`{setId}:{pieceCount}:{effectId}`) is present in
 * `activeConditions`; stack effects use `stackCounts` and otherwise stay at 0.
 * Scope matching is deliberately left to the caller.
 */
export function resolveDiscEffects({
  fourPieceId = null,
  twoPieceId = null,
  activeConditions = {},
  stackCounts = {},
} = {}) {
  const resolved = [];

  const append = (setId, pieceCount) => {
    const set = getDiscSet(setId);
    if (!set) return;

    const entries = pieceCount === 4 ? set.fourPiece : set.twoPiece;

    for (const entry of entries) {
      const key = `${set.id}:${pieceCount}:${entry.id}`;
      const requestedStacks = entry.stacks
        ? Number(stackCounts[key] ?? entry.stacks.default)
        : null;
      const stacks = entry.stacks
        ? Math.min(
            entry.stacks.max,
            Math.max(entry.stacks.min, Number.isFinite(requestedStacks) ? requestedStacks : 0),
          )
        : 1;
      const active = entry.stacks
        ? stacks > 0
        : entry.always || activeConditions[key] === true;

      resolved.push(
        Object.freeze({
          key,
          setId: set.id,
          setName: set.name,
          pieceCount,
          active,
          multiplier: active ? stacks : 0,
          label: entry.label,
          effects: entry.effects,
          condition: entry.condition,
          scope: entry.scope,
        }),
      );
    }
  };

  // A 4-piece set also grants that set's 2-piece bonus.
  append(fourPieceId, 2);
  append(fourPieceId, 4);
  if (twoPieceId !== fourPieceId) append(twoPieceId, 2);

  return Object.freeze(resolved);
}

export function sumResolvedDiscStats(
  resolvedEffects,
  { includeScoped = false } = {},
) {
  const totals = {};

  for (const entry of resolvedEffects ?? []) {
    if (!entry.active || (!includeScoped && entry.scope)) continue;

    for (const [stat, value] of Object.entries(entry.effects)) {
      totals[stat] = (totals[stat] ?? 0) + value * entry.multiplier;
    }
  }

  return Object.freeze(totals);
}
