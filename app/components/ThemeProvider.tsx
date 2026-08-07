"use client";

import { createContext, useContext } from "react";
import { LIGHT, type ThemePalette } from "@/app/lib/constants";

interface ThemeContextValue {
  t: ThemePalette;
  dark: boolean;
  toggle: () => void;
}

export const ThemeCtx = createContext<ThemeContextValue>({
  t: LIGHT,
  dark: false,
  toggle: () => {},
});

export const useTheme = () => useContext(ThemeCtx);
