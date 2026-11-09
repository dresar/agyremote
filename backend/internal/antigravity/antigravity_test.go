package antigravity

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestHandleVersionFallback(t *testing.T) {
	h := NewHandler("/path/to/nonexistent/agy")
	req := httptest.NewRequest(http.MethodGet, "/api/antigravity/version", nil)
	rec := httptest.NewRecorder()

	h.HandleVersion(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var res VersionResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}

	if res.Version != "1.4.9" {
		t.Fatalf("expected fallback 1.4.9, got %s", res.Version)
	}
	if res.BinPath != "/path/to/nonexistent/agy" {
		t.Fatalf("expected /path/to/nonexistent/agy, got %s", res.BinPath)
	}
}

func TestHandleUpdateFallback(t *testing.T) {
	h := NewHandler("/path/to/nonexistent/agy")
	req := httptest.NewRequest(http.MethodPost, "/api/antigravity/update", nil)
	rec := httptest.NewRecorder()

	h.HandleUpdate(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var res UpdateResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}

	if res.Success != false {
		t.Fatalf("expected success=false for nonexistent bin, got %v", res.Success)
	}
	if res.Version != "1.4.9" {
		t.Fatalf("expected fallback 1.4.9, got %s", res.Version)
	}
	if res.Output == "" {
		t.Fatal("expected non-empty error output")
	}
}

func TestHandleChangelogFallback(t *testing.T) {
	h := NewHandler("/path/to/nonexistent/agy")
	req := httptest.NewRequest(http.MethodGet, "/api/antigravity/changelog", nil)
	rec := httptest.NewRecorder()

	h.HandleChangelog(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var res ChangelogResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}

	if res.Changelog != "Changelog tidak tersedia saat ini" {
		t.Fatalf("expected fallback changelog, got %s", res.Changelog)
	}
}

func TestRealBinaryEndpoints(t *testing.T) {
	realBin := "/opt/data/home/.local/bin/agy"
	if _, err := os.Stat(realBin); os.IsNotExist(err) {
		t.Skip("real agy binary not installed")
	}

	h := NewHandler(realBin)

	reqVer := httptest.NewRequest(http.MethodGet, "/api/antigravity/version", nil)
	recVer := httptest.NewRecorder()
	h.HandleVersion(recVer, reqVer)
	if recVer.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recVer.Code)
	}
	var resVer VersionResponse
	if err := json.Unmarshal(recVer.Body.Bytes(), &resVer); err != nil {
		t.Fatal(err)
	}
	if resVer.Version == "" {
		t.Fatal("expected non-empty version")
	}
	if resVer.BinPath != realBin {
		t.Fatalf("expected %s, got %s", realBin, resVer.BinPath)
	}

	reqCl := httptest.NewRequest(http.MethodGet, "/api/antigravity/changelog", nil)
	recCl := httptest.NewRecorder()
	h.HandleChangelog(recCl, reqCl)
	if recCl.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recCl.Code)
	}
	var resCl ChangelogResponse
	if err := json.Unmarshal(recCl.Body.Bytes(), &resCl); err != nil {
		t.Fatal(err)
	}
	if resCl.Changelog == "" {
		t.Fatal("expected non-empty changelog")
	}
}

func TestRegisterRoutes(t *testing.T) {
	mux := http.NewServeMux()
	RegisterRoutes(mux, "/nonexistent/path/agy")

	reqVer := httptest.NewRequest(http.MethodGet, "/api/antigravity/version", nil)
	recVer := httptest.NewRecorder()
	mux.ServeHTTP(recVer, reqVer)
	if recVer.Code != http.StatusOK {
		t.Fatalf("expected 200 from registered /api/antigravity/version, got %d", recVer.Code)
	}

	reqCl := httptest.NewRequest(http.MethodGet, "/api/antigravity/changelog", nil)
	recCl := httptest.NewRecorder()
	mux.ServeHTTP(recCl, reqCl)
	if recCl.Code != http.StatusOK {
		t.Fatalf("expected 200 from registered /api/antigravity/changelog, got %d", recCl.Code)
	}

	reqUp := httptest.NewRequest(http.MethodPost, "/api/antigravity/update", nil)
	recUp := httptest.NewRecorder()
	mux.ServeHTTP(recUp, reqUp)
	if recUp.Code != http.StatusOK {
		t.Fatalf("expected 200 from registered /api/antigravity/update, got %d", recUp.Code)
	}
}
