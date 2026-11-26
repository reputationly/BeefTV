import { describe, expect, test } from "bun:test";

import { ACCOUNT_SETTINGS_SECTIONS } from "../src/components/account-settings/account-settings-sections";
import { buildMaasModelChannel, maasProfilesFromCatalog, shouldBlockForMaasKey } from "../src/lib/maas-catalog";
import type { ModelChannel } from "../src/stores/use-config-store";

const pinnedOfficial = {
    id: "beeftv",
    name: "BeefTV 官方算力",
    baseUrl: "https://api.beeftv.test/v1",
    apiKey: "",
    hasApiKey: false,
    apiFormat: "openai",
    models: ["managed-text-model"],
    pinned: true,
    scope: "system",
} as unknown as ModelChannel;

const maasChannel = buildMaasModelChannel({
    apiKey: "sk-test",
    profiles: maasProfilesFromCatalog({
        text: [{ platformModel: "GLM-5" }],
        image: [{ platformModel: "minimax-h3-image" }],
    }).profiles,
});

describe("首次运行 MaaS 门禁判据", () => {
    test("没有任何渠道时必须先填 MaaS Key", () => {
        expect(shouldBlockForMaasKey([])).toBe(true);
        expect(shouldBlockForMaasKey(undefined)).toBe(true);
    });

    test("内置官方渠道不能顶替 MaaS 渠道", () => {
        expect(shouldBlockForMaasKey([pinnedOfficial])).toBe(true);
    });

    test("MaaS 渠道缺少密钥或模型时仍然阻塞", () => {
        expect(shouldBlockForMaasKey([{ ...maasChannel, apiKey: "", hasApiKey: false }])).toBe(true);
        expect(shouldBlockForMaasKey([{ ...maasChannel, models: [] }])).toBe(true);
    });

    test("配置完成的 MaaS 渠道放行", () => {
        expect(shouldBlockForMaasKey([pinnedOfficial, maasChannel])).toBe(false);
        expect(shouldBlockForMaasKey([{ ...maasChannel, apiKey: "", hasApiKey: true }])).toBe(false);
    });
});

describe("设置分类不再包含账号与余额", () => {
    test("只保留通用设置、模型与内置插件", () => {
        expect(ACCOUNT_SETTINGS_SECTIONS.map((section) => section.id)).toEqual(["general", "models", "plugins"]);
    });

    test("不再出现登录、余额、充值或钱包入口", () => {
        const labels = ACCOUNT_SETTINGS_SECTIONS.map((section) => section.label).join("|");
        for (const removed of ["账号", "余额", "充值", "钱包", "登录"]) {
            expect(labels).not.toContain(removed);
        }
    });
});
