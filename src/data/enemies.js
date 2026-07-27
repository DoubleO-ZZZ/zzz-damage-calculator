export const ENEMY_DATA_VERSION = "3.0";
export const ENEMY_DATA_VERIFIED_AT = "2026-07-28";
export const ENEMY_SOURCE_BASE =
  "https://static.nanoka.cc/zzz/3.0/ko/monster";

const resistance = (
  physical = 0,
  fire = 0,
  ice = 0,
  electric = 0,
  ether = 0,
  wind = 0,
) =>
  Object.freeze({ physical, fire, ice, electric, ether, wind });

const enemy = (
  id,
  entityId,
  name,
    defenseAt60,
    resistances,
    stunMultiplierPercent,
    sourceIconUrl,
  ) =>
  Object.freeze({
    id,
    entityId,
    name,
    rank: "S",
    defenseAt60,
    resistances,
    stunMultiplierPercent,
    icon: `./assets/nanoka/enemies/${id}.webp`,
    sourceIconUrl,
    sourceUrl: `https://zzz.nanoka.cc/monster/${id}`,
    dataSourceUrl: `${ENEMY_SOURCE_BASE}/${id}.json`,
  });

export const S_RANK_ENEMIES = Object.freeze([
  enemy("30007", 11235, "죽음의 도살자", 952.8, resistance(0, 0, -20, 0, -20), 150, "https://static.nanoka.cc/assets/zzz/Monster_CottusGrey.webp"),
  enemy("30009", 11411, "미지의 복합 침식체", 952.8, resistance(0, 0, 0, -20, -20), 150, "https://static.nanoka.cc/assets/zzz/Monster_ComplexCorrupted.webp"),
  enemy("30012", 11422, "마리오네트·쌍둥이", 952.8, resistance(0, 0, -20, 0, -20), 200, "https://static.nanoka.cc/assets/zzz/Monster_Marionette_Twins.webp"),
  enemy("30021", 11701, "「오버로드 침식체·폼페이」", 952.8, resistance(0, -20, 0, 40), 150, "https://static.nanoka.cc/assets/zzz/Monster_TyrantPompey.webp"),
  enemy("30024", 11811, "새크리파이스·브랑그", 952.8, resistance(20, 0, -20), 150, "https://static.nanoka.cc/assets/zzz/Monster_SacrificeBringer.webp"),
  enemy("30032", 11541, "제페토", 952.8, resistance(), 150, "https://static.nanoka.cc/assets/zzz/Monster_Geppetto.webp"),
  enemy("30033", 31031, "미아즈마 프리스트", 952.8, resistance(0, 0, 40, 0, -20), 150, "https://static.nanoka.cc/assets/zzz/Monster_MentorMevorakh.webp"),
  enemy("30034", 31061, "미아즈마 핀드·네임리스", 952.8, resistance(-20, 40, 0, 0, -20), 125, "https://static.nanoka.cc/assets/zzz/Monster_NamelessOne.webp"),
  enemy("30038", 31141, "「모독자」", 952.8, resistance(-20, 0, 40, -20), 125, "https://static.nanoka.cc/assets/zzz/Monster_IsoldetheDefiler.webp"),
  enemy("30041", 11841, "방황하는 사냥꾼", 1588, resistance(40, -20, -20), 150, "https://static.nanoka.cc/assets/zzz/Monster_WanderingHunter.webp"),
  enemy("30042", 31351, "악몽에 묶인 자·엽석연", 952.8, resistance(-20, 0, -20, 40, 0, -20), 200, "https://static.nanoka.cc/assets/zzz/Monster_Awakener.webp"),
  enemy("35001", 11531, "니네베", 952.8, resistance(), 150, "https://static.nanoka.cc/assets/zzz/Monster_Nineveh.webp"),
  enemy("40000", 31411, "태초의 악몽·「창조주」", 476.4, resistance(-20, 0, 40, 0, 40), 150, "https://static.nanoka.cc/assets/zzz/Monster_Vessel.webp"),
  enemy("40001", 31451, "고독한 불협의 노래·베스퍼", 476.4, resistance(0, 40, 40, 0, -20, -20), 150, "https://static.nanoka.cc/assets/zzz/Monster_Vesper.webp"),
  enemy("40002", 11801, "피의 청소부", 476.4, resistance(0, 40, 0, -20, -20, 40), 150, "https://static.nanoka.cc/assets/zzz/Monster_GraymaneCenturion.webp"),
  enemy("40003", 11803, "레플리카·피의 청소부", 476.4, resistance(0, 40, -20, 0, 0, -20), 150, "https://static.nanoka.cc/assets/zzz/Monster_ClonedBlackWolf.webp"),
  enemy("40004", 31432, "태양의 잔불·파에톤", 952.8, resistance(40, 0, -20, 0, 0, -20), 150, "https://static.nanoka.cc/assets/zzz/Monster_Pure.webp"),
  enemy("40005", 31431, "태양의 잔불·파에톤 · 변이", 952.8, resistance(40, 0, -20, 0, 0, -20), 150, "https://static.nanoka.cc/assets/zzz/Monster_Mutant.webp"),
  enemy("40006", 31661, "기르타블리르", 952.8, resistance(0, 0, 0, 0, 0, -20), 150, "https://static.nanoka.cc/assets/zzz/Monster_Girtablu.webp"),
  enemy("40007", 31413, "융합·태초의 악몽", 476.4, resistance(), 150, "https://static.nanoka.cc/assets/zzz/Monster_Vessel_HC.webp"),
  enemy("300071", 11233, "갓 태어난 죽음의 도살자", 1318.04, resistance(), 100, "https://static.nanoka.cc/assets/zzz/Monster_Cottus.webp"),
  enemy("300072", 11901, "노토리우스·죽음의 도살자", 952.8, resistance(0, 0, -20, 0, -20), 150, "https://static.nanoka.cc/assets/zzz/Monster_NotoriousDeadEndButcher.webp"),
  enemy("300121", 11861, "노토리우스·마리오네트", 952.8, resistance(0, 0, -20, 0, -20), 200, "https://static.nanoka.cc/assets/zzz/Monster_NotoriousMarionette.webp"),
  enemy("300211", 11881, "노토리우스·폼페이", 952.8, resistance(0, -20, 0, 40), 150, "https://static.nanoka.cc/assets/zzz/Monster_NotoriousPompey.webp"),
]);

export const ENEMY_BY_ID = Object.freeze(
  Object.fromEntries(S_RANK_ENEMIES.map((entry) => [entry.id, entry])),
);

export function resolveEnemy(enemyId, element = "physical") {
  const selected = ENEMY_BY_ID[String(enemyId)] ?? S_RANK_ENEMIES[0];
  return Object.freeze({
    ...selected,
    enemyDefense: selected.defenseAt60,
    enemyResistancePercent: selected.resistances[element] ?? 0,
    baseStunMultiplierPercent: selected.stunMultiplierPercent,
  });
}
