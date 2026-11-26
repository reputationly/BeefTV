import { Database, Plug, Settings2 } from "lucide-react";

// 本地版没有账号体系：只保留通用设置、模型与内置插件（账户/余额/充值入口已移除）。
// 单独成文件，便于测试直接断言"账号与余额"不再出现在设置分类里。
export const ACCOUNT_SETTINGS_SECTIONS = [
    { id: "general", label: "通用设置", icon: Settings2 },
    { id: "models", label: "模型", icon: Database },
    { id: "plugins", label: "内置插件", icon: Plug },
] as const;

export type AccountSettingsSection = (typeof ACCOUNT_SETTINGS_SECTIONS)[number]["id"];
