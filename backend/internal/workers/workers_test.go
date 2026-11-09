package workers

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

func TestValidateWorkerID(t *testing.T) {
	validIDs := []string{"agy01", "agy02", "agy05", "agy10", "agy15"}
	for _, id := range validIDs {
		code, msg := ValidateWorkerID(id)
		if code != 0 || msg != "" {
			t.Fatalf("expected valid for %s, got code=%d msg=%s", id, code, msg)
		}
	}

	metaIDs := []string{
		"agy01;rm -rf",
		"agy01|cat",
		"agy01$FOO",
		"agy01`whoami`",
		"agy01 test",
		"agy01/test",
		"agy01\\test",
		"agy01..test",
		"agy01%20test",
	}
	for _, id := range metaIDs {
		code, _ := ValidateWorkerID(id)
		if code != http.StatusBadRequest {
			t.Fatalf("expected 400 for metachar ID %q, got %d", id, code)
		}
	}

	invalidIDs := []string{
		"agy00",
		"agy16",
		"agy99",
		"agy1",
		"AGY01",
		"worker01",
		"root",
	}
	for _, id := range invalidIDs {
		code, _ := ValidateWorkerID(id)
		if code != http.StatusNotFound {
			t.Fatalf("expected 404 for invalid ID %q, got %d", id, code)
		}
	}
}

func TestGetProfileHome(t *testing.T) {
	tmpDir := t.TempDir()
	h := NewHandler(tmpDir, "", "")

	pPrimary := filepath.Join(tmpDir, "agy01")
	if err := os.Mkdir(pPrimary, 0755); err != nil {
		t.Fatal(err)
	}
	resPrimary := h.GetProfileHome("agy01")
	if resPrimary != pPrimary {
		t.Fatalf("expected %s, got %s", pPrimary, resPrimary)
	}

	pFallback := filepath.Join(tmpDir, "account2")
	if err := os.Mkdir(pFallback, 0755); err != nil {
		t.Fatal(err)
	}
	resFallback := h.GetProfileHome("agy02")
	if resFallback != pFallback {
		t.Fatalf("expected %s, got %s", pFallback, resFallback)
	}
}

func TestIsDaemonRunning(t *testing.T) {
	tmpDir := t.TempDir()
	h := NewHandler(tmpDir, "", "")

	st1 := h.IsDaemonRunning("agy01")
	if st1.Running {
		t.Fatal("expected daemon not running on empty dir")
	}

	pdir := filepath.Join(tmpDir, "agy01")
	geminiCli := filepath.Join(pdir, ".gemini", "antigravity-cli")
	if err := os.MkdirAll(geminiCli, 0755); err != nil {
		t.Fatal(err)
	}
	pidPath := filepath.Join(geminiCli, "antigravity-cli-daemon.pid")
	if err := os.WriteFile(pidPath, []byte("99999999\n"), 0644); err != nil {
		t.Fatal(err)
	}

	st2 := h.IsDaemonRunning("agy01")
	if st2.Running {
		t.Fatal("expected daemon not running for non-existent PID")
	}
}

func TestGetWorkerAndListWorkers(t *testing.T) {
	tmpDir := t.TempDir()
	h := NewHandler(tmpDir, "", "")

	_, err := h.GetWorker("agy99")
	if err == nil {
		t.Fatal("expected error for agy99")
	}

	wUnauth, err := h.GetWorker("agy01")
	if err != nil {
		t.Fatal(err)
	}
	if wUnauth.Authenticated {
		t.Fatal("expected unauthenticated")
	}
	if wUnauth.Email != "-" {
		t.Fatalf("expected '-' email, got %s", wUnauth.Email)
	}
	if wUnauth.Status != "unauthenticated" {
		t.Fatalf("expected status unauthenticated, got %s", wUnauth.Status)
	}

	pdir := filepath.Join(tmpDir, "agy02")
	geminiCli := filepath.Join(pdir, ".gemini", "antigravity-cli")
	geminiCfg := filepath.Join(pdir, ".gemini", "config")
	_ = os.MkdirAll(geminiCli, 0755)
	_ = os.MkdirAll(geminiCfg, 0755)

	cfgData := `{"userSettings":{"cliRemoteControlHostname":"custom-host"}}`
	_ = os.WriteFile(filepath.Join(geminiCfg, "config.json"), []byte(cfgData), 0644)

	tokData := `{"id_token_email":"user@example.com","token":{"refresh_token":"fake-refresh"}}`
	_ = os.WriteFile(filepath.Join(geminiCli, "antigravity-oauth-token"), []byte(tokData), 0644)

	wAuth, err := h.GetWorker("agy02")
	if err != nil {
		t.Fatal(err)
	}
	if !wAuth.Authenticated {
		t.Fatal("expected authenticated true")
	}
	if wAuth.Email != "user@example.com" {
		t.Fatalf("expected user@example.com, got %s", wAuth.Email)
	}
	if wAuth.Hostname != "custom-host" || wAuth.Name != "custom-host" {
		t.Fatalf("expected custom-host, got hostname=%s name=%s", wAuth.Hostname, wAuth.Name)
	}
	if wAuth.Status != "idle" {
		t.Fatalf("expected status idle, got %s", wAuth.Status)
	}

	workersList := h.ListWorkers()
	if len(workersList) != 15 {
		t.Fatalf("expected 15 workers, got %d", len(workersList))
	}
}

