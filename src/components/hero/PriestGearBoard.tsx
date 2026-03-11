import { Gem, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { EQUIPMENT_QUALITY_LABELS, EQUIPMENT_RANK_LABELS } from "../../lib/equipmentSystem";
import type { GeneratedEquipment } from "../../types/game";

const priestSlots = [
  { key: "priest-hand-1", label: "手部", className: "priest-slot-hand", icon: <Wand2 size={16} /> },
  { key: "priest-armor-1", label: "护甲", className: "priest-slot-armor", icon: <ShieldCheck size={16} /> },
  { key: "priest-medium-1", label: "施法媒介-1", className: "priest-slot-medium-1", icon: <Sparkles size={16} /> },
  { key: "priest-medium-2", label: "施法媒介-2", className: "priest-slot-medium-2", icon: <Sparkles size={16} /> },
  { key: "priest-medium-3", label: "施法媒介-3", className: "priest-slot-medium-3", icon: <Sparkles size={16} /> },
  { key: "priest-core-1", label: "施法核心", className: "priest-slot-core", icon: <Sparkles size={16} /> },
  { key: "priest-accessory-1", label: "饰品-1", className: "priest-slot-acc-1", icon: <Gem size={16} /> },
  { key: "priest-accessory-2", label: "饰品-2", className: "priest-slot-acc-2", icon: <Gem size={16} /> }
];

interface PriestGearBoardProps {
  equippedBySlot: Record<string, GeneratedEquipment | undefined>;
  selectedSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
}

function slotQualityText(item: GeneratedEquipment | undefined): string {
  if (!item) {
    return "未装备";
  }
  return `${EQUIPMENT_QUALITY_LABELS[item.quality]} · ${EQUIPMENT_RANK_LABELS[item.rank]}`;
}

export function PriestGearBoard({ equippedBySlot, selectedSlotId, onSelectSlot }: PriestGearBoardProps) {
  return (
    <div className="gear-board priest-gear-board">
      <div className="priest-aura" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      {priestSlots.map((slot) => {
        const item = equippedBySlot[slot.key];
        return (
          <button
            key={slot.key}
            className={`gear-slot vertex-slot priest-slot ${slot.className} ${selectedSlotId === slot.key ? "active-slot" : ""}`}
            type="button"
            aria-label={slot.label}
            onClick={() => onSelectSlot(slot.key)}
          >
            {slot.icon}
            <span className="gear-slot-name" title={item?.templateName ?? slot.label}>
              {item?.templateName ?? slot.label}
            </span>
            <small className="gear-slot-meta">{slotQualityText(item)}</small>
          </button>
        );
      })}
    </div>
  );
}

