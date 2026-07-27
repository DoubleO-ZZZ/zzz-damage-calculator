import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  ENEMY_BY_ID,
  S_RANK_ENEMIES,
  resolveEnemy,
} from "../src/data/enemies.js";

test("verified enemy snapshot contains 24 unique S-rank choices", () => {
  assert.equal(S_RANK_ENEMIES.length, 24);
  assert.equal(
    new Set(S_RANK_ENEMIES.map((enemy) => enemy.id)).size,
    S_RANK_ENEMIES.length,
  );
  assert.equal(Object.keys(ENEMY_BY_ID).length, S_RANK_ENEMIES.length);

  for (const enemy of S_RANK_ENEMIES) {
    assert.equal(enemy.rank, "S");
    assert.ok(enemy.defenseAt60 > 0);
    assert.ok(enemy.stunMultiplierPercent > 0);
    assert.deepEqual(Object.keys(enemy.resistances), [
      "physical",
      "fire",
      "ice",
      "electric",
      "ether",
      "wind",
    ]);
    assert.match(enemy.sourceUrl, /^https:\/\/zzz\.nanoka\.cc\/monster\//);
    assert.equal(enemy.icon, `./assets/nanoka/enemies/${enemy.id}.webp`);
    assert.doesNotMatch(enemy.icon, /^https?:\/\//);
    assert.ok(
      existsSync(new URL(`../${enemy.icon.slice(2)}`, import.meta.url)),
      `missing local enemy image for ${enemy.id}`,
    );
  }
});

test("enemy resolution applies the selected element resistance", () => {
  const butcher = resolveEnemy("30007", "ice");
  const pompeyFire = resolveEnemy("30021", "fire");
  const pompeyElectric = resolveEnemy("30021", "electric");

  assert.equal(butcher.enemyDefense, 952.8);
  assert.equal(butcher.enemyResistancePercent, -20);
  assert.equal(butcher.baseStunMultiplierPercent, 150);
  assert.equal(pompeyFire.enemyResistancePercent, -20);
  assert.equal(pompeyElectric.enemyResistancePercent, 40);
});

test("high-defense and notorious variants preserve their verified entity data", () => {
  const hunter = resolveEnemy("30041", "physical");
  const notoriousButcher = resolveEnemy("300072", "ether");

  assert.equal(hunter.enemyDefense, 1588);
  assert.equal(hunter.enemyResistancePercent, 40);
  assert.equal(resolveEnemy("30041", "fire").enemyResistancePercent, -20);
  assert.equal(notoriousButcher.entityId, 11901);
  assert.equal(notoriousButcher.enemyDefense, 952.8);
  assert.equal(notoriousButcher.enemyResistancePercent, -20);
});

test("unknown enemy ids fall back to a complete S-rank preset", () => {
  const fallback = resolveEnemy("not-a-real-enemy", "ether");

  assert.equal(fallback.id, S_RANK_ENEMIES[0].id);
  assert.equal(fallback.enemyDefense, S_RANK_ENEMIES[0].defenseAt60);
  assert.equal(
    fallback.enemyResistancePercent,
    S_RANK_ENEMIES[0].resistances.ether,
  );
});