func TestConversationsDB(t *testing.T) {
	tmpDir := t.TempDir()
	h := NewHandler(tmpDir, "", "")

	dataEmpty, err := h.GetWorkerConversations("agy01")
	if err != nil {
		t.Fatal(err)
	}
	if dataEmpty.WorkerID != "agy01" {
		t.Fatalf("expected agy01, got %s", dataEmpty.WorkerID)
	}

	pdir := filepath.Join(tmpDir, "agy01")
	geminiCli := filepath.Join(pdir, ".gemini", "antigravity-cli")
	_ = os.MkdirAll(geminiCli, 0755)
	dbPath := filepath.Join(geminiCli, "conversation_summaries.db")

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatal(err)
	}
	createTable := `CREATE TABLE conversation_summaries (
		conversation_id TEXT PRIMARY KEY,
		title TEXT NOT NULL DEFAULT "",
		preview TEXT NOT NULL DEFAULT "",
		step_count INTEGER NOT NULL DEFAULT 0,
		last_modified_time DATETIME NOT NULL,
		workspace_uris TEXT NOT NULL,
		project_id TEXT NOT NULL DEFAULT ""
	);`
	if _, err := db.Exec(createTable); err != nil {
		_ = db.Close()
		t.Fatal(err)
	}

	insertSQL := `INSERT INTO conversation_summaries VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, _ = db.Exec(insertSQL, "c1", "Test Title 1", "Preview 1", 10, "2026-10-29 02:00:00", `["file:///opt/data/home/TestProject"]`, "p1")
	_, _ = db.Exec(insertSQL, "c2", "", "Preview 2", 5, "2026-10-29 01:00:00", `[]`, "p2")
	_ = db.Close()

	data, err := h.GetWorkerConversations("agy01")
	if err != nil {
		t.Fatal(err)
	}
	if len(data.NonProjectConversations) != 1 {
		t.Fatalf("expected 1 non-project conversation, got %d", len(data.NonProjectConversations))
	}
	if data.NonProjectConversations[0].Title != "Percakapan Tanpa Judul" {
		t.Fatalf("expected fallback title, got %s", data.NonProjectConversations[0].Title)
	}
	if data.NonProjectConversations[0].ID != "c2" {
		t.Fatalf("expected c2, got %s", data.NonProjectConversations[0].ID)
	}

	foundProject := false
	for _, f := range data.Folders {
		if f.Path == "/opt/data/home/TestProject" {
			foundProject = true
			if len(f.Conversations) != 1 {
				t.Fatalf("expected 1 conversation in folder, got %d", len(f.Conversations))
			}
			if f.Conversations[0].ID != "c1" {
				t.Fatalf("expected c1, got %s", f.Conversations[0].ID)
			}
		}
	}
	if !foundProject {
		t.Fatal("expected TestProject folder to be created and populated")
	}
}

func TestCleanPromptAndExecutiveSummary(t *testing.T) {
	p1 := CleanPrompt("Short prompt")
	if p1 != "Short prompt" {
		t.Fatalf("expected 'Short prompt', got %s", p1)
	}

	p2 := CleanPrompt("\n\n   First line   \nSecond line")
	if p2 != "First line" {
		t.Fatalf("expected 'First line', got %s", p2)
	}

	longP := strings.Repeat("x", 150)
	p3 := CleanPrompt(longP)
	if len(p3) > 120 || !strings.HasSuffix(p3, "...") {
		t.Fatalf("expected truncated prompt, got len=%d %s", len(p3), p3)
	}

	s1 := ExecutiveSummary("Short summary", 200)
	if s1 != "Short summary" {
		t.Fatalf("expected 'Short summary', got %s", s1)
	}

	longS := strings.Repeat("y", 250)
	s2 := ExecutiveSummary(longS, 200)
	if len(s2) != 200 || !strings.HasSuffix(s2, "...") {
		t.Fatalf("expected 200 chars truncated summary, got len=%d %s", len(s2), s2)
	}
}

func TestTranscriptsAndMessages(t *testing.T) {
	tmpDir := t.TempDir()
	h := NewHandler(tmpDir, "", "")

	emptyMsgs := h.GetConversationMessages("agy01", "nonexistent-cid")
	if emptyMsgs.ConversationID != "nonexistent-cid" || len(emptyMsgs.Messages) != 0 {
		t.Fatal("expected empty messages for nonexistent CID")
	}

	pdir := filepath.Join(tmpDir, "agy01")
	convDir := filepath.Join(pdir, ".gemini", "antigravity-cli", "brain", "cid-123", ".system_generated", "logs")
	_ = os.MkdirAll(convDir, 0755)

	logPath := filepath.Join(convDir, "transcript.jsonl")
	lines := []string{
		`{"created_at":"2026-10-29T02:00:00.000Z","step_index":0,"type":"USER_INPUT","content":"<USER_REQUEST>Halo dunia</USER_REQUEST>"}`,
		`{"created_at":"2026-10-29T02:00:01.000Z","step_index":1,"type":"PLANNER_RESPONSE","content":"Halo juga! Siap membantu."}`,
		`{"created_at":"2026-10-29T02:00:02.000Z","tool_calls":[{"name":"edit_file","args":{"Path":"/opt/data/test.go"}}]}`,
		`{"created_at":"2026-10-29T02:00:03.000Z","tool_calls":[{"name":"write_file","args":{"path":"/opt/data/new.go","Overwrite":false}}]}`,
		`{"created_at":"2026-10-29T02:00:04.000Z","tool_calls":[{"name":"run_command","args":{"CommandLine":"rm -rf /opt/data/old.go"}}]}`,
	}
	_ = os.WriteFile(logPath, []byte(strings.Join(lines, "\n")+"\n"), 0644)

	msgs := h.GetConversationMessages("agy01", "cid-123")
	if len(msgs.Messages) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(msgs.Messages))
	}
	if msgs.Messages[0].ID != "u_0" || msgs.Messages[0].Sender != "user" || msgs.Messages[0].Content != "Halo dunia" {
		t.Fatalf("unexpected user message: %+v", msgs.Messages[0])
	}
	if msgs.Messages[1].ID != "a_1" || msgs.Messages[1].Sender != "agent" || msgs.Messages[1].Content != "Halo juga! Siap membantu." {
		t.Fatalf("unexpected agent message: %+v", msgs.Messages[1])
	}

	trans := h.GetTranscripts("agy01", 10)
	if len(trans.Transcripts) != 1 {
		t.Fatalf("expected 1 transcript, got %d", len(trans.Transcripts))
	}
	if trans.Transcripts[0].ConversationID != "cid-123" {
		t.Fatalf("expected cid-123, got %s", trans.Transcripts[0].ConversationID)
	}
	if trans.Transcripts[0].TurnCount != 1 {
		t.Fatalf("expected 1 turn, got %d", trans.Transcripts[0].TurnCount)
	}

	changes := h.GetFileChanges("agy01")
	if changes.ConversationID != "cid-123" {
		t.Fatalf("expected cid-123, got %s", changes.ConversationID)
	}
	if changes.Summary.Modified != 1 || changes.Summary.Created != 1 || changes.Summary.Deleted != 1 || changes.Summary.Total != 3 {
		t.Fatalf("unexpected changes summary: %+v", changes.Summary)
	}
}

func TestHTTPHandlers(t *testing.T) {
	tmpDir := t.TempDir()
	h := NewHandler(tmpDir, "", "")
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	req1 := httptest.NewRequest(http.MethodGet, "/api/workers", nil)
	rec1 := httptest.NewRecorder()
	mux.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec1.Code)
	}

	reqSlash := httptest.NewRequest(http.MethodGet, "/api/workers/", nil)
	recSlash := httptest.NewRecorder()
	mux.ServeHTTP(recSlash, reqSlash)
	if recSlash.Code != http.StatusOK {
		t.Fatalf("expected 200 for /api/workers/, got %d", recSlash.Code)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/api/workers/agy01", nil)
	rec2 := httptest.NewRecorder()
	mux.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200 for agy01, got %d", rec2.Code)
	}

	req404 := httptest.NewRequest(http.MethodGet, "/api/workers/agy99", nil)
	rec404 := httptest.NewRecorder()
	mux.ServeHTTP(rec404, req404)
	if rec404.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for agy99, got %d", rec404.Code)
	}

	req400 := httptest.NewRequest(http.MethodGet, "/api/workers/agy01;rm%20-rf", nil)
	rec400 := httptest.NewRecorder()
	mux.ServeHTTP(rec400, req400)
	if rec400.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for metachars, got %d", rec400.Code)
	}

	reqAct := httptest.NewRequest(http.MethodPost, "/api/workers/agy01/activate", nil)
	recAct := httptest.NewRecorder()
	mux.ServeHTTP(recAct, reqAct)
	if recAct.Code != http.StatusOK {
		t.Fatalf("expected 200 for activate, got %d", recAct.Code)
	}

	reqPromptEmpty := httptest.NewRequest(http.MethodPost, "/api/workers/agy01/prompt", strings.NewReader(`{}`))
	recPromptEmpty := httptest.NewRecorder()
	mux.ServeHTTP(recPromptEmpty, reqPromptEmpty)
	if recPromptEmpty.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty prompt body, got %d", recPromptEmpty.Code)
	}

	reqPrompt404 := httptest.NewRequest(http.MethodPost, "/api/workers/agy99/prompt", strings.NewReader(`{"prompt":"test"}`))
	recPrompt404 := httptest.NewRecorder()
	mux.ServeHTTP(recPrompt404, reqPrompt404)
	if recPrompt404.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for nonexistent worker prompt, got %d", recPrompt404.Code)
	}
}

func TestUsageCalculation(t *testing.T) {
	tmpDir := t.TempDir()
	h := NewHandler(tmpDir, "", "")

	pdir := filepath.Join(tmpDir, "agy01")
	convDir := filepath.Join(pdir, ".gemini", "antigravity-cli", "conversations")
	_ = os.MkdirAll(convDir, 0755)

	db1 := filepath.Join(convDir, "session1.db")
	_ = os.WriteFile(db1, make([]byte, 16384), 0644)

	u := h.GetUsage("agy01")
	if u == nil {
		t.Fatal("expected non-nil usage")
	}
	if u.Gemini.TotalSteps != 2 {
		t.Fatalf("expected 2 total steps, got %d", u.Gemini.TotalSteps)
	}
	if u.Gemini.FiveHourSteps != 2 {
		t.Fatalf("expected 2 five-hour steps, got %d", u.Gemini.FiveHourSteps)
	}
}

func TestSkillManagement(t *testing.T) {
	tmpDir := t.TempDir()
	h := NewHandler(tmpDir, "", "")

	count, err := h.DeploySkill("test-skill", "Testing skill description", "# Test Skill\nContent", []string{"agy01", "agy02"})
	if err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Fatalf("expected 2 installed, got %d", count)
	}

	skills := h.ListAllSkills()
	if len(skills) != 1 {
		t.Fatalf("expected 1 skill, got %d", len(skills))
	}
	if skills[0].Name != "test-skill" {
		t.Fatalf("expected test-skill, got %s", skills[0].Name)
	}
	if len(skills[0].Workers) != 2 {
		t.Fatalf("expected 2 workers, got %d", len(skills[0].Workers))
	}

	detail, err := h.GetSkillDetail("test-skill")
	if err != nil {
		t.Fatal(err)
	}
	if detail.Name != "test-skill" || detail.Description != "Testing skill description" {
		t.Fatalf("unexpected detail: %+v", detail)
	}

	deleted, err := h.DeleteSkill("test-skill", []string{"agy01"})
	if err != nil {
		t.Fatal(err)
	}
	if deleted != 1 {
		t.Fatalf("expected 1 deleted, got %d", deleted)
	}

	skillsAfter := h.ListAllSkills()
	if len(skillsAfter) != 1 || len(skillsAfter[0].Workers) != 1 {
		t.Fatalf("expected 1 skill remaining with 1 worker, got %+v", skillsAfter)
	}
}
