export const MINDSCAPE_DATA_VERSION = "3.0";
export const MINDSCAPE_SOURCE_BASE =
  "https://static.nanoka.cc/zzz/3.0/ko/character";

export const MINDSCAPE_SUPPORTED_STATS = Object.freeze([
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
  "anomalyDamageBonus",
  "penetrationDamageBonus",
]);

const SUPPORTED_STATS = new Set(MINDSCAPE_SUPPORTED_STATS);
const VALID_ACTIVATIONS = new Set(["always", "toggle", "stacks"]);

function effect(level, label, stat, value, options = {}) {
  return {
    level,
    label,
    stat,
    value,
    activation: options.activation ?? "toggle",
    maxStacks: options.maxStacks ?? 1,
    defaultActive: options.defaultActive ?? false,
    skillTypes: options.skillTypes ?? [],
    mode: options.mode ?? null,
    element: options.element ?? null,
    anomalyKey: options.anomalyKey ?? null,
    sourceNote: options.sourceNote ?? "",
    reason: options.reason ?? null,
  };
}

function always(level, label, stat, value, options = {}) {
  return effect(level, label, stat, value, {
    ...options,
    activation: "always",
  });
}

function toggle(level, label, stat, value, options = {}) {
  return effect(level, label, stat, value, {
    ...options,
    activation: "toggle",
  });
}

function stacks(level, label, stat, value, maxStacks, options = {}) {
  return effect(level, label, stat, value, {
    ...options,
    activation: "stacks",
    maxStacks,
  });
}

function unsupported(level, label, reason, sourceNote = reason, options = {}) {
  return effect(level, label, "unsupported", 0, {
    ...options,
    activation: options.activation ?? "always",
    reason,
    sourceNote,
  });
}

function skillLevel(level, label) {
  return unsupported(
    level,
    label,
    "대표 스킬과 레벨별 계수표가 연결되지 않아 스킬 레벨 +2를 자동 환산할 수 없습니다.",
    "일반 공격·회피·지원·특수·콤보 스킬 레벨 +2",
  );
}

function defineCharacter(characterId, name, _mode, rows) {
  return [
    characterId,
    Object.freeze(
      rows.map((row, index) =>
        Object.freeze({
          ...row,
          key: `${characterId}:m${row.level}:${index}`,
          mode: row.mode ?? null,
          skillTypes: Object.freeze([...row.skillTypes]),
          anomalyKey: Array.isArray(row.anomalyKey)
            ? Object.freeze([...row.anomalyKey])
            : row.anomalyKey,
          characterId,
          characterName: name,
          sourceUrl: `${MINDSCAPE_SOURCE_BASE}/${characterId}.json`,
        }),
      ),
    ),
  ];
}

