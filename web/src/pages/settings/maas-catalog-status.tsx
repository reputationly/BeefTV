import { useMaasCatalogStore } from "@/stores/use-maas-catalog-store";

function shortVersion(version: string) {
    return version ? version.slice(0, 8) : "—";
}

function fetchedLabel(fetchedAt?: string) {
    if (!fetchedAt) return "";
    const date = new Date(fetchedAt);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

/** MaaS 渠道卡片上的能力清单状态：版本、来源（实时/缓存）、上次同步时间或失败原因。 */
export function MaasCatalogStatus() {
    const status = useMaasCatalogStore((state) => state.status);
    const version = useMaasCatalogStore((state) => state.version);
    const fetchedAt = useMaasCatalogStore((state) => state.fetchedAt);
    const source = useMaasCatalogStore((state) => state.source);
    const error = useMaasCatalogStore((state) => state.error);
    if (status === "idle") return null;
    if (status === "error") {
        return <span style={{ color: "var(--palette-status-error, #dc2626)" }}>能力清单刷新失败：{error || "未知原因"}（沿用上次目录）</span>;
    }
    const time = fetchedLabel(fetchedAt);
    return (
        <span>
            清单 {shortVersion(version)} · {source === "cache" ? "缓存" : "已刷新"}
            {time ? ` · ${time}` : ""}
        </span>
    );
}
