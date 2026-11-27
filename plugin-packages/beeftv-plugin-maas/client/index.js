// BeefTV 内置插件：MaaS 算力网关（beeftv-plugin-maas）
// 通过 app.settings 插槽提供一键 BYOK 配置面板：只填 MaaS API Key，
// 校验通过后把网关上的文本 / 图像 / 视频 / 语音模型同步到「设置 → 模型服务」。

// MaaS 算力网关（maas.ovaijisuan.com，new-api 部署）渠道常量与目录映射。
// 模型来源是网关第一方目录 `GET /api/v1/models/catalog`（由 Hilo 目录配置驱动）。

const MAAS_BASE_URL = "https://maas.ovaijisuan.com/v1";
const MAAS_ORIGIN = "https://maas.ovaijisuan.com";
const MAAS_CHANNEL_ID = "maas";
const MAAS_CHANNEL_NAME = "MaaS 算力网关";
const MAAS_PROVIDER_CHAT = "chat-completion";
const MAAS_PROVIDER_IMAGE = "maas-image";
const MAAS_PROVIDER_VIDEO = "maas-video";

function platformModel(item) {
  return typeof item?.platformModel === "string" ? item.platformModel.trim() : "";
}

function displayNameOf(item, model) {
  const display = typeof item?.displayName === "string" ? item.displayName.trim() : "";
  return display || model;
}

function modalitiesOf(item) {
  const modalities = [];
  if (item?.supportsImage) modalities.push("image");
  if (item?.supportsVideo) modalities.push("video");
  if (item?.supportsAudio) modalities.push("audio");
  return modalities;
}

/**
 * 目录 → 渠道档位：text → chat-completion（模态取 supports*）、image / video 用平台名。
 * audio（音乐）BeefTV 没有对应流水线，跳过。
 */
function maasProfilesFromCatalog(payload) {
  const profiles = [];
  for (const item of Array.isArray(payload?.text) ? payload.text : []) {
    const model = platformModel(item);
    if (!model) continue;
    const modalities = modalitiesOf(item);
    const description = typeof item?.description === "string" ? item.description.trim() : "";
    profiles.push({
      model,
      displayName: displayNameOf(item, model),
      ...(description ? { description } : {}),
      capability: "text",
      protocol: MAAS_PROVIDER_CHAT,
      authType: "bearer",
      ...(modalities.length ? { modalities } : {}),
    });
  }
  for (const [items, capability, protocol] of [
    [payload?.image, "image", MAAS_PROVIDER_IMAGE],
    [payload?.video, "video", MAAS_PROVIDER_VIDEO],
  ]) {
    for (const item of Array.isArray(items) ? items : []) {
      const model = platformModel(item);
      if (!model) continue;
      const description = typeof item?.description === "string" ? item.description.trim() : "";
      profiles.push({
        model,
        displayName: displayNameOf(item, model),
        ...(description ? { description } : {}),
        capability,
        protocol,
        authType: "bearer",
      });
    }
  }
  const defaults = {};
  const chat = typeof payload?.defaults?.chat === "string" ? payload.defaults.chat.trim() : "";
  const multimodal = typeof payload?.defaults?.multimodal === "string" ? payload.defaults.multimodal.trim() : "";
  if (chat && profiles.some((profile) => profile.model === chat && profile.capability === "text")) defaults.chat = chat;
  if (multimodal && profiles.some((profile) => profile.model === multimodal && profile.capability === "text")) defaults.multimodal = multimodal;
  return { profiles, defaults };
}

/** 渠道在 BeefTV「设置 → 模型服务」里的唯一写入口。 */
function buildMaasModelChannel({ apiKey, baseUrl, profiles, existingChannel } = {}) {
  const cleanUrl = String(baseUrl || MAAS_BASE_URL).trim().replace(/\/+$/, "") || MAAS_BASE_URL;
  const cleanKey = String(apiKey || "").trim();
  const unique = [...new Map((Array.isArray(profiles) ? profiles : []).map((item) => [item.model, item])).values()];
  return {
    id: MAAS_CHANNEL_ID,
    name: existingChannel?.name || MAAS_CHANNEL_NAME,
    scope: "user",
    baseUrl: cleanUrl,
    apiKey: cleanKey,
    hasApiKey: Boolean(cleanKey || existingChannel?.hasApiKey),
    apiFormat: "openai",
    models: unique.map((item) => item.model),
    modelProfiles: unique.map((item) => ({ ...item })),
  };
}

function isMaasChannelReady(channel) {
  if (!channel) return false;
  return Boolean(channel.apiKey || channel.hasApiKey) && Array.isArray(channel.models) && channel.models.length > 0;
}


function getReact(host) {
  if (host?.React) return host.React;
  if (host?.ui?.React) return host.ui.React;
  if (typeof window !== "undefined") return window.__BEEFTV_REACT__ || window.React || null;
  return null;
}

const panelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "4px 0",
  color: "var(--user-ink, #1d1d21)",
};