const entries = [
  defineCharacter("1021", "네코마타", "strong", [
    toggle(1, "새 사냥 기술", "resistanceIgnore", 16, { element: "물리", skillTypes: ["rear-attack"], sourceNote: "후면 공격은 물리 피해 저항 16% 무시. 그로기 적 대상 공격은 후면 판정" }),
    unsupported(2, "쥐와 고양이", "에너지 획득 효율은 단일 피해식에 포함되지 않습니다.", "적 1기·출전 중 에너지 획득 효율 25%"),
    skillLevel(3, "호기심 많은 왼쪽 꼬리"),
    stacks(4, "발톱 갈기", "critRate", 7, 2, { sourceNote: "강화 특수 스킬 후 스택당 치명타 확률 7%, 15초" }),
    skillLevel(5, "행운의 오른쪽 꼬리"),
    stacks(6, "포식자의 혈통", "critDamage", 18, 3, { sourceNote: "콤보/궁극기 후 스택당 치명타 피해 18%. 처치 시 최대 스택" }),
  ]),
  defineCharacter("1041", "「11호」", "strong", [
    unsupported(1, "급격한 온도 상승", "에너지 즉시 회복은 단일 피해식에 포함되지 않습니다.", "에너지 40pt 미만일 때 80pt까지 회복"),
    stacks(2, "고온 응축", "damageBonus", 3, 12, { skillTypes: ["basic:fire-suppression", "dash:fire-suppression", "dodge-counter:fire-suppression"], sourceNote: "화력 진압 발동 공격 피해 스택당 3%, 15초" }),
    skillLevel(3, "정예 사병"),
    unsupported(4, "드세지는 불길", "경직 저항·받는 피해 감소·무적은 공격 피해식에 포함되지 않습니다."),
    skillLevel(5, "완벽한 사병"),
    toggle(6, "작열하는 몰입", "resistanceIgnore", 25, { element: "불", skillTypes: ["basic:fire-suppression", "dash:fire-suppression", "dodge-counter:fire-suppression"], sourceNote: "EX/콤보/궁극기로 충전 획득 후 화력 진압 현재 스킬이 불 저항 25% 무시" }),
  ]),
  defineCharacter("1061", "코린", "strong", [
    toggle(1, "개방성 외상", "damageBonus", 12, { sourceNote: "콤보/궁극기 명중 표적에게 주는 피해 12%, 15초" }),
    stacks(2, "열분해 효과", "resistanceReduction", 0.5, 20, { element: "물리", sourceNote: "EX/콤보/궁극기 명중 시 표적 물리 저항 스택당 0.5%, 5초" }),
    skillLevel(3, "초보 메이드"),
    unsupported(4, "전장의 시종", "에너지 회복은 단일 피해식에 포함되지 않습니다."),
    skillLevel(5, "특수요원 메이드"),
    unsupported(6, "내실 다지기", "충전 스택당 공격력 3%의 별도 추가 피해 패킷이 필요합니다.", "최대 40스택을 특정 전기톱 공격에서 전량 소모"),
  ]),
  defineCharacter("1081", "빌리", "strong", [
    unsupported(1, "깜짝 등장", "에너지 회복은 단일 피해식에 포함되지 않습니다."),
    toggle(2, "무빙 사격술", "damageBonus", 25, { skillTypes: ["dodge-counter"], sourceNote: "회피 반격 피해 25%" }),
    skillLevel(3, "별빛 기사의 가르침"),
    toggle(4, "스타라이트-징벌의 탄약", "critRate", 32, { skillTypes: ["ex-special"], sourceNote: "강화 특수 스킬 치명타 확률 최대 32%. 이 값은 근거리 최대치 토글" }),
    skillLevel(5, "사라진 기술 구조체"),
    stacks(6, "스타라이트-영웅의 순간", "damageBonus", 6, 5, { sourceNote: "누적 10회 명중/극한 회피 후 스택당 피해 6%" }),
  ]),
  defineCharacter("1111", "앤톤", "strong", [
    unsupported(1, "워밍업", "에너지 회복은 단일 피해식에 포함되지 않습니다."),
    unsupported(2, "기세등등", "실드는 공격 피해식에 포함되지 않습니다."),
    skillLevel(3, "교대 훈련"),
    toggle(4, "함께 불태우자!", "critRate", 10, { sourceNote: "콤보/궁극기 후 파티 치명타 확률 10%, 12초" }),
    skillLevel(5, "만능형 전문가"),
    stacks(6, "한계 돌파", "damageBonus", 4, 6, { skillTypes: ["basic:burst-mode", "dodge-counter:burst-mode"], sourceNote: "스파이크 공격 치명타 후 스택당 피해 4%, 30초" }),
  ]),
  defineCharacter("1191", "엘렌", "strong", [
    stacks(1, "혹독한 겨울의 징조", "critRate", 2, 6, { sourceNote: "급랭 충전 1pt 소비당 치명타 확률 2%, 15초" }),
    stacks(2, "극해의 포식자", "critDamage", 20, 3, { skillTypes: ["ex-special"], sourceNote: "강화 특수 스킬 현재 타격 치명타 피해 충전당 20%, 최대 60%" }),
    skillLevel(3, "야근 사절"),
    unsupported(4, "끝없는 한파", "급랭 충전·고속 차지·에너지 회복은 단일 피해식에 직접 반영되지 않습니다."),
    skillLevel(5, "충분한 수면"),
    toggle(6, "연회의 시간", "penetrationPercent", 20, { sourceNote: "EX/콤보/고속 차지 후 관통률 20%, 6초" }),
    toggle(6, "연회의 시간", "damageBonus", 250, { skillTypes: ["dash:charged-scissors"], sourceNote: "성대한 연회 3스택 소비 시 차지 가위질 현재 스킬 피해 250%" }),
  ]),
  defineCharacter("1201", "하루마사", "strong", [
    unsupported(1, "「왕성한 기합」", "전기 감옥 상한과 추가 발사는 계수·별도 패킷 모델이 필요합니다."),
    toggle(2, "재능 낭비", "damageBonus", 50, { skillTypes: ["dash:soaring-bow-slash"], sourceNote: "번갯불 보유 중 해당 대시 공격 피해 50%" }),
    skillLevel(3, "하얀 거짓말"),
    unsupported(4, "어쩌다 한 번의 활력", "표식 지속 시간·데시벨·표식 부여는 단일 피해식에 포함되지 않습니다."),
    skillLevel(5, "아무도 모르는"),
    toggle(6, "회심", "resistanceIgnore", 15, { element: "전기", sourceNote: "갑시와 을시가 그로기/이상 적 명중 후 해당 적 전기 저항 15% 무시, 12초" }),
    unsupported(6, "회심", "12회 명중마다 공격력 1500% 전자 폭발은 별도 추가 피해 패킷이 필요합니다."),
  ]),
  defineCharacter("1241", "주연", "strong", [
    unsupported(1, "빠른 장전", "강화 산탄 재장전은 탄약·회전율 모델이 필요합니다."),
    stacks(2, "에테르 잔해", "damageBonus", 10, 5, { element: "에테르", skillTypes: ["basic:enhanced-shell", "dash:enhanced-shell"], sourceNote: "강화 산탄 소비 명중 시 스택당 에테르 피해 10%, 5초" }),
    skillLevel(3, "치안관 특훈"),
    toggle(4, "에테르 침투", "resistanceIgnore", 25, { element: "에테르", skillTypes: ["basic:enhanced-shell", "dash:enhanced-shell"], sourceNote: "강화 산탄 소비 공격이 에테르 저항 25% 무시" }),
    skillLevel(5, "특근 경력"),
    unsupported(6, "확장 에너지팩-3형", "공격력 220% 에테르 벅샷 4발은 별도 추가 피해 패킷이 필요합니다.", "총 추가 계수 880%"),
  ]),
  defineCharacter("1291", "휴고", "strong", [
    toggle(1, "증오의 아이", "critRate", 12, { skillTypes: ["settlement"], sourceNote: "암연의 메아리 중 결산 치명타 확률 12%" }),
    toggle(1, "증오의 아이", "critDamage", 30, { skillTypes: ["settlement"], sourceNote: "암연의 메아리 중 결산 치명타 피해 30%" }),
    unsupported(2, "내면의 소년", "방어력 무시는 현재 안전 정규화 대상에서 제외됩니다.", "결산 타격이 방어력 15% 무시"),
    skillLevel(3, "독수독과"),
    toggle(4, "극작법", "resistanceIgnore", 12, { element: "얼음", sourceNote: "차지 사격 명중 표적의 얼음 저항 12% 무시, 15초" }),
    skillLevel(5, "열반"),
    toggle(6, "가시 왕관", "damageBonus", 60, { skillTypes: ["settlement"], sourceNote: "결산 현재 피해 60%" }),
    unsupported(6, "가시 왕관", "특정 EX 종결 일격의 계수 +1000%는 스킬 계수 가산 모델이 필요합니다."),
  ]),
  defineCharacter("1301", "오피&「도깨비불」", "strong", [
    toggle(1, "호화로운 고양이집", "resistanceIgnore", 15, { element: "불", skillTypes: ["special:corrosive-flash", "ex:scarlet-vortex", "ex:condensed-heat", "ex:blazing-eruption"], sourceNote: "지정 스킬이 불 저항 15% 무시" }),
    toggle(1, "호화로운 고양이집", "damageBonus", 20, { skillTypes: ["aimed-agent-attack"], sourceNote: "정조준 보유 에이전트 공격 피해 20%" }),
    toggle(2, "괴식 리스트", "attackPercent", 20, { sourceNote: "궁극기 후 공격력 20%, 최대 45초" }),
    skillLevel(3, "〈전술 매뉴얼〉"),
    toggle(4, "핑크색 홀스터", "damageBonus", 40, { skillTypes: ["ex:condensed-heat", "ultimate:dance-with-flame"], sourceNote: "지정 EX/궁극기 피해 40%" }),
    skillLevel(5, "명계의 동전"),
    unsupported(6, "마법의 씨앗", "레이저 명중마다 공격력 250%의 별도 추가 피해 패킷이 필요합니다."),
  ]),
  defineCharacter("1321", "이블린", "strong", [
    unsupported(1, "엮어가는 꿈", "방어력 무시는 현재 안전 정규화 대상에서 제외됩니다.", "감금 표적 공격 시 방어력 12% 무시"),
    always(2, "불 속에서 춤을", "attackPercent", 15, { sourceNote: "공격력 15% 상시 증가" }),
    skillLevel(3, "허물벗기"),
    toggle(4, "운명의 울림", "critDamage", 40, { sourceNote: "콤보/궁극기 후 실드 보유 중 치명타 피해 40%" }),
    skillLevel(5, "노을처럼 붉은 실"),
    unsupported(6, "빛과 그림자의 유대", "공격력 375% 추가 공격을 최대 16회 발동하므로 별도 패킷·횟수 모델이 필요합니다."),
  ]),
  defineCharacter("1381", "0호·엔비", "strong", [
    unsupported(1, "정전하", "백뢰 추가 피해 3회는 원래 백뢰 계수와 별도 패킷 모델이 필요합니다."),
    always(2, "이중화 프로토콜", "critRate", 12, { sourceNote: "치명타 확률 12% 상시 증가" }),
    skillLevel(3, "지난날의 영광"),
    toggle(4, "실버의 잔향", "resistanceIgnore", 12, { element: "전기", sourceNote: "은빛 별 표식 대상 전기 저항 12% 무시" }),
    skillLevel(5, "감독판"),
    unsupported(6, "프리퀄 주인공", "백뢰 6회마다 공격력 1000% 전자 와류는 별도 추가 피해 패킷이 필요합니다."),
  ]),
  defineCharacter("1431", "엽빛나", "strong", [
    toggle(1, "꿈속의 나", "damageBonus", 10, { skillTypes: ["core:unity-extra-damage"], sourceNote: "합일 효과가 추가로 주는 피해 10%" }),
    unsupported(1, "꿈속의 나", "방어력 무시는 현재 안전 정규화 대상에서 제외됩니다.", "합일 대상 방어력 20% 무시"),
    unsupported(2, "빛과 그림자", "방어력 무시는 현재 안전 정규화 대상에서 제외됩니다.", "지정 EX/궁극기가 방어력 40% 무시"),
    skillLevel(3, "검객의 길"),
    unsupported(4, "함께 먼지 속으로", "장막 약체화 보너스 상한은 현재 단일 피해 배율과 직접 연결할 수 없습니다."),
    skillLevel(5, "작은 불씨의 인도"),
    unsupported(6, "등불의 바람", "지정 EX/궁극기 마지막 일격의 공격력 1500% 추가 피해는 별도 패킷이 필요합니다."),
  ]),
  defineCharacter("1461", "「시드」", "strong", [
    toggle(1, "「동면기」", "critDamage", 30, { skillTypes: ["basic:falling-flower-collapse"], sourceNote: "해당 일반 공격 치명타 피해 30%" }),
    unsupported(2, "「흡광법」", "방어력 무시는 현재 안전 정규화 대상에서 제외됩니다.", "포위 적용 에이전트가 방어력 20% 무시"),
    stacks(2, "「흡광법」", "damageBonus", 5, 24, { skillTypes: ["basic:falling-flower-slaughter"], sourceNote: "직전 EX 에너지 5pt 소비당 이어지는 일반 공격 피해 5%, 총 60~120pt" }),
    skillLevel(3, "「발아설」"),
    toggle(4, "「방향조」", "damageBonus", 20, { skillTypes: ["ultimate"], sourceNote: "포위 상태에서 궁극기 피해 20%" }),
    skillLevel(5, "「개화기」"),
    always(6, "「유심론」", "critDamage", 50, { sourceNote: "치명타 피해 50% 상시 증가" }),
    unsupported(6, "「유심론」", "공격력 165% 레이저 3발은 별도 추가 피해 패킷이 필요합니다.", "총 추가 계수 495%"),
  ]),
  defineCharacter("1521", "시시아", "strong", [
    always(1, "여행자와 사냥감", "resistanceIgnore", 5, { element: "전기", sourceNote: "파티 전체 전기 피해가 저항 5% 무시" }),
    toggle(1, "여행자와 사냥감", "resistanceIgnore", 10, { element: "전기", skillTypes: ["infiltration"], sourceNote: "침투 피해가 전기 저항 10% 무시" }),
    unsupported(1, "여행자와 사냥감", "핵심 패시브 방어 무시를 기존 값의 140%로 바꾸는 효과라 기본 패시브 없이 절대값을 더할 수 없습니다.", "핵심 패시브 최대치 25%→35%"),
    toggle(2, "허기와 격언", "damageBonus", 35, { skillTypes: ["basic:snake-kiss"], sourceNote: "해당 일반 공격 피해 35%" }),
    skillLevel(3, "사슬과 따뜻한 보금자리"),
    unsupported(4, "악당의 각오", "계수가 공개되지 않은 특수 침투 추가 발동은 별도 패킷이 필요합니다."),
    skillLevel(5, "위증과 송곳니"),
    unsupported(6, "집과 6단지 거리", "계수가 공개되지 않은 특수 침투 추가 발동은 별도 패킷이 필요합니다."),
  ]),
  defineCharacter("1551", "피로이스", "strong", [
    always(1, "황혼의 옛 기록", "critRate", 8, { sourceNote: "치명타 확률 8% 상시 증가" }),
    unsupported(2, "화염의 기사", "데시벨 회복·최대치는 단일 피해식에 포함되지 않습니다."),
    skillLevel(3, "운명의 족쇄"),
    unsupported(4, "낮을 태우는 불", "라이브 3.0에서 시네마 효과가 미공개입니다."),
    skillLevel(5, "어린 근위병"),
    unsupported(6, "여명의 샛별", "라이브 3.0에서 시네마 효과가 미공개입니다."),
  ]),

  defineCharacter("1091", "미야비", "anomaly", [
    unsupported(1, "설상가상", "방어력 무시는 현재 안전 정규화 대상에서 제외됩니다.", "서리와 달이 내리는 서리 1pt당 방어력 6%, 최대 6스택 무시"),
    unsupported(1, "설상가상", "속성 이상 축적 효율은 단일 이상 피해량에 포함되지 않습니다."),
    toggle(2, "토납법", "damageBonus", 30, { skillTypes: ["basic:wind-flower", "dodge-counter"], sourceNote: "지정 일반 공격/회피 반격 피해 30%" }),
    always(2, "토납법", "critRate", 15, { sourceNote: "전장 진입 시 치명타 확률 15%" }),
    skillLevel(3, "무인의 수양"),
    always(4, "동상", "anomalyDamageBonus", 30, { anomalyKey: "서리열·파괴", sourceNote: "서리열·파괴 피해 30%" }),
    skillLevel(5, "기념일"),
    toggle(6, "천부적인 재능", "damageBonus", 30, { skillTypes: ["basic:frost-moon"], sourceNote: "서리와 달 자세 중 해당 일반 공격 피해 30%" }),
    unsupported(6, "천부적인 재능", "자동 발도 베기는 계수가 공개되지 않아 별도 패킷으로 계산할 수 없습니다."),
  ]),
  defineCharacter("1171", "버니스", "anomaly", [
    unsupported(1, "따뜻한 공감", "잿불 계수 +100%는 스킬 계수 가산 모델이 필요합니다."),
    unsupported(1, "따뜻한 공감", "발화점 상한과 이상 축적치는 단일 이상 피해량에 포함되지 않습니다."),
    stacks(2, "무료 사이즈 업", "penetrationPercent", 4, 5, { sourceNote: "열기 관통 표적 피격 시 스택당 관통률 4%, 최대 20%" }),
    skillLevel(3, "낙천적인 천성"),
    toggle(4, "최상의 연료 보급", "critRate", 30, { skillTypes: ["ex-special", "assist-attack"], sourceNote: "지정 공격 치명타 확률 30%" }),
    skillLevel(5, "불과 얼음의 춤"),
    toggle(6, "타오르는 불꽃의 초대", "resistanceIgnore", 25, { element: "불", skillTypes: ["ex:double-shake", "special:ember", "anomaly:burn"], anomalyKey: ["연소"], sourceNote: "EX 명중 기간 중 지정 피해가 불 저항 25% 무시" }),
    unsupported(6, "타오르는 불꽃의 초대", "특수 잿불 공격력 60%와 연소 피해 1800% 추가 결산은 별도 패킷·재결산 모델이 필요합니다."),
  ]),
  defineCharacter("1181", "그레이스", "anomaly", [
    unsupported(1, "약실 재충전", "에너지 회복은 단일 이상 피해량에 포함되지 않습니다."),
    toggle(2, "절연 파괴", "resistanceReduction", 8.5, { element: "전기", sourceNote: "수류탄 명중 시 전기 저항 8.5% 감소, 8초" }),
    unsupported(2, "절연 파괴", "전기 이상 축적 저항 감소는 단일 이상 피해량에 포함되지 않습니다."),
    skillLevel(3, "수석 엔지니어"),
    unsupported(4, "폭파 축전기", "충전과 에너지 획득 효율은 단일 이상 피해량에 포함되지 않습니다."),
    skillLevel(5, "「냉정한 철의 마녀」"),
    unsupported(6, "기폭 방아쇠", "수류탄 피해 2배와 투사체 +1은 분리된 스킬·추가 패킷 모델이 필요합니다."),
  ]),
  defineCharacter("1221", "야나기", "anomaly", [
    toggle(1, "지피지기", "anomalyProficiency", 80, { sourceNote: "통찰 1스택 이상 보유 시 이상 마스터리 80pt" }),
    unsupported(2, "뛰어난 적응력", "극성 혼돈 기본 20%와 찌르기당 +15%는 전용 혼돈 계수 모델이 필요합니다."),
    skillLevel(3, "츠키시로식 관리학"),
    toggle(4, "장기판의 지배자", "penetrationPercent", 16, { sourceNote: "발각 표적을 공격할 때 관통률 16%" }),
    skillLevel(5, "오니 「엄마」"),
    toggle(6, "인간의 것이 아닌 피", "damageBonus", 20, { skillTypes: ["ex-special"], sourceNote: "삼라만상 상태 중 강화 특수 스킬 피해 20%" }),
    unsupported(6, "인간의 것이 아닌 피", "극성 혼돈 추가 찌르기 상한 변경은 전용 계수·회전 모델이 필요합니다."),
  ]),
  defineCharacter("1261", "제인", "anomaly", [
    stacks(1, "범죄 고문", "damageBonus", 0.1, 300, { sourceNote: "열광 중 이상 마스터리 1pt당 피해 0.1%, 최대 30%. 스택값은 적용할 pt" }),
    unsupported(1, "범죄 고문", "물리 이상 축적 효율은 단일 이상 피해량에 포함되지 않습니다."),
    unsupported(2, "근주자적", "방어력 무시는 현재 안전 정규화 대상에서 제외됩니다.", "갉힘 표적 방어력 15% 무시"),
    unsupported(2, "근주자적", "강타 전용 치명타 피해 +50%는 이상 치명타 모델이 필요합니다."),
    skillLevel(3, "무명인"),
    toggle(4, "유연한 리드", "anomalyDamageBonus", 18, { sourceNote: "강타/혼돈 발동 후 파티 이상 피해 18%, 15초" }),
    skillLevel(5, "비축하는 습관"),
    toggle(6, "「지저분한」 수단", "critRate", 20, { sourceNote: "열광 상태 치명타 확률 20%" }),
    toggle(6, "「지저분한」 수단", "critDamage", 40, { sourceNote: "열광 상태 치명타 피해 40%" }),
    unsupported(6, "「지저분한」 수단", "강타 치명타 후 이상 마스터리 1600% 추가 공격은 별도 이상 치명타·패킷 모델이 필요합니다."),
  ]),
  defineCharacter("1281", "파이퍼", "anomaly", [
    unsupported(1, "여유 시간", "동력 획득 확률·상한은 회전 모델이 필요합니다."),
    toggle(2, "향상심", "damageBonus", 10, { skillTypes: ["special:slam", "ex:slam", "ultimate:slam"], sourceNote: "지정 내려찍기 물리 피해 10%" }),
    stacks(2, "향상심", "damageBonus", 1, 30, { skillTypes: ["special:slam", "ex:slam", "ultimate:slam"], sourceNote: "동력 1스택당 지정 내려찍기 피해 1%" }),
    skillLevel(3, "트럭 전문가"),
    unsupported(4, "숙련된 기교", "에너지 회복은 단일 이상 피해량에 포함되지 않습니다."),
    skillLevel(5, "개인적인 취미"),
    unsupported(6, "가벼운 설렘", "강화 특수 스킬·동력 지속 시간은 회전 모델이 필요합니다."),
  ]),
  defineCharacter("1331", "비비안", "anomaly", [
    unsupported(1, "〈봄의 정원으로 오라〉", "표적이 받는 이상·혼돈 피해 16%는 현재 취약도 배율 필드가 필요합니다."),
    unsupported(2, "〈폭풍우의 밤, 폭풍우의 밤〉", "난개 마스터리 환산 130%는 전용 난개 계수 모델이 필요합니다."),
    toggle(2, "〈폭풍우의 밤, 폭풍우의 밤〉", "resistanceIgnore", 15, { skillTypes: ["anomaly:abloom"], anomalyKey: "난개", sourceNote: "난개가 모든 속성 저항 15% 무시" }),
    skillLevel(3, "〈타자, 그 자신〉"),
    toggle(4, "〈갈대숲의 바람〉", "attackPercent", 12, { skillTypes: ["basic:rising-skirt-fall", "basic:feathers-and-flowers"], sourceNote: "지정 일반 공격 명중 후 공격력 12%, 12초" }),
    unsupported(4, "〈갈대숲의 바람〉", "지정 일반 공격 확정 치명타는 강제 치명타 플래그가 필요합니다."),
    skillLevel(5, "〈소네트〉"),
    always(6, "〈비비안〉", "damageBonus", 40, { element: "에테르", sourceNote: "에테르 피해 40% 상시 증가" }),
    unsupported(6, "〈비비안〉", "수호의 깃 5pt 소비 시 특수 난개 비율 5배만 확정되며 중간 스택 계수와 추가 결산 모델이 필요합니다."),
  ]),
  defineCharacter("1401", "앨리스", "anomaly", [
    toggle(1, "손바닥 위의 고수풀", "defenseReduction", 20, { anomalyKey: "강타", sourceNote: "앨리스 강타 발동 후 표적 방어력 20% 감소, 30초" }),
    always(2, "검 끝의 세이지", "anomalyDamageBonus", 15, { anomalyKey: "강타", sourceNote: "파티 강타 피해 15%" }),
    always(2, "검 끝의 세이지", "anomalyDamageBonus", 15, { anomalyKey: "물리 혼돈", sourceNote: "물리 이상 상태 적에게 결산되는 혼돈 피해 15%" }),
    skillLevel(3, "대칭주의"),
    always(4, "입술 사이 로즈메리", "resistanceIgnore", 10, { element: "물리", sourceNote: "물리 피해 저항 10% 무시" }),
    unsupported(4, "입술 사이 로즈메리", "물리 이상 축적치 25%는 단일 이상 피해량에 포함되지 않습니다."),
    skillLevel(5, "불가사의를 향한 열망"),
    unsupported(6, "마음속 백리향", "이상 마스터리 3300%·확정 치명타 추가 공격은 별도 패킷과 이상 치명타 모델이 필요합니다."),
  ]),
  defineCharacter("1501", "아리아", "anomaly", [
    unsupported(1, "활기찬 목소리", "난개 치명타 확률·피해와 초기 이상 장악력 연동은 전용 이상 치명타 모델이 필요합니다."),
    unsupported(1, "활기찬 목소리", "에테르 이상 축적 저항 무시는 단일 이상 피해량에 포함되지 않습니다."),
    unsupported(2, "꿈같은 리듬", "방어력 무시는 현재 안전 정규화 대상에서 제외됩니다.", "공격/난개 방어력 16%, 망상의 시간 중 추가 8% 무시"),
    skillLevel(3, "드리머"),
    unsupported(4, "기계 천사", "에너지·데시벨 회복은 단일 이상 피해량에 포함되지 않습니다."),
    skillLevel(5, "빗속의 눈물"),
    toggle(6, "구조체의 꿈", "damageBonus", 40, { element: "에테르", skillTypes: ["basic:enhanced-absolute-pitch", "ultimate"], sourceNote: "망상의 시간 중 지정 공격 에테르 피해 40%" }),
  ]),
  defineCharacter("1541", "프로미아", "anomaly", [
    unsupported(1, "순진한 이상", "방어력 무시는 현재 안전 정규화 대상에서 제외됩니다.", "유죄 추정 표적에 대한 파티 난개 방어력 20% 무시"),
    always(2, "흔들리는 신념", "anomalyProficiency", 40, { sourceNote: "이상 마스터리 40pt 상시 증가" }),
    unsupported(2, "흔들리는 신념", "서리 형벌 난개 배율 +120%는 전용 난개 계수 모델이 필요합니다."),
    skillLevel(3, "잔혹한 달빛"),
    unsupported(4, "냉혹한 죄명", "한랭 침식 회복은 단일 이상 피해량에 포함되지 않습니다."),
    skillLevel(5, "죽어가는 나방"),
    always(6, "계속될 이야기", "resistanceIgnore", 15, { anomalyKey: ["연소", "침식", "감전", "쇄빙", "강타", "풍화", "혼돈", "난개", "난류"], sourceNote: "자신의 속성 이상·혼돈 피해가 모든 속성 저항 15% 무시" }),
    unsupported(6, "계속될 이야기", "200% 고정 결산 특수 난개는 별도 이상 결산 패킷이 필요합니다."),
  ]),
  defineCharacter("1561", "벨리나", "anomaly", [
    always(1, "질서 있는 우아함", "resistanceIgnore", 20, { anomalyKey: "난류", sourceNote: "벨리나가 난류 발동 시 모든 속성 저항 20% 무시" }),
    always(1, "질서 있는 우아함", "resistanceIgnore", 20, { element: "바람", anomalyKey: "풍화", sourceNote: "파티 풍화 피해가 바람 저항 20% 무시" }),
    toggle(2, "포화식 플랜", "anomalyDamageBonus", 15, { anomalyKey: ["풍화", "난류"], sourceNote: "추가 능력 활성 중 풍화·난류 피해 증가 효과 추가 15%" }),
    skillLevel(3, "예의 바른 정복"),
    toggle(4, "티타임은 곧 심판", "attackPercent", 15, { sourceNote: "강화 특수 스킬 후 공격력 15%, 40초" }),
    skillLevel(5, "죽음을 고하는 마녀"),
    stacks(6, "수석 천사", "damageBonus", 2.5, 16, { anomalyKey: "풍화", sourceNote: "풍화 재부여 시 이전 풍화 남은 1초당 피해 2.5%, 최대 40%" }),
    unsupported(6, "수석 천사", "풍식 회복과 바람 이상 축적치 증가는 단일 이상 피해량에 포함되지 않습니다."),
  ]),

  defineCharacter("1051", "이드하리", "mingpo", [
    toggle(1, "심연 아래 잠긴 과거", "resistanceIgnore", 20, { element: "얼음", skillTypes: ["basic", "ex-special"], sourceNote: "일반 공격/강화 특수 스킬이 얼음 저항 20% 무시" }),
    always(2, "누가 이곳에서 사색하는가", "critDamage", 40, { sourceNote: "치명타 피해 40% 상시 증가" }),
    skillLevel(3, "듣는 이가 없는 이야기"),
    toggle(4, "고요 속에 피어나다", "hpPercent", 5, { sourceNote: "에테르 장막·용천 중 HP 최대치 5%" }),
    skillLevel(5, "허구가 아닌 위로"),
    toggle(6, "마침내 평안을 만난 꿈", "penetrationDamageBonus", 25, { sourceNote: "깨우침 기간 중 관입 피해 25%" }),
  ]),
  defineCharacter("1371", "의현", "mingpo", [
    always(1, "청정한 도심", "critRate", 10, { sourceNote: "전장 진입 시 치명타 확률 10%" }),
    unsupported(1, "청정한 도심", "관입력 50% 낙뢰는 별도 추가 피해 패킷이 필요합니다."),
    toggle(2, "재앙을 막고, 액운을 넘어", "resistanceIgnore", 15, { element: "에테르", skillTypes: ["ex-special", "ultimate"], sourceNote: "궁극기/강화 특수 스킬이 에테르 저항 15% 무시" }),
    unsupported(2, "재앙을 막고, 액운을 넘어", "관입력 1200% 파괴 스킬은 별도 스킬 패킷이 필요합니다."),
    skillLevel(3, "음양의 조화"),
    stacks(4, "술도귀일", "damageBonus", 30, 2, { skillTypes: ["ex:dense-cloud", "ex:vanish-with-ink"], sourceNote: "평정심 1스택당 다음 지정 EX 피해 30%" }),
    skillLevel(5, "구름을 바라보며"),
    toggle(6, "동요와 고요", "penetrationDamageBonus", 20, { sourceNote: "정신 집중 상태 관입 피해 20%" }),
  ]),
  defineCharacter("1441", "마나토", "mingpo", [
    stacks(1, "방랑자의 생존 법칙", "damageBonus", 0.4, 50, { element: "불", skillTypes: ["assist-attack", "basic"], sourceNote: "잃은 HP 1%당 지정 불 피해 0.4%, 최대 20%. 스택값은 잃은 HP%" }),
    toggle(2, "낮과 밤, 주방과 사랑", "resistanceIgnore", 8, { element: "불", sourceNote: "달궈진 칼날 상태에서 불 저항 8% 무시" }),
    skillLevel(3, "괴담의 세계로"),
    always(4, "소년의 맹세", "hpPercent", 8, { sourceNote: "HP 최대치 8% 상시 증가" }),
    unsupported(4, "소년의 맹세", "치명상 생존 효과는 공격 피해식에 포함되지 않습니다."),
    skillLevel(5, "혼자가 아닌 나"),
    stacks(6, "지난날의 꿈을 넘어서", "damageBonus", 3, 5, { element: "불", skillTypes: ["assist-attack"], sourceNote: "지원 돌격 명중 후 스택당 불 피해 3%, 8초" }),
  ]),
  defineCharacter("1471", "반악", "mingpo", [
    toggle(1, "탐욕은 불과 같다", "resistanceReduction", 10, { element: "불", sourceNote: "전율 표적 불 저항 10% 감소, 30초" }),
    toggle(1, "탐욕은 불과 같다", "penetrationDamageBonus", 10, { skillTypes: ["ex:lion-roar", "ex:shaking-mountain", "basic:collapsed-mountain", "basic:mountain-crush"], sourceNote: "전율 표적에 대한 지정 스킬 관입 피해 10%" }),
    toggle(2, "증오는 칼과 같다", "critDamage", 15, { sourceNote: "핵심 패시브 치명타 피해 버프 추가 15%" }),
    toggle(2, "증오는 칼과 같다", "damageBonus", 15, { element: "불", sourceNote: "핵심 패시브 불 피해 버프 추가 15%" }),
    skillLevel(3, "우둔함은 족쇄와 같다"),
    toggle(4, "섬멸 유닛·타입 제로", "damageBonus", 30, { skillTypes: ["ex:lion-roar-rage", "ex:shaking-mountain-rage", "basic:collapsed-mountain", "basic:mountain-crush"], sourceNote: "지정 스킬 피해 30%" }),
    skillLevel(5, "학도"),
    toggle(6, "명왕의 강림", "damageBonus", 8, { element: "불", sourceNote: "명왕 상태 불 피해 버프 추가 8%" }),
    unsupported(6, "명왕의 강림", "일반 공격 시 관입력 600% 추가 피해는 별도 패킷이 필요합니다."),
  ]),
  defineCharacter("1531", "스타라이트·빌리", "mingpo", [
    toggle(1, "영웅 등장", "resistanceIgnore", 18, { element: "물리", sourceNote: "강화 특수 명중 후 자신의 공격이 물리 저항 18% 무시, 45초" }),
    toggle(2, "황야의 기계 병사", "damageBonus", 50, { skillTypes: ["basic:max-magic-starlight", "ex:wheely-stunt", "ultimate:flying-kick"], sourceNote: "지정 스킬 피해 50%" }),
    toggle(2, "황야의 기계 병사", "critDamage", 50, { skillTypes: ["ex:wheely-stunt"], sourceNote: "터보 부스트 소비 시 윌리 스턴트 치명타 피해 50%" }),
    skillLevel(3, "기사도 정신"),
    stacks(4, "정의의 불꽃", "critDamage", 8, 2, { sourceNote: "특수 스킬 동력 제어 시전마다 치명타 피해 8%, 45초" }),
    skillLevel(5, "빛나는 무기"),
    toggle(6, "별빛 기사", "penetrationDamageBonus", 18, { skillTypes: ["ultimate:flying-kick", "basic:max-magic-starlight"], sourceNote: "지정 스킬 관입 피해 18%" }),
    unsupported(6, "별빛 기사", "찬란한 별빛 1스택당 관입력 100% 추가 피해는 별도 패킷이 필요합니다."),
  ]),
];

