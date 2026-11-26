import { http } from "@/services/api/request";

/** 目录参数项：与 Hilo 的 `params` 同构。 */
export type ModelCatalogParam = {
    type?: string;
    label?: string;
    default?: string;
    options?: string[];
};

/** 目录里的一条（媒体与对话共用；对话没有 params / max_refs）。 */
export type ModelCatalogItem = {
    id?: string;
    /** 提交给网关时用的平台模型名。 */
    platformModel?: string;
    displayName?: string;
    description?: string;
    maxRefs?: number;
    /** 参数表：宽高比 / 分辨率 / 时长 / 生成方式等，供节点渲染默认值与选项。 */
    params?: Record<string, ModelCatalogParam>;
    /** 云端指定的接口类型；缺失或未知时由客户端回退本地映射。 */
    interfaceType?: string;
    supportsImage?: boolean;
    supportsVideo?: boolean;
    supportsAudio?: boolean;
};

/** new-api `GET /api/v1/models/catalog` 的载荷：Hilo 目录 + 平台模型名 + 角色默认值。 */
export type ModelCatalogPayload = {
    version?: string;
    image?: ModelCatalogItem[];
    video?: ModelCatalogItem[];
    audio?: ModelCatalogItem[];
    text?: ModelCatalogItem[];
    defaults?: { chat?: string; multimodal?: string };
};

export type MaasCatalogSnapshot = {
    version: string;
    payload: ModelCatalogPayload;
    /** live = 这次真的请求到了网关；cache = 网关不可达时用上一次的。 */
    source: "live" | "cache";
};

type CatalogResponse = { version?: string; catalog?: ModelCatalogPayload; source?: "live" | "cache" };

function toSnapshot(payload: CatalogResponse | undefined): MaasCatalogSnapshot | null {
    const catalog = payload?.catalog;
    if (!catalog || !Array.isArray(catalog.text)) return null;
    return {
        version: typeof payload?.version === "string" ? payload.version : typeof catalog.version === "string" ? catalog.version : "",
        payload: catalog,
        source: payload?.source === "cache" ? "cache" : "live",
    };
}

/** 真实拉取模型目录（后端会把结果落盘缓存）；目录匿名可取，不需要密钥。 */
export async function fetchMaasCatalog(baseURL: string): Promise<MaasCatalogSnapshot> {
    const snapshot = toSnapshot(await http.post<CatalogResponse>("/ai/catalog", { baseUrl: baseURL }));
    if (!snapshot) throw new Error("网关未返回可用的模型目录");
    return snapshot;
}

/** 读上一次成功落盘的目录；没有缓存时返回 null（不抛错）。 */
export async function readCachedMaasCatalog(): Promise<MaasCatalogSnapshot | null> {
    try {
        return toSnapshot(await http.get<CatalogResponse>("/ai/catalog"));
    } catch {
        return null;
    }
}

/** 校验 MaaS Key：走模型列表接口，上游 401 即视为无效。 */
export async function validateMaasKey(baseURL: string, apiKey: string): Promise<void> {
    await http.post("/ai/models", { baseUrl: baseURL, apiKey, apiFormat: "openai" });
}
