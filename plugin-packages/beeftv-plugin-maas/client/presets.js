// MaaS 算力网关（maas.ovaijisuan.com，new-api 部署）渠道常量与目录映射。
// 模型来源是网关第一方目录 `GET /api/v1/models/catalog`（由 Hilo 目录配置驱动）。

export const MAAS_BASE_URL = "https://maas.ovaijisuan.com/v1";
export const MAAS_ORIGIN = "https://maas.ovaijisuan.com";
export const MAAS_CHANNEL_ID = "maas";
export const MAAS_CHANNEL_NAME = "MaaS 算力网关";
export const MAAS_PROVIDER_CHAT = "chat-completion";
export const MAAS_PROVIDER_IMAGE = "maas-image";
export const MAAS_PROVIDER_VIDEO = "maas-video";

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
export function maasProfilesFromCatalog(payload) {
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
export function buildMaasModelChannel({ apiKey, baseUrl, profiles, existingChannel } = {}) {
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

export function isMaasChannelReady(channel) {
  if (!channel) return false;
  return Boolean(channel.apiKey || channel.hasApiKey) && Array.isArray(channel.models) && channel.models.length > 0;
}
