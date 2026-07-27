import test from "node:test";
import assert from "node:assert/strict";

import { CHARACTER_BY_ID, WEAPONS } from "../src/data/catalog.js";
import {
  PARTY_WEAPON_EFFECTS,
  resolvePartyWeaponEffects,
} from "../src/data/party-weapon-effects.js";
import {
  resolveSharedParty,
  resolveSupportBuild,
} from "../src/party-engine.js";

const dealer = CHARACTER_BY_ID["1041"];

function supportBuild(member) {
  const character = CHARACTER_BY_ID[member.characterId];
  return resolveSupportBuild(member, {
    dealer,
    team: [dealer, character],
    mode: "strong",
    skillType: "normal",
    stunned: false,
  });
}

test("Astra support preset reaches the attack-share cap with minimum rolls", () => {
  const build = supportBuild({
    characterId: "1311",
    weaponId: "14131",
    weaponRefinement: 1,
    discFourPieceId: "32800",
  });

  assert.deepEqual(build.rolls, {
    attackPercent: 3,
    hpPercent: 0,
    critRatePercent: 0,
    total: 3,
  });
  assert.equal(build.twoPieceId, "31400");
  assert.ok(Math.abs(build.stats.initialAttack - 3443.32) < 1e-9);
  assert.deepEqual(
    build.cuts.map(({ threshold, rolls, reached, attainable }) => ({
      threshold,
      rolls,
      reached,
      attainable,
    })),
    [{ threshold: 3429, rolls: 3, reached: true, attainable: true }],
  );
});

test("King of the Summit preset stops at the 50% wearer crit threshold", () => {
  const build = supportBuild({
    characterId: "1251",
    weaponId: "14125",
    weaponRefinement: 1,
    discFourPieceId: "33200",
  });

  assert.equal(build.rolls.critRatePercent, 6);
  assert.ok(Math.abs(build.stats.critRate - 51.4) < 1e-9);
  assert.equal(build.cuts[0].threshold, 50);
  assert.equal(build.cuts[0].reached, true);
  assert.equal(
    build.discEffects
      .filter((row) => row.active && row.stat === "critDamage")
      .reduce((sum, row) => sum + row.amount, 0),
    30,
  );
});

test("non-rollable support caps are reported instead of fabricating substats", () => {
  const build = supportBuild({
    characterId: "1211",
    weaponId: "14121",
    weaponRefinement: 1,
    discFourPieceId: "31300",
  });

  assert.equal(build.stats.penetrationRatio, 70.4);
  assert.equal(build.cuts[0].threshold, 72);
  assert.equal(build.cuts[0].reached, false);
  assert.equal(build.cuts[0].attainable, false);
  assert.equal(build.rolls.total, 0);
});

test("support W-Engine refinement is included before buff-cut evaluation", () => {
  const member = {
    characterId: "1161",
    weaponId: "14116",
    discFourPieceId: "33200",
  };
  const r1 = supportBuild({ ...member, weaponRefinement: 1 });
  const r5 = supportBuild({ ...member, weaponRefinement: 5 });

  assert.ok(Math.abs(r1.stats.impact - 256.19) < 1e-9);
  assert.ok(Math.abs(r5.stats.impact - 276.74) < 1e-9);
  assert.equal(r1.cuts[0].reached, false);
  assert.equal(r5.cuts[0].reached, true);
  assert.equal(
    r1.agentEffects.applied.find((row) => row.stat === "damageBonus")
      ?.amount,
    65,
  );
  assert.equal(
    r5.agentEffects.applied.find((row) => row.stat === "damageBonus")
      ?.amount,
    75,
  );
});

test("support crit cuts include self core, W-Engine, and teammate crit buffs", () => {
  const hugo = supportBuild({
    characterId: "1291",
    weaponId: "13004",
    weaponRefinement: 5,
    discFourPieceId: "33200",
  });
  const cissia = supportBuild({
    characterId: "1521",
    weaponId: "14152",
    weaponRefinement: 1,
    discFourPieceId: "33200",
  });
  const party = resolveSharedParty(
    {
      mode: "strong",
      skillType: "normal",
      stunned: false,
      party: {
        member2: {
          characterId: "1251",
          weaponId: "14125",
          weaponRefinement: 1,
          discFourPieceId: "33200",
        },
        member3: {
          characterId: "1121",
          weaponId: "13103",
          weaponRefinement: 5,
          discFourPieceId: "31900",
        },
      },
    },
    dealer,
  );

  assert.equal(hugo.rolls.critRatePercent, 0);
  assert.equal(hugo.stats.critRate, 31.4);
  assert.equal(cissia.rolls.critRatePercent, 0);
  assert.equal(cissia.stats.critRate, 48);
  assert.equal(cissia.selfWeaponPassive.totals.critRate, 25);
  assert.equal(party.members[0].build.rolls.critRatePercent, 0);
  assert.equal(party.members[0].build.stats.critRate, 53);
});

