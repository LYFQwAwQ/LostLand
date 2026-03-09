import type { Hero } from "../types/game";

export const initialLogs: string[] = [
  "侦察队已完成北侧荒野测绘，新增 3 条可达路线。",
  "边境岗哨补给完成，地图压制效率提升。",
  "冒险家协会发布委派：清理荆棘丛林外围。",
  "迷雾区节点出现开发迹象，建议持续投入秩序场。"
];

export const heroes: Hero[] = [
  {
    id: "arthur",
    name: "阿瑟·列维坦",
    title: "圣壁守望者",
    heroClass: "paladin",
    image:
      "https://images.unsplash.com/photo-1614726310457-53ba02aa64c5?auto=format&fit=crop&q=80&w=900",
    stats: { hp: "12,500", mp: "800", str: "245", int: "85", agi: "112", def: "450" }
  },
  {
    id: "selene",
    name: "塞琳娜·逐星",
    title: "星环织法者",
    heroClass: "mage",
    image:
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=900",
    stats: { hp: "4,200", mp: "4,500", str: "42", int: "380", agi: "156", def: "120" }
  }
];
