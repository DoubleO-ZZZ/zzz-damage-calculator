const ELEMENT_CHARACTER_IDS = Object.freeze({
  physical: new Set([
    "1021", "1061", "1071", "1081", "1261", "1281", "1351", "1401",
    "1411", "1421", "1431", "1481", "1491", "1531",
  ]),
  fire: new Set([
    "1041", "1101", "1121", "1151", "1161", "1171", "1301", "1321",
    "1391", "1441", "1471", "1571",
  ]),
  ice: new Set([
    "1051", "1091", "1131", "1141", "1191", "1291", "1341", "1541",
  ]),
  electric: new Set([
    "1011", "1111", "1181", "1201", "1211", "1221", "1251", "1271",
    "1361", "1381", "1461", "1521",
  ]),
  wind: new Set(["1561"]),
  ether: new Set([
    "1031", "1241", "1311", "1331", "1371", "1451", "1501", "1511",
    "1551",
  ]),
});

export const ELEMENT_LABELS = Object.freeze({
  physical: "물리",
  fire: "불",
  ice: "얼음",
  electric: "전기",
  wind: "바람",
  ether: "에테르",
  unknown: "속성 미확인",
});

export function characterElement(characterId) {
  return (
    Object.entries(ELEMENT_CHARACTER_IDS).find(([, ids]) =>
      ids.has(String(characterId)),
    )?.[0] ?? "unknown"
  );
}

export function characterImage(characterId) {
  return `./assets/nanoka/characters/${encodeURIComponent(characterId)}.webp`;
}

export function weaponImage(weaponId) {
  return `./assets/nanoka/weapons/${encodeURIComponent(weaponId)}.webp`;
}

export function discImage(discId) {
  return `./assets/nanoka/discs/${encodeURIComponent(discId)}.webp`;
}
