import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "light" | "dark";
export type ThemePreference = ThemeName | "system";

// 工作区首次启动（没有保存过偏好）用亮色；normalizeTheme 仍把非法值归为深色，
// 那条规则服务画布皮肤，与工作区默认值分开。
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "light";

export function normalizeTheme(value: unknown): ThemeName {
    return value === "light" ? "light" : "dark";
}

type ThemeStore = {
    theme: ThemeName;
    preference: ThemePreference;
    setTheme: (theme?: string) => void;
};

function systemTheme(): ThemeName {
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveThemeSelection(value: unknown): { preference: ThemePreference; theme: ThemeName } {
    const preference: ThemePreference =
        value === "system" ? "system" : value === "light" ? "light" : value === "dark" ? "dark" : DEFAULT_THEME_PREFERENCE;
    return { preference, theme: preference === "system" ? systemTheme() : preference };
}

export function watchSystemTheme(media: Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener"> = window.matchMedia("(prefers-color-scheme: dark)")) {
    const sync = () => {
        const theme = media.matches ? "dark" : "light";
        if (useThemeStore.getState().preference === "system" && useThemeStore.getState().theme !== theme) useThemeStore.setState({ theme });
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
}

export const useThemeStore = create<ThemeStore>()(
    persist(
        (set) => ({
            theme: "light",
            preference: DEFAULT_THEME_PREFERENCE,
            setTheme: (theme) => set(resolveThemeSelection(theme)),
        }),
        {
            name: "infinite-canvas:theme_store",
            // 偏好与解析后的主题分开；画布与皮肤只接收 light / dark。
            merge: (persisted, current) => {
                const saved = persisted as Partial<ThemeStore> | null;
                return { ...current, ...resolveThemeSelection(saved?.preference ?? saved?.theme) };
            },
        },
    ),
);
