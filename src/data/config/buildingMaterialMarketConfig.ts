import defaultMarketConfigJson from "./buildingMaterialMarkets/default.json";
import rcLumenCityConfigJson from "./buildingMaterialMarkets/rc-lumen-city.json";
import rcDawnlightPortConfigJson from "./buildingMaterialMarkets/rc-dawnlight-port.json";
import ihFrostholdCitadelConfigJson from "./buildingMaterialMarkets/ih-frosthold-citadel.json";
import ihHammerfellConfigJson from "./buildingMaterialMarkets/ih-hammerfell.json";
import aeAmberTownConfigJson from "./buildingMaterialMarkets/ae-amber-town.json";
import aeGoldwheatCityConfigJson from "./buildingMaterialMarkets/ae-goldwheat-city.json";
import mwEmeraldHeartConfigJson from "./buildingMaterialMarkets/mw-emerald-heart.json";
import mwPearlHavenConfigJson from "./buildingMaterialMarkets/mw-pearl-haven.json";
import sgSunwardKeepConfigJson from "./buildingMaterialMarkets/sg-sunward-keep.json";
import sgSilvergrainTownConfigJson from "./buildingMaterialMarkets/sg-silvergrain-town.json";
import boLastlightBastionConfigJson from "./buildingMaterialMarkets/bo-lastlight-bastion.json";

interface BuildingMaterialMarketConfigRaw {
  priceFloatPctRange?: number[];
}

export interface BuildingMaterialMarketConfig {
  priceFloatPctRange: [number, number];
}

export interface BuildingMaterialPriceQuote {
  unitPrice: number;
  floatPct: number;
}

const FALLBACK_PRICE_FLOAT_RANGE: [number, number] = [-0.1, 0.12];
const PRICE_ROUND_STEP = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sanitizeFloatRange(raw: number[] | undefined, fallback: [number, number]): [number, number] {
  const first = Number.isFinite(raw?.[0]) ? (raw?.[0] as number) : fallback[0];
  const second = Number.isFinite(raw?.[1]) ? (raw?.[1] as number) : fallback[1];
  const safeFirst = clamp(first, -0.6, 1);
  const safeSecond = clamp(second, -0.6, 1);
  if (safeFirst <= safeSecond) {
    return [safeFirst, safeSecond];
  }
  return [safeSecond, safeFirst];
}

function sanitizeConfig(raw: BuildingMaterialMarketConfigRaw | undefined): BuildingMaterialMarketConfig {
  return {
    priceFloatPctRange: sanitizeFloatRange(raw?.priceFloatPctRange, FALLBACK_PRICE_FLOAT_RANGE)
  };
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return ((value >>> 0) & 0xffffffff) / 0x100000000;
  };
}

function roundToStep(value: number, step: number): number {
  const safeStep = Math.max(1, Math.floor(step));
  return Math.max(1, Math.round(value / safeStep) * safeStep);
}

const DEFAULT_BUILDING_MATERIAL_MARKET_CONFIG = sanitizeConfig(defaultMarketConfigJson as BuildingMaterialMarketConfigRaw);

const BUILDING_MATERIAL_MARKET_CONFIG_BY_CITY_NODE_ID: Record<string, BuildingMaterialMarketConfig> = {
  "rc-lumen-city": sanitizeConfig(rcLumenCityConfigJson as BuildingMaterialMarketConfigRaw),
  "rc-dawnlight-port": sanitizeConfig(rcDawnlightPortConfigJson as BuildingMaterialMarketConfigRaw),
  "ih-frosthold-citadel": sanitizeConfig(ihFrostholdCitadelConfigJson as BuildingMaterialMarketConfigRaw),
  "ih-hammerfell": sanitizeConfig(ihHammerfellConfigJson as BuildingMaterialMarketConfigRaw),
  "ae-amber-town": sanitizeConfig(aeAmberTownConfigJson as BuildingMaterialMarketConfigRaw),
  "ae-goldwheat-city": sanitizeConfig(aeGoldwheatCityConfigJson as BuildingMaterialMarketConfigRaw),
  "mw-emerald-heart": sanitizeConfig(mwEmeraldHeartConfigJson as BuildingMaterialMarketConfigRaw),
  "mw-pearl-haven": sanitizeConfig(mwPearlHavenConfigJson as BuildingMaterialMarketConfigRaw),
  "sg-sunward-keep": sanitizeConfig(sgSunwardKeepConfigJson as BuildingMaterialMarketConfigRaw),
  "sg-silvergrain-town": sanitizeConfig(sgSilvergrainTownConfigJson as BuildingMaterialMarketConfigRaw),
  "bo-lastlight-bastion": sanitizeConfig(boLastlightBastionConfigJson as BuildingMaterialMarketConfigRaw)
};

export function getBuildingMaterialMarketConfig(nodeId: string): BuildingMaterialMarketConfig {
  return BUILDING_MATERIAL_MARKET_CONFIG_BY_CITY_NODE_ID[nodeId] ?? DEFAULT_BUILDING_MATERIAL_MARKET_CONFIG;
}

export function resolveBuildingMaterialPriceQuote(basePrice: number, nodeId: string, seedKey: string): BuildingMaterialPriceQuote {
  const safeBasePrice = Math.max(1, Math.floor(basePrice));
  const config = getBuildingMaterialMarketConfig(nodeId);
  const random = createRandom(hashSeed(`${nodeId}:${seedKey}`));
  const [minPct, maxPct] = config.priceFloatPctRange;
  const floatPct = minPct + (maxPct - minPct) * random();
  const unitPrice = roundToStep(safeBasePrice * (1 + floatPct), PRICE_ROUND_STEP);
  return {
    unitPrice,
    floatPct
  };
}
