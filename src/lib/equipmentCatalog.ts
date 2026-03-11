import type { EquipmentSlot, EquipmentSubtype, HeroClass } from "../types/game";

export interface HeroEquipSlotDefinition {
  id: string;
  label: string;
  slot: EquipmentSlot;
}

const PALADIN_HAND_SLOT_IDS = ["hand-1", "hand-2"] as const;

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  head: "头部",
  armor: "护甲",
  oneHand: "手部",
  twoHand: "双手",
  bracer: "护手",
  legs: "护腿",
  shoes: "鞋",
  accessory: "饰品",
  castingMedium: "施法媒介",
  castingCore: "施法核心"
};

export const EQUIPMENT_SUBTYPE_LABELS: Record<EquipmentSubtype, string> = {
  heavyHelm: "重型头盔",
  lightHelm: "轻型头盔",
  lightArmor: "轻甲",
  heavyArmor: "重甲",
  robe: "法袍",
  shield: "盾牌",
  longSword: "长剑",
  staff: "法杖",
  greatSword: "巨剑",
  spear: "长矛",
  plateBracer: "重型护手",
  clothBracer: "布甲护手",
  lightLegGuard: "轻型护腿",
  heavyLegGuard: "重型护腿",
  clothShoes: "布鞋",
  plateBoots: "重甲鞋",
  fireMedium: "炽焰符文",
  frostMedium: "霜语符文",
  stormMedium: "风暴符文",
  fireCore: "余烬核心",
  rangerBoots: "游侠战靴",
  ring: "戒指",
  necklace: "项链",
  bracelet: "手镯"
};

const PALADIN_EQUIP_SLOTS: HeroEquipSlotDefinition[] = [
  { id: "head-1", label: "头盔", slot: "head" },
  { id: "armor-1", label: "护甲", slot: "armor" },
  { id: "legs-1", label: "护腿-左", slot: "legs" },
  { id: "legs-2", label: "护腿-右", slot: "legs" },
  { id: "bracer-1", label: "护手-左", slot: "bracer" },
  { id: "bracer-2", label: "护手-右", slot: "bracer" },
  { id: "hand-1", label: "手部-左", slot: "oneHand" },
  { id: "hand-2", label: "手部-右", slot: "oneHand" },
  { id: "accessory-1", label: "饰品-1", slot: "accessory" },
  { id: "accessory-2", label: "饰品-2", slot: "accessory" },
  { id: "accessory-3", label: "饰品-3", slot: "accessory" }
];

const MAGE_EQUIP_SLOTS: HeroEquipSlotDefinition[] = [
  { id: "rune-1", label: "符文-1", slot: "castingMedium" },
  { id: "rune-2", label: "符文-2", slot: "castingMedium" },
  { id: "rune-3", label: "符文-3", slot: "castingMedium" },
  { id: "rune-4", label: "符文-4", slot: "castingMedium" },
  { id: "rune-5", label: "符文-5", slot: "castingMedium" },
  { id: "head-1", label: "头盔", slot: "head" },
  { id: "armor-1", label: "护甲", slot: "armor" },
  { id: "accessory-1", label: "饰品-1", slot: "accessory" },
  { id: "accessory-2", label: "饰品-2", slot: "accessory" },
  { id: "accessory-3", label: "饰品-3", slot: "accessory" },
  { id: "core-1", label: "施法核心", slot: "castingCore" }
];

const RANGER_EQUIP_SLOTS: HeroEquipSlotDefinition[] = [
  { id: "ranger-hand-1", label: "主手", slot: "oneHand" },
  { id: "ranger-hand-2", label: "副手", slot: "oneHand" },
  { id: "ranger-armor-1", label: "护甲", slot: "armor" },
  { id: "ranger-shoes-1", label: "战靴", slot: "shoes" },
  { id: "ranger-accessory-1", label: "饰品-1", slot: "accessory" },
  { id: "ranger-accessory-2", label: "饰品-2", slot: "accessory" },
  { id: "ranger-accessory-3", label: "饰品-3", slot: "accessory" },
  { id: "ranger-accessory-4", label: "饰品-4", slot: "accessory" }
];

const HERO_EQUIP_SLOTS: Record<HeroClass, HeroEquipSlotDefinition[]> = {
  paladin: PALADIN_EQUIP_SLOTS,
  mage: MAGE_EQUIP_SLOTS,
  ranger: RANGER_EQUIP_SLOTS
};

export const HERO_EQUIP_TYPE_SUMMARY: Record<HeroClass, string[]> = {
  paladin: ["头盔 x1", "护甲 x1", "护腿 x2", "护手 x2", "手部 x2", "饰品（戒指/项链/手镯）x3"],
  mage: ["施法核心 x1", "符文 x5", "头盔 x1", "护甲 x1", "饰品（戒指/项链/手镯）x3"],
  ranger: ["手部 x2", "护甲 x1", "战靴 x1", "饰品（戒指/项链/手镯）x4"]
};

export function getHeroEquipSlots(heroClass: HeroClass): HeroEquipSlotDefinition[] {
  return HERO_EQUIP_SLOTS[heroClass];
}

export function isPaladinHandSlot(slotId: string): boolean {
  return PALADIN_HAND_SLOT_IDS.includes(slotId as (typeof PALADIN_HAND_SLOT_IDS)[number]);
}

export function getPairedPaladinHandSlot(slotId: string): string | null {
  if (slotId === "hand-1") {
    return "hand-2";
  }
  if (slotId === "hand-2") {
    return "hand-1";
  }
  return null;
}
