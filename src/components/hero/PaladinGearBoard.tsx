import { Gem, Shield, ShieldCheck, Sword, Wand2 } from "lucide-react";
import { EQUIPMENT_QUALITY_LABELS, EQUIPMENT_RANK_LABELS } from "../../lib/equipmentSystem";
import type { GeneratedEquipment } from "../../types/game";

const slots = [
  { key: "head-1", label: "头盔", className: "slot-head", icon: <Shield size={18} /> },
  { key: "armor-1", label: "护甲", className: "slot-armor", icon: <ShieldCheck size={18} /> },
  { key: "legs-1", label: "护腿-左", className: "slot-leg-l", icon: <Shield size={18} /> },
  { key: "legs-2", label: "护腿-右", className: "slot-leg-r", icon: <Shield size={18} /> },
  { key: "hand-1", label: "手部-左", className: "slot-main", icon: <Sword size={18} /> },
  { key: "hand-2", label: "手部-右", className: "slot-off", icon: <Shield size={18} /> },
  { key: "bracer-1", label: "护手-左", className: "slot-glove-l", icon: <Wand2 size={18} /> },
  { key: "bracer-2", label: "护手-右", className: "slot-glove-r", icon: <Wand2 size={18} /> },
  { key: "accessory-1", label: "饰品-1", className: "slot-acc-1", icon: <Gem size={18} /> },
  { key: "accessory-2", label: "饰品-2", className: "slot-acc-2", icon: <Gem size={18} /> },
  { key: "accessory-3", label: "饰品-3", className: "slot-acc-3", icon: <Gem size={18} /> }
];

interface PaladinGearBoardProps {
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

export function PaladinGearBoard({ equippedBySlot, selectedSlotId, onSelectSlot }: PaladinGearBoardProps) {
  return (
    <div className="paladin-gear-board">
      <div className="paladin-silhouette" aria-hidden="true">
        <div className="sil-head" />
        <div className="sil-torso" />
        <div className="sil-arm-l" />
        <div className="sil-arm-r" />
        <div className="sil-leg-l" />
        <div className="sil-leg-r" />
      </div>

      {slots.map((slot) => {
        const item = equippedBySlot[slot.key];
        return (
          <button
            key={slot.key}
            className={`gear-slot paladin-slot ${slot.className} ${selectedSlotId === slot.key ? "active-slot" : ""}`}
            type="button"
            onClick={() => onSelectSlot(slot.key)}
            aria-label={slot.label}
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
