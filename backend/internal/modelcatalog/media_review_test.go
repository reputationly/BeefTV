package modelcatalog

import "testing"

// 审片模型不再写死，用例自己给一个名字。
const reviewModel = "wand-vega-vl-1.0-flash"

func TestMediaReviewSelectionUsesItsOwnRoleAndSelectedCredential(t *testing.T) {
	channel := AssistantChannel{ID: "beeftv", Pinned: true, Enabled: true, CredentialRef: "beeftv",
		BaseURL: "https://example.test", Models: []string{reviewModel},
		ModelProfiles: []AssistantModelProfile{{Model: reviewModel, Capability: "text", Protocol: "chat-completion"}}}
	snapshot := AssistantConfigSnapshot{MediaReviewModel: "beeftv::" + reviewModel, Channels: []AssistantChannel{channel}}
	lookups := 0
	lookup := func(id, ref, url string) (string, string, bool) {
		lookups++
		if id != channel.ID || ref != channel.CredentialRef {
			t.Fatal("wrong selected credential")
		}
		return "synthetic-key", "https://selected.example.test/v1", true
	}
	provider, reason := ResolveMediaReviewProvider(snapshot, lookup)
	if reason != "" || provider.Model != reviewModel || provider.APIKey != "synthetic-key" || provider.BaseURL != "https://selected.example.test/v1" || lookups != 1 {
		t.Fatal("selected managed media model did not resolve")
	}
	if _, reason := ResolveAssistantChannelModel(snapshot, snapshot.MediaReviewModel, lookup); reason == "" {
		t.Fatal("media role must not grant main assistant access")
	}
	for _, change := range []func(*AssistantConfigSnapshot){
		func(s *AssistantConfigSnapshot) { s.MediaReviewModel = "" },
		func(s *AssistantConfigSnapshot) { s.MediaReviewModel = "missing::" + reviewModel },
		func(s *AssistantConfigSnapshot) { s.Channels[0].Enabled = false },
		func(s *AssistantConfigSnapshot) { s.Channels[0].Models = []string{"other"} },
		func(s *AssistantConfigSnapshot) {
			s.Channels[0].ModelProfiles = []AssistantModelProfile{{Model: reviewModel, Capability: "text", Protocol: "responses"}}
		},
		func(s *AssistantConfigSnapshot) { s.MediaReviewModel = "beeftv::gpt-6-astra" },
	} {
		s := snapshot
		s.Channels = []AssistantChannel{channel}
		change(&s)
		if got, reason := ResolveMediaReviewProvider(s, lookup); reason == "" || got.APIKey != "" {
			t.Fatal("invalid choice accepted or credential exposed")
		}
	}
	if lookups != 1 {
		t.Fatal("invalid choices must not look up credentials")
	}
	snapshot.Channels[0].ModelAliases = map[string]string{reviewModel: "catalog-wand"}
	snapshot.Channels[0].Models = []string{"catalog-wand"}
	snapshot.Channels[0].ModelProfiles = []AssistantModelProfile{{Model: "catalog-wand", Capability: "text", Protocol: "chat-completion"}}
	provider, reason = ResolveMediaReviewProvider(snapshot, lookup)
	if reason != "" || provider.Model != "catalog-wand" {
		t.Fatal("configured catalog alias was not used")
	}
}

// 审片模型由能力目录的模态决定：视频/音频分别要求对应模态，未声明模态时按兼容放行。
func TestMediaReviewModelIsChosenByModalities(t *testing.T) {
	build := func(modalities []string) (AssistantConfigSnapshot, ManagedCredentialLookup) {
		channel := AssistantChannel{ID: "maas", Enabled: true, BaseURL: "https://maas.test/v1",
			Models:        []string{"qwen3.8-flash"},
			ModelProfiles: []AssistantModelProfile{{Model: "qwen3.8-flash", Capability: "text", Protocol: "chat-completion", Modalities: modalities}}}
		snapshot := AssistantConfigSnapshot{MediaReviewModel: "maas::qwen3.8-flash", Channels: []AssistantChannel{channel}}
		return snapshot, func(string, string, string) (string, string, bool) { return "sk", "https://maas.test/v1", true }
	}

	snapshot, lookup := build([]string{"image", "video"})
	if _, reason := ResolveMediaReviewProviderForMimeType(snapshot, lookup, "video/mp4"); reason != "" {
		t.Fatalf("声明视频模态的模型应可用于视频审片，got %q", reason)
	}
	if _, reason := ResolveMediaReviewProviderForMimeType(snapshot, lookup, "audio/wav"); reason == "" {
		t.Fatal("未声明音频模态的模型不应通过音频审片")
	}

	snapshot, lookup = build([]string{"image"})
	if _, reason := ResolveMediaReviewProviderForMimeType(snapshot, lookup, "video/mp4"); reason == "" {
		t.Fatal("只声明图片模态的模型不应通过视频审片")
	}

	// 旧目录不声明模态：不做模态门禁，保持可用。
	snapshot, lookup = build(nil)
	if _, reason := ResolveMediaReviewProviderForMimeType(snapshot, lookup, "video/mp4"); reason != "" {
		t.Fatalf("未声明模态的模型应保持可用，got %q", reason)
	}
}
