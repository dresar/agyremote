package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"agyremote/internal/antigravity"
	"agyremote/internal/auth"
	"agyremote/internal/config"
	"agyremote/internal/static"
	"agyremote/internal/vitals"
	"agyremote/internal/workers"
)

func TestHealthEndpoint(t *testing.T) {
	startTime = time.Now()

	reqGet := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	recGet := httptest.NewRecorder()
	handleHealth(recGet, reqGet)

	if recGet.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recGet.Code)
	}
	if ct := recGet.Header().Get("Content-Type"); !strings.Contains(ct, "application/json") {
		t.Fatalf("expected application/json, got %s", ct)
	}

	var body map[string]any
	if err := json.Unmarshal(recGet.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["status"] != "ok" {
		t.Fatalf("expected ok, got %v", body["status"])
	}
	if body["version"] != "1.0.0" {
		t.Fatalf("expected 1.0.0, got %v", body["version"])
	}
	if _, ok := body["timestamp"]; !ok {
		t.Fatal("expected timestamp field")
	}
	if _, ok := body["uptime"]; !ok {
		t.Fatal("expected uptime field")
	}

	reqHead := httptest.NewRequest(http.MethodHead, "/api/health", nil)
	recHead := httptest.NewRecorder()
	handleHealth(recHead, reqHead)
	if recHead.Code != http.StatusOK {
		t.Fatalf("expected 200 for HEAD, got %d", recHead.Code)
	}
	if recHead.Body.Len() != 0 {
		t.Fatalf("expected empty body for HEAD, got %d bytes", recHead.Body.Len())
	}

	reqPost := httptest.NewRequest(http.MethodPost, "/api/health", nil)
	recPost := httptest.NewRecorder()
	handleHealth(recPost, reqPost)
	if recPost.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", recPost.Code)
	}
	if !strings.Contains(recPost.Body.String(), "Method Not Allowed") {
		t.Fatalf("expected Method Not Allowed error, got %s", recPost.Body.String())
	}
}

func TestCORSMiddleware(t *testing.T) {
	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	handler := corsMiddleware(dummyHandler)

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	req.Header.Set("Origin", "https:\x2f\x2fagyremote.agentai.my.id")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Header().Get("Access-Control-Allow-Origin") != "https:\x2f\x2fagyremote.agentai.my.id" {
		t.Fatalf("expected origin echoed, got %s", rec.Header().Get("Access-Control-Allow-Origin"))
	}
	if rec.Header().Get("Connection") != "close" {
		t.Fatalf("expected Connection: close, got %s", rec.Header().Get("Connection"))
	}

	reqPrompt := httptest.NewRequest(http.MethodGet, "/api/workers/agy01/prompt", nil)
	recPrompt := httptest.NewRecorder()
	handler.ServeHTTP(recPrompt, reqPrompt)
	if recPrompt.Header().Get("Connection") == "close" {
		t.Fatal("expected Connection: close to be omitted for /prompt")
	}

	reqOptions := httptest.NewRequest(http.MethodOptions, "/api/health", nil)
	recOptions := httptest.NewRecorder()
	handler.ServeHTTP(recOptions, reqOptions)
	if recOptions.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for OPTIONS, got %d", recOptions.Code)
	}
	if recOptions.Body.Len() != 0 {
		t.Fatalf("expected empty body for OPTIONS, got %d bytes", recOptions.Body.Len())
	}
}

func TestBodyLimitMiddleware(t *testing.T) {
	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	handler := bodyLimitMiddleware(dummyHandler)

	reqLargeHeader := httptest.NewRequest(http.MethodPost, "/api/workers/agy01/prompt", nil)
	reqLargeHeader.ContentLength = 2 * 1024 * 1024
	recLargeHeader := httptest.NewRecorder()
	handler.ServeHTTP(recLargeHeader, reqLargeHeader)
	if recLargeHeader.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %d", recLargeHeader.Code)
	}

	malformedJSON := bytes.NewReader([]byte("{ malformed json: true "))
	reqMalformed := httptest.NewRequest(http.MethodPost, "/api/workers/agy01/prompt", malformedJSON)
	reqMalformed.Header.Set("Content-Type", "application/json")
	recMalformed := httptest.NewRecorder()
	handler.ServeHTTP(recMalformed, reqMalformed)
	if recMalformed.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for malformed JSON, got %d", recMalformed.Code)
	}
	if !strings.Contains(recMalformed.Body.String(), "Malformed JSON payload") {
		t.Fatalf("expected Malformed JSON payload error, got %s", recMalformed.Body.String())
	}

	validJSON := bytes.NewReader([]byte(`{"prompt":"test"}`))
	reqValid := httptest.NewRequest(http.MethodPost, "/api/workers/agy01/prompt", validJSON)
	reqValid.Header.Set("Content-Type", "application/json")
	recValid := httptest.NewRecorder()
	handler.ServeHTTP(recValid, reqValid)
	if recValid.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid JSON, got %d", recValid.Code)
	}
}

