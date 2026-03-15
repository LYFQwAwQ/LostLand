import { Gem, Shield, ShieldCheck, Sword } from "lucide-react";
import { EQUIPMENT_RANK_LABELS, getEquipmentQualityLabel } from "../../lib/equipmentSystem";
import { legendaryEquipmentIdByUid } from "../../data/legendaryEquipments";
import type { GeneratedEquipment } from "../../types/game";

const slots = [
  { key: "ranger-hand-1", label: "主手", className: "ranger-slot-main", icon: <Sword size={16} /> },
  { key: "ranger-hand-2", label: "副手", className: "ranger-slot-off", icon: <Sword size={16} /> },
  { key: "ranger-armor-1", label: "护甲", className: "ranger-slot-armor", icon: <ShieldCheck size={16} /> },
  { key: "ranger-shoes-1", label: "战靴", className: "ranger-slot-shoes", icon: <Shield size={16} /> },
  { key: "ranger-accessory-1", label: "饰品-1", className: "ranger-slot-acc-1", icon: <Gem size={16} /> },
  { key: "ranger-accessory-2", label: "饰品-2", className: "ranger-slot-acc-2", icon: <Gem size={16} /> },
  { key: "ranger-accessory-3", label: "饰品-3", className: "ranger-slot-acc-3", icon: <Gem size={16} /> },
  { key: "ranger-accessory-4", label: "饰品-4", className: "ranger-slot-acc-4", icon: <Gem size={16} /> }
];

interface RangerGearBoardProps {
  equippedBySlot: Record<string, GeneratedEquipment | undefined>;
  selectedSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
}

function slotQualityText(item: GeneratedEquipment | undefined): string {
  if (!item) {
    return "未装备";
  }
  return `${getEquipmentQualityLabel(item.quality, Boolean(legendaryEquipmentIdByUid[item.uid]))} · ${EQUIPMENT_RANK_LABELS[item.rank]}`;
}

export function RangerGearBoard({ equippedBySlot, selectedSlotId, onSelectSlot }: RangerGearBoardProps) {
  return (
    <div className="gear-board ranger-gear-board">
      <div className="ranger-track-lines" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      {slots.map((slot) => {
        const item = equippedBySlot[slot.key];
        return (
          <button
            key={slot.key}
            className={`gear-slot vertex-slot ranger-slot ${slot.className} ${selectedSlotId === slot.key ? "active-slot" : ""}`}
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
