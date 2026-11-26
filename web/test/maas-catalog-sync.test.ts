import { beforeEach, describe, expect, test } from "bun:test";

import { shouldApplyMaasCatalog } from "../src/lib/maas-catalog-sync";
import type { MaasCatalogSnapshot } from "../src/services/api/maas-catalog";
import { useMaasCatalogStore } from "../src/stores/use-maas-catalog-store";

const snapshot = (version: string, text: Array<Record<string, unknown>> = [{ platform_model: "GLM-5" }]): MaasCatalogSnapshot => ({
    version,
    source: "live",
    payload: { version, text },
});

describe("目录版本判定", () => {
    beforeEach(() => useMaasCatalogStore.getState().reset());

    test("版本相同不重写渠道", () => {
        expect(shouldApplyMaasCatalog(snapshot("v2"), "v2")).toBe(false);
    });

    test("版本变化需要重写渠道", () => {
        expect(shouldApplyMaasCatalog(snapshot("v2"), "v1")).toBe(true);
    });

    test("没有版本号时按内容重写一次", () => {
        expect(shouldApplyMaasCatalog(snapshot(""), "")).toBe(true);
    });

    test("空目录或缺失快照不触发重写", () => {
        expect(shouldApplyMaasCatalog(null, "v1")).toBe(false);
        expect(shouldApplyMaasCatalog({ version: "v1", source: "cache", payload: { text: [], image: [], video: [] } }, "v0")).toBe(false);
    });
});

describe("目录状态", () => {
    beforeEach(() => useMaasCatalogStore.getState().reset());

    test("应用成功记录版本与来源", () => {
        useMaasCatalogStore.getState().record(snapshot("v3"), true);
        const state = useMaasCatalogStore.getState();
        expect(state.status).toBe("ready");
        expect(state.appliedVersion).toBe("v3");
        expect(state.source).toBe("live");
    });

    test("只读缓存不推进已应用版本", () => {
        useMaasCatalogStore.getState().record(snapshot("v1"), true);
        useMaasCatalogStore.getState().record({ ...snapshot("v2"), source: "cache" }, false);
        const state = useMaasCatalogStore.getState();
        expect(state.version).toBe("v2");
        expect(state.appliedVersion).toBe("v1");
    });

    test("失败保留上次版本并记录原因", () => {
        useMaasCatalogStore.getState().record(snapshot("v1"), true);
        useMaasCatalogStore.getState().fail("读取网关模型目录失败（HTTP 502）");
        const state = useMaasCatalogStore.getState();
        expect(state.status).toBe("error");
        expect(state.error).toContain("502");
        expect(state.appliedVersion).toBe("v1");
    });
});
