import { Alert, Button, Form, Input } from "antd";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { AppModal } from "@/components/ui/product/app-modal";
import {
    MAAS_BASE_URL,
    MAAS_CHANNEL_NAME,
    MAAS_CONSOLE_TOKEN_URL,
    findMaasChannel,
    maasProfilesFromCatalog,
    shouldBlockForMaasKey,
} from "@/lib/maas-catalog";
import { fetchMaasCatalog, validateMaasKey } from "@/services/api/maas-catalog";
import { runMaasCatalogSync } from "@/lib/maas-catalog-sync";
import { saveMaasChannel } from "@/services/maas-channel";
import { BrandLogo } from "@/components/brand/brand-logo";
import { useConfigStore } from "@/stores/use-config-store";

/** 写入 MaaS 渠道并落库；返回写入后的渠道与错误原因。 */
/**
 * 首次运行门禁：本地没有任何可用 MaaS 渠道时阻塞主界面，必须先输入 MaaS Key。
 * 配置完成后正常渲染 children，后续可在「设置 → 模型服务」或插件面板更换密钥。
 */
export function MaasKeyGate({ children }: { children: React.ReactNode }) {
    const channels = useConfigStore((state) => state.config.channels);
    const [apiKey, setApiKey] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const ready = !shouldBlockForMaasKey(channels);

    // 启动即同步一次能力目录（缓存优先、再真实刷新），版本没变不会重写渠道。
    useEffect(() => {
        if (!ready) return;
        void runMaasCatalogSync();
    }, [ready]);

    const submit = async () => {
        const trimmed = apiKey.trim();
        if (!trimmed) {
            setError("请填写 MaaS API Key（sk-...）");
            return;
        }
        setBusy(true);
        setError("");
        try {
            await validateMaasKey(MAAS_BASE_URL, trimmed);
            const mapping = maasProfilesFromCatalog((await fetchMaasCatalog(MAAS_BASE_URL)).payload);
            if (!mapping.profiles.length) throw new Error("网关目录里没有 BeefTV 可用的模型");
            await saveMaasChannel(trimmed, mapping.profiles, mapping.defaults);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "校验 MaaS Key 失败");
        } finally {
            setBusy(false);
        }
    };

    if (ready) return <>{children}</>;

    return (
        <>
            <AppModal
                open
                aria-label={`连接 ${MAAS_CHANNEL_NAME}`}
                closable={false}
                maskClosable={false}
                keyboard={false}
                footer={null}
                title={null}
                width="min(640px, calc(100vw - 32px))"
                styles={{ body: { maxHeight: "84dvh", overflowY: "auto", overscrollBehavior: "contain" } }}
            >
                <div className="flex flex-col gap-3">
                    <BrandLogo className="mx-auto h-10 w-auto max-w-[200px]" fallback={null} />
                    <div className="text-center">
                        <h2 className="m-0 text-[length:var(--fs-title)] font-[500] text-foreground">添加一个 MaaS 密钥开始使用</h2>
                        <p className="mt-1 mb-0 text-[length:var(--fs-body)] leading-[22px] text-foreground/70">
                            请按以下步骤前往 MaaS 控制台获取密钥：
                        </p>
                    </div>
                    <ol className="m-0 flex list-decimal flex-col gap-3 pl-5 text-[length:var(--fs-body)] leading-[22px] text-foreground/70">
                        <li>
                            打开令牌管理
                            <img
                                src="/onboarding/maas-key-1.png"
                                alt="MaaS 控制台令牌管理页面，高亮「添加令牌」按钮"
                                className="mt-1.5 block w-full rounded-lg border object-contain object-left-top"
                                style={{ borderColor: "var(--border)", maxHeight: 150 }}
                                draggable={false}
                            />
                        </li>
                        <li>
                            创建令牌
                            <img
                                src="/onboarding/maas-key-2.png"
                                alt="MaaS 控制台「创建新的令牌」对话框，填写名称与令牌分组"
                                className="mt-1.5 block w-full rounded-lg border object-contain object-left-top"
                                style={{ borderColor: "var(--border)", maxHeight: 150 }}
                                draggable={false}
                            />
                        </li>
                    </ol>
                    <a
                        href={MAAS_CONSOLE_TOKEN_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-fit items-center gap-1 self-start text-[length:var(--fs-caption)] font-[550] underline decoration-1 underline-offset-2"
                        style={{ color: "var(--foreground)" }}
                    >
                        打开令牌页
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                    <Form layout="vertical" className="mt-1" onFinish={() => void submit()}>
                        <Form.Item label="输入 API 密钥" required>
                            <Input.Password
                                autoFocus
                                autoComplete="off"
                                spellCheck={false}
                                placeholder="sk-..."
                                value={apiKey}
                                disabled={busy}
                                onChange={(event) => setApiKey(event.target.value)}
                                onPressEnter={() => void submit()}
                            />
                        </Form.Item>
                        {error ? <Alert type="error" showIcon message={error} /> : null}
                        <div className="mt-4 flex justify-end">
                            <Button type="primary" htmlType="submit" loading={busy}>
                                {busy ? "校验并同步中…" : "保存并继续"}
                            </Button>
                        </div>
                    </Form>
                </div>
            </AppModal>
            <div className="min-h-screen" aria-hidden="true" />
        </>
    );
}
