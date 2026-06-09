import {
  Coffee,
  Utensils,
  Soup,
  Cookie,
  GlassWater,
  Apple,
  Activity,
  Brain,
  Flame,
  BatteryLow,
  Frown,
  Wind,
  Droplets,
  CupSoda,
  Wine,
  Milk,
  type LucideIcon,
} from "lucide-react";

export function mealIcon(mealType: string): LucideIcon {
  switch (mealType?.toLowerCase()) {
    case "breakfast":
      return Coffee;
    case "lunch":
      return Utensils;
    case "dinner":
      return Soup;
    case "snack":
      return Cookie;
    case "drink":
      return GlassWater;
    default:
      return Apple;
  }
}

export function symptomIcon(symptomType: string): LucideIcon {
  switch (symptomType?.toLowerCase()) {
    case "headache":
      return Brain;
    case "heartburn":
      return Flame;
    case "fatigue":
      return BatteryLow;
    case "nausea":
      return Frown;
    case "bloating":
      return Wind;
    default:
      return Activity;
  }
}

export function beverageIcon(beverageType: string): LucideIcon {
  switch (beverageType?.toLowerCase()) {
    case "coffee":
      return Coffee;
    case "tea":
      return CupSoda;
    case "juice":
      return CupSoda;
    case "soda":
      return CupSoda;
    case "alcohol":
      return Wine;
    case "milk":
      return Milk;
    default:
      return Droplets;
  }
}
