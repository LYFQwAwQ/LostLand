import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getMaterialDropCatalog } from "../data/battleDrops";
import { initialConsumableStacks } from "../data/consumables";
import { equipmentTemplates } from "../data/equipmentTemplates";
import { heroMemoryMap, initialOwnedHeroMemoryIds } from "../data/heroMemories";
import {
  legendaryEquipmentIdByUid,
  legendaryEquipmentItemById,
  legendaryEquipments,
  legendaryEquipmentSkillsById
} from "../data/legendaryEquipments";
import { heroes } from "../data/mockData";
import { getPairedPaladinHandSlot, isPaladinHandSlot } from "../lib/equipmentCatalog";
import { generateEquipmentBatch } from "../lib/equipmentSystem";
import type { BattleDropSummary } from "../types/battle";
import type {
  BulletinMissionReward,
  GeneratedEquipment,
  InventoryConsumableStack,
  InventoryMaterialStack,
  InventoryMemoryStack,
  InventoryResourceRarity,
  LegendaryEquipmentDefinition,
  LegendaryEquipmentSkillDefinition
} from "../types/game";

export interface EquippedOwner {
  heroId: string;
  slotId: string;
}

export interface EquipmentInventorySnapshot {
  seed: string;
  equippedByHero: Record<string, Record<string, string>>;
  equippedLegendaryByHero?: Record<string, string[]>;
  ownedLegendaryEquipmentIds?: string[];
  materialStock?: Record<string, number>;
  consumableStock?: Record<string, number>;
  memoryOwnedIds?: string[];
  equippedMemoryByHero?: Record<string, string>;
}

interface EquipmentInventoryContextValue {
  items: GeneratedEquipment[];
  itemMap: Map<string, GeneratedEquipment>;
  equippedByHero: Record<string, Record<string, string>>;
  legendaryEquipments: LegendaryEquipmentDefinition[];
  legendaryEquipmentSkillsById: Record<string, LegendaryEquipmentSkillDefinition>;
  ownedLegendaryEquipmentIds: string[];
  materialItems: InventoryMaterialStack[];
  consumableItems: InventoryConsumableStack[];
  memoryItems: InventoryMemoryStack[];
  equippedMemoryByHero: Record<string, string>;
  refreshItems: () => void;
  collectBattleDrops: (drops: BattleDropSummary | null | undefined) => void;
  grantMissionRewards: (reward: BulletinMissionReward | null | undefined) => void;
  consumeMaterials: (materials: Array<{ materialId: string; quantity: number }>) => boolean;
  equipItem: (
    heroId: string,
    slotId: string,
    itemUid: string,
    options?: { forceReplaceHand?: boolean }
  ) => boolean;
  unequipItem: (heroId: string, slotId: string) => void;
  setHeroMemory: (heroId: string, memoryId: string | null) => boolean;
  getHeroMemory: (heroId: string) => string | null;
  getMemoryOwner: (memoryId: string) => string | null;
  getLegendaryEquipmentOwner: (equipmentId: string) => string | null;
  getItemOwner: (itemUid: string) => EquippedOwner | null;
  getItemOwners: (itemUid: string) => EquippedOwner[];
  exportSnapshot: () => EquipmentInventorySnapshot;
  importSnapshot: (snapshot: EquipmentInventorySnapshot) => void;
}

const DEFAULT_SEED = "global-inventory-seed";
const MATERIAL_CATALOG = getMaterialDropCatalog();
const MATERIAL_CATALOG_MAP = new Map(MATERIAL_CATALOG.map((item) => [item.id, item]));
const HERO_CLASS_BY_ID = new Map(heroes.map((hero) => [hero.id, hero.heroClass]));
const LEGENDARY_EQUIPMENT_ID_SET = new Set(legendaryEquipments.map((item) => item.id));
const LEGENDARY_EQUIPMENT_LIMIT_PER_HERO = 2;
const RESOURCE_RARITY_ORDER: Record<InventoryResourceRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3
};

const EquipmentInventoryContext = createContext<EquipmentInventoryContextValue | null>(null);

function buildInventory(seed: string): GeneratedEquipment[] {
  return generateEquipmentBatch(equipmentTemplates, 64, {
    seed,
    level: 1,
    source: "global-inventory"
  });
}