export const MINDSCAPE_EFFECTS = Object.freeze(Object.fromEntries(entries));

export const MINDSCAPE_CHARACTER_NAMES = Object.freeze(
  Object.fromEntries(
    Object.entries(MINDSCAPE_EFFECTS).map(([characterId, effects]) => [
      characterId,
      effects[0]?.characterName ?? characterId,
    ]),
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
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

function scopeMismatch(effect, context) {
  if (context.mode && effect.mode && context.mode !== effect.mode) {
    return "mode";
  }

  if (effect.element) {
    const selectedElements = asArray(context.element);
    if (
      selectedElements.length === 0 ||
      !selectedElements.includes(effect.element)
    ) {
      return "element";
    }
  }

  if (effect.anomalyKey) {
    const effectKeys = asArray(effect.anomalyKey);
    const selectedKeys = asArray(context.anomalyKey);
    if (
      selectedKeys.length === 0 ||
      !intersects(effectKeys, selectedKeys)
    ) {
      return "anomalyKey";
    }
  }

  if (effect.skillTypes.length > 0) {
    const selectedSkillTypes = asArray(context.skillType);
    if (
      selectedSkillTypes.length === 0 ||
      !intersects(effect.skillTypes, selectedSkillTypes)
    ) {
      return "skillType";
    }
  }

  return null;
}

function requestedActivation(effect, context) {
  const requested = context.activations?.[effect.key];

  if (effect.activation === "always") {
    return { active: true, stacks: 1 };
  }

  if (effect.activation === "stacks") {
    const rawStacks = context.maxActivation
      ? effect.maxStacks
      : Number(requested ?? (effect.defaultActive ? effect.maxStacks : 0));
    const activeStacks = Number.isFinite(rawStacks)
      ? clamp(Math.trunc(rawStacks), 0, effect.maxStacks)
      : 0;
    return { active: activeStacks > 0, stacks: activeStacks };
  }

  const active = context.maxActivation
    ? true
    : requested === undefined
      ? effect.defaultActive
      : Boolean(requested);
  return { active, stacks: active ? 1 : 0 };
}

/**
 * Resolves cumulative Mindscape effects for a character.
 *
 * maxActivation enables every supported toggle and uses every stack at its
 * maximum, but it never bypasses mode/element/anomaly/skill scope checks.
 * activations is keyed by the stable `effect.key` exposed in applied/skipped.
 */
export function resolveMindscapeEffects(
  characterId,
  mindscape = 0,
  options = {},
) {
  const effects = MINDSCAPE_EFFECTS[String(characterId)] ?? [];
  const selectedMindscape = clamp(Math.trunc(Number(mindscape) || 0), 0, 6);
  const context = {
    mode: options.mode ?? effects[0]?.mode ?? null,
    element: options.element ?? null,
    anomalyKey: options.anomalyKey ?? null,
    skillType: options.skillType ?? null,
    maxActivation: Boolean(options.maxActivation),
    activations: options.activations ?? {},
  };

  const totals = Object.fromEntries(
    MINDSCAPE_SUPPORTED_STATS.map((stat) => [stat, 0]),
  );
  const applied = [];
  const skipped = [];
  const unresolved = [];

  for (const entry of effects) {
    if (entry.level > selectedMindscape) continue;

    if (entry.stat === "unsupported" || !SUPPORTED_STATS.has(entry.stat)) {
      unresolved.push(entry);
      continue;
    }

    if (!VALID_ACTIVATIONS.has(entry.activation)) {
      unresolved.push({
        ...entry,
        reason: `지원하지 않는 activation "${entry.activation}"`,
      });
      continue;
    }

    const mismatch = scopeMismatch(entry, context);
    if (mismatch) {
      skipped.push({ ...entry, skippedReason: `scope:${mismatch}` });
      continue;
    }

    const activation = requestedActivation(entry, context);
    if (!activation.active) {
      skipped.push({ ...entry, skippedReason: "inactive" });
      continue;
    }

    const amount = entry.value * activation.stacks;
    totals[entry.stat] += amount;
    applied.push({ ...entry, activeStacks: activation.stacks, amount });
  }

  return {
    characterId: String(characterId),
    mindscape: selectedMindscape,
    dataVersion: MINDSCAPE_DATA_VERSION,
    totals,
    applied,
    skipped,
    unsupported: unresolved,
  };
}

export function getMindscapeEffects(characterId, mindscape = 6) {
  const selectedMindscape = clamp(Math.trunc(Number(mindscape) || 0), 0, 6);
  return (MINDSCAPE_EFFECTS[String(characterId)] ?? []).filter(
    (entry) => entry.level <= selectedMindscape,
  );
}
