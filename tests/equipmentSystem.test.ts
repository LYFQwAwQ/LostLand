import assert from "node:assert/strict";
import test from "node:test";
import type { EquipmentTemplate } from "../src/types/game.ts";
import {
  EQUIPMENT_QUALITY_AFFIX_COUNT,
  generateEquipmentBatch,
  generateEquipmentFromPool,
  generateEquipmentFromTemplate,
  getSocketCountByLevel
} from "../src/lib/equipmentSystem.ts";

function buildForcedTemplate(): EquipmentTemplate {
  return {
    id: "forced",
    name: "测试样本",
    slot: "oneHand",
    subtype: "longSword",
    baseWeight: 1,
    t1Stats: [{ key: "str", label: "力量", lvl1Base: 100, growthRate: 10 }],
    rankWeights: {
      crude: 0,
      fine: 1,
      superior: 0,
      perfect: 0
    },
    qualityWeights: {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
      mythic: 1
    },
    affixPool: [{ key: "critRate", label: "暴击率", min: 0.2, max: 0.2, weight: 1 }]
  };
}

test("quality decides affix count, mythic -> 5", () => {
  const item = generateEquipmentFromTemplate(buildForcedTemplate(), { seed: 20260303 });
  assert.equal(item.quality, "mythic");
  assert.equal(item.affixCount, EQUIPMENT_QUALITY_AFFIX_COUNT.mythic);
  assert.equal(item.affixes.length, EQUIPMENT_QUALITY_AFFIX_COUNT.mythic);
});

test("rank multiplier amplifies both t1 base stats and t2 affixes", () => {
  const item = generateEquipmentFromTemplate(buildForcedTemplate(), { seed: 7, level: 1 });
  assert.equal(item.rank, "fine");
  const base = item.t1Stats[0];
  const affix = item.affixes[0];

  assert.equal(base.baseValue, 100);
  assert.equal(base.finalValue, Number((100 * (1 + item.rankPercent)).toFixed(3)));
  assert.equal(affix.rolledValue, 0.2);
  assert.equal(affix.finalValue, Number((0.2 * (1 + item.rankPercent)).toFixed(3)));
});

test("affix roll is sampled with replacement (non-deduplicated)", () => {
  const item = generateEquipmentFromTemplate(buildForcedTemplate(), { seed: "same-affix" });
  assert.equal(item.affixes.length, 5);
  assert.equal(new Set(item.affixes.map((x) => x.key)).size, 1);
});

test("socket unlock count follows level / 20", () => {
  assert.equal(getSocketCountByLevel(1), 0);
  assert.equal(getSocketCountByLevel(19), 0);
  assert.equal(getSocketCountByLevel(20), 1);
  assert.equal(getSocketCountByLevel(40), 2);
});

test("environment multipliers can force quality result", () => {
  const template: EquipmentTemplate = {
    ...buildForcedTemplate(),
    qualityWeights: {
      common: 1,
      uncommon: 1,
      rare: 1,
      epic: 1,
      legendary: 1,
      mythic: 1
    }
  };

  const item = generateEquipmentFromTemplate(template, {
    seed: 12,
    environment: {
      id: "force-common",
      label: "测试环境",
      qualityWeightMultipliers: {
        common: 100,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
        mythic: 0
      }
    }
  });

  assert.equal(item.quality, "common");
  assert.equal(item.affixCount, 0);
});

test("batch generation is deterministic when seed is fixed", () => {
  const pool: EquipmentTemplate[] = [
    buildForcedTemplate(),
    {
      ...buildForcedTemplate(),
      id: "forced-2",
      baseWeight: 10
    }
  ];

  const a = generateEquipmentBatch(pool, 4, { seed: "batch-seed", source: "test" });
  const b = generateEquipmentBatch(pool, 4, { seed: "batch-seed", source: "test" });
  assert.deepEqual(a, b);
});

test("pool generation respects baseWeight random selection", () => {
  const first: EquipmentTemplate = { ...buildForcedTemplate(), id: "first", baseWeight: 0 };
  const second: EquipmentTemplate = { ...buildForcedTemplate(), id: "second", baseWeight: 100 };
  const item = generateEquipmentFromPool([first, second], { seed: 9981 });
  assert.equal(item.templateId, "second");
});
