import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "sora.theme";

function getInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const t = getInitial();
    setTheme(t);
    apply(t);
  }, []);

  const update = (t: Theme) => {
    setTheme(t);
    apply(t);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, t);
  };

  return {
    theme,
    setTheme: update,
    toggle: () => update(theme === "dark" ? "light" : "dark"),
  };
}
