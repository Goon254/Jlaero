import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SystemUI from "expo-system-ui";
import { palettes, type Palette, type Scheme } from "./tokens";

export type ThemePreference = "system" | Scheme;

const STORAGE_KEY = "jlaero.theme";

type ThemeValue = {
  scheme: Scheme;
  colors: Palette;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  reduceMotion: boolean;
};

const ThemeContext = createContext<ThemeValue>({
  scheme: "dark",
  colors: palettes.dark,
  preference: "system",
  setPreference: () => {},
  reduceMotion: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === "light" || v === "dark" || v === "system") setPreferenceState(v);
    });
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const scheme: Scheme =
    preference === "system" ? (system === "light" ? "light" : "dark") : preference;
  const colors = palettes[scheme];

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  const value = useMemo(
    () => ({ scheme, colors, preference, setPreference, reduceMotion }),
    [scheme, colors, preference, setPreference, reduceMotion]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { fonts, space, radius, iconSize, touchTarget, statusTone, toneColors } from "./tokens";
export type { Palette, Scheme, Tone } from "./tokens";
