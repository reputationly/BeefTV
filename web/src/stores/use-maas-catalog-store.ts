import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { MaasCatalogSnapshot } from "@/services/api/maas-catalog";

type MaasCatalogStatus = "idle" | "syncing" | "ready" | "error";

type MaasCatalogStore = {
    status: MaasCatalogStatus;
    /** 网关最近一次给出的目录版本。 */
    version: string;
    /** 已经写进渠道的目录版本；与 version 不同才需要重写渠道。 */
    appliedVersion: string;
    fetchedAt?: string;
    source?: "live" | "cache";
    error?: string;
    record: (snapshot: MaasCatalogSnapshot, applied: boolean) => void;
    fail: (error: string) => void;
    reset: () => void;
};

// 只存小体积元信息（版本/时间/状态），能力清单本身留在后端缓存文件里。
export const useMaasCatalogStore = create<MaasCatalogStore>()(
    persist(
        (set) => ({
            status: "idle",
            version: "",
            appliedVersion: "",
            record: (snapshot, applied) => set((state) => ({
                status: "ready",
                version: snapshot.version,
                appliedVersion: applied ? snapshot.version : state.appliedVersion,
                fetchedAt: undefined,
                source: snapshot.source,
                error: undefined,
            })),
            fail: (error) => set({ status: "error", error }),
            reset: () => set({ status: "idle", version: "", appliedVersion: "", fetchedAt: undefined, source: undefined, error: undefined }),
        }),
        { name: "infinite-canvas:maas_catalog_store" },
    ),
);
