package generation

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestGatewayModelCatalogURL(t *testing.T) {
	got, err := GatewayModelCatalogURL("https://maas.example.com/v1")
	if err != nil || got != "https://maas.example.com/api/v1/models/catalog" {
		t.Fatalf("url = %q, err = %v", got, err)
	}
	if _, err := GatewayModelCatalogURL("ftp://x"); err == nil {
		t.Fatal("非 http(s) 地址应被拒绝")
	}
	if _, err := GatewayModelCatalogURL("https://user:pw@host/v1"); err == nil {
		t.Fatal("带用户信息的地址应被拒绝")
	}
}

func TestFetchGatewayModelCatalog(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != GatewayModelCatalogPath {
			t.Errorf("path = %q", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"version":"v1","text":[{"platform_model":"GLM-5"}],"image":[],"video":[],"audio":[],"defaults":{"chat":"GLM-5"}}`))
	}))
	defer server.Close()

	catalog, err := FetchGatewayModelCatalog(context.Background(), server.URL+"/v1")
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if catalog.Version != "v1" || len(catalog.Payload) == 0 {
		t.Fatalf("unexpected catalog: %+v", catalog)
	}

	dir := t.TempDir()
	if err := WriteGatewayModelCatalogCache(dir, catalog); err != nil {
		t.Fatalf("write cache: %v", err)
	}
	info, err := os.Stat(dir + "/" + GatewayModelCatalogCacheFile)
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("cache file mode = %v, err = %v", info.Mode().Perm(), err)
	}
	cached, found := ReadGatewayModelCatalogCache(dir)
	if !found || cached.Version != "v1" {
		t.Fatalf("cached = %+v, found = %v", cached, found)
	}
}

func TestFetchGatewayModelCatalogRejectsBadPayload(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"version":"v1"}`))
	}))
	defer server.Close()
	if _, err := FetchGatewayModelCatalog(context.Background(), server.URL+"/v1"); err == nil {
		t.Fatal("缺少 text 的目录应被拒绝")
	}
}
