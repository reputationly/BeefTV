import type { ModelCatalogItem, ModelCatalogPayload } from "@/services/api/maas-catalog";
import type { ModelChannel } from "@/stores/use-config-store";

// MaaS 算力网关（maas.ovaijisuan.com，new-api 部署）的渠道常量与目录映射。
// 模型来源是网关注册的第一方目录 `GET /api/v1/models/catalog`（由 Hilo 目录配置驱动），
// 不再有 /v1/ov/capabilities 这条通路。
export const MAAS_BASE_URL = "https://maas.ovaijisuan.com/v1";
// 用户创建/查看 sk-... 令牌的控制台页面。
export const MAAS_CONSOLE_TOKEN_URL = "https://maas.ovaijisuan.com/console/token";
export const MAAS_CHANNEL_ID = "maas";
export const MAAS_CHANNEL_NAME = "MaaS 算力网关";
// 协议名必须是后端已注册的接口类型：
//   text  → chat-completion（内置）
//   image → maas-image（plugin-packages/maas-image，aspect_ratio + resolution）
//   video → maas-video（plugin-packages/maas-video，metadata.image_mode + 轮询）
// MaaS 的图像/视频契约与 OpenAI 版本不同，不能用 openai-image / openai-videos。
export const MAAS_PROVIDER_CHAT = "chat-completion";
export const MAAS_PROVIDER_IMAGE = "maas-image";
export const MAAS_PROVIDER_VIDEO = "maas-video";
// 参考族玩法固定 reference，必须用独立接口类型（模板 DSL 不支持按模型名分支）。
export const MAAS_PROVIDER_VIDEO_REF = "maas-video-ref";

export type MaasCapability = "text" | "image" | "video" | "audio";

export type MaasModelProfile = {
    model: string;
    displayName: string;
    description?: string;
    capability: MaasCapability;
    protocol: string;
    authType: "bearer";
    /** 网关声明的输入模态（只有对话模型可能非空）。 */
    modalities?: string[];
};

export type MaasCatalogDefaults = { chat?: string; multimodal?: string };

export type MaasCatalogMapping = {
    profiles: MaasModelProfile[];
    defaults: MaasCatalogDefaults;
    /** 云端 interfaceType 写法无法解析时的提示（回退本地映射，不影响生成）。 */
    warnings: string[];
};

// 云端 interfaceType 取值必须落在对应能力已注册的协议里；
// 写错时回退本地默认映射并留下一条 warning，而不是让生成阶段才失败。
const ACCEPTED_INTERFACE_TYPES: Record<"text" | "image" | "video", string[]> = {
    text: [MAAS_PROVIDER_CHAT],
    image: [MAAS_PROVIDER_IMAGE],
    video: [MAAS_PROVIDER_VIDEO, MAAS_PROVIDER_VIDEO_REF],
};

function resolveInterfaceType(
    item: ModelCatalogItem,
    capability: "text" | "image" | "video",
    fallback: string,
    warnings: string[],
): string {
    const declared = typeof item.interfaceType === "string" ? item.interfaceType.trim() : "";
    if (!declared) return fallback;
    if (ACCEPTED_INTERFACE_TYPES[capability].includes(declared)) return declared;
    warnings.push(`${item.platformModel ?? item.id ?? "?"} 的 interfaceType「${declared}」不可用，已回退 ${fallback}`);
    return fallback;
}

function platformModel(item: ModelCatalogItem | undefined): string {
    return typeof item?.platformModel === "string" ? item.platformModel.trim() : "";
}

function displayNameOf(item: ModelCatalogItem, model: string): string {
    const display = typeof item.displayName === "string" ? item.displayName.trim() : "";
    return display || model;
}

function modalitiesOf(item: ModelCatalogItem): string[] {
    const modalities: string[] = [];
    if (item.supportsImage) modalities.push("image");
    if (item.supportsVideo) modalities.push("video");
    if (item.supportsAudio) modalities.push("audio");
    return modalities;
}

function defaultVideoProtocol(model: string): string {
    return model.includes("-ref") ? MAAS_PROVIDER_VIDEO_REF : MAAS_PROVIDER_VIDEO;
}

