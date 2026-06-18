import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight, ArrowLeftRight, ArrowUpRight, BadgeDollarSign, Banknote, BarChart3, BookOpen,
  BriefcaseBusiness, Bus, Car, Circle, Coffee, CreditCard, Gift, HandHeart, Handshake, Heart,
  HeartPulse, Home, Landmark, List, MoreHorizontal, PiggyBank, Repeat2, Settings, ShoppingBag,
  ShoppingBasket, Sparkles, Target, Utensils, WalletCards, WandSparkles, Users,
} from "lucide-react";

const map: Record<string, LucideIcon> = {
  home: Home, list: List, target: Target, chart: BarChart3, wallet: WalletCards, settings: Settings,
  circle: Circle, basket: ShoppingBasket, coffee: Coffee, car: Car, briefcase: BriefcaseBusiness,
  gift: Gift, sparkles: Sparkles, heart: Heart, health: HeartPulse, "hand-heart": HandHeart,
  book: BookOpen, bag: ShoppingBag, handshake: Handshake, family: Users, card: CreditCard,
  cash: Banknote, repeat: Repeat2, more: MoreHorizontal, transport: Bus, restaurant: Utensils,
  coins: BadgeDollarSign, "trend-up": ArrowUpRight, "trend-down": ArrowDownRight, arrows: ArrowLeftRight,
  assistant: WandSparkles, savings: PiggyBank, bank: Landmark,
};

export function CategoryGlyph({ name, size = 20 }: { name?: string; size?: number }) {
  const Icon = map[name || "circle"] || Circle;
  return <Icon size={size} strokeWidth={2} />;
}
