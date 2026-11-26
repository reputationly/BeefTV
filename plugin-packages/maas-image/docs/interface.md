# MaaS 图像接口字段

- Provider ID：`maas-image`；能力：`image`；同步响应。
- 创建：`POST /v1/images/generations`（JSON）。

| 统一字段 | 上游字段 |
| --- | --- |
| `model` | `model` |
| `prompt` | `prompt` |
| `aspectRatio` | `aspect_ratio`（如 `16:9`） |
| `resolution` | `resolution`（`1K` / `2K`） |
| `imageCount` | `n` |

响应：`{ "data": [{ "url": "…" }] }`。

注意：MaaS 只接受 `aspect_ratio` + `resolution`，**不要**发 OpenAI 的 `size`（会被按尺寸阶梯拒绝）。
