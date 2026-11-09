package auth

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"os"
)

var (
	bearerPattern = regexp.MustCompile(`(?i)^Bearer\s+(.+)$`)
	knownPrefixes = []string{
		"/api/workers",
		"/api/system",
		"/api/processes",
		"/api/antigravity",
		"/api/prompt",
		"/api/file",
		"/api/ai",
		"/api/project",
		"/api/skills",
	}
)

type Middleware struct {
	allowedKeys map[string]struct{}
}

func NewMiddleware(adminKey string) *Middleware {
	keys := map[string]struct{}{}
	if adminKey != "" {
		keys[adminKey] = struct{}{}
	}
	// Key tambahan via env (JANGAN hardcode di source publik):
	//   ADMIN_AUTH_KEYS="key1,key2,..." di .env
	for _, k := range strings.Split(os.Getenv("ADMIN_AUTH_KEYS"), ",") {
		if k != "" {
			keys[k] = struct{}{}
		}
	}
	return &Middleware{allowedKeys: keys}
}

func (m *Middleware) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		if !strings.HasPrefix(path, "/api/") || path == "/api/health" {
			next.ServeHTTP(w, r)
			return
		}

		isKnownProtectedRoute := false
		for _, prefix := range knownPrefixes {
			if path == prefix || strings.HasPrefix(path, prefix+"/") {
				isKnownProtectedRoute = true
				break
			}
		}

		if !isKnownProtectedRoute {
			WriteError(w, http.StatusNotFound, "Not Found")
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			WriteError(w, http.StatusUnauthorized, "Unauthorized: Missing Authorization header")
			return
		}

		if len(authHeader) >= 4096 {
			WriteError(w, http.StatusUnauthorized, "Unauthorized: Token payload too large")
			return
		}

		match := bearerPattern.FindStringSubmatch(authHeader)
		if len(match) < 2 {
			WriteError(w, http.StatusUnauthorized, "Unauthorized: Invalid authentication scheme")
			return
		}

		token := strings.TrimSpace(match[1])
		if token == "" {
			WriteError(w, http.StatusUnauthorized, "Unauthorized: Empty token")
			return
		}

		if _, ok := m.allowedKeys[token]; !ok {
			WriteError(w, http.StatusUnauthorized, "Unauthorized: Invalid Bearer token")
			return
		}

		next.ServeHTTP(w, r)
	})
}

func RequireAuth(next http.Handler) http.Handler {
	return NewMiddleware(os.Getenv("ADMIN_AUTH_KEY")).Wrap(next)
}

func WriteJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, map[string]string{
		"error": message,
	})
}