test("same party disc buff is deduplicated and member order is invariant", () => {
  const common = {
    mode: "strong",
    skillType: "normal",
    stunned: false,
    party: {
      member2: {
        characterId: "1311",
        weaponId: "14131",
        weaponRefinement: 1,
        discFourPieceId: "31600",
      },
      member3: {
        characterId: "1151",
        weaponId: "13115",
        weaponRefinement: 1,
        discFourPieceId: "31600",
      },
    },
  };
  const forward = resolveSharedParty(common, dealer);
  const reversedCommon = structuredClone(common);
  [
    reversedCommon.party.member2,
    reversedCommon.party.member3,
  ] = [
    reversedCommon.party.member3,
    reversedCommon.party.member2,
  ];
  const reversed = resolveSharedParty(reversedCommon, dealer);
  const sharedDiscRows = forward.ledger.filter(
    (row) => row.stackGroup === "disc:31600:party-damage",
  );

  assert.equal(sharedDiscRows.length, 2);
  assert.equal(sharedDiscRows.filter((row) => row.active).length, 1);
  assert.equal(
    sharedDiscRows.find((row) => !row.active)?.skippedReason,
    "non-stacking-duplicate",
  );
  assert.deepEqual(forward.totals, reversed.totals);
});

test("duplicate Game Ball party crit applies once and records the skipped copy", () => {
  const party = resolveSharedParty(
    {
      mode: "strong",
      skillType: "normal",
      party: {
        member2: {
          characterId: "1311",
          weaponId: "14002",
          weaponRefinement: 5,
          discFourPieceId: "33400",
        },
        member3: {
          characterId: "1031",
          weaponId: "14002",
          weaponRefinement: 5,
          discFourPieceId: "31600",
        },
      },
    },
    dealer,
  );
  const rows = party.ledger.filter(
    (row) => row.stackGroup === "wengine:14002:enemy-crit-rate",
  );

  assert.equal(party.totals.critRate, 20);
  assert.equal(rows.filter((row) => row.active).length, 1);
  assert.equal(
    rows.find((row) => !row.active)?.skippedReason,
    "non-stacking-duplicate",
  );
});

test("scope-mismatched party W-Engine effects remain visible as skipped", () => {
  const party = resolveSharedParty(
    {
      mode: "strong",
      skillType: "normal",
      party: {
        member2: {
          characterId: "1311",
          weaponId: "14149",
          weaponRefinement: 1,
          discFourPieceId: "33400",
        },
        member3: {
          characterId: "1161",
          weaponId: "14116",
          weaponRefinement: 1,
          discFourPieceId: "33200",
        },
      },
    },
    dealer,
  );
  const scoped = party.skipped.filter(
    (row) => row.sourceId === "14149" && row.skippedReason === "scope",
  );

  assert.equal(scoped.length, 2);
  assert.ok(scoped.every((row) => row.ownerId === "1311"));
});

test("Yuzuha auto 2-piece clears both buff cuts with minimum attack rolls", () => {
  const r1Moonlight = supportBuild({
    characterId: "1411",
    weaponId: "14141",
    weaponRefinement: 1,
    discFourPieceId: "33400",
  });
  const r1Phaethon = supportBuild({
    characterId: "1411",
    weaponId: "14141",
    weaponRefinement: 1,
    discFourPieceId: "33000",
  });
  const r3Moonlight = supportBuild({
    characterId: "1411",
    weaponId: "14141",
    weaponRefinement: 3,
    discFourPieceId: "33400",
  });

  assert.equal(r1Moonlight.twoPieceId, "33000");
  assert.ok(r1Moonlight.stats.anomalyMastery >= 200);
  assert.equal(r1Phaethon.twoPieceId, "32800");
  assert.equal(r1Phaethon.rolls.attackPercent, 5);
  assert.ok(r1Phaethon.stats.anomalyMastery >= 200);
  assert.equal(r3Moonlight.twoPieceId, "32800");
  assert.equal(r3Moonlight.rolls.attackPercent, 5);
});

