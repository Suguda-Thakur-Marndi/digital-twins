"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "vitaltwin-theme";
const LEGACY_STORAGE_KEY = "twincare-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [mounted, setMounted] = useState<boolean>(false);

  // Initialize theme from storage or system on client mount
  useEffect(() => {
    try {
      const stored = (localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)) as Theme | null;
      if (stored && (stored === "light" || stored === "dark" || stored === "system")) {
        setThemeState(stored);
      } else {
        setThemeState("system");
      }
    } catch {
      setThemeState("system");
    }
    setMounted(true);
  }, []);

  // Update resolvedTheme and document classes whenever theme changes
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const computeResolved = (t: Theme): ResolvedTheme => {
      if (t === "dark") return "dark";
      if (t === "light") return "light";
      return mediaQuery.matches ? "dark" : "light";
    };

    const resolved = computeResolved(theme);
    setResolvedTheme(resolved);

    const root = document.documentElement;
    if (resolved === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }

    const handleSystemChange = () => {
      if (theme === "system") {
        const nextResolved = mediaQuery.matches ? "dark" : "light";
        setResolvedTheme(nextResolved);
        if (nextResolved === "dark") {
          root.classList.add("dark");
          root.style.colorScheme = "dark";
        } else {
          root.classList.remove("dark");
          root.style.colorScheme = "light";
        }
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
      localStorage.setItem(LEGACY_STORAGE_KEY, newTheme);
    } catch {
      // storage unavailable
    }
  };

  const toggleTheme = () => {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    // Graceful fallback during SSR or pre-mount
    return {
      theme: "light",
      resolvedTheme: "light",
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}

/**
 * Accessible Dark/Light Theme Switcher with smooth icon transitions
 */
export function ThemeToggle({
  className = "",
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isDark = isClient ? resolvedTheme === "dark" : false;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      aria-checked={isDark}
      role="switch"
      className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 border cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 ${
        isDark
          ? "bg-[rgba(15,29,48,0.7)] text-[#E7F0FC] border-[rgba(148,183,220,0.2)] hover:bg-[rgba(20,37,59,0.9)] hover:border-[rgba(148,183,220,0.4)] shadow-xs"
          : "bg-[rgba(255,255,255,0.75)] text-[#172033] border-[rgba(255,255,255,0.8)] hover:bg-[rgba(255,255,255,0.95)] hover:border-[rgba(37,99,235,0.3)] shadow-xs"
      } backdrop-blur-md ${className}`}
      title={`Current: ${isDark ? "Dark" : "Light"} theme. Click to switch.`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center overflow-hidden">
        <Sun
          className={`w-4 h-4 text-amber-500 transition-all duration-300 absolute ${
            isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`}
        />
        <Moon
          className={`w-4 h-4 text-cyan-300 transition-all duration-300 absolute ${
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
          }`}
        />
      </div>

      {showLabel && (
        <span className="text-[11px] font-medium tracking-wide">
          {isDark ? "Dark" : "Light"}
        </span>
      )}
    </button>
  );
}
