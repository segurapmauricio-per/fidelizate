import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRut(rut: string): string {
  const clean = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 2) return rut;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const reversed = body.split("").reverse();
  const parts: string[] = [];
  for (let i = 0; i < reversed.length; i += 3) {
    parts.push(reversed.slice(i, i + 3).reverse().join(""));
  }
  return `${parts.reverse().join(".")}-${dv}`;
}

export function normalizeRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, "").toUpperCase();
}