func TestM2RoutesIntegration(t *testing.T) {
	cfg := &config.Config{
		DistDir:       "../../internal/static/dist",
		AdminAuthKey:  "test-admin-key",
		WorkspaceRoot: "/opt/data",
		AgyBinPath:    "/opt/data/home/.local/bin/agy",
	}

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
	mux.Handle("/", staticHandler)

	authMiddleware := auth.NewMiddleware(cfg.AdminAuthKey)
	app := corsMiddleware(bodyLimitMiddleware(authMiddleware.Wrap(mux)))

	reqUnauth := httptest.NewRequest(http.MethodGet, "/api/system/vitals", nil)
	recUnauth := httptest.NewRecorder()
	app.ServeHTTP(recUnauth, reqUnauth)
	if recUnauth.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 unauth, got %d", recUnauth.Code)
	}

	reqVitals := httptest.NewRequest(http.MethodGet, "/api/system/vitals", nil)
	reqVitals.Header.Set("Authorization", "Bearer test-admin-key")
	recVitals := httptest.NewRecorder()
	app.ServeHTTP(recVitals, reqVitals)
	if recVitals.Code != http.StatusOK {
		t.Fatalf("expected 200 for vitals, got %d", recVitals.Code)
	}

	reqProcs := httptest.NewRequest(http.MethodGet, "/api/processes", nil)
	reqProcs.Header.Set("Authorization", "Bearer test-admin-key")
	recProcs := httptest.NewRecorder()
	app.ServeHTTP(recProcs, reqProcs)
	if recProcs.Code != http.StatusOK {
		t.Fatalf("expected 200 for processes, got %d", recProcs.Code)
	}

	reqKill0 := httptest.NewRequest(http.MethodPost, "/api/processes/0/kill", nil)
	reqKill0.Header.Set("Authorization", "Bearer test-admin-key")
	recKill0 := httptest.NewRecorder()
	app.ServeHTTP(recKill0, reqKill0)
	if recKill0.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for PID 0, got %d", recKill0.Code)
	}

	reqKill1 := httptest.NewRequest(http.MethodPost, "/api/processes/1/kill", nil)
	reqKill1.Header.Set("Authorization", "Bearer test-admin-key")
	recKill1 := httptest.NewRecorder()
	app.ServeHTTP(recKill1, reqKill1)
	if recKill1.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for PID 1, got %d", recKill1.Code)
	}

	reqKillNeg := httptest.NewRequest(http.MethodPost, "/api/processes/-1/kill", nil)
	reqKillNeg.Header.Set("Authorization", "Bearer test-admin-key")
	recKillNeg := httptest.NewRecorder()
	app.ServeHTTP(recKillNeg, reqKillNeg)
	if recKillNeg.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for PID -1, got %d", recKillNeg.Code)
	}

	reqKillNaN := httptest.NewRequest(http.MethodPost, "/api/processes/not-a-number/kill", nil)
	reqKillNaN.Header.Set("Authorization", "Bearer test-admin-key")
	recKillNaN := httptest.NewRecorder()
	app.ServeHTTP(recKillNaN, reqKillNaN)
	if recKillNaN.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for non-numeric PID, got %d", recKillNaN.Code)
	}

	reqVer := httptest.NewRequest(http.MethodGet, "/api/antigravity/version", nil)
	reqVer.Header.Set("Authorization", "Bearer test-admin-key")
	recVer := httptest.NewRecorder()
	app.ServeHTTP(recVer, reqVer)
	if recVer.Code != http.StatusOK {
		t.Fatalf("expected 200 for version, got %d", recVer.Code)
	}

	reqCl := httptest.NewRequest(http.MethodGet, "/api/antigravity/changelog", nil)
	reqCl.Header.Set("Authorization", "Bearer test-admin-key")
	recCl := httptest.NewRecorder()
	app.ServeHTTP(recCl, reqCl)
	if recCl.Code != http.StatusOK {
		t.Fatalf("expected 200 for changelog, got %d", recCl.Code)
	}

	reqUp := httptest.NewRequest(http.MethodPost, "/api/antigravity/update", nil)
	reqUp.Header.Set("Authorization", "Bearer test-admin-key")
	recUp := httptest.NewRecorder()
	app.ServeHTTP(recUp, reqUp)
	if recUp.Code != http.StatusOK {
		t.Fatalf("expected 200 for update, got %d", recUp.Code)
	}
}

