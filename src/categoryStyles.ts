import type { AppData } from "./types";
export const categoryIcons = [
  "circle",
  "hand-heart",
  "handshake",
  "more",
  "heart",
  "health",
  "sparkles",
  "coffee",
  "book",
  "gift",
  "basket",
  "briefcase",
  "car",
  "repeat",
  "coins",
  "trend-up",
  "plane",
  "train",
  "bike",
  "fuel",
  "phone",
  "smartphone",
  "laptop",
  "wifi",
  "receipt",
  "store",
  "pizza",
  "cake",
  "hotel",
  "camera",
  "music",
  "movie",
  "game",
  "gym",
  "trophy",
  "education",
  "clothes",
  "pet",
  "baby",
  "repair",
  "appliances",
  "utilities",
  "vacation",
  "nature",
  "family",
  "bag",
  "bank",
  "savings",
  "cash",
  "wallet",
  "restaurant",
  "transport",
  "home",
  "cat",
  "target",
  "chart",
  "card",
  "arrows",
];
export const categoryColors = [
  "#718096",
  "#A78BFA",
  "#F472B6",
  "#EF4444",
  "#F97316",
  "#FFB020",
  "#10B981",
  "#14B8A6",
  "#3B82F6",
  "#6366F1",
  "#06B6D4",
  "#84CC16",
  "#D946EF",
  "#E879F9",
  "#FB7185",
  "#FBBF24",
  "#2DD4BF",
  "#60A5FA",
  "#C084FC",
  "#A3E635",
  "#FCA5A5",
  "#FDBA74",
  "#67E8F9",
  "#818CF8",
  "#34D399",
  "#EAB308",
  "#EC4899",
  "#8B5CF6",
  "#0EA5E9",
  "#22C55E",
  "#D97706",
  "#F43F5E",
];
export function distinguishCategories(data: AppData): AppData {
  if (data.categoryStyleVersion === 1) return data;
  const colors = new Set<string>();
  const icons = new Set<string>();
  return {
    ...data,
    categoryStyleVersion: 1,
    categories: data.categories.map((c, i) => {
      let color = c.color;
      let icon = c.icon;
      if (!color || colors.has(color.toLowerCase()))
        color =
          categoryColors.find((x) => !colors.has(x.toLowerCase())) ||
          `hsl(${(i * 137.508) % 360} 68% 62%)`;
      if (!categoryIcons.includes(icon) || icons.has(icon))
        icon = categoryIcons.find((x) => !icons.has(x)) || "circle";
      colors.add(color.toLowerCase());
      icons.add(icon);
      return { ...c, color, icon };
    }),
  };
}
