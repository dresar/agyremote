package static

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestServeRootAndIndex(t *testing.T) {
	h := NewHandler("")

	reqRoot := httptest.NewRequest(http.MethodGet, "/", nil)
	recRoot := httptest.NewRecorder()
	h.ServeHTTP(recRoot, reqRoot)

	if recRoot.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recRoot.Code)
	}
	if ct := recRoot.Header().Get("Content-Type"); !strings.Contains(ct, "text/html") {
		t.Fatalf("expected text/html, got %s", ct)
	}
	if cc := recRoot.Header().Get("Cache-Control"); !strings.Contains(cc, "no-cache") {
		t.Fatalf("expected no-cache, got %s", cc)
	}

	reqIndex := httptest.NewRequest(http.MethodGet, "/index.html", nil)
	recIndex := httptest.NewRecorder()
	h.ServeHTTP(recIndex, reqIndex)
	if recIndex.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recIndex.Code)
	}

	reqDistIndex := httptest.NewRequest(http.MethodGet, "/dist/index.html", nil)
	recDistIndex := httptest.NewRecorder()
	h.ServeHTTP(recDistIndex, reqDistIndex)
	if recDistIndex.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recDistIndex.Code)
	}
}

func TestServeServiceWorker(t *testing.T) {
	h := NewHandler("")

	req := httptest.NewRequest(http.MethodGet, "/sw.js", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "text/javascript") {
		t.Fatalf("expected text/javascript, got %s", ct)
	}
	if cc := rec.Header().Get("Cache-Control"); !strings.Contains(cc, "no-cache") {
		t.Fatalf("expected no-cache, got %s", cc)
	}
}

func TestServeManifest(t *testing.T) {
	h := NewHandler("")

	req := httptest.NewRequest(http.MethodGet, "/manifest.json", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "application/json") {
		t.Fatalf("expected application/json, got %s", ct)
	}
}

func TestServeAPK(t *testing.T) {
	h := NewHandler("")

	endpoints := []string{"/agyremote.apk", "/dist/agyremote.apk"}
	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 for %s, got %d", ep, rec.Code)
		}
		if ct := rec.Header().Get("Content-Type"); ct != "application/vnd.android.package-archive" {
			t.Fatalf("expected application/vnd.android.package-archive, got %s", ct)
		}
		if cd := rec.Header().Get("Content-Disposition"); !strings.Contains(cd, `filename="agyremote.apk"`) {
			t.Fatalf("expected Content-Disposition attachment, got %s", cd)
		}
	}
}

func TestSPAFallback(t *testing.T) {
	h := NewHandler("")

	req := httptest.NewRequest(http.MethodGet, "/overview", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "text/html") {
		t.Fatalf("expected text/html, got %s", ct)
	}
	if cc := rec.Header().Get("Cache-Control"); !strings.Contains(cc, "no-cache") {
		t.Fatalf("expected no-cache, got %s", cc)
	}
}

func TestUnmatchedAPIRoute(t *testing.T) {
	h := NewHandler("")

	req := httptest.NewRequest(http.MethodGet, "/api/unknown_subpath", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "application/json") {
		t.Fatalf("expected application/json, got %s", ct)
	}
	if !strings.Contains(rec.Body.String(), "Not Found") {
		t.Fatalf("expected Not Found, got %s", rec.Body.String())
	}
}