function normalizeResourceStock(input: Record<string, number> | null | undefined): Record<string, number> {
  return Object.entries(input ?? {}).reduce<Record<string, number>>((acc, [id, quantity]) => {
    if (typeof quantity !== "number" || !Number.isFinite(quantity)) {
      return acc;
    }
    const safeQuantity = Math.max(0, Math.floor(quantity));
    if (safeQuantity <= 0) {
      return acc;
    }
    acc[id] = safeQuantity;
    return acc;
  }, {});
}

function buildDefaultConsumableStock(): Record<string, number> {
  return initialConsumableStacks.reduce<Record<string, number>>((acc, item) => {
    acc[item.id] = Math.max(0, Math.floor(item.quantity));
    return acc;
  }, {});
}

function buildDefaultOwnedMemoryIds(): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  initialOwnedHeroMemoryIds.forEach((memoryId) => {
    if (!heroMemoryMap.has(memoryId) || seen.has(memoryId)) {
      return;
    }
    seen.add(memoryId);
    result.push(memoryId);
  });
  return result;
}

function normalizeOwnedMemoryIds(memoryIds: string[] | null | undefined): string[] {
  if (!Array.isArray(memoryIds)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  memoryIds.forEach((memoryId) => {
    if (typeof memoryId !== "string" || memoryId.length <= 0) {
      return;
    }
    if (!heroMemoryMap.has(memoryId) || seen.has(memoryId)) {
      return;
    }
    seen.add(memoryId);
    result.push(memoryId);
  });
  return result;
}

function normalizeEquippedMemoryByHero(
  mapping: Record<string, string> | null | undefined,
  ownedMemoryIds: Set<string>
): Record<string, string> {
  const next: Record<string, string> = {};
  const used = new Set<string>();
  const source = mapping ?? {};
  const orderedHeroIds = [...heroes.map((hero) => hero.id), ...Object.keys(source).filter((heroId) => !HERO_CLASS_BY_ID.has(heroId))];

  orderedHeroIds.forEach((heroId) => {
    const heroClass = HERO_CLASS_BY_ID.get(heroId);
    if (!heroClass) {
      return;
    }
    const memoryId = source[heroId];
    if (typeof memoryId !== "string" || memoryId.length <= 0) {
      return;
    }
    const memory = heroMemoryMap.get(memoryId);
    if (!memory) {
      return;
    }
    if (memory.heroClass !== heroClass) {
      return;
    }
    if (!ownedMemoryIds.has(memoryId) || used.has(memoryId)) {
      return;
    }
    used.add(memoryId);
    next[heroId] = memoryId;
  });
  return next;
}

function normalizeOwnedLegendaryEquipmentIds(equipmentIds: string[] | null | undefined): string[] {
  if (!Array.isArray(equipmentIds)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  equipmentIds.forEach((equipmentId) => {
    if (typeof equipmentId !== "string" || equipmentId.length <= 0 || seen.has(equipmentId)) {
      return;
    }
    if (!LEGENDARY_EQUIPMENT_ID_SET.has(equipmentId)) {
      return;
    }
    seen.add(equipmentId);
    result.push(equipmentId);
  });
  return result;
}

function buildDefaultOwnedLegendaryEquipmentIds(): string[] {
  return legendaryEquipments.map((item) => item.id);
}

function areStringMapEqual(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => left[key] === right[key]);
}

export function EquipmentInventoryProvider({ children }: { children: ReactNode }) {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [equippedByHero, setEquippedByHero] = useState<Record<string, Record<string, string>>>({});
  const [ownedLegendaryEquipmentIds, setOwnedLegendaryEquipmentIds] = useState<string[]>(
    () => buildDefaultOwnedLegendaryEquipmentIds()
  );
  const [materialStock, setMaterialStock] = useState<Record<string, number>>({});
  const [consumableStock, setConsumableStock] = useState<Record<string, number>>(() => buildDefaultConsumableStock());
  const [ownedMemoryIds, setOwnedMemoryIds] = useState<string[]>(() => buildDefaultOwnedMemoryIds());
  const [equippedMemoryByHero, setEquippedMemoryByHero] = useState<Record<string, string>>({});

  const ownedMemoryIdSet = useMemo(() => new Set(ownedMemoryIds), [ownedMemoryIds]);
  const ownedLegendaryEquipmentIdSet = useMemo(
    () => new Set(ownedLegendaryEquipmentIds),
    [ownedLegendaryEquipmentIds]
  );
  const ownedLegendaryItems = useMemo(
    () =>
      ownedLegendaryEquipmentIds
        .map((equipmentId) => legendaryEquipmentItemById[equipmentId])
        .filter((item): item is GeneratedEquipment => Boolean(item)),
    [ownedLegendaryEquipmentIds]
  );
  const items = useMemo(() => [...buildInventory(seed), ...ownedLegendaryItems], [ownedLegendaryItems, seed]);
  const itemMap = useMemo(() => new Map(items.map((item) => [item.uid, item])), [items]);

  const ownerMap = useMemo(() => {
    const map = new Map<string, EquippedOwner[]>();
    Object.entries(equippedByHero).forEach(([heroId, slots]) => {
      Object.entries(slots).forEach(([slotId, uid]) => {
        if (itemMap.has(uid)) {
          const list = map.get(uid) ?? [];
          list.push({ heroId, slotId });
          map.set(uid, list);
        }
      });
    });
    return map;
  }, [equippedByHero, itemMap]);

  const memoryOwnerMap = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(equippedMemoryByHero).forEach(([heroId, memoryId]) => {
      if (typeof memoryId !== "string" || memoryId.length <= 0) {
        return;
      }
      map.set(memoryId, heroId);
    });
    return map;
  }, [equippedMemoryByHero]);


  const materialItems = useMemo(() => {
    const merged: InventoryMaterialStack[] = MATERIAL_CATALOG.map((item) => ({
      id: item.id,
      name: item.name,
      rarity: item.rarity,
      quantity: materialStock[item.id] ?? 0,
      sourceEnemyPrototypeIds: [...item.sourceEnemyPrototypeIds]
    }));

    Object.entries(materialStock).forEach(([materialId, quantity]) => {
      if (MATERIAL_CATALOG_MAP.has(materialId) || quantity <= 0) {
        return;
      }
      merged.push({
        id: materialId,
        name: materialId,
        rarity: "common",
        quantity,
        sourceEnemyPrototypeIds: ["unknown"]
      });
    });

    return merged.sort((left, right) => {
      if (right.quantity !== left.quantity) {
        return right.quantity - left.quantity;
      }
      if (RESOURCE_RARITY_ORDER[right.rarity] !== RESOURCE_RARITY_ORDER[left.rarity]) {
        return RESOURCE_RARITY_ORDER[right.rarity] - RESOURCE_RARITY_ORDER[left.rarity];
      }
      return left.name.localeCompare(right.name, "zh-CN");
    });
  }, [materialStock]);

  const consumableItems = useMemo(() => {
    return initialConsumableStacks
      .map((item) => ({
        ...item,
        quantity: consumableStock[item.id] ?? 0
      }))
      .sort((left, right) => {
        if (RESOURCE_RARITY_ORDER[right.rarity] !== RESOURCE_RARITY_ORDER[left.rarity]) {
          return RESOURCE_RARITY_ORDER[right.rarity] - RESOURCE_RARITY_ORDER[left.rarity];
        }
        return left.name.localeCompare(right.name, "zh-CN");
      });
  }, [consumableStock]);

  const memoryItems = useMemo(() => {
    const all = ownedMemoryIds
      .map((memoryId) => heroMemoryMap.get(memoryId))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map<InventoryMemoryStack>((item) => ({
        id: item.id,
        heroClass: item.heroClass,
        title: item.title,
        quote: item.quote,
        effect: item.effect
      }));
    return all.sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));
  }, [ownedMemoryIds]);

  useEffect(() => {
    const validUids = new Set(items.map((item) => item.uid));
    setEquippedByHero((prev) => {
      let changed = false;
      const next: Record<string, Record<string, string>> = {};

      Object.entries(prev).forEach(([heroId, slots]) => {
        const filtered = Object.fromEntries(Object.entries(slots).filter(([, uid]) => validUids.has(uid)));
        next[heroId] = filtered;
        if (Object.keys(filtered).length !== Object.keys(slots).length) {
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [items]);

  useEffect(() => {
    setEquippedMemoryByHero((prev) => {
      const normalized = normalizeEquippedMemoryByHero(prev, ownedMemoryIdSet);
      return areStringMapEqual(prev, normalized) ? prev : normalized;
    });
  }, [ownedMemoryIdSet]);


  const refreshItems = () => {
    setSeed(`${Date.now()}`);
  };

  const collectBattleDrops = (drops: BattleDropSummary | null | undefined) => {
    if (!drops || drops.entries.length <= 0) {
      return;
    }

    setMaterialStock((prev) => {
      let changed = false;
      const next = { ...prev };

      drops.entries.forEach((entry) => {
        if (entry.category !== "material" || !entry.material) {
          return;
        }
        const quantity = Math.max(0, Math.floor(entry.quantity));
        if (quantity <= 0) {
          return;
        }
        next[entry.material.id] = (next[entry.material.id] ?? 0) + quantity;
        changed = true;
      });

      return changed ? next : prev;
    });
  };

  const grantMissionRewards = (reward: BulletinMissionReward | null | undefined) => {
    if (!reward) {
      return;
    }

    if (reward.materials.length > 0) {
      setMaterialStock((prev) => {
        const next = { ...prev };
        let changed = false;
        reward.materials.forEach((item) => {
          const quantity = Math.max(0, Math.floor(item.quantity));
          if (quantity <= 0) {
            return;
          }
          next[item.materialId] = (next[item.materialId] ?? 0) + quantity;
          changed = true;
        });
        return changed ? next : prev;
      });
    }

    if (reward.consumables.length > 0) {
      setConsumableStock((prev) => {
        const next = { ...prev };
        let changed = false;
        reward.consumables.forEach((item) => {
          const quantity = Math.max(0, Math.floor(item.quantity));
          if (quantity <= 0) {
            return;
          }
          next[item.consumableId] = (next[item.consumableId] ?? 0) + quantity;
          changed = true;
        });
        return changed ? next : prev;
      });
    }
  };

  const consumeMaterials = (materials: Array<{ materialId: string; quantity: number }>): boolean => {
    if (!materials || materials.length <= 0) {
      return true;
    }

    const requirements = materials
      .map((item) => ({
        materialId: item.materialId,
        quantity: Math.max(0, Math.floor(item.quantity))
      }))
      .filter((item) => item.materialId.length > 0 && item.quantity > 0);

    if (requirements.length <= 0) {
      return true;
    }

    let consumed = false;
    setMaterialStock((prev) => {
      const hasEnough = requirements.every((item) => (prev[item.materialId] ?? 0) >= item.quantity);
      if (!hasEnough) {
        return prev;
      }

      const next = { ...prev };
      requirements.forEach((item) => {
        const remain = (next[item.materialId] ?? 0) - item.quantity;
        if (remain > 0) {
          next[item.materialId] = remain;
        } else {
          delete next[item.materialId];
        }
      });
      consumed = true;
      return next;
    });
    return consumed;
  };

  const equipItem = (
    heroId: string,
    slotId: string,
    itemUid: string,
    options: { forceReplaceHand?: boolean } = {}
  ): boolean => {
    const item = itemMap.get(itemUid);
    if (!item) {
      return false;
    }

    const owners = ownerMap.get(itemUid) ?? [];
    if (owners.some((owner) => owner.heroId !== heroId)) {
      return false;
    }

    const legendaryEquipmentId = legendaryEquipmentIdByUid[itemUid];
    if (legendaryEquipmentId && !ownedLegendaryEquipmentIdSet.has(legendaryEquipmentId)) {
      return false;
    }

    if (item.slot === "twoHand") {
      if (!isPaladinHandSlot(slotId)) {
        return false;
      }
      const pairedSlot = getPairedPaladinHandSlot(slotId);
      if (!pairedSlot) {
        return false;
      }
      const pairedUid = equippedByHero[heroId]?.[pairedSlot];
      if (pairedUid && pairedUid !== itemUid && !options.forceReplaceHand) {
        return false;
      }
    }

    setEquippedByHero((prev) => {
      const nextHeroSlots = { ...(prev[heroId] ?? {}) };
      const targetCurrentUid = nextHeroSlots[slotId];

      if (item.slot === "twoHand") {
        const pairedSlot = getPairedPaladinHandSlot(slotId);
        if (!pairedSlot) {
          return prev;
        }

        Object.entries(nextHeroSlots).forEach(([currentSlotId, uid]) => {
          if (uid === itemUid) {
            delete nextHeroSlots[currentSlotId];
          }
        });

        const pairedUid = nextHeroSlots[pairedSlot];
        if (pairedUid && pairedUid !== itemUid) {
          delete nextHeroSlots[pairedSlot];
        }

        if (targetCurrentUid) {
          const targetCurrentItem = itemMap.get(targetCurrentUid);
          if (targetCurrentItem?.slot === "twoHand") {
            const mirrorSlot = getPairedPaladinHandSlot(slotId);
            if (mirrorSlot) {
              delete nextHeroSlots[mirrorSlot];
            }
          }
        }

        nextHeroSlots[slotId] = itemUid;
        nextHeroSlots[pairedSlot] = itemUid;
      } else {
        Object.entries(nextHeroSlots).forEach(([currentSlotId, uid]) => {
          if (uid === itemUid && currentSlotId !== slotId) {
            delete nextHeroSlots[currentSlotId];
          }
        });

        if (targetCurrentUid) {
          const targetCurrentItem = itemMap.get(targetCurrentUid);
          if (targetCurrentItem?.slot === "twoHand" && isPaladinHandSlot(slotId)) {
            const mirrorSlot = getPairedPaladinHandSlot(slotId);
            if (mirrorSlot) {
              delete nextHeroSlots[mirrorSlot];
            }
          }
        }

        if (item.slot === "oneHand" && isPaladinHandSlot(slotId)) {
          const pairedSlot = getPairedPaladinHandSlot(slotId);
          if (pairedSlot) {
            const pairedUid = nextHeroSlots[pairedSlot];
            if (pairedUid) {
              const pairedItem = itemMap.get(pairedUid);
              if (pairedItem?.slot === "twoHand") {
                delete nextHeroSlots[pairedSlot];
                if (nextHeroSlots[slotId] === pairedUid) {
                  delete nextHeroSlots[slotId];
                }
              }
            }
          }
        }

        nextHeroSlots[slotId] = itemUid;
      }

      const legendaryUidCount = new Set(
        Object.values(nextHeroSlots).filter((uid) => Boolean(legendaryEquipmentIdByUid[uid]))
      ).size;
      if (legendaryUidCount > LEGENDARY_EQUIPMENT_LIMIT_PER_HERO) {
        return prev;
      }

      return {
        ...prev,
        [heroId]: nextHeroSlots
      };
    });
    return true;
  };

  const unequipItem = (heroId: string, slotId: string) => {
    setEquippedByHero((prev) => {
      const current = prev[heroId] ?? {};
      const currentUid = current[slotId];
      if (!currentUid) {
        return prev;
      }
      const nextSlots = { ...current };
      const currentItem = itemMap.get(currentUid);

      if (currentItem?.slot === "twoHand" && isPaladinHandSlot(slotId)) {
        const pairedSlot = getPairedPaladinHandSlot(slotId);
        if (pairedSlot && nextSlots[pairedSlot] === currentUid) {
          delete nextSlots[pairedSlot];
        }
      }

      delete nextSlots[slotId];
      return {
        ...prev,
        [heroId]: nextSlots
      };
    });
  };

  const setHeroMemory = (heroId: string, memoryId: string | null): boolean => {
    const heroClass = HERO_CLASS_BY_ID.get(heroId);
    if (!heroClass) {
      return false;
    }

    if (!memoryId) {
      setEquippedMemoryByHero((prev) => {
        if (!prev[heroId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[heroId];
        return next;
      });
      return true;
    }

    const memory = heroMemoryMap.get(memoryId);
    if (!memory) {
      return false;
    }
    if (memory.heroClass !== heroClass) {
      return false;
    }
    if (!ownedMemoryIdSet.has(memoryId)) {
      return false;
    }
    const owner = memoryOwnerMap.get(memoryId);
    if (owner && owner !== heroId) {
      return false;
    }

    setEquippedMemoryByHero((prev) => ({
      ...prev,
      [heroId]: memoryId
    }));
    return true;
  };

  const exportSnapshot = (): EquipmentInventorySnapshot => {
    const cloned = Object.entries(equippedByHero).reduce<Record<string, Record<string, string>>>((acc, [heroId, slots]) => {
      acc[heroId] = { ...slots };
      return acc;
    }, {});
    return {
      seed,
      equippedByHero: cloned,
      ownedLegendaryEquipmentIds: [...ownedLegendaryEquipmentIds],
      materialStock: { ...materialStock },
      consumableStock: { ...consumableStock },
      memoryOwnedIds: [...ownedMemoryIds],
      equippedMemoryByHero: { ...equippedMemoryByHero }
    };
  };

  const importSnapshot = (snapshot: EquipmentInventorySnapshot) => {
    setSeed(typeof snapshot.seed === "string" && snapshot.seed.length > 0 ? snapshot.seed : DEFAULT_SEED);
    const next = Object.entries(snapshot.equippedByHero ?? {}).reduce<Record<string, Record<string, string>>>((acc, [heroId, slots]) => {
      acc[heroId] = Object.entries(slots ?? {}).reduce<Record<string, string>>((slotAcc, [slotId, uid]) => {
        if (typeof uid === "string" && uid.length > 0) {
          slotAcc[slotId] = uid;
        }
        return slotAcc;
      }, {});
      return acc;
    }, {});
    setEquippedByHero(next);
    const fallbackLegendaryOwnedIds = buildDefaultOwnedLegendaryEquipmentIds();
    const importedLegendaryOwnedIds = snapshot.ownedLegendaryEquipmentIds
      ? normalizeOwnedLegendaryEquipmentIds(snapshot.ownedLegendaryEquipmentIds)
      : fallbackLegendaryOwnedIds;
    const normalizedLegendaryOwnedIds =
      importedLegendaryOwnedIds.length > 0 ? importedLegendaryOwnedIds : fallbackLegendaryOwnedIds;
    setOwnedLegendaryEquipmentIds(normalizedLegendaryOwnedIds);

    if (snapshot.materialStock) {
      setMaterialStock(normalizeResourceStock(snapshot.materialStock));
    }
    if (snapshot.consumableStock) {
      setConsumableStock({
        ...buildDefaultConsumableStock(),
        ...normalizeResourceStock(snapshot.consumableStock)
      });
    }

    const fallbackOwnedIds = buildDefaultOwnedMemoryIds();
    const importedOwned = snapshot.memoryOwnedIds ? normalizeOwnedMemoryIds(snapshot.memoryOwnedIds) : fallbackOwnedIds;
    const normalizedOwned = importedOwned.length > 0 ? importedOwned : fallbackOwnedIds;
    setOwnedMemoryIds(normalizedOwned);
    setEquippedMemoryByHero(normalizeEquippedMemoryByHero(snapshot.equippedMemoryByHero, new Set(normalizedOwned)));
  };

  const value = useMemo<EquipmentInventoryContextValue>(
    () => ({
      items,
      itemMap,
      equippedByHero,
      legendaryEquipments,
      legendaryEquipmentSkillsById,
      ownedLegendaryEquipmentIds,
      materialItems,
      consumableItems,
      memoryItems,
      equippedMemoryByHero,
      refreshItems,
      collectBattleDrops,
      grantMissionRewards,
      consumeMaterials,
      equipItem,
      unequipItem,
      setHeroMemory,
      getHeroMemory(heroId) {
        return equippedMemoryByHero[heroId] ?? null;
      },
      getMemoryOwner(memoryId) {
        return memoryOwnerMap.get(memoryId) ?? null;
      },
      getLegendaryEquipmentOwner(equipmentId) {
        const item = legendaryEquipmentItemById[equipmentId];
        if (!item) {
          return null;
        }
        const owners = ownerMap.get(item.uid) ?? [];
        return owners.length > 0 ? owners[0].heroId : null;
      },
      getItemOwner(itemUid) {
        const list = ownerMap.get(itemUid);
        return list && list.length > 0 ? list[0] : null;
      },
      getItemOwners(itemUid) {
        return ownerMap.get(itemUid) ?? [];
      },
      exportSnapshot,
      importSnapshot
    }),
    [
      consumableItems,
      equippedByHero,
      equippedMemoryByHero,
      itemMap,
      items,
      materialItems,
      memoryItems,
      memoryOwnerMap,
      ownerMap,
      ownedLegendaryEquipmentIds,
      ownedMemoryIdSet
    ]
  );

  return <EquipmentInventoryContext.Provider value={value}>{children}</EquipmentInventoryContext.Provider>;
}

export function useEquipmentInventory(): EquipmentInventoryContextValue {
  const context = useContext(EquipmentInventoryContext);
  if (!context) {
    throw new Error("useEquipmentInventory must be used within EquipmentInventoryProvider");
  }
  return context;
}
