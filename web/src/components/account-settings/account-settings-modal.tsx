import { Button, Segmented } from "antd";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { AppChangelogButton, APP_VERSION, formatAppVersionLabel } from "@/components/layout/app-changelog-modal";
import { AppModal } from "@/components/ui/product/app-modal";
import { useDesktopUpdate } from "@/hooks/use-desktop-update";
import { ModelDefaultGrid } from "@/pages/settings/model-default-grid";
import { useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { AccountBuiltinPlugins } from "./account-builtin-plugins";
import { ACCOUNT_SETTINGS_SECTIONS, type AccountSettingsSection } from "./account-settings-sections";
import "./account-settings.css";

type Section = AccountSettingsSection;

export function AccountSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [active, setActive] = useState<Section>("general");
    const contentRef = useRef<HTMLElement>(null);
    const navigate = useNavigate();
    const config = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const theme = useThemeStore((state) => state.preference);
    const setTheme = useThemeStore((state) => state.setTheme);
    const { state: updateState } = useDesktopUpdate();
    const installedVersion = formatAppVersionLabel(updateState.currentVersion || APP_VERSION);
    useEffect(() => { if (open) setActive("general"); }, [open]);
    useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [active]);
    const goTo = (path: string) => { onClose(); navigate(path); };
    return <AppModal flush open={open} aria-label="账户设置" width="min(960px, calc(100vw - 32px))" className="account-settings-modal" footer={null} onCancel={onClose}>
        <div className="account-settings-layout">
            <nav className="account-settings-nav" aria-label="账户设置分类">
                {ACCOUNT_SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={active === id ? "page" : undefined} onClick={() => setActive(id)}>
                    <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
                </button>)}
            </nav>
            <section ref={contentRef} className="account-settings-content" aria-label={ACCOUNT_SETTINGS_SECTIONS.find((section) => section.id === active)?.label} tabIndex={0}>
                <h2>{ACCOUNT_SETTINGS_SECTIONS.find((section) => section.id === active)?.label}</h2>
                {active === "general" ? <>
                    <div className="account-setting-row"><h3>外观</h3><Segmented className="account-appearance-control" aria-label="外观模式" value={theme} options={[{ label: "浅色", value: "light" }, { label: "深色", value: "dark" }, { label: "跟随系统", value: "system" }]} onChange={(value) => setTheme(value)} /></div>
                    <div className="account-setting-row"><div><h3>存储设置</h3><p>管理素材、缓存与本地存储位置</p></div><Button onClick={() => goTo("/settings?section=storage")}>打开</Button></div>
                    <div className="account-setting-row"><div><h3>连接诊断</h3><p>一键导出最近 7 天诊断包，或检查环境与请求记录</p></div><Button onClick={() => goTo("/settings?section=diagnostics")}>打开</Button></div>
                    <div className="account-setting-row"><div><h3>版本与更新日志</h3><p>{installedVersion ? `当前版本 ${installedVersion}，查看版本记录与第三方许可` : "查看版本记录与第三方许可"}</p></div><AppChangelogButton appearance="button" version={installedVersion} label="查看" /></div>
                </> : null}
                {active === "models" ? <>
                    <ModelDefaultGrid config={config} onChange={(key, value) => updateConfig(key, value)} onOpenChannels={() => goTo("/settings?section=channels")} />
                </> : null}
                {active === "plugins" ? <AccountBuiltinPlugins onManage={() => goTo("/plugins")} /> : null}
            </section>
        </div>
    </AppModal>;
}