test("duplicate dealer and party members are excluded from the resolved team", () => {
  const party = resolveSharedParty(
    {
      party: {
        member2: {
          characterId: "1041",
          weaponId: "14104",
          discFourPieceId: "31900",
        },
        member3: {
          characterId: "1041",
          weaponId: "14104",
          discFourPieceId: "31900",
        },
      },
    },
    dealer,
  );

  assert.deepEqual(party.team.map((member) => member.id), ["1041"]);
  assert.ok(
    party.members.every(
      (member) => member.skippedReason === "duplicate-character",
    ),
  );
});

test("all live support, stun, and defense W-Engines declare R1-R5 effects", () => {
  const catalog = WEAPONS.filter(
    (weapon) =>
      ["지원", "격파", "방어"].includes(weapon.specialty) &&
      weapon.version.includes("3.0 live"),
  );

  assert.equal(catalog.length, 34);
  assert.deepEqual(
    catalog
      .filter((weapon) => !PARTY_WEAPON_EFFECTS[weapon.id])
      .map((weapon) => weapon.id),
    [],
  );

  for (const weapon of catalog) {
    const definition = PARTY_WEAPON_EFFECTS[weapon.id];
    assert.ok(
      definition.effects.length + definition.selfEffects.length > 0,
      `${weapon.id} has no declared effects`,
    );
    for (const row of [...definition.effects, ...definition.selfEffects]) {
      assert.equal(row.values.length, 5, `${row.key} lacks R1-R5 values`);
      assert.match(
        definition.sourceUrl,
        new RegExp(`/3\\.0/ko/weapon/${weapon.id}\\.json$`),
      );
    }
  }
});

test("Hellfire Gears refinement changes the wearer's maximum Impact buff", () => {
  const r1 = resolvePartyWeaponEffects("14110", 1);
  const r5 = resolvePartyWeaponEffects("14110", 5);
  const buildR1 = supportBuild({
    characterId: "1161",
    weaponId: "14110",
    weaponRefinement: 1,
    discFourPieceId: "33200",
  });
  const buildR5 = supportBuild({
    characterId: "1161",
    weaponId: "14110",
    weaponRefinement: 5,
    discFourPieceId: "33200",
  });

  assert.equal(r1.selfApplied[0].stat, "impactPercent");
  assert.equal(r1.selfApplied[0].amount, 20);
  assert.equal(r5.selfApplied[0].amount, 40);
  assert.ok(buildR5.stats.impact > buildR1.stats.impact);
  assert.equal(buildR1.cuts[0].reached, false);
  assert.equal(buildR5.cuts[0].reached, true);
  assert.equal(r1.applied.length, 0);
  assert.equal(r1.unsupported.length, 1);
  assert.equal(r1.unsupported[0].skippedReason, "unsupported");
});

test("Belina signature exposes separate wearer and party AP refinements", () => {
  const r1 = resolvePartyWeaponEffects("14156", 1, {
    wearer: CHARACTER_BY_ID["1561"],
    dealer,
  });
  const r5 = resolvePartyWeaponEffects("14156", 5, {
    wearer: CHARACTER_BY_ID["1561"],
    dealer,
  });

  assert.equal(r1.applied[0].stat, "anomalyProficiency");
  assert.equal(r1.applied[0].amount, 60);
  assert.equal(r5.applied[0].amount, 96);
  assert.equal(r1.selfApplied[0].stat, "anomalyProficiency");
  assert.equal(r1.selfApplied[0].amount, 70);
  assert.equal(r5.selfApplied[0].amount, 110);

  const shared = resolveSharedParty(
    {
      party: {
        member2: {
          characterId: "1561",
          weaponId: "14156",
          weaponRefinement: 5,
          discFourPieceId: "31900",
        },
      },
    },
    dealer,
  );
  const ledgerRow = shared.ledger.find(
    (row) =>
      row.sourceId === "14156" &&
      row.stat === "anomalyProficiency",
  );
  assert.equal(ledgerRow?.amount, 96);
  assert.equal(ledgerRow?.active, true);
});

test("Yuzuha engine keeps Anomaly Mastery and Proficiency distinct", () => {
  const r5 = resolvePartyWeaponEffects("14141", 5);

  assert.equal(r5.applied[0].stat, "anomalyProficiency");
  assert.equal(r5.applied[0].amount, 96);
  assert.deepEqual(
    r5.selfApplied.map(({ stat, amount }) => ({ stat, amount })),
    [
      { stat: "anomalyMasteryFlat", amount: 48 },
      { stat: "anomalyProficiency", amount: 96 },
    ],
  );
});
