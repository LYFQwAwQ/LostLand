import type { RegionEdge, RegionNode } from "../types/game";

export interface NodeFieldVisual {
  orderOpacity: number;
  expansionOpacity: number;
  ringScale: number;
}

export interface EdgeFieldVisual {
  color: string;
  width: number;
  dash: string;
}

export interface FieldVisualizationHooks {
  resolveNodeVisual?: (node: RegionNode) => NodeFieldVisual;
  resolveEdgeVisual?: (edge: RegionEdge) => EdgeFieldVisual;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mixColor(from: [number, number, number], to: [number, number, number], t: number): string {
  const p = clamp(t, 0, 1);
  const r = Math.round(from[0] + (to[0] - from[0]) * p);
  const g = Math.round(from[1] + (to[1] - from[1]) * p);
  const b = Math.round(from[2] + (to[2] - from[2]) * p);
  return `rgb(${r}, ${g}, ${b})`;
}

export const defaultFieldHooks: Required<FieldVisualizationHooks> = {
  resolveNodeVisual(node) {
    return {
      orderOpacity: clamp(0.15 + node.field.orderAura * 0.5, 0.1, 0.75),
      expansionOpacity: clamp(0.15 + node.field.expansionAura * 0.5, 0.1, 0.75),
      ringScale: clamp(0.85 + node.field.pulse * 0.45, 0.85, 1.45)
    };
  },
  resolveEdgeVisual(edge) {
    const order = edge.fieldFlux.order;
    const expansion = edge.fieldFlux.expansion;
    const mix = expansion / Math.max(order + expansion, 0.0001);

    return {
      color: mixColor([85, 140, 220], [200, 110, 90], mix),
      width: clamp(0.8 + (order + expansion) * 0.8, 0.9, 2.1),
      dash: expansion > order ? "4 3" : ""
    };
  }
};
