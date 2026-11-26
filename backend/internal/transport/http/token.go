package httptransport

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
)

const LaunchTokenHeader = "X-Desktop-Token"

type desktopAuthenticatedKey struct{}

// DesktopAuthenticated can only be set after the launch credential was verified.
func DesktopAuthenticated(r *http.Request) bool {
	trusted, _ := r.Context().Value(desktopAuthenticatedKey{}).(bool)
	return trusted
}

func NewLaunchToken() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw), nil
}

func RequireLaunchToken(token string) func(http.Handler) http.Handler {
	want := []byte(token)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 插件客户端目录是 ESM 模块，浏览器的 import() **不能带自定义头**，
			// 要求启动令牌会让所有带 client 的插件加载失败（"Importing a module
			// script failed"）。这些是随包的开源插件代码，不含密钥。
			if r.Method == http.MethodOptions || r.URL.Path == "/api/health/live" || isPluginClientAsset(r) {
				next.ServeHTTP(w, r)
				return
			}
			got := []byte(r.Header.Get(LaunchTokenHeader))
			if len(want) == 0 || len(got) != len(want) || subtle.ConstantTimeCompare(got, want) != 1 {
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.WriteHeader(http.StatusForbidden)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"code":   http.StatusForbidden,
					"data":   nil,
					"msg":    "桌面运行时授权无效",
					"reason": "desktop_token_required",
				})
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), desktopAuthenticatedKey{}, true)))
		})
	}
}

// isPluginClientAsset 判断是不是插件的客户端静态文件（/api/plugins/<id>/files/...）。
func isPluginClientAsset(r *http.Request) bool {
	if r.Method != http.MethodGet {
		return false
	}
	path := r.URL.Path
	if !strings.HasPrefix(path, "/api/plugins/") || !strings.Contains(path, "/files/") {
		return false
	}
	return true
}
