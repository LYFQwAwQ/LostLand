import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { equipmentTemplates } from "../data/equipmentTemplates";
import { getPairedPaladinHandSlot, isPaladinHandSlot } from "../lib/equipmentCatalog";
import { generateEquipmentBatch } from "../lib/equipmentSystem";
import type { GeneratedEquipment } from "../types/game";

export interface EquippedOwner {
  heroId: string;
  slotId: string;
}

export interface EquipmentInventorySnapshot {
  seed: string;
  equippedByHero: Record<string, Record<string, string>>;
}

interface EquipmentInventoryContextValue {
  items: GeneratedEquipment[];
  itemMap: Map<string, GeneratedEquipment>;
  equippedByHero: Record<string, Record<string, string>>;
  refreshItems: () => void;
  equipItem: (
    heroId: string,
    slotId: string,
    itemUid: string,
    options?: { forceReplaceHand?: boolean }
  ) => boolean;
  unequipItem: (heroId: string, slotId: string) => void;
  getItemOwner: (itemUid: string) => EquippedOwner | null;
  getItemOwners: (itemUid: string) => EquippedOwner[];
  exportSnapshot: () => EquipmentInventorySnapshot;
  importSnapshot: (snapshot: EquipmentInventorySnapshot) => void;
}

const DEFAULT_SEED = "global-inventory-seed";

const EquipmentInventoryContext = createContext<EquipmentInventoryContextValue | null>(null);

function buildInventory(seed: string): GeneratedEquipment[] {
  return generateEquipmentBatch(equipmentTemplates, 64, {
    seed,
    level: 1,
    source: "global-inventory"
  });
}

export function EquipmentInventoryProvider({ children }: { children: ReactNode }) {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [equippedByHero, setEquippedByHero] = useState<Record<string, Record<string, string>>>({});

  const items = useMemo(() => buildInventory(seed), [seed]);
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

  const refreshItems = () => {
    setSeed(`${Date.now()}`);
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

  const exportSnapshot = (): EquipmentInventorySnapshot => {
    const cloned = Object.entries(equippedByHero).reduce<Record<string, Record<string, string>>>((acc, [heroId, slots]) => {
      acc[heroId] = { ...slots };
      return acc;
    }, {});
    return {
      seed,
      equippedByHero: cloned
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
  };

  const value = useMemo<EquipmentInventoryContextValue>(
    () => ({
      items,
      itemMap,
      equippedByHero,
      refreshItems,
      equipItem,
      unequipItem,
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
    [equippedByHero, itemMap, items, ownerMap, seed]
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
