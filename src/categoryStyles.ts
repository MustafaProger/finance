import type { AppData } from "./types";

export const categoryIconLabels: Record<string, string> = {
  circle: "Без значка",
  "hand-heart": "Благотворительность",
  handshake: "Долги",
  more: "Другое",
  heart: "Забота о себе",
  health: "Здоровье",
  sparkles: "Импульсивные покупки",
  coffee: "Кафе",
  book: "Книги",
  gift: "Подарки",
  basket: "Продукты",
  briefcase: "Работа",
  car: "Автомобиль",
  repeat: "Подписки",
  coins: "Кэшбэк",
  "trend-up": "Зарплата",
  plane: "Путешествия",
  train: "Поезд",
  bike: "Велосипед",
  fuel: "Бензин и топливо",
  phone: "Телефон",
  smartphone: "Смартфон",
  laptop: "Ноутбук",
  wifi: "Интернет",
  receipt: "Платежи и комиссии",
  store: "Магазин",
  pizza: "Пицца",
  cake: "Десерт",
  hotel: "Отель",
  camera: "Фото",
  music: "Музыка",
  movie: "Кино",
  game: "Игры",
  gym: "Спорт",
  trophy: "Достижения",
  education: "Образование",
  clothes: "Одежда",
  pet: "Питомцы",
  baby: "Дети",
  repair: "Ремонт",
  appliances: "Техника",
  utilities: "Коммунальные услуги",
  vacation: "Отпуск",
  nature: "Прогулки",
  family: "Семья",
  bag: "Покупки",
  bank: "Банк",
  savings: "Накопления",
  cash: "Наличные",
  wallet: "Кошелёк",
  restaurant: "Еда вне дома",
  transport: "Транспорт",
  home: "Дом",
  cat: "Кошка",
  target: "Цель",
  chart: "Статистика",
  card: "Карта",
  arrows: "Корректировка и переводы",
};
export const categoryIcons = Object.keys(categoryIconLabels);

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

// Only the mismatches created by the old unique-icon assignment are repaired.
// Categories can intentionally share an icon.
const legacyIcons: Record<string, [oldIcon: string, newIcon: string]> = {
  семья: ["fuel", "family"],
  продукты: ["car", "basket"],
  работа: ["train", "briefcase"],
  подарки: ["briefcase", "gift"],
  образование: ["gift", "education"],
  корректировка: ["book", "arrows"],
  "платежи, комиссии": ["basket", "receipt"],
  "еда вне дома": ["store", "restaurant"],
  транспорт: ["bike", "transport"],
  гуляю: ["game", "nature"],
};

export function suggestedCategoryIcon(name: string) {
  const normalized = name.trim().toLowerCase().replace(/ё/g, "е");
  const match =
    legacyIcons[normalized]?.[1] ??
    (
      {
        "деньги от родителей": "family",
        "кафе и рестораны": "coffee",
        азс: "fuel",
        топливо: "fuel",
        бензин: "fuel",
      } as Record<string, string>
    )[normalized];
  return (
    match ??
    categoryIcons.find(
      (id) => categoryIconLabels[id].toLowerCase() === normalized,
    ) ??
    "circle"
  );
}

export function distinguishCategories(data: AppData): AppData {
  if (data.categoryIconRevision === 1) return data;
  return {
    ...data,
    // Keep the legacy marker so older clients do not reassign duplicate icons.
    categoryStyleVersion: 1,
    categoryIconRevision: 1,
    categories: data.categories.map((category) => {
      const legacy = legacyIcons[category.name.trim().toLowerCase()];
      const icon =
        legacy && category.icon === legacy[0]
          ? legacy[1]
          : categoryIcons.includes(category.icon)
            ? category.icon
            : suggestedCategoryIcon(category.name);
      return icon === category.icon ? category : { ...category, icon };
    }),
  };
}
