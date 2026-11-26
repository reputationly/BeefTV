package bootstrap

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestDesktopCORSAllowsModelRelayPreflight(t *testing.T) {
	router := gin.New()
	router.Use(desktopCORSMiddleware())
	forwarded := false
	router.POST("/api/ai/custom", func(c *gin.Context) {
		forwarded = true
		c.Status(http.StatusNoContent)
	})
	for _, origin := range []string{"wails://wails", "http://wails.localhost"} {
		t.Run(origin, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodOptions, "/api/ai/custom", nil)
			request.Header.Set("Origin", origin)
			requested := []string{"authorization", "content-type", "traceparent", "x-canvas-trace-id", "x-desktop-token", "x-beeftv-observer-mode", "x-canvas-upstream-url", "x-canvas-upstream-format", "x-canvas-upstream-base-url", "x-canvas-upstream-headers"}
			request.Header.Set("Access-Control-Request-Method", "POST")
			request.Header.Set("Access-Control-Request-Headers", strings.Join(requested, ","))
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != http.StatusNoContent || forwarded {
				t.Fatalf("preflight must finish without invoking the relay: status=%d forwarded=%v", response.Code, forwarded)
			}
			if response.Header().Get("Access-Control-Allow-Origin") != origin || response.Header().Get("Access-Control-Allow-Credentials") != "true" {
				t.Fatal("desktop origin and credential policy were not retained")
			}
			allowed := map[string]bool{}
			for _, name := range strings.Split(response.Header().Get("Access-Control-Allow-Headers"), ",") {
				allowed[strings.ToLower(strings.TrimSpace(name))] = true
			}
			for _, name := range requested {
				if !allowed[name] {
					t.Errorf("browser will block model relay header %q", name)
				}
			}
		})
	}
}

func TestDesktopCORSAllowsPrivateNetworkPreflightAndBlocksUntrustedWebOrigins(t *testing.T) {
	router := gin.New()
	router.Use(desktopCORSMiddleware())
	router.GET("/api/workspace", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	pnaReq := httptest.NewRequest(http.MethodOptions, "/api/workspace", nil)
	pnaReq.Header.Set("Origin", "http://wails.localhost")
	pnaReq.Header.Set("Access-Control-Request-Method", "GET")
	pnaReq.Header.Set("Access-Control-Request-Private-Network", "true")
	pnaRes := httptest.NewRecorder()
	router.ServeHTTP(pnaRes, pnaReq)
	if pnaRes.Code != http.StatusNoContent {
		t.Fatalf("private network preflight status = %d, want 204", pnaRes.Code)
	}
	if pnaRes.Header().Get("Access-Control-Allow-Private-Network") != "true" {
		t.Fatalf("missing Access-Control-Allow-Private-Network header: %#v", pnaRes.Header())
	}

	untrustedPreflight := httptest.NewRequest(http.MethodOptions, "/api/workspace", nil)
	untrustedPreflight.Header.Set("Origin", "https://malicious.example.com")
	untrustedPreflight.Header.Set("Access-Control-Request-Method", "GET")
	untrustedRes := httptest.NewRecorder()
	router.ServeHTTP(untrustedRes, untrustedPreflight)
	if untrustedRes.Code != http.StatusForbidden {
		t.Fatalf("untrusted preflight status = %d, want 403", untrustedRes.Code)
	}
	if untrustedRes.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("untrusted origin reflected in CORS header: %q", untrustedRes.Header().Get("Access-Control-Allow-Origin"))
	}
}

// 桌面 WebView 在本机开发形态下的页面来源是 wails://wails.localhost:<port>，
// 正式壳是 wails://wails。两者都必须拿到 CORS 许可，否则前端直连回环端口失败，
// 只能退回窗口内同源通道并关闭任务文本实时流。
func TestDesktopOriginAllowlistCoversWailsShellHosts(t *testing.T) {
	allowed := []string{
		"wails://wails",
		"wails://wails.localhost",
		"wails://wails.localhost:34115",
		"http://wails.localhost:34115",
		"http://127.0.0.1:8080",
		"http://localhost:3000",
	}
	for _, origin := range allowed {
		if !IsAllowedDesktopOrigin(origin) {
			t.Errorf("origin %q must be trusted as a desktop shell origin", origin)
		}
	}
	rejected := []string{
		"wails://evil.localhost:34115",
		"wails://wails.localhost.evil.example",
		"https://malicious.example.com",
		"http://192.168.1.5:8080",
		"wails://user@wails.localhost:34115",
		"wails://wails.localhost:34115/path",
		"",
	}
	for _, origin := range rejected {
		if IsAllowedDesktopOrigin(origin) {
			t.Errorf("origin %q must not be trusted", origin)
		}
	}
}

func TestDesktopCORSReflectsDevelopmentShellOrigin(t *testing.T) {
	router := gin.New()
	router.Use(desktopCORSMiddleware())
	router.GET("/api/health/live", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	const origin = "wails://wails.localhost:34115"
	request := httptest.NewRequest(http.MethodGet, "/api/health/live", nil)
	request.Header.Set("Origin", origin)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", response.Code)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != origin {
		t.Fatalf("Access-Control-Allow-Origin = %q, want %q", got, origin)
	}
}