const labelStyle = { fontSize: "13px", fontWeight: 550, color: "var(--user-ink, #1d1d21)" };
const hintStyle = { fontSize: "12px", lineHeight: "18px", color: "var(--user-ink-muted, #686872)" };
const inputStyle = {
  width: "100%",
  height: "34px",
  padding: "0 10px",
  borderRadius: "8px",
  border: "1px solid var(--user-border-strong, rgba(25,25,30,.17))",
  background: "var(--user-surface, #ffffff)",
  color: "var(--user-ink, #1d1d21)",
  fontSize: "13px",
};
const buttonStyle = {
  height: "34px",
  padding: "0 16px",
  borderRadius: "8px",
  border: "none",
  background: "var(--user-action-bg, #57575b)",
  color: "var(--user-action-foreground, #ffffff)",
  fontSize: "13px",
  fontWeight: 550,
  cursor: "pointer",
};

function createMaasSettingsPanel(host) {
  const React = getReact(host);
  if (!React) return () => null;
  const h = React.createElement;

  return function MaasSettingsPanel(props) {
    const existingChannel = React.useMemo(() => {
      try {
        const channels = host?.channels?.list?.() || [];
        return channels.find((item) => item.id === MAAS_CHANNEL_ID || String(item.baseUrl || "").includes("maas.ovaijisuan.com"));
      } catch {
        return undefined;
      }
    }, []);

    const initialKey =
      props?.config?.apiKey || host?.config?.get?.("apiKey", "") || existingChannel?.apiKey || "";
    const [apiKey, setApiKey] = React.useState(String(initialKey));
    const [busy, setBusy] = React.useState(false);
    const [status, setStatus] = React.useState(
      isMaasChannelReady(existingChannel)
        ? `已连接「${existingChannel.name}」渠道（已启用 ${existingChannel.models?.length || 0} 个模型）`
        : "",
    );
    const [error, setError] = React.useState("");

    const saveAndSync = async () => {
      const trimmed = apiKey.trim();
      const hasSavedKey = Boolean(existingChannel?.apiKey || existingChannel?.hasApiKey);
      if (!trimmed && !hasSavedKey) {
        setError("请填写 MaaS API Key（sk-...）");
        return;
      }
      setBusy(true);
      setError("");
      setStatus("");
      try {
        // 与首次运行门禁同源：读取网关第一方目录（本地后端中转，匿名可取）。
        const response = await fetch("/api/ai/catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseUrl: MAAS_BASE_URL }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || (typeof data?.code === "number" && data.code !== 0)) {
          throw new Error(data?.msg || data?.reason || `读取网关模型目录失败（HTTP ${response.status}）`);
        }
        const mapping = maasProfilesFromCatalog(data?.data?.catalog);
        if (!mapping.profiles.length) throw new Error("网关目录里没有 BeefTV 可用的模型");

        if (trimmed) {
          if (typeof props?.updateConfig === "function") await props.updateConfig({ apiKey: trimmed, baseUrl: MAAS_BASE_URL });
          else if (host?.config?.set) await host.config.set({ apiKey: trimmed, baseUrl: MAAS_BASE_URL });
        }

        const channel = buildMaasModelChannel({
          apiKey: trimmed,
          baseUrl: MAAS_BASE_URL,
          profiles: mapping.profiles,
          existingChannel,
        });
        if (!host?.channels?.upsert) throw new Error("当前宿主版本不支持同步模型渠道");
        await host.channels.upsert(channel);

        setStatus(`已同步 ${channel.models.length} 个模型到「模型服务」`);
        host?.ui?.notify?.("MaaS 渠道与模型已同步至模型服务", "success");
      } catch (err) {
        setError(err instanceof Error ? err.message : "校验 MaaS Key 失败");
      } finally {
        setBusy(false);
      }
    };

    return h(
      "div",
      { style: panelStyle },
      h("p", { style: hintStyle }, "MaaS 网关地址固定为 https://maas.ovaijisuan.com/v1，只需填写该网关签发的密钥。"),
      h(
        "label",
        { style: labelStyle, htmlFor: "maas-api-key" },
        "MaaS API Key",
      ),
      h("input", {
        id: "maas-api-key",
        type: "password",
        autoComplete: "off",
        spellCheck: false,
        placeholder: "sk-...",
        value: apiKey,
        disabled: busy,
        onChange: (event) => setApiKey(event.target.value),
        style: inputStyle,
      }),
      error ? h("p", { style: { ...hintStyle, color: "var(--color-error, #dc2626)" } }, error) : null,
      status ? h("p", { style: hintStyle }, status) : null,
      h(
        "div",
        { style: { display: "flex", justifyContent: "flex-end", gap: "10px" } },
        h(
          "button",
          { type: "button", disabled: busy, onClick: saveAndSync, style: buttonStyle },
          busy ? "校验并同步中..." : "校验并同步到模型服务",
        ),
      ),
    );
  };
}

export function activate(host) {
  const SettingsPanel = createMaasSettingsPanel(host);
  const dispose = host.contribute("app.settings", {
    id: "maas-settings",
    label: "MaaS 算力网关",
    component: SettingsPanel,
  });
  return () => {
    if (typeof dispose === "function") dispose();
  };
}
