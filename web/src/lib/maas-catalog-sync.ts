import { MAAS_BASE_URL, findMaasChannel, maasProfilesFromCatalog } from "@/lib/maas-catalog";
import { fetchMaasCatalog, readCachedMaasCatalog, type MaasCatalogSnapshot } from "@/services/api/maas-catalog";
import { saveMaasChannel } from "@/services/maas-channel";
import { useConfigStore } from "@/stores/use-config-store";
import { useMaasCatalogStore } from "@/stores/use-maas-catalog-store";

/** 版本变了、或还没写过渠道时才需要重写；同一版本重复启动不碰配置。 */
export function shouldApplyMaasCatalog(snapshot: MaasCatalogSnapshot | null, appliedVersion: string): boolean {
    if (!snapshot?.payload) return false;
    const hasModels = (snapshot.payload.text?.length ?? 0) + (snapshot.payload.image?.length ?? 0) + (snapshot.payload.video?.length ?? 0) > 0;
    if (!hasModels) return false;
    // 网关没给版本时不据此跳过，按内容重写一次，保证首次迁移能落地。
    if (!snapshot.version) return true;
    return snapshot.version !== appliedVersion;
}

/**
 * 启动时的目录同步：缓存优先 → 再真实刷新 → 只有版本变化才重写渠道。
 * 目录匿名可取，密钥只用于生成与首次校验。
 */
export async function runMaasCatalogSync(): Promise<void> {
    const channel = findMaasChannel(useConfigStore.getState().config.channels);
    const apiKey = channel?.apiKey || "";
    if (!channel || !apiKey) return;

    const store = useMaasCatalogStore.getState();
    const apply = async (snapshot: MaasCatalogSnapshot | null) => {
        if (!snapshot) return;
        if (!shouldApplyMaasCatalog(snapshot, useMaasCatalogStore.getState().appliedVersion)) {
            store.record(snapshot, false);
            return;
        }
        const mapping = maasProfilesFromCatalog(snapshot.payload);
        if (!mapping.profiles.length) {
            store.fail("网关目录里没有 BeefTV 可用的模型");
            return;
        }
        await saveMaasChannel(apiKey, mapping.profiles, mapping.defaults);
        store.record(snapshot, true);
    };

    const cached = await readCachedMaasCatalog();
    try {
        await apply(cached);
    } catch (error) {
        store.fail(error instanceof Error ? error.message : "读取模型目录缓存失败");
    }

    try {
        await apply(await fetchMaasCatalog(MAAS_BASE_URL));
    } catch (error) {
        store.fail(error instanceof Error ? error.message : "刷新网关模型目录失败");
    }
}
