import { describe, expect, test } from "bun:test";
import { DEFAULT_THEME_PREFERENCE, normalizeTheme, resolveThemeSelection } from "../src/stores/use-theme-store";

describe("workspace theme default", () => {
    test("first launch without a saved preference starts light", () => {
        expect(DEFAULT_THEME_PREFERENCE).toBe("light");
        expect(resolveThemeSelection(undefined)).toEqual({ preference: "light", theme: "light" });
        expect(resolveThemeSelection(null)).toEqual({ preference: "light", theme: "light" });
        expect(resolveThemeSelection("bogus")).toEqual({ preference: "light", theme: "light" });
    });

    test("a saved preference still wins over the default", () => {
        expect(resolveThemeSelection("dark")).toEqual({ preference: "dark", theme: "dark" });
        expect(resolveThemeSelection("light")).toEqual({ preference: "light", theme: "light" });
        expect(resolveThemeSelection("system").preference).toBe("system");
    });

    test("canvas skin normalization keeps rejecting invalid values as dark", () => {
        expect(normalizeTheme("light")).toBe("light");
        expect(normalizeTheme("bogus")).toBe("dark");
    });
});
