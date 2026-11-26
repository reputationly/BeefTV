package generation

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"infinite-canvas/backend/internal/kernel"
	"infinite-canvas/backend/internal/modelcatalog"
	"infinite-canvas/backend/internal/outbound"
)

// GatewayModelCatalogPath 是第一方模型目录（new-api 按 Hilo 目录配置下发）。
// 与 `/api/v1/models/config` 同一份配置，区别是带 `platform_model`。
const GatewayModelCatalogPath = "/api/v1/models/catalog"

// GatewayModelCatalogCacheFile 本机缓存文件名。
const GatewayModelCatalogCacheFile = "maas-model-catalog.json"

// GatewayModelCatalog 一份目录快照：version 由服务端按内容哈希给出。
type GatewayModelCatalog struct {
	Version string          `json:"version"`
	Payload json.RawMessage `json:"payload"`
}

// GatewayModelCatalogURL 由渠道地址推导目录地址：取 origin 再拼固定路径。
func GatewayModelCatalogURL(baseURL string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.User != nil {
		return "", errors.New("模型服务地址无效")
	}
	parsed.Path = GatewayModelCatalogPath
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return parsed.String(), nil
}

// FetchGatewayModelCatalog 读取第一方目录。目录不含密钥信息，匿名请求即可。
func FetchGatewayModelCatalog(ctx context.Context, baseURL string) (GatewayModelCatalog, error) {
	target, err := GatewayModelCatalogURL(baseURL)
	if err != nil {
		return GatewayModelCatalog{}, kernel.BadAuthRequest(err.Error())
	}
	if _, err := outbound.ValidateOutboundURL(target); err != nil {
		return GatewayModelCatalog{}, CatalogError(http.StatusBadRequest, "catalog_address_invalid", err.Error(), err)
	}
	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return GatewayModelCatalog{}, kernel.BadAuthRequest("模型服务地址无效")
	}
	request.Header.Set("Accept", "application/json")
	data, _, err := DoBinary(request)
	if err != nil {
		var httpErr HTTPError
		if errors.As(err, &httpErr) {
			return GatewayModelCatalog{}, modelcatalog.CatalogFetchError{StatusCode: httpErr.StatusCode, Cause: err}
		}
		return GatewayModelCatalog{}, modelcatalog.CatalogFetchError{Cause: err}
	}
	var envelope struct {
		Version string          `json:"version"`
		Text    json.RawMessage `json:"text"`
	}
	if err := json.Unmarshal(data, &envelope); err != nil || len(envelope.Text) == 0 {
		return GatewayModelCatalog{}, CatalogError(http.StatusBadGateway, "catalog_invalid", "模型目录格式无法解析", err)
	}
	return GatewayModelCatalog{Version: envelope.Version, Payload: json.RawMessage(data)}, nil
}

// ReadGatewayModelCatalogCache 读上一次成功的目录快照。
func ReadGatewayModelCatalogCache(dataDir string) (GatewayModelCatalog, bool) {
	if strings.TrimSpace(dataDir) == "" {
		return GatewayModelCatalog{}, false
	}
	raw, err := os.ReadFile(filepath.Join(dataDir, GatewayModelCatalogCacheFile))
	if err != nil {
		return GatewayModelCatalog{}, false
	}
	var cached GatewayModelCatalog
	if json.Unmarshal(raw, &cached) != nil || len(cached.Payload) == 0 {
		return GatewayModelCatalog{}, false
	}
	return cached, true
}

// WriteGatewayModelCatalogCache 落盘（0600）。失败只影响缓存。
func WriteGatewayModelCatalogCache(dataDir string, catalog GatewayModelCatalog) error {
	if strings.TrimSpace(dataDir) == "" || len(catalog.Payload) == 0 {
		return errors.New("目录缓存写入缺少数据目录或内容")
	}
	encoded, err := json.Marshal(catalog)
	if err != nil {
		return err
	}
	target := filepath.Join(dataDir, GatewayModelCatalogCacheFile)
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(target), ".maas-catalog-*")
	if err != nil {
		return err
	}
	name := tmp.Name()
	defer os.Remove(name)
	if err := tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(encoded); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(name, target)
}
