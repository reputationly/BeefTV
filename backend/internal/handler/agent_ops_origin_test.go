package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	httptransport "infinite-canvas/backend/internal/transport/http"
)

func TestIsLoopbackRequestOriginRules(t *testing.T) {
	cases := []struct {
		name    string
		host    string
		remote  string
		origin  string
		allowed string
		want    bool
	}{
		{"no origin", "127.0.0.1:18090", "127.0.0.1:5555", "", "", true},
		{"same origin", "127.0.0.1:18090", "127.0.0.1:5555", "http://127.0.0.1:18090", "", true},
		{"other loopback port", "127.0.0.1:18090", "127.0.0.1:5555", "http://127.0.0.1:9999", "", false},
		{"fake localhost subdomain", "127.0.0.1:18090", "127.0.0.1:5555", "http://localhost.attacker.example", "", false},
		{"allowed product origin", "127.0.0.1:18090", "127.0.0.1:5555", "https://app.beeftv.local", "https://app.beeftv.local", true},
		{"non loopback remote", "127.0.0.1:18090", "10.0.0.9:5555", "", "", false},
		{"non loopback host", "evil.example:80", "127.0.0.1:5555", "", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("BEEFTV_ALLOWED_ORIGINS", tc.allowed)
			req := httptest.NewRequest(http.MethodGet, "http://"+tc.host+"/api/ops", nil)
			req.Host = tc.host
			req.RemoteAddr = tc.remote
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			if got := isLoopbackRequest(req); got != tc.want {
				t.Fatalf("isLoopbackRequest=%v want %v", got, tc.want)
			}
		})
	}
}

func TestWailsOriginRequiresAuthenticatedDesktopTransport(t *testing.T) {
	for _, origin := range []string{"wails://wails", "http://wails.localhost", "https://wails.localhost", "wails://wails.localhost:34115", "wails://attacker", "https://evil.example", "https://wails.localhost.evil.example"} {
		for _, token := range []string{"", "wrong", "test-desktop-token"} {
			req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:54321/api/assistant/ui-session", nil)
			req.RemoteAddr = "127.0.0.1:12345"
			req.Header.Set("Origin", origin)
			req.Header.Set(httptransport.LaunchTokenHeader, token)
			if isLoopbackRequest(req) {
				t.Fatal("unverified header must not authorize Wails origin")
			}
			accepted := false
			httptransport.RequireLaunchToken("test-desktop-token")(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
				accepted = isLoopbackRequest(r)
			})).ServeHTTP(httptest.NewRecorder(), req)
			want := token == "test-desktop-token" && isWailsOrigin(origin)
			if accepted != want {
				t.Fatalf("origin=%s token-present=%v accepted=%v want=%v", origin, token != "", accepted, want)
			}
		}
	}
}

// 桌面壳（启动令牌已验）从另一个本机端口加载前端时，loopback 端口不同也应放行。
func TestDesktopShellAcceptsLoopbackOriginOnAnotherPort(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:8080/api/assistant/ui-session", nil)
	req.Host = "127.0.0.1:8080"
	req.RemoteAddr = "127.0.0.1:54321"
	req.Header.Set("Origin", "http://127.0.0.1:3010")
	req.Header.Set(httptransport.LaunchTokenHeader, "test-desktop-token")
	accepted := false
	httptransport.RequireLaunchToken("test-desktop-token")(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		accepted = isLoopbackRequest(r)
	})).ServeHTTP(httptest.NewRecorder(), req)
	if !accepted {
		t.Fatal("桌面壳从另一本机端口发起的请求应被接受")
	}

	// 没有启动令牌时仍然拒绝：任意 loopback 端口不能凭空算同源。
	plain := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:8080/api/assistant/ui-session", nil)
	plain.Host = "127.0.0.1:8080"
	plain.RemoteAddr = "127.0.0.1:54321"
	plain.Header.Set("Origin", "http://127.0.0.1:3010")
	if isLoopbackRequest(plain) {
		t.Fatal("无令牌的跨端口 loopback 请求不应被接受")
	}
	// 非 loopback 的 Origin 即使带令牌也不能放行。
	remote := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:8080/api/assistant/ui-session", nil)
	remote.Host = "127.0.0.1:8080"
	remote.RemoteAddr = "127.0.0.1:54321"
	remote.Header.Set("Origin", "https://evil.example")
	remote.Header.Set(httptransport.LaunchTokenHeader, "test-desktop-token")
	rejected := true
	httptransport.RequireLaunchToken("test-desktop-token")(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		rejected = !isLoopbackRequest(r)
	})).ServeHTTP(httptest.NewRecorder(), remote)
	if !rejected {
		t.Fatal("非本机 Origin 不应放行")
	}
}