func TestM3RoutesIntegration(t *testing.T) {
	cfg := &config.Config{
		Host:          "127.0.0.1",
		Port:          8787,
		AdminAuthKey:  "test-admin-key",
		DistDir:       "internal/static/dist",
		ProfilesRoot:  "/opt/data/home/agy-profiles",
		WorkspaceRoot: "/opt/data",
		AgyBinPath:    "/opt/data/home/.local/bin/agy",
	}

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
	mux.Handle("/", staticHandler)

	authMiddleware := auth.NewMiddleware(cfg.AdminAuthKey)
	app := corsMiddleware(bodyLimitMiddleware(authMiddleware.Wrap(mux)))

	reqUnauth := httptest.NewRequest(http.MethodGet, "/api/workers", nil)
	recUnauth := httptest.NewRecorder()
	app.ServeHTTP(recUnauth, reqUnauth)
	if recUnauth.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 unauth, got %d", recUnauth.Code)
	}

	reqWorkers := httptest.NewRequest(http.MethodGet, "/api/workers", nil)
	reqWorkers.Header.Set("Authorization", "Bearer test-admin-key")
	recWorkers := httptest.NewRecorder()
	app.ServeHTTP(recWorkers, reqWorkers)
	if recWorkers.Code != http.StatusOK {
		t.Fatalf("expected 200 for /api/workers, got %d", recWorkers.Code)
	}

	var wBody struct {
		Workers []workers.WorkerProfile `json:"workers"`
	}
	if err := json.Unmarshal(recWorkers.Body.Bytes(), &wBody); err != nil {
		t.Fatal(err)
	}
	if len(wBody.Workers) != 15 {
		t.Fatalf("expected 15 worker profiles, got %d", len(wBody.Workers))
	}

	reqSlash := httptest.NewRequest(http.MethodGet, "/api/workers/", nil)
	reqSlash.Header.Set("Authorization", "Bearer test-admin-key")
	recSlash := httptest.NewRecorder()
	app.ServeHTTP(recSlash, reqSlash)
	if recSlash.Code != http.StatusOK {
		t.Fatalf("expected 200 for /api/workers/, got %d", recSlash.Code)
	}

	reqAgy01 := httptest.NewRequest(http.MethodGet, "/api/workers/agy01", nil)
	reqAgy01.Header.Set("Authorization", "Bearer test-admin-key")
	recAgy01 := httptest.NewRecorder()
	app.ServeHTTP(recAgy01, reqAgy01)
	if recAgy01.Code != http.StatusOK {
		t.Fatalf("expected 200 for /api/workers/agy01, got %d", recAgy01.Code)
	}

	reqAgy99 := httptest.NewRequest(http.MethodGet, "/api/workers/agy99", nil)
	reqAgy99.Header.Set("Authorization", "Bearer test-admin-key")
	recAgy99 := httptest.NewRecorder()
	app.ServeHTTP(recAgy99, reqAgy99)
	if recAgy99.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for /api/workers/agy99, got %d", recAgy99.Code)
	}

	reqMeta := httptest.NewRequest(http.MethodGet, "/api/workers/agy01;rm%20-rf", nil)
	reqMeta.Header.Set("Authorization", "Bearer test-admin-key")
	recMeta := httptest.NewRecorder()
	app.ServeHTTP(recMeta, reqMeta)
	if recMeta.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for metachars, got %d", recMeta.Code)
	}

	reqConv := httptest.NewRequest(http.MethodGet, "/api/workers/agy01/conversations", nil)
	reqConv.Header.Set("Authorization", "Bearer test-admin-key")
	recConv := httptest.NewRecorder()
	app.ServeHTTP(recConv, reqConv)
	if recConv.Code != http.StatusOK {
		t.Fatalf("expected 200 for conversations, got %d", recConv.Code)
	}

	reqTrans := httptest.NewRequest(http.MethodGet, "/api/workers/agy01/transcripts", nil)
	reqTrans.Header.Set("Authorization", "Bearer test-admin-key")
	recTrans := httptest.NewRecorder()
	app.ServeHTTP(recTrans, reqTrans)
	if recTrans.Code != http.StatusOK {
		t.Fatalf("expected 200 for transcripts, got %d", recTrans.Code)
	}

	reqMsgs := httptest.NewRequest(http.MethodGet, "/api/workers/agy01/conversations/nonexistent/messages", nil)
	reqMsgs.Header.Set("Authorization", "Bearer test-admin-key")
	recMsgs := httptest.NewRecorder()
	app.ServeHTTP(recMsgs, reqMsgs)
	if recMsgs.Code != http.StatusOK {
		t.Fatalf("expected 200 for messages, got %d", recMsgs.Code)
	}

	reqAct := httptest.NewRequest(http.MethodPost, "/api/workers/agy01/activate", nil)
	reqAct.Header.Set("Authorization", "Bearer test-admin-key")
	recAct := httptest.NewRecorder()
	app.ServeHTTP(recAct, reqAct)
	if recAct.Code != http.StatusOK {
		t.Fatalf("expected 200 for activate, got %d", recAct.Code)
	}

	reqDaemonStatus := httptest.NewRequest(http.MethodGet, "/api/workers/agy01/daemon/status", nil)
	reqDaemonStatus.Header.Set("Authorization", "Bearer test-admin-key")
	recDaemonStatus := httptest.NewRecorder()
	app.ServeHTTP(recDaemonStatus, reqDaemonStatus)
	if recDaemonStatus.Code != http.StatusOK {
		t.Fatalf("expected 200 for daemon status, got %d", recDaemonStatus.Code)
	}

	reqChanges := httptest.NewRequest(http.MethodGet, "/api/workers/agy01/changes", nil)
	reqChanges.Header.Set("Authorization", "Bearer test-admin-key")
	recChanges := httptest.NewRecorder()
	app.ServeHTTP(recChanges, reqChanges)
	if recChanges.Code != http.StatusOK {
		t.Fatalf("expected 200 for changes, got %d", recChanges.Code)
	}

	reqUsage := httptest.NewRequest(http.MethodGet, "/api/workers/agy01/usage", nil)
	reqUsage.Header.Set("Authorization", "Bearer test-admin-key")
	recUsage := httptest.NewRecorder()
	app.ServeHTTP(recUsage, reqUsage)
	if recUsage.Code != http.StatusOK {
		t.Fatalf("expected 200 for usage, got %d", recUsage.Code)
	}

	reqPromptEmpty := httptest.NewRequest(http.MethodPost, "/api/workers/agy01/prompt", strings.NewReader(`{}`))
	reqPromptEmpty.Header.Set("Authorization", "Bearer test-admin-key")
	recPromptEmpty := httptest.NewRecorder()
	app.ServeHTTP(recPromptEmpty, reqPromptEmpty)
	if recPromptEmpty.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty prompt body, got %d", recPromptEmpty.Code)
	}

	reqPrompt404 := httptest.NewRequest(http.MethodPost, "/api/workers/agy99/prompt", strings.NewReader(`{"prompt":"test"}`))
	reqPrompt404.Header.Set("Authorization", "Bearer test-admin-key")
	recPrompt404 := httptest.NewRecorder()
	app.ServeHTTP(recPrompt404, reqPrompt404)
	if recPrompt404.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for nonexistent worker prompt, got %d", recPrompt404.Code)
	}
}


