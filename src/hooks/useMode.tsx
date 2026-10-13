import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Mode = "student" | "teacher";
const KEY = "bilim.mode";
const Ctx = createContext<{ mode: Mode; setMode: (m: Mode) => void }>({
  mode: "student",
  setMode: () => {},
});

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("student");
  useEffect(() => {
    const v = window.localStorage.getItem(KEY);
    if (v === "teacher" || v === "student") setModeState(v);
  }, []);
  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    window.localStorage.setItem(KEY, m);
  }, []);
  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>;
}

export function useMode() {
  return useContext(Ctx);
}
