import { describe, expect, test } from "bun:test";

import {
    MAAS_BASE_URL,
    MAAS_CHANNEL_ID,
    buildMaasModelChannel,
    findMaasChannel,
    isMaasChannelReady,
    maasProfilesFromCatalog,
} from "../src/lib/maas-catalog";
import { maasProfilesFromCatalog as pluginProfilesFromCatalog, buildMaasModelChannel as buildPluginChannel } from "../../plugin-packages/beeftv-plugin-maas/client/presets.js";
import type { ModelCatalogPayload } from "../src/services/api/maas-catalog";

const CATALOG: ModelCatalogPayload = {
    version: "v1",
    text: [
        { platformModel: "qwen3.8-flash", displayName: "Qwen 3.8 Flash", supportsImage: true, supportsVideo: true },
        { platformModel: "deepseek-v4-1-flash-1017", displayName: "DeepSeek 1017", supportsImage: true },
        { platformModel: "GLM-5" },
    ],
    image: [{ platformModel: "minimax-h3-image", displayName: "MiniMax H3 图像" }],
    video: [{ platformModel: "minimax-h3-2k", displayName: "MiniMax H3 帧族" }],
    audio: [{ platformModel: "minimax-music3" }],
    defaults: { chat: "deepseek-v4-1-flash-1017", multimodal: "qwen3.8-flash" },
};

describe("MaaS 目录映射", () => {
    test("对话/图像/视频进入渠道，音乐跳过，平台模型名作为提交名", () => {
        const { profiles, defaults } = maasProfilesFromCatalog(CATALOG);
        expect(profiles.map((row) => [row.model, row.capability, row.protocol])).toEqual([
            ["qwen3.8-flash", "text", "chat-completion"],
            ["deepseek-v4-1-flash-1017", "text", "chat-completion"],
            ["GLM-5", "text", "chat-completion"],
            ["minimax-h3-image", "image", "maas-image"],
            ["minimax-h3-2k", "video", "maas-video"],
        ]);
        expect(defaults).toEqual({ chat: "deepseek-v4-1-flash-1017", multimodal: "qwen3.8-flash" });
        expect(profiles.find((row) => row.model === "qwen3.8-flash")?.modalities).toEqual(["image", "video"]);
    });

    test("defaults 指向不存在的模型时不生效", () => {
        const { defaults } = maasProfilesFromCatalog({ ...CATALOG, defaults: { chat: "not-there", multimodal: "minimax-h3-image" } });
        expect(defaults.chat).toBeUndefined();
        expect(defaults.multimodal).toBeUndefined();
    });

    test("应用侧与插件对同一份目录给出完全相同的档位与默认值", () => {
        const app = maasProfilesFromCatalog(CATALOG);
        const plugin = pluginProfilesFromCatalog(CATALOG);
        expect(plugin.profiles).toEqual(app.profiles);
        expect(plugin.defaults).toEqual(app.defaults);
    });
});

describe("MaaS 渠道构建", () => {
    test("固定 id 与网关地址，模型与档位一一对应", () => {
        const { profiles } = maasProfilesFromCatalog(CATALOG);
        const channel = buildMaasModelChannel({ apiKey: "sk-test", profiles });
        expect(channel.id).toBe(MAAS_CHANNEL_ID);
        expect(channel.baseUrl).toBe(MAAS_BASE_URL);
        expect(channel.models).toEqual(["qwen3.8-flash", "deepseek-v4-1-flash-1017", "GLM-5", "minimax-h3-image", "minimax-h3-2k"]);
    });

    test("插件与门禁构建出的渠道形状一致", () => {
        const { profiles } = maasProfilesFromCatalog(CATALOG);
        const appChannel = buildMaasModelChannel({ apiKey: "sk-test", profiles });
        const pluginChannel = buildPluginChannel({ apiKey: "sk-test", baseUrl: MAAS_BASE_URL, profiles });
        expect(pluginChannel).toEqual(appChannel);
    });

    test("没有密钥或没有模型时渠道不算就绪", () => {
        const { profiles } = maasProfilesFromCatalog(CATALOG);
        expect(isMaasChannelReady(undefined)).toBe(false);
        expect(isMaasChannelReady(buildMaasModelChannel({ apiKey: "", profiles }))).toBe(false);
        expect(isMaasChannelReady(buildMaasModelChannel({ apiKey: "sk-test", profiles: [] }))).toBe(false);
        expect(isMaasChannelReady(buildMaasModelChannel({ apiKey: "sk-test", profiles }))).toBe(true);
    });

    test("能按渠道 id 或网关地址找回已配置渠道", () => {
        const { profiles } = maasProfilesFromCatalog(CATALOG);
        const channel = buildMaasModelChannel({ apiKey: "sk-test", profiles });
        expect(findMaasChannel([channel])?.id).toBe(MAAS_CHANNEL_ID);
        expect(findMaasChannel([{ ...channel, id: "legacy" }])?.id).toBe("legacy");
        expect(findMaasChannel([])).toBeUndefined();
    });
});

describe("云端 interfaceType", () => {
    test("按云端值选协议", () => {
        const { profiles, warnings } = maasProfilesFromCatalog({
            text: [{ platformModel: "GLM-5", interfaceType: "chat-completion" }],
            image: [{ platformModel: "minimax-h3-image", interfaceType: "maas-image" }],
            video: [{ platformModel: "minimax-h3-2k", interfaceType: "maas-video" }],
        });
        expect(profiles.map((row) => row.protocol)).toEqual(["chat-completion", "maas-image", "maas-video"]);
        expect(warnings).toEqual([]);
    });

    test("写错的 interfaceType 回退本地映射并留 warning，不让生成阶段才失败", () => {
        const { profiles, warnings } = maasProfilesFromCatalog({
            image: [{ platformModel: "minimax-h3-image", interfaceType: "maas-imag" }],
        });
        expect(profiles[0].protocol).toBe("maas-image");
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("maas-imag");
    });

    test("能力不匹配的 interfaceType 也回退", () => {
        const { profiles, warnings } = maasProfilesFromCatalog({
            video: [{ platformModel: "minimax-h3-2k", interfaceType: "maas-image" }],
        });
        expect(profiles[0].protocol).toBe("maas-video");
        expect(warnings).toHaveLength(1);
    });
});

test("参数表随档位落地，供节点渲染默认值与选项", () => {
    const { profiles } = maasProfilesFromCatalog({
        image: [{
            platformModel: "minimax-h3-image",
            params: {
                aspect_ratio: { type: "select", label: "宽高比", default: "16:9", options: ["1:1", "16:9"] },
                resolution: { type: "select", label: "分辨率", default: "2K", options: ["1K", "2K"] },
            },
        }],
    });
    expect(profiles[0].params?.aspect_ratio?.default).toBe("16:9");
    expect(profiles[0].params?.resolution?.options).toEqual(["1K", "2K"]);
});
