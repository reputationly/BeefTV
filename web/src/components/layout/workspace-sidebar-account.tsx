import { Settings2 } from "lucide-react";
import { useState } from "react";

import { AccountSettingsModal } from "@/components/account-settings/account-settings-modal";
import { cn } from "@/lib/utils";

/**
 * 侧栏底部入口：只负责打开本机设置。
 * 本地版不再展示账号登录态，账户/余额/充值入口已移除（后端 /api/beeftv/connection* 仍保留）。
 */
export function WorkspaceSidebarAccount({ collapsed }: { collapsed: boolean }) {
    const [open, setOpen] = useState(false);
    const label = "设置";

    return <>
        <button
            type="button"
            className={cn("app-workspace-nav-link app-workspace-official-account group relative flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-[var(--r-md)] px-3 py-2 text-[var(--fs-body)] text-foreground/62 hover:bg-surface-hover hover:text-foreground", collapsed && "is-collapsed")}
            style={collapsed ? undefined : { paddingLeft: 10 }}
            aria-label={label}
            title={label}
            onClick={() => setOpen(true)}
        >
            <span className="app-workspace-nav-main flex min-w-0 items-center gap-2.5">
                <span className="app-workspace-nav-icon" aria-hidden="true">
                    <Settings2 className="size-4" strokeWidth={1.8} />
                </span>
                {!collapsed ? <span className="app-workspace-nav-title truncate">{label}</span> : null}
            </span>
        </button>
        <AccountSettingsModal open={open} onClose={() => setOpen(false)} />
    </>;
}
