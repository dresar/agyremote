package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"agyremote/internal/antigravity"
	"agyremote/internal/auth"
	"agyremote/internal/config"
	"agyremote/internal/static"
	"agyremote/internal/vitals"
	"agyremote/internal/workers"
)

var startTime time.Time

func main() {
	startTime = time.Now()
	cfg := config.LoadConfig(".env")

	mux := http.NewServeMux()
	staticHandler := static.NewHandler(cfg.DistDir)
	antigravityHandler := antigravity.NewHandler(cfg.AgyBinPath)
	vitalsHandler := vitals.NewHandler(cfg.WorkspaceRoot)
	workersHandler := workers.NewHandler(cfg.ProfilesRoot, cfg.AgyBinPath, cfg.WorkspaceRoot)

	mux.HandleFunc("/api/health", handleHealth)

	vitalsHandler.RegisterRoutes(mux)
	antigravityHandler.RegisterRoutes(mux)
	workersHandler.RegisterRoutes(mux)

	mux.HandleFunc("/api", handleAPIFallback)
	mux.HandleFunc("/api/", handleAPIFallback)

	mux.HandleFunc("/agyremote.apk", staticHandler.ServeAPK)
	mux.HandleFunc("/dist/agyremote.apk", staticHandler.ServeAPK)

	mux.Handle("/", staticHandler)

	authMiddleware := auth.NewMiddleware(cfg.AdminAuthKey)

	handler := corsMiddleware(bodyLimitMiddleware(authMiddleware.Wrap(mux)))

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	server := &http.Server{
		Addr:    addr,
		Handler: handler,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	go func() {
		fmt.Printf("agyremote backend daemon listening on http:\x2f\x2f%s:%d\n", cfg.Host, cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			os.Exit(1)
		}
	}()

	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				auth.WriteError(w, http.StatusInternalServerError, "Internal Server Error")
			}
		}()

		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}

		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Forwarded-For, X-Accel-Buffering")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Type, X-Accel-Buffering")

		if !strings.Contains(r.URL.Path, "/prompt") {
			w.Header().Set("Connection", "close")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func bodyLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.ContentLength > 1048576 {
			auth.WriteError(w, http.StatusRequestEntityTooLarge, "Payload too large")
			return
		}

		ct := r.Header.Get("Content-Type")
		isJSON := strings.Contains(ct, "application/json")
		hasBody := r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodPatch || r.Method == http.MethodDelete

		if isJSON && hasBody {
			lr := io.LimitReader(r.Body, 1048576+1)
			buf, err := io.ReadAll(lr)
			if err != nil {
				auth.WriteError(w, http.StatusBadRequest, "Bad Request")
				return
			}

			if len(buf) > 1048576 {
				auth.WriteError(w, http.StatusRequestEntityTooLarge, "Payload too large")
				return
			}

			trimmed := bytes.TrimSpace(buf)
			if len(trimmed) > 0 {
				var js any
				if err := json.Unmarshal(trimmed, &js); err != nil {
					auth.WriteError(w, http.StatusBadRequest, "Malformed JSON payload")
					return
				}
			}

			r.Body = io.NopCloser(bytes.NewReader(buf))
		}

		next.ServeHTTP(w, r)
	})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		auth.WriteError(w, http.StatusMethodNotAllowed, "Method Not Allowed")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	if r.Method == http.MethodHead {
		return
	}

	uptime := int(time.Since(startTime).Seconds())
	payload := map[string]any{
		"status":    "ok",
		"timestamp": time.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
		"version":   "1.0.0",
		"uptime":    uptime,
	}

	_ = json.NewEncoder(w).Encode(payload)
}

func handleAPIFallback(w http.ResponseWriter, r *http.Request) {
	auth.WriteError(w, http.StatusNotFound, "Not Found")
}

func WriteJSON(w http.ResponseWriter, status int, data any) {
	auth.WriteJSON(w, status, data)
}

func WriteError(w http.ResponseWriter, status int, message string) {
	auth.WriteError(w, status, message)
}
