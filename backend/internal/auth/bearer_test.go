package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newTestHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"success"}`))
	})
}

func TestBearerAuthExemptions(t *testing.T) {
	mw := NewMiddleware("test-admin-key")
	handler := mw.Wrap(newTestHandler())

	req := httptest.NewRequest(http.MethodGet, "/overview", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for non-API route, got %d", rec.Code)
	}

	reqHealth := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	recHealth := httptest.NewRecorder()
	handler.ServeHTTP(recHealth, reqHealth)
	if recHealth.Code != http.StatusOK {
		t.Fatalf("expected 200 for /api/health without auth, got %d", recHealth.Code)
	}
}

func TestUnknownAPIRouteGatingBeforeAuth(t *testing.T) {
	mw := NewMiddleware("test-admin-key")
	handler := mw.Wrap(newTestHandler())

	req := httptest.NewRequest(http.MethodGet, "/api/v99/unknown", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown /api/ route without auth, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"error":"Not Found"`) {
		t.Fatalf("expected Not Found error message, got %s", rec.Body.String())
	}
}

func TestAuthMissingHeader(t *testing.T) {
	mw := NewMiddleware("test-admin-key")
	handler := mw.Wrap(newTestHandler())

	req := httptest.NewRequest(http.MethodGet, "/api/workers", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Missing Authorization header") {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}

func TestAuthPayloadTooLarge(t *testing.T) {
	mw := NewMiddleware("test-admin-key")
	handler := mw.Wrap(newTestHandler())

	longHeader := "Bearer " + strings.Repeat("A", 4096)
	req := httptest.NewRequest(http.MethodGet, "/api/workers", nil)
	req.Header.Set("Authorization", longHeader)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Token payload too large") {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}

func TestAuthInvalidScheme(t *testing.T) {
	mw := NewMiddleware("test-admin-key")
	handler := mw.Wrap(newTestHandler())

	req := httptest.NewRequest(http.MethodGet, "/api/workers", nil)
	req.Header.Set("Authorization", "Basic dXNlcjpwYXNz")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Invalid authentication scheme") {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}

func TestAuthEmptyToken(t *testing.T) {
	mw := NewMiddleware("test-admin-key")
	handler := mw.Wrap(newTestHandler())

	req := httptest.NewRequest(http.MethodGet, "/api/workers", nil)
	req.Header.Set("Authorization", "Bearer    ")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestAuthInvalidToken(t *testing.T) {
	mw := NewMiddleware("test-admin-key")
	handler := mw.Wrap(newTestHandler())

	req := httptest.NewRequest(http.MethodGet, "/api/workers", nil)
	req.Header.Set("Authorization", "Bearer wrong-secret-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Invalid Bearer token") {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}

func TestAuthValidTokens(t *testing.T) {
	t.Setenv("ADMIN_AUTH_KEYS", "env-key-a,env-key-b")
	mw := NewMiddleware("custom-admin-key")
	handler := mw.Wrap(newTestHandler())

	validTokens := []string{
		"custom-admin-key",
		"env-key-a",
		"env-key-b",
	}

	for _, token := range validTokens {
		req := httptest.NewRequest(http.MethodGet, "/api/workers", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 for token %s, got %d", token, rec.Code)
		}
	}

	reqLower := httptest.NewRequest(http.MethodGet, "/api/workers", nil)
	reqLower.Header.Set("Authorization", "bearer custom-admin-key")
	recLower := httptest.NewRecorder()
	handler.ServeHTTP(recLower, reqLower)
	if recLower.Code != http.StatusOK {
		t.Fatalf("expected 200 for lowercase bearer scheme, got %d", recLower.Code)
	}
}
