import { MAAS_CHANNEL_ID, buildMaasModelChannel, findMaasChannel, type MaasCatalogDefaults, type MaasModelProfile } from "@/lib/maas-catalog";
import { defaultMediaReviewModel } from "@/lib/media-review-model";
import { withChannels } from "@/lib/managed-beeftv-catalog";
import { commitModelConfig, flushModelConfig } from "@/services/model-config-repository";
import { encodeChannelModel, useConfigStore, type ModelChannel } from "@/stores/use-config-store";

/**
 * 把 MaaS 渠道写进本地模型配置并落库（首次门禁、启动同步、插件面板共用）。
 * 默认文本/多模态模型取网关目录给出的 defaults；没给时沿用原有回退。
 */
export async function saveMaasChannel(
    apiKey: string,
    profiles: MaasModelProfile[],
    defaults: MaasCatalogDefaults = {},
): Promise<ModelChannel> {
    const latest = useConfigStore.getState().config;
    const existing = findMaasChannel(latest.channels);
    const channel = buildMaasModelChannel({ apiKey, profiles, existingChannel: existing });
    const nextChannels = [...latest.channels.filter((item) => item.id !== MAAS_CHANNEL_ID), channel];
    const withCatalog = withChannels(latest, nextChannels);

    const textDefault = defaults.chat ? encodeChannelModel(channel.id, defaults.chat) : "";
    const multimodalDefault = defaults.multimodal
        ? encodeChannelModel(channel.id, defaults.multimodal)
        : defaultMediaReviewModel(withCatalog);
    const nextConfig = {
        ...withCatalog,
        ...(textDefault ? { textModel: textDefault, model: textDefault } : {}),
        ...(multimodalDefault ? { mediaReviewModel: multimodalDefault } : {}),
    };
    await commitModelConfig(nextConfig);
    await flushModelConfig();
    useConfigStore.getState().replaceConfig(nextConfig);
    return channel;
}
