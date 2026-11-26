package modelcatalog

import (
	"strings"

	"infinite-canvas/backend/internal/assistant"
)

// 审片发送的媒体类型 → 需要的输入模态。
const (
	mediaReviewModeVideo = "video"
	mediaReviewModeAudio = "audio"
)

// A review model uses the same channel and credentials as other selections,
// but its verified media adapter does not grant it the main assistant role.
//
// 不再写死具体模型名：只要该模型是对话能力 + chat-completion 协议即可；
// 若能力目录声明了输入模态，则必须支持审片要送的模态（视频/音频）。
func ResolveMediaReviewProvider(snapshot AssistantConfigSnapshot, lookup ManagedCredentialLookup) (assistant.Provider, string) {
	return resolveMediaReviewProviderForMode(snapshot, lookup, mediaReviewModeVideo)
}

// ResolveMediaReviewProviderForMimeType 由片段 MIME 推导所需模态后再校验。
func ResolveMediaReviewProviderForMimeType(snapshot AssistantConfigSnapshot, lookup ManagedCredentialLookup, mimeType string) (assistant.Provider, string) {
	mode := mediaReviewModeVideo
	if strings.EqualFold(strings.TrimSpace(mimeType), "audio/wav") {
		mode = mediaReviewModeAudio
	}
	return resolveMediaReviewProviderForMode(snapshot, lookup, mode)
}

func resolveMediaReviewProviderForMode(snapshot AssistantConfigSnapshot, lookup ManagedCredentialLookup, mode string) (assistant.Provider, string) {
	selection := strings.TrimSpace(snapshot.MediaReviewModel)
	channelID, modelID := SplitModelKey(selection)
	channel, found := FindAssistantChannel(snapshot.Channels, channelID, modelID)
	if selection == "" || !found {
		return assistant.Provider{}, AssistantReasonModelNotConfigured
	}
	resolved := assistantModelAlias(channel, modelID)
	protocol, ok := ChannelModelProtocol(channel, resolved)
	if !ok || protocol != "chat-completion" {
		return assistant.Provider{}, AssistantReasonProtocolUnsupported
	}
	if declared := ChannelModelModalities(channel, resolved); len(declared) > 0 {
		required := mediaReviewModeVideo
		if mode == mediaReviewModeAudio {
			required = mediaReviewModeAudio
		}
		if !containsModality(declared, required) {
			return assistant.Provider{}, AssistantReasonProtocolUnsupported
		}
	}
	return resolveChannelModel(snapshot, selection, lookup, []string{resolved})
}

// ChannelModelModalities 返回该模型声明的输入模态；未声明时返回空切片。
func ChannelModelModalities(channel AssistantChannel, modelID string) []string {
	for _, profile := range channel.ModelProfiles {
		if profile.Model == modelID && len(profile.Modalities) > 0 {
			return profile.Modalities
		}
	}
	return nil
}

func containsModality(modalities []string, want string) bool {
	for _, modality := range modalities {
		if strings.EqualFold(strings.TrimSpace(modality), want) {
			return true
		}
	}
	return false
}