function mediaProfiles(
    items: ModelCatalogItem[] | undefined,
    capability: "image" | "video",
    protocol: string,
    warnings: string[],
): MaasModelProfile[] {
    const profiles: MaasModelProfile[] = [];
    for (const item of Array.isArray(items) ? items : []) {
        const model = platformModel(item);
        if (!model) continue;
        const description = typeof item.description === "string" ? item.description.trim() : "";
        profiles.push({
            model,
            displayName: displayNameOf(item, model),
            ...(description ? { description } : {}),
            capability,
            protocol: resolveInterfaceType(item, capability, protocol || defaultVideoProtocol(model), warnings),
            ...(capability === "video" && model.includes("-ref") ? { protocol: MAAS_PROVIDER_VIDEO_REF } : {}),
            authType: "bearer",
            ...(item.params ? { params: item.params } : {}),
        });
    }
    return profiles;
}

/**
 * 目录 → 渠道档位。
 * text → chat-completion（模态取 supports*）、image → maas-image、video → maas-video；
 * audio（音乐）BeefTV 没有对应流水线，直接跳过。
 */
export function maasProfilesFromCatalog(payload: ModelCatalogPayload | undefined): MaasCatalogMapping {
    const profiles: MaasModelProfile[] = [];
    const warnings: string[] = [];
    for (const item of Array.isArray(payload?.text) ? payload.text : []) {
        const model = platformModel(item);
        if (!model) continue;
        const modalities = modalitiesOf(item);
        const description = typeof item.description === "string" ? item.description.trim() : "";
        profiles.push({
            model,
            displayName: displayNameOf(item, model),
            ...(description ? { description } : {}),
            capability: "text",
            protocol: resolveInterfaceType(item, "text", MAAS_PROVIDER_CHAT, warnings),
            authType: "bearer",
            ...(modalities.length ? { modalities } : {}),
        });
    }
    profiles.push(...mediaProfiles(payload?.image, "image", MAAS_PROVIDER_IMAGE, warnings));
    profiles.push(...mediaProfiles(payload?.video, "video", "", warnings));

    const defaults: MaasCatalogDefaults = {};
    const chat = typeof payload?.defaults?.chat === "string" ? payload.defaults.chat.trim() : "";
    const multimodal = typeof payload?.defaults?.multimodal === "string" ? payload.defaults.multimodal.trim() : "";
    if (chat && profiles.some((profile) => profile.model === chat && profile.capability === "text")) defaults.chat = chat;
    if (multimodal && profiles.some((profile) => profile.model === multimodal && profile.capability === "text")) defaults.multimodal = multimodal;
    return { profiles, defaults, warnings };
}

export type MaasChannelInput = {
    apiKey: string;
    profiles: MaasModelProfile[];
    existingChannel?: ModelChannel;
};

/** 渠道在 BeefTV「设置 → 模型服务」里的唯一写入口。 */
export function buildMaasModelChannel({ apiKey, profiles, existingChannel }: MaasChannelInput): ModelChannel {
    const unique = [...new Map(profiles.map((profile) => [profile.model, profile])).values()];
    return {
        ...(existingChannel ?? ({} as ModelChannel)),
        id: MAAS_CHANNEL_ID,
        name: existingChannel?.name || MAAS_CHANNEL_NAME,
        scope: "user",
        baseUrl: MAAS_BASE_URL,
        apiKey: apiKey.trim() || existingChannel?.apiKey || "",
        hasApiKey: Boolean(apiKey.trim() || existingChannel?.hasApiKey),
        apiFormat: "openai",
        models: unique.map((profile) => profile.model),
        modelProfiles: unique.map((profile) => ({ ...profile })),
    } as ModelChannel;
}

export function isMaasChannelReady(channel: ModelChannel | undefined): boolean {
    if (!channel) return false;
    return Boolean(channel.apiKey || channel.hasApiKey) && Array.isArray(channel.models) && channel.models.length > 0;
}

export function findMaasChannel(channels: ModelChannel[] | undefined): ModelChannel | undefined {
    return (channels ?? []).find((channel) => channel.id === MAAS_CHANNEL_ID || channel.baseUrl?.includes("maas.ovaijisuan.com"));
}

/** 首次运行门禁判据：只认 MaaS 渠道本身，内置 pinned 官方渠道不算数。 */
export function shouldBlockForMaasKey(channels: ModelChannel[] | undefined): boolean {
    return !isMaasChannelReady(findMaasChannel(channels));
}
