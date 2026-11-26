import { describe, expect, test } from "bun:test";

import { defaultMediaReviewModel, mediaReviewModelOptions, normalizeMediaReviewModel } from "../src/lib/media-review-model";
import { buildMaasModelChannel, maasProfilesFromCatalog } from "../src/lib/maas-catalog";
import { withChannels } from "../src/lib/managed-beeftv-catalog";
import type { AiConfig, ModelChannel } from "../src/stores/use-config-store";
import { defaultConfig } from "../src/stores/use-config-store";

const CATALOG = {
    text: [
        { platformModel: "deepseek-v4-1-flash-1017", supportsImage: true },
        { platformModel: "qwen3.8-flash", supportsImage: true, supportsVideo: true },
        { platformModel: "glm-4v-flash", supportsImage: true },
    ],
    image: [{ platformModel: "minimax-h3-image" }],
};

function configWithMaas(): AiConfig {
    const channel = buildMaasModelChannel({ apiKey: "sk", profiles: maasProfilesFromCatalog(CATALOG).profiles });
    return withChannels({ ...defaultConfig, channels: [], mediaReviewModel: "" } as AiConfig, [channel]);
}

describe("审片模型按能力目录的模态选择", () => {
    test("只列声明了视频输入的对话模型", () => {
        const config = configWithMaas();
        expect(mediaReviewModelOptions(config)).toEqual(["maas::qwen3.8-flash"]);
    });

    test("默认审片模型就是支持视频的模型", () => {
        expect(defaultMediaReviewModel(configWithMaas())).toBe("maas::qwen3.8-flash");
    });

    test("选了不支持视频的模型会被归一化为空", () => {
        const config = configWithMaas();
        expect(normalizeMediaReviewModel(config, "maas::glm-4v-flash")).toBe("");
        expect(normalizeMediaReviewModel(config, "maas::qwen3.8-flash")).toBe("maas::qwen3.8-flash");
    });

    test("旧目录没有模态声明时仍可人工选择，但不会自动当成默认", () => {
        const legacyProfiles = maasProfilesFromCatalog({ text: [{ platformModel: "GLM-5" }] }).profiles;
        const channel: ModelChannel = buildMaasModelChannel({ apiKey: "sk", profiles: legacyProfiles });
        const config = withChannels({ ...defaultConfig, channels: [], mediaReviewModel: "" } as AiConfig, [channel]);
        expect(mediaReviewModelOptions(config)).toEqual(["maas::GLM-5"]);
        expect(defaultMediaReviewModel(config)).toBe("");
    });
});
