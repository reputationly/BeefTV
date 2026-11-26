# MaaS 算力网关 · BeefTV 内置渠道插件

只填一个 MaaS 网关密钥（`sk-...`），即可把网关上的文本、图像、视频与语音模型同步到 BeefTV「设置 → 模型服务」。

- 网关地址固定：`https://maas.ovaijisuan.com/v1`（new-api 部署，OpenAI 兼容）
- 渠道 ID：`maas`，渠道名：`MaaS 算力网关`
- 鉴权：`Authorization: Bearer <apiKey>`；密钥只保存在本机工作区配置里
- 模型 → 能力/协议的映射见 [`client/presets.js`](../client/presets.js)，接口细节见 [docs/interface.md](docs/interface.md)

## 授权范围

`generation.run`、`media.read`、`ui.slot`、`settings.write`（`settings.write` 用于调用宿主
`POST /api/ai/models` 校验密钥并同步模型目录）。
