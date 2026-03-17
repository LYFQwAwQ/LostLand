import { Gem, Shield, ShieldCheck, Star, Zap } from "lucide-react";
import { EQUIPMENT_RANK_LABELS, getEquipmentQualityLabel } from "../../lib/equipmentSystem";
import { legendaryEquipmentIdByUid } from "../../data/legendaryEquipments";
import type { GeneratedEquipment } from "../../types/game";

const OUTER_RADIUS = 38;
const INNER_SLOT_RADIUS = 24;

const tipPoints = Array.from({ length: 5 }).map((_, index) => {
  const angle = ((-90 + index * 72) * Math.PI) / 180;
  return {
    x: 50 + Math.cos(angle) * OUTER_RADIUS,
    y: 50 + Math.sin(angle) * OUTER_RADIUS
  };
});

const innerPoints = Array.from({ length: 5 }).map((_, index) => {
  const angle = ((-54 + index * 72) * Math.PI) / 180;
  return {
    x: 50 + Math.cos(angle) * INNER_SLOT_RADIUS,
    y: 50 + Math.sin(angle) * INNER_SLOT_RADIUS
  };
});

const starPoints = Array.from({ length: 10 }).map((_, index) => {
  const angle = ((-90 + index * 36) * Math.PI) / 180;
  const radius = index % 2 === 0 ? OUTER_RADIUS : 15;
  return `${50 + Math.cos(angle) * radius},${50 + Math.sin(angle) * radius}`;
});

const runeSlots = ["rune-1", "rune-2", "rune-3", "rune-4", "rune-5"] as const;

const auxSlots = [
  { key: "head-1", label: "头盔", icon: <Shield size={14} /> },
  { key: "armor-1", label: "护甲", icon: <ShieldCheck size={14} /> },
  { key: "accessory-1", label: "饰品-1", icon: <Gem size={14} /> },
  { key: "accessory-2", label: "饰品-2", icon: <Gem size={14} /> },
  { key: "accessory-3", label: "饰品-3", icon: <Gem size={14} /> }
];

interface MageGearBoardProps {
  equippedBySlot: Record<string, GeneratedEquipment | undefined>;
  selectedSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
  onHoverSlot?: (slotId: string | null, x?: number, y?: number) => void;
}

function slotQualityText(item: GeneratedEquipment | undefined): string {
  if (!item) {
    return "未装备";
  }
  return `${getEquipmentQualityLabel(item.quality, Boolean(legendaryEquipmentIdByUid[item.uid]))} · ${EQUIPMENT_RANK_LABELS[item.rank]}`;
}

export function MageGearBoard({ equippedBySlot, selectedSlotId, onSelectSlot, onHoverSlot }: MageGearBoardProps) {
  return (
    <div className="gear-board mage-gear-board">
      <svg className="gear-pentagon" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="mage-ring-outer" cx="50" cy="50" r="44" />
        <circle className="mage-ring-inner" cx="50" cy="50" r="30" />
        <polygon className="mage-star-outline" points={starPoints.join(" ")} />
        {tipPoints.map((point, idx) => (
          <line key={idx} className="mage-star-link" x1="50" y1="50" x2={point.x} y2={point.y} />
        ))}
      </svg>

      {tipPoints.map((point, idx) => {
        const slotId = runeSlots[idx];
        const item = equippedBySlot[slotId];
        return (
          <button
            key={slotId}
            className={`gear-slot vertex-slot mage-tip-slot ${selectedSlotId === slotId ? "active-slot" : ""}`}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            type="button"
            aria-label={`符文槽 ${idx + 1}`}
            onClick={() => onSelectSlot(slotId)}
            onMouseEnter={(event) => onHoverSlot?.(slotId, event.clientX, event.clientY)}
            onMouseMove={(event) => onHoverSlot?.(slotId, event.clientX, event.clientY)}
            onMouseLeave={() => onHoverSlot?.(null)}
          >
            <Star size={16} />
            <span className="gear-slot-name" title={item?.templateName ?? `符文-${idx + 1}`}>
              {item?.templateName ?? `符文-${idx + 1}`}
            </span>
            <small className="gear-slot-meta">{slotQualityText(item)}</small>
          </button>
        );
      })}

      {auxSlots.map((slot, idx) => {
        const point = innerPoints[idx];
        const item = equippedBySlot[slot.key];
        return (
          <button
            key={slot.key}
            className={`gear-slot vertex-slot mage-aux-slot ${selectedSlotId === slot.key ? "active-slot" : ""}`}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            type="button"
            aria-label={slot.label}
            onClick={() => onSelectSlot(slot.key)}
            onMouseEnter={(event) => onHoverSlot?.(slot.key, event.clientX, event.clientY)}
            onMouseMove={(event) => onHoverSlot?.(slot.key, event.clientX, event.clientY)}
            onMouseLeave={() => onHoverSlot?.(null)}
          >
            {slot.icon}
            <span className="gear-slot-name" title={item?.templateName ?? slot.label}>
              {item?.templateName ?? slot.label}
            </span>
            <small className="gear-slot-meta">{slotQualityText(item)}</small>
          </button>
        );
      })}

      <button
        className={`gear-slot vertex-slot mage-core-slot ${selectedSlotId === "core-1" ? "active-slot" : ""}`}
        type="button"
        aria-label="施法核心"
        onClick={() => onSelectSlot("core-1")}
        onMouseEnter={(event) => onHoverSlot?.("core-1", event.clientX, event.clientY)}
        onMouseMove={(event) => onHoverSlot?.("core-1", event.clientX, event.clientY)}
        onMouseLeave={() => onHoverSlot?.(null)}
      >
        <Zap size={16} />
        <span className="gear-slot-name" title={equippedBySlot["core-1"]?.templateName ?? "施法核心"}>
          {equippedBySlot["core-1"]?.templateName ?? "施法核心"}
        </span>
        <small className="gear-slot-meta">{slotQualityText(equippedBySlot["core-1"])}</small>
      </button>
    </div>
  );
}
