# MaaS 算力网关接口说明

## 插件身份

- 插件包名：`beeftv-plugin-maas`
- 渠道 ID：`maas`，渠道名：`MaaS 算力网关`
- 固定 Base URL：`https://maas.ovaijisuan.com/v1`（new-api 部署）
- 鉴权方式：`Authorization: Bearer <apiKey>`
- 配置项：仅 `apiKey`（`baseUrl` 有默认值，通常不需要改）

## 密钥校验与目录同步

宿主通过 `POST /api/ai/models`（`baseUrl` + `apiKey` + `apiFormat: "openai"`）访问网关
`GET /v1/models`：返回 200 且带模型即视为密钥有效；401 会以 `reason` 透传网关的真实报错。

模型能力来自网关 `GET /api/pricing` 的 `supported_endpoint_types`：

| endpoint type | BeefTV 能力 | Provider ID |
| --- | --- | --- |
| `openai` | text | `maas-chat` |
| `image-generation` | image | `maas-image` |
| `openai-video` | video | `maas-video` |
| `audio-speech` | audio | `maas-audio` |

## 贡献的多模态协议 Provider

| Provider ID | 能力 | 创建接口 | 轮询接口 |
| --- | --- | --- | --- |
| `maas-chat` | `text` | `POST /v1/chat/completions` | 同步返回 |
| `maas-image` | `image` | `POST /v1/images/generations` | 同步返回 |
| `maas-video` | `video` | `POST /v1/videos` | `GET /v1/videos/{{taskId}}` |
| `maas-audio` | `audio` | `POST /v1/audio/speech` | 同步返回 |

new-api 把音乐生成（`ace-step`、`minimax-music3`、`music2`）与超分（`relayvsr`）也挂在
`/v1/videos` 任务接口下，插件暂按 `maas-video` 登记；语音合成（`tts2`）登记在 `maas-audio`。
