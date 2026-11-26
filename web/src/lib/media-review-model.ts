import { encodeChannelModel, normalizeModelOptionValue, type AiConfig, type ModelChannel } from "@/stores/use-config-store";

// 审片模型要求：对话能力 + chat-completion 协议；若模型声明了输入模态，
// 还必须支持视频输入（审片发的是 MP4 片段）。模态来自网关能力目录，不再写死模型名。
const REVIEW_MODALITY = "video";

function chatProfiles(channel: ModelChannel) {
    if (channel.enabled === false) return [];
    return (channel.modelProfiles ?? []).filter((profile) => {
        if (profile.capability !== "text") return false;
        return (profile.protocol?.trim() || "chat-completion") === "chat-completion";
    });
}

/** 明确声明了视频模态、可作审片模型的选项。 */
export function videoReviewOptions(config: AiConfig): string[] {
    const options: string[] = [];
    for (const channel of config.channels) {
        for (const profile of chatProfiles(channel)) {
            if (!channel.models.includes(profile.model)) continue;
            if (profile.modalities?.includes(REVIEW_MODALITY)) options.push(encodeChannelModel(channel.id, profile.model));
        }
    }
    return options;
}

/** 没声明模态的对话模型：旧目录兼容用，只能在人工选择时出现。 */
function unmodeledChatOptions(config: AiConfig): string[] {
    const options: string[] = [];
    for (const channel of config.channels) {
        for (const profile of chatProfiles(channel)) {
            if (!channel.models.includes(profile.model)) continue;
            if ((profile.modalities?.length ?? 0) === 0) options.push(encodeChannelModel(channel.id, profile.model));
        }
    }
    return options;
}

/** 下拉选项：优先只列有视频模态的模型；整份目录都没声明模态时才退回全部对话模型。 */
export function mediaReviewModelOptions(config: AiConfig): string[] {
    const withVideo = videoReviewOptions(config);
    return withVideo.length ? withVideo : unmodeledChatOptions(config);
}

/**
 * 默认审片模型：只自动选"明确声明了视频模态"的模型。
 * 目录里没有任何模态声明时留空，避免把纯文本模型派去审片、等到调用才失败。
 */
export function defaultMediaReviewModel(config: AiConfig): string {
    return videoReviewOptions(config)[0] ?? "";
}

export function normalizeMediaReviewModel(config: AiConfig, value: unknown): string {
    const candidate = normalizeModelOptionValue(value, config.channels);
    return mediaReviewModelOptions(config).includes(candidate) ? candidate : "";
}
