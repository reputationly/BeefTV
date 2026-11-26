# MaaS 视频接口字段

- Provider ID：`maas-video`；能力：`video`；异步任务。
- 创建：`POST /v1/videos`（JSON）；轮询：`GET /v1/videos/{id}`；取消：`DELETE /v1/videos/{id}`。

| 统一字段 | 上游字段 |
| --- | --- |
| `model` | `model`（平台模型名，如 `minimax-h3-2k`） |
| `prompt` | `prompt` |
| `images` | `images`（首帧/尾帧/参考图，顺序即业务顺序） |
| `duration` | `duration`（整数秒；续写时为最终总时长） |
| `resolution` | `metadata.resolution`（`768P` / `2K`） |
| `generateAudio` | `metadata.generate_audio` |
| `providerOptions.maas.imageMode` | `metadata.image_mode`（`first-last-frame` / `text-to-video` / `video-extension` / `reference`） |

轮询产物在 `metadata.url`；状态：`queued` / `in_progress` / `completed` / `failed` / `cancelled`。
