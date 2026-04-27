import { labels } from "@/config/labels";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type TranslationKey = keyof typeof labels;
export const t = (key: TranslationKey): string => labels[key];
