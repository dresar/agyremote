package workers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"agyremote/internal/auth"
)

var (
	workerIDPattern = regexp.MustCompile(`^agy(0[1-9]|1[0-5])$`)
	activeSessions  sync.Map
)

type WorkerSubTask struct {
	Name    string `json:"name"`
	Details string `json:"details"`
	PID     int    `json:"pid,omitempty"`
	Status  string `json:"status"`
}

type WorkerProfile struct {
	ID            string          `json:"id"`
	Name          string          `json:"name"`
	Email         string          `json:"email"`
	Authenticated bool            `json:"authenticated"`
	ActiveSession *string         `json:"activeSession"`
	Status        string          `json:"status"`
	Hostname      string          `json:"hostname"`
	DaemonActive  bool            `json:"daemonActive"`
	Picture       *string         `json:"picture,omitempty"`
	ActiveTasks   []WorkerSubTask `json:"activeTasks,omitempty"`
}

type DaemonStatus struct {
	Running bool `json:"running"`
	PID     int  `json:"pid,omitempty"`
}

type GeminiQuota struct {
	WeeklyPercentLeft   int    `json:"weeklyPercentLeft"`
	WeeklyReset         string `json:"weeklyReset"`
	FiveHourPercentLeft int    `json:"fiveHourPercentLeft"`
	FiveHourReset       string `json:"fiveHourReset"`
	WeeklySteps         int    `json:"weeklySteps"`
	FiveHourSteps       int    `json:"fiveHourSteps"`
	TotalSteps          int    `json:"totalSteps"`
}

type ClaudeGptQuota struct {
	WeeklyPercentLeft   int    `json:"weeklyPercentLeft"`
	WeeklyReset         string `json:"weeklyReset"`
	FiveHourPercentLeft int    `json:"fiveHourPercentLeft"`
	FiveHourReset       string `json:"fiveHourReset"`
}

type WorkerUsage struct {
	WorkerID      string         `json:"workerId"`
	Email         string         `json:"email"`
	Authenticated bool           `json:"authenticated"`
	Gemini        GeminiQuota    `json:"gemini"`
	ClaudeGpt     ClaudeGptQuota `json:"claudeGpt"`
}

type Handler struct {
	profilesRoot  string
	binPath       string
	workspaceRoot string
	avatarCache   map[string]string
	avatarLock    sync.RWMutex
}

func NewHandler(profilesRoot, binPath, workspaceRoot string) *Handler {
	if profilesRoot == "" {
		profilesRoot = "/opt/data/home/agy-profiles"
	}
	if binPath == "" {
		binPath = "/opt/data/home/.local/bin/agy"
	}
	if workspaceRoot == "" {
		workspaceRoot = "/opt/data"
	}
	h := &Handler{
		profilesRoot:  profilesRoot,
		binPath:       binPath,
		workspaceRoot: workspaceRoot,
		avatarCache:   make(map[string]string),
	}
	h.loadAvatarCache()
	return h
}

func (h *Handler) loadAvatarCache() {
	candidates := []string{
		filepath.Join("cache", "worker_avatars.json"),
		filepath.Join("/opt/data/home/agyremote-backend/cache/worker_avatars.json"),
		filepath.Join("server", "cache", "worker_avatars.json"),
		filepath.Join("..", "server", "cache", "worker_avatars.json"),
		filepath.Join("/opt/data/home/agyremote/server/cache/worker_avatars.json"),
	}
	for _, p := range candidates {
		if data, err := os.ReadFile(p); err == nil {
			h.avatarLock.Lock()
			_ = json.Unmarshal(data, &h.avatarCache)
			h.avatarLock.Unlock()
			break
		}
	}
}

func ValidateWorkerID(id string) (int, string) {
	if strings.ContainsAny(id, "; `$\\|&/\\") || strings.Contains(id, " ") || strings.Contains(id, "..") || strings.Contains(id, "%") {
		return http.StatusBadRequest, "Malformed worker ID with invalid characters"
	}
	if !workerIDPattern.MatchString(id) {
		return http.StatusNotFound, "Worker profile not found"
	}
	return 0, ""
}

func (h *Handler) GetProfileHome(id string) string {
	primary := filepath.Join(h.profilesRoot, id)
	if fi, err := os.Stat(primary); err == nil && fi.IsDir() {
		return primary
	}
	numStr := strings.TrimPrefix(id, "agy")
	if num, err := strconv.Atoi(numStr); err == nil {
		fallback := filepath.Join(h.profilesRoot, fmt.Sprintf("account%d", num))
		if fi, err := os.Stat(fallback); err == nil && fi.IsDir() {
			return fallback
		}
	}
	return primary
}

func (h *Handler) IsDaemonRunning(id string) DaemonStatus {
	if code, _ := ValidateWorkerID(id); code != 0 {
		return DaemonStatus{Running: false}
	}
	pdir := h.GetProfileHome(id)
	pidFile := filepath.Join(pdir, ".gemini", "antigravity-cli", "antigravity-cli-daemon.pid")
	data, err := os.ReadFile(pidFile)
	if err != nil {
		return DaemonStatus{Running: false}
	}
	pidStr := strings.TrimSpace(string(data))
	pid, err := strconv.Atoi(pidStr)
	if err != nil || pid <= 0 {
		return DaemonStatus{Running: false}
	}
	procPath := fmt.Sprintf("/proc/%d", pid)
	if _, err := os.Stat(procPath); err != nil {
		return DaemonStatus{Running: false}
	}
	cmdlinePath := fmt.Sprintf("/proc/%d/cmdline", pid)
	if cmdData, err := os.ReadFile(cmdlinePath); err == nil {
		cmdStr := string(cmdData)
		if !strings.Contains(cmdStr, "agy") || !strings.Contains(cmdStr, "remote-control") {
			return DaemonStatus{Running: false}
		}
	}
	return DaemonStatus{Running: true, PID: pid}
}

func (h *Handler) GetWorker(id string) (*WorkerProfile, error) {
	if code, msg := ValidateWorkerID(id); code != 0 {
		return nil, fmt.Errorf("%d: %s", code, msg)
	}
	numStr := strings.TrimPrefix(id, "agy")
	num, _ := strconv.Atoi(numStr)
	pdir := h.GetProfileHome(id)

	hostname := fmt.Sprintf("eka-%d", num)
	name := fmt.Sprintf("Worker %s", strings.ToUpper(id))
	email := "-"
	authenticated := false

	h.avatarLock.RLock()
	picVal, hasPic := h.avatarCache[id]
	h.avatarLock.RUnlock()
	var picture *string
	if hasPic && picVal != "" {
		picture = &picVal
	}

	cfgPath := filepath.Join(pdir, ".gemini", "config", "config.json")
	if cfgData, err := os.ReadFile(cfgPath); err == nil {
		var cfg struct {
			UserSettings struct {
				CliRemoteControlHostname string `json:"cliRemoteControlHostname"`
			} `json:"userSettings"`
		}
		if json.Unmarshal(cfgData, &cfg) == nil && cfg.UserSettings.CliRemoteControlHostname != "" {
			hostname = cfg.UserSettings.CliRemoteControlHostname
			name = hostname
		}
	}

	tokPath := filepath.Join(pdir, ".gemini", "antigravity-cli", "antigravity-oauth-token")
	if tokData, err := os.ReadFile(tokPath); err == nil {
		var tok struct {
			Token struct {
				AccessToken  string `json:"access_token"`
				RefreshToken string `json:"refresh_token"`
				Expiry       string `json:"expiry"`
				Email        string `json:"email"`
			} `json:"token"`
			IDTokenEmail string `json:"id_token_email"`
			IDToken      string `json:"id_token"`
			Picture      string `json:"picture"`
			RefreshToken string `json:"refresh_token"`
		}
		if json.Unmarshal(tokData, &tok) == nil {
			email = tok.IDTokenEmail
			var exp int64
			if email == "" && tok.IDToken != "" {
				parts := strings.Split(tok.IDToken, ".")
				if len(parts) >= 2 {
					payload := parts[1]
					padLen := (4 - (len(payload) % 4)) % 4
					payload += strings.Repeat("=", padLen)
					payload = strings.ReplaceAll(payload, "-", "+")
					payload = strings.ReplaceAll(payload, "_", "/")
					if dec, err := base64.StdEncoding.DecodeString(payload); err == nil {
						var parsed struct {
							Email   string `json:"email"`
							Exp     int64  `json:"exp"`
							Picture string `json:"picture"`
						}
						if json.Unmarshal(dec, &parsed) == nil {
							email = parsed.Email
							exp = parsed.Exp
							if parsed.Picture != "" && picture == nil {
								picture = &parsed.Picture
							}
						}
					}
				}
			} else if tok.Token.Expiry != "" {
				if t, err := time.Parse(time.RFC3339Nano, tok.Token.Expiry); err == nil {
					exp = t.Unix()
				}
			}

			if email == "" && tok.Token.Email != "" {
				email = tok.Token.Email
			}

			if tok.Picture != "" && picture == nil {
				picture = &tok.Picture
			}

			if email != "" && email != "unknown" && email != "-" {
				hasRefresh := tok.Token.RefreshToken != "" || tok.RefreshToken != ""
				authenticated = hasRefresh || exp == 0 || exp > (time.Now().Unix()-86400*30)
			}
		}
	}

	if !authenticated {
		email = "-"
	}

	var activeSession *string
	if val, ok := activeSessions.Load(id); ok {
		sess := val.(string)
		activeSession = &sess
	}

	daemonInfo := h.IsDaemonRunning(id)

	activeTasks := make([]WorkerSubTask, 0)
	if daemonInfo.Running {
		activeTasks = append(activeTasks, WorkerSubTask{
			Name:    "Daemon Server",
			Details: fmt.Sprintf("PID %d • remote-control serve", daemonInfo.PID),
			PID:     daemonInfo.PID,
			Status:  "running",
		})
	}
	if activeSession != nil {
		activeTasks = append(activeTasks, WorkerSubTask{
			Name:    "Sesi Interaktif",
			Details: *activeSession,
			Status:  "running",
		})
	}
	profileBase := filepath.Base(pdir)
	if procEntries, pErr := os.ReadDir("/proc"); pErr == nil {
		for _, pe := range procEntries {
			if !pe.IsDir() {
				continue
			}
			pNum, convErr := strconv.Atoi(pe.Name())
			if convErr != nil || pNum <= 0 || pNum == daemonInfo.PID {
				continue
			}
			cmdBytes, readErr := os.ReadFile(filepath.Join("/proc", pe.Name(), "cmdline"))
			if readErr != nil {
				continue
			}
			cmdStr := string(cmdBytes)
			if strings.Contains(cmdStr, "agy") && (strings.Contains(cmdStr, id) || strings.Contains(cmdStr, strings.ToUpper(id)) || strings.Contains(cmdStr, profileBase)) {
				taskSnippet := "Pemrosesan tugas aktif"
				if idx := strings.Index(cmdStr, "-p "); idx >= 0 {
					pPart := cmdStr[idx+3:]
					pPart = strings.ReplaceAll(pPart, "\x00", " ")
					pPart = strings.TrimSpace(pPart)
					if len(pPart) > 50 {
						pPart = pPart[:50] + "..."
					}
					if len(pPart) > 5 {
						taskSnippet = pPart
					}
				}
				activeTasks = append(activeTasks, WorkerSubTask{
					Name:    "Pemrosesan Tugas",
					Details: fmt.Sprintf("PID %d • %s", pNum, taskSnippet),
					PID:     pNum,
					Status:  "running",
				})
			}
		}
	}

	status := "unauthenticated"
	if authenticated {
		if len(activeTasks) > 0 || activeSession != nil || daemonInfo.Running {
			status = "running"
		} else {
			status = "idle"
		}
	}

	return &WorkerProfile{
		ID:            id,
		Name:          name,
		Email:         email,
		Authenticated: authenticated,
		ActiveSession: activeSession,
		Status:        status,
		Hostname:      hostname,
		DaemonActive:  daemonInfo.Running,
		Picture:       picture,
		ActiveTasks:   activeTasks,
	}, nil
}

func (h *Handler) ListWorkers() []WorkerProfile {
	workers := make([]WorkerProfile, 0, 15)
	for i := 1; i <= 15; i++ {
		id := fmt.Sprintf("agy%02d", i)
		if w, err := h.GetWorker(id); err == nil {
			workers = append(workers, *w)
		}
	}
	return workers
}

func (h *Handler) GetUsage(id string) *WorkerUsage {
	w, err := h.GetWorker(id)
	if err != nil {
		return nil
	}
	pdir := h.GetProfileHome(id)
	convDir := filepath.Join(pdir, ".gemini", "antigravity-cli", "conversations")

	totalSteps := 0
	fiveHourSteps := 0
	weeklySteps := 0
	now := time.Now()

	if entries, err := os.ReadDir(convDir); err == nil {
		for _, e := range entries {
			if strings.HasSuffix(e.Name(), ".db") {
				if fi, err := e.Info(); err == nil {
					est := int(math.Round(float64(fi.Size()) / 8192.0))
					if est < 1 {
						est = 1
					}
					totalSteps += est
					diff := now.Sub(fi.ModTime())
					if diff < 5*time.Hour {
						fiveHourSteps += est
					}
					if diff < 7*24*time.Hour {
						weeklySteps += est
					}
				}
			}
		}
	}

	fiveHourBudget := 3000
	weeklyBudget := 30000

	fiveHourUsed := fiveHourSteps
	if fiveHourUsed > fiveHourBudget {
		fiveHourUsed = fiveHourBudget
	}

	fiveHourPercentLeft := 0
	if w.Authenticated {
		fiveHourPercentLeft = int(math.Round(float64(fiveHourBudget-fiveHourUsed) / float64(fiveHourBudget) * 100))
		if fiveHourPercentLeft < 5 {
			fiveHourPercentLeft = 5
		}
	}

	weeklyUsed := weeklySteps
	if weeklyUsed > weeklyBudget {
		weeklyUsed = weeklyBudget
	}

	weeklyPercentLeft := 0
	if w.Authenticated {
		weeklyPercentLeft = int(math.Round(float64(weeklyBudget-weeklyUsed) / float64(weeklyBudget) * 100))
		if weeklyPercentLeft < 10 {
			weeklyPercentLeft = 10
		}
	}

	nowMs := now.UnixMilli()
	fiveMod := nowMs % (5 * 3600 * 1000)
	fiveHourResetH := 4 - int(fiveMod/3600000)
	if fiveHourResetH < 1 {
		fiveHourResetH = 1
	}
	fiveHourResetM := int((nowMs % 3600000) / 60000)
	fiveHourReset := fmt.Sprintf("%dh %dm", fiveHourResetH, fiveHourResetM)

	weekMod := nowMs % (7 * 86400 * 1000)
	weekResetD := 6 - int(weekMod/86400000)
	if weekResetD < 1 {
		weekResetD = 1
	}
	weekResetH := int((nowMs % 86400000) / 3600000)
	weeklyReset := fmt.Sprintf("%dd %dh", weekResetD, weekResetH)

	claudeWeekly := 0
	claudeFiveHour := 0
	if w.Authenticated {
		claudeWeekly = 100
		claudeFiveHour = 100
	}

	return &WorkerUsage{
		WorkerID:      id,
		Email:         w.Email,
		Authenticated: w.Authenticated,
		Gemini: GeminiQuota{
			WeeklyPercentLeft:   weeklyPercentLeft,
			WeeklyReset:         weeklyReset,
			FiveHourPercentLeft: fiveHourPercentLeft,
			FiveHourReset:       fiveHourReset,
			WeeklySteps:         weeklySteps,
			FiveHourSteps:       fiveHourSteps,
			TotalSteps:          totalSteps,
		},
		ClaudeGpt: ClaudeGptQuota{
			WeeklyPercentLeft:   claudeWeekly,
			WeeklyReset:         "7d",
			FiveHourPercentLeft: claudeFiveHour,
			FiveHourReset:       "5h",
		},
	}
}

func (h *Handler) StartDaemon(id string) (bool, string, int) {
	current := h.IsDaemonRunning(id)
	if current.Running {
		return true, fmt.Sprintf("Worker daemon sudah aktif (PID %d)", current.PID), current.PID
	}
	pdir := h.GetProfileHome(id)
	cmd := exec.Command(h.binPath, "remote-control", "start")
	cmd.Dir = pdir
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("HOME=%s", pdir),
		fmt.Sprintf("GEMINI_HOME=%s/.gemini", pdir),
		fmt.Sprintf("PATH=/opt/data/tools/go/bin:/opt/data/home/.local/bin:%s", os.Getenv("PATH")),
	)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if err := cmd.Start(); err != nil {
		return false, err.Error(), 0
	}
	_ = cmd.Process.Release()
	time.Sleep(1200 * time.Millisecond)
	check := h.IsDaemonRunning(id)
	if check.Running {
		return true, fmt.Sprintf("Worker daemon berhasil dihidupkan (PID %d)", check.PID), check.PID
	}
	return true, "Perintah hidupkan worker dikirim", 0
}

func (h *Handler) StopDaemon(id string) (bool, string) {
	current := h.IsDaemonRunning(id)
	pdir := h.GetProfileHome(id)
	cmd := exec.Command(h.binPath, "remote-control", "stop")
	cmd.Dir = pdir
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("HOME=%s", pdir),
		fmt.Sprintf("GEMINI_HOME=%s/.gemini", pdir),
	)
	_ = cmd.Run()
	if current.PID > 0 {
		procPath := fmt.Sprintf("/proc/%d", current.PID)
		if _, err := os.Stat(procPath); err == nil {
			_ = syscall.Kill(current.PID, syscall.SIGTERM)
			time.Sleep(500 * time.Millisecond)
			if _, err := os.Stat(procPath); err == nil {
				_ = syscall.Kill(current.PID, syscall.SIGKILL)
			}
		}
	}
	return true, "Worker daemon berhasil dimatikan"
}

func (h *Handler) LogoutWorker(id string) error {
	pdir := h.GetProfileHome(id)
	tokFile := filepath.Join(pdir, ".gemini", "antigravity-cli", "antigravity-oauth-token")
	tokBak := tokFile + ".bak"
	_ = os.Remove(tokFile)
	_ = os.Remove(tokBak)

	activeSessions.Delete(id)

	pidFile := fmt.Sprintf("/tmp/agy_login_%s.pid", id)
	if data, err := os.ReadFile(pidFile); err == nil {
		if pid, err := strconv.Atoi(strings.TrimSpace(string(data))); err == nil && pid > 0 {
			_ = syscall.Kill(pid, syscall.SIGTERM)
		}
		_ = os.Remove(pidFile)
	}
	_ = os.Remove(fmt.Sprintf("/tmp/agy_login_%s.sock", id))
	_ = os.Remove(fmt.Sprintf("/tmp/agy_login_%s.url", id))
	return nil
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/workers", h.HandleListWorkers)
	mux.HandleFunc("GET /api/workers/", h.HandleWorkersSlash)
	mux.HandleFunc("GET /api/workers/{id}", h.HandleGetWorker)
	mux.HandleFunc("GET /api/workers/{id}/", h.HandleGetWorker)
	mux.HandleFunc("GET /api/workers/{id}/transcripts", h.HandleTranscripts)
	mux.HandleFunc("GET /api/workers/{id}/changes", h.HandleFileChanges)
	mux.HandleFunc("GET /api/workers/{id}/conversations", h.HandleConversations)
	mux.HandleFunc("GET /api/workers/{id}/conversations/{cid}/messages", h.HandleMessages)
	mux.HandleFunc("GET /api/workers/{id}/daemon/status", h.HandleDaemonStatus)
	mux.HandleFunc("POST /api/workers/{id}/daemon/start", h.HandleDaemonStart)
	mux.HandleFunc("POST /api/workers/{id}/daemon/stop", h.HandleDaemonStop)
	mux.HandleFunc("GET /api/workers/{id}/usage", h.HandleUsage)
	mux.HandleFunc("POST /api/workers/{id}/activate", h.HandleActivate)
	mux.HandleFunc("POST /api/workers/{id}/folders/quick", h.HandleQuickFolder)
	mux.HandleFunc("POST /api/workers/{id}/auth/login", h.HandleAuthLogin)
	mux.HandleFunc("POST /api/workers/{id}/auth/submit", h.HandleAuthSubmit)
	mux.HandleFunc("POST /api/workers/{id}/auth/logout", h.HandleAuthLogout)
	mux.HandleFunc("POST /api/workers/{id}/prompt/enhance", h.HandlePromptEnhance)
	mux.HandleFunc("POST /api/prompt/enhance", h.HandlePromptEnhance)
	mux.HandleFunc("POST /api/ai/chat", h.HandleAiChat)
	mux.HandleFunc("GET /api/project/meta", h.HandleProjectMeta)
	mux.HandleFunc("POST /api/workers/{id}/prompt", h.HandlePrompt)
	mux.HandleFunc("GET /api/workers/{id}/file", h.HandleGetFile)
	mux.HandleFunc("GET /api/file", h.HandleGetFile)
	mux.HandleFunc("GET /api/skills", h.HandleListSkills)
	mux.HandleFunc("GET /api/skills/{name}", h.HandleGetSkill)
	mux.HandleFunc("POST /api/skills", h.HandleSaveSkill)
	mux.HandleFunc("POST /api/skills/install", h.HandleInstallSkill)
	mux.HandleFunc("DELETE /api/skills/{name}", h.HandleDeleteSkill)
}

func (h *Handler) HandleListWorkers(w http.ResponseWriter, r *http.Request) {
	workers := h.ListWorkers()
	auth.WriteJSON(w, http.StatusOK, map[string]any{"workers": workers})
}

func (h *Handler) HandleWorkersSlash(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/api/workers/" {
		h.HandleListWorkers(w, r)
		return
	}
	auth.WriteError(w, http.StatusNotFound, "Not Found")
}

func (h *Handler) HandleGetWorker(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		trimmed := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/workers"), "/")
		if trimmed != "" && !strings.Contains(trimmed, "/") {
			id = trimmed
		}
	}
	if id == "" {
		h.HandleListWorkers(w, r)
		return
	}
	if code, msg := ValidateWorkerID(id); code != 0 {
		auth.WriteError(w, code, msg)
		return
	}
	worker, err := h.GetWorker(id)
	if err != nil {
		auth.WriteError(w, http.StatusNotFound, "Worker profile not found")
		return
	}
	auth.WriteJSON(w, http.StatusOK, worker)
}

func (h *Handler) HandleDaemonStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if code, msg := ValidateWorkerID(id); code != 0 {
		auth.WriteError(w, code, msg)
		return
	}
	st := h.IsDaemonRunning(id)
	auth.WriteJSON(w, http.StatusOK, st)
}

func (h *Handler) HandleDaemonStart(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if code, msg := ValidateWorkerID(id); code != 0 {
		auth.WriteError(w, code, msg)
		return
	}
	success, msg, pid := h.StartDaemon(id)
	worker, _ := h.GetWorker(id)
	resp := map[string]any{
		"success": success,
		"message": msg,
		"worker":  worker,
	}
	if pid > 0 {
		resp["pid"] = pid
	}
	auth.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) HandleDaemonStop(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if code, msg := ValidateWorkerID(id); code != 0 {
		auth.WriteError(w, code, msg)
		return
	}
	success, msg := h.StopDaemon(id)
	worker, _ := h.GetWorker(id)
	auth.WriteJSON(w, http.StatusOK, map[string]any{
		"success": success,
		"message": msg,
		"worker":  worker,
	})
}

func (h *Handler) HandleUsage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if code, msg := ValidateWorkerID(id); code != 0 {
		auth.WriteError(w, code, msg)
		return
	}
	u := h.GetUsage(id)
	if u == nil {
		auth.WriteError(w, http.StatusNotFound, "Worker not found")
		return
	}
	auth.WriteJSON(w, http.StatusOK, u)
}

func (h *Handler) HandleActivate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if code, msg := ValidateWorkerID(id); code != 0 {
		auth.WriteError(w, code, msg)
		return
	}
	worker, _ := h.GetWorker(id)
	msg := "Worker diinisialisasi"
	if worker != nil && worker.Authenticated {
		msg = "Worker aktif"
	}
	auth.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": msg,
		"worker":  worker,
	})
}

func (h *Handler) HandleAuthLogin(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if code, msg := ValidateWorkerID(id); code != 0 {
		auth.WriteError(w, code, msg)
		return
	}
	pyScript := "/opt/data/home/agy-profiles/login_session.py"
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "python3", pyScript, "start", id)
	out, err := cmd.CombinedOutput()
	outStr := string(out)

	re := regexp.MustCompile(`AUTH_URL=(https://accounts\.google\.com/o/oauth2/auth\S+)`)
	if match := re.FindStringSubmatch(outStr); len(match) > 1 {
		auth.WriteJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"authUrl": match[1],
			"worker":  id,
		})
		return
	}
	urlFile := fmt.Sprintf("/tmp/agy_login_%s.url", id)
	if data, errF := os.ReadFile(urlFile); errF == nil {
		u := strings.TrimSpace(string(data))
		if strings.HasPrefix(u, "https://") {
			auth.WriteJSON(w, http.StatusOK, map[string]any{
				"success": true,
				"authUrl": u,
				"worker":  id,
			})
			return
		}
	}
	errMsg := "Failed to extract authorization URL"
	if err != nil {
		errMsg = err.Error()
	}
	auth.WriteError(w, http.StatusInternalServerError, errMsg)
}

func (h *Handler) HandleAuthSubmit(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if code, msg := ValidateWorkerID(id); code != 0 {
		auth.WriteError(w, code, msg)
		return
	}
	var req struct {
		Code string `json:"code"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	code := strings.TrimSpace(req.Code)
	if code == "" {
		auth.WriteError(w, http.StatusBadRequest, "Kode otorisasi diperlukan")
		return
	}

	pyScript := "/opt/data/home/agy-profiles/login_session.py"
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "python3", pyScript, "submit", id, code)
	out, err := cmd.CombinedOutput()
	outStr := string(out)

	if strings.Contains(outStr, "OK:") {
		msg := strings.TrimSpace(strings.TrimPrefix(outStr, "OK:"))
		worker, _ := h.GetWorker(id)
		auth.WriteJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": msg,
			"worker":  worker,
		})
		return
	}

	if strings.Contains(outStr, "ERROR:") || err != nil {
		msg := strings.TrimSpace(strings.TrimPrefix(outStr, "ERROR:"))
		if msg == "" && err != nil {
			msg = err.Error()
		}
		auth.WriteError(w, http.StatusBadRequest, msg)
		return
	}

	worker, _ := h.GetWorker(id)
	auth.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Login berhasil",
		"worker":  worker,
	})
}

func (h *Handler) HandleAuthLogout(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if code, msg := ValidateWorkerID(id); code != 0 {
		auth.WriteError(w, code, msg)
		return
	}
	_ = h.LogoutWorker(id)
	worker, _ := h.GetWorker(id)
	auth.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": fmt.Sprintf("Worker %s disconnected", id),
		"worker":  worker,
	})
}

func (h *Handler) HandlePromptEnhance(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Prompt string `json:"prompt"`
		Worker string `json:"worker"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	rawPrompt := strings.TrimSpace(req.Prompt)
	if rawPrompt == "" {
		auth.WriteError(w, http.StatusBadRequest, "Prompt field is required")
		return
	}
	workerID := req.Worker
	if pathID := r.PathValue("id"); pathID != "" {
		workerID = pathID
	}
	if workerID == "" {
		workerID = "agy10"
	}

	keysPath := "/opt/data/home/agy-profiles/gemini_keys_pool.json"
	instruction := fmt.Sprintf("Anda adalah Senior Prompt Engineer. Sempurnakan draf instruksi pengguna berikut menjadi instruksi coding agent yang presisi, terstruktur, profesional, dan actionable.\n\nATURAN MUTLAK:\n1. WAJIB MENGGUNAKAN BAHASA INDONESIA YANG JELAS DAN MUDAH DIPAHAMI.\n2. Tuliskan HANYA hasil prompt yang telah disempurnakan tanpa pengantar, tanpa penjelasan, dan tanpa basa-basi.\n3. Jangan gunakan simbol markdown asterik (**) atau pagar (#).\n\nInstruksi Pengguna:\n%s", rawPrompt)

	bynaraKeys := []string{}
	// Pool key ByNara via env (JANGAN hardcode di source publik):
	//   BYNARA_KEYS="sk-...,sk-..." di .env
	for _, k := range strings.Split(os.Getenv("BYNARA_KEYS"), ",") {
		if k != "" {
			bynaraKeys = append(bynaraKeys, k)
		}
	}
	for _, bKey := range bynaraKeys {
		bBody, _ := json.Marshal(map[string]any{
			"model": "stepfun-3.7-flash",
			"messages": []map[string]string{
				{"role": "system", "content": "Anda adalah Senior Prompt Engineer. Sempurnakan draf instruksi pengguna menjadi instruksi eksekusi teknis yang presisi. WAJIB 100% MENGGUNAKAN BAHASA INDONESIA YANG MUDAH DIPAHAMI. Tuliskan HANYA hasil prompt tanpa pengantar, tanpa basa-basi, dan tanpa simbol markdown asterik (**)."},
				{"role": "user", "content": rawPrompt},
			},
			"temperature": 0.2,
		})
		bCtx, bCancel := context.WithTimeout(r.Context(), 5*time.Second)
		bReq, _ := http.NewRequestWithContext(bCtx, http.MethodPost, "https://router.bynara.id/v1/chat/completions", bytes.NewReader(bBody))
		bReq.Header.Set("Content-Type", "application/json")
		bReq.Header.Set("Authorization", "Bearer "+bKey)
		bResp, bErr := http.DefaultClient.Do(bReq)
		bCancel()
		if bErr == nil && bResp.StatusCode == http.StatusOK {
			var bRes struct {
				Choices []struct {
					Message struct {
						Content string `json:"content"`
					} `json:"message"`
				} `json:"choices"`
			}
			if json.NewDecoder(bResp.Body).Decode(&bRes) == nil && len(bRes.Choices) > 0 {
				_ = bResp.Body.Close()
				cleanTxt := strings.TrimSpace(bRes.Choices[0].Message.Content)
				cleanTxt = strings.ReplaceAll(cleanTxt, "**", "")
				cleanTxt = strings.ReplaceAll(cleanTxt, "```", "")
				if len(cleanTxt) > 5 {
					auth.WriteJSON(w, http.StatusOK, map[string]any{
						"success":        true,
						"enhancedPrompt": cleanTxt,
						"originalPrompt": rawPrompt,
					})
					return
				}
			}
			_ = bResp.Body.Close()
		}
	}

	if keysData, err := os.ReadFile(keysPath); err == nil {
		var pool struct {
			Keys []struct {
				APIKey string `json:"api_key"`
			} `json:"keys"`
		}
		if json.Unmarshal(keysData, &pool) == nil {
			for _, k := range pool.Keys {
				if strings.HasPrefix(k.APIKey, "AIza") {
					for _, model := range []string{"gemini-2.5-flash", "gemini-3.8-flash"} {
						url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, k.APIKey)
						bodyPayload, _ := json.Marshal(map[string]any{
							"contents": []map[string]any{
								{"parts": []map[string]string{{"text": instruction}}},
							},
						})
						ctxReq, cancelReq := context.WithTimeout(r.Context(), 3*time.Second)
						httpReq, _ := http.NewRequestWithContext(ctxReq, http.MethodPost, url, bytes.NewReader(bodyPayload))
						httpReq.Header.Set("Content-Type", "application/json")
						resp, errH := http.DefaultClient.Do(httpReq)
						cancelReq()
						if errH == nil && resp.StatusCode == http.StatusOK {
							var resBody struct {
								Candidates []struct {
									Content struct {
										Parts []struct {
											Text string `json:"text"`
										} `json:"parts"`
									} `json:"content"`
								} `json:"candidates"`
							}
							_ = json.NewDecoder(resp.Body).Decode(&resBody)
							_ = resp.Body.Close()
							if len(resBody.Candidates) > 0 && len(resBody.Candidates[0].Content.Parts) > 0 {
								txt := strings.TrimSpace(resBody.Candidates[0].Content.Parts[0].Text)
								if len(txt) > 10 {
									auth.WriteJSON(w, http.StatusOK, map[string]any{
										"success":        true,
										"enhancedPrompt": txt,
										"originalPrompt": rawPrompt,
									})
									return
								}
							}
						}
					}
					break
				}
			}
		}
	}

	pdir := h.GetProfileHome(workerID)
	ctxExec, cancelExec := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancelExec()
	cmd := exec.CommandContext(ctxExec, h.binPath, "--model", "gemini-3.8-flash", "--print", instruction)
	cmd.Dir = pdir
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("HOME=%s", pdir),
		fmt.Sprintf("GEMINI_HOME=%s/.gemini", pdir),
		fmt.Sprintf("PATH=%s", os.Getenv("PATH")),
	)
	out, err := cmd.Output()
	if err == nil {
		txt := strings.TrimSpace(string(out))
		if len(txt) > 15 {
			auth.WriteJSON(w, http.StatusOK, map[string]any{
				"success":        true,
				"enhancedPrompt": txt,
				"originalPrompt": rawPrompt,
			})
			return
		}
	}

	fallbackText := fmt.Sprintf("Analisis project dan implementasikan permintaan berikut dengan standar produksi:\n\n- Sasaran: %s\n- Validasi semua input dan error handling secara komprehensif.\n- Jalankan pengujian dan pastikan integritas sistem terjaga.", rawPrompt)
	auth.WriteJSON(w, http.StatusOK, map[string]any{
		"success":        true,
		"enhancedPrompt": fallbackText,
		"originalPrompt": rawPrompt,
	})
}

var (
	cachedSoul     string
	cachedSoulOnce sync.Once
)

func getSoulPrompt() string {
	cachedSoulOnce.Do(func() {
		paths := []string{
			"/opt/data/home/agyremote-backend/soul.md",
			"/opt/data/home/agyremote/soul.md",
		}
		for _, p := range paths {
			if data, err := os.ReadFile(p); err == nil && len(data) > 0 {
				cachedSoul = strings.TrimSpace(string(data))
				return
			}
		}
		cachedSoul = "AgyRemote AI Brain. Senior Technical Architect and Engineering Partner in AgyRemote."
	})
	return cachedSoul
}

func getGeminiKeys() []string {
	var keys []string
	data, err := os.ReadFile("/opt/data/home/agy-profiles/gemini_keys_pool.json")
	if err == nil {
		var pool struct {
			Keys []struct {
				ApiKey string `json:"api_key"`
			} `json:"keys"`
		}
		if json.Unmarshal(data, &pool) == nil {
			for _, k := range pool.Keys {
				if strings.TrimSpace(k.ApiKey) != "" {
					keys = append(keys, strings.TrimSpace(k.ApiKey))
				}
			}
		}
	}
	if v := strings.TrimSpace(os.Getenv("GEMINI_KEYS")); v != "" {
		for _, p := range strings.Split(v, ",") {
			if p = strings.TrimSpace(p); p != "" {
				keys = append(keys, p)
			}
		}
	}
	return keys
}

func (h *Handler) HandleAiChat(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Messages []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages"`
		Model    string `json:"model"`
		Provider string `json:"provider"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Messages) == 0 {
		auth.WriteError(w, http.StatusBadRequest, "Invalid chat request")
		return
	}
	provider := strings.ToLower(strings.TrimSpace(req.Provider))
	model := strings.ToLower(strings.TrimSpace(req.Model))

	soulText := getSoulPrompt()

	if provider == "gemini" || strings.Contains(model, "gemini") {
		gemModel := "gemini-3.6-flash"
		if strings.Contains(model, "3.8") {
			gemModel = "gemini-3.8-flash"
		} else if strings.Contains(model, "3.6") {
			gemModel = "gemini-3.6-flash"
		} else if strings.Contains(model, "lite") {
			gemModel = "gemini-3.1-flash-lite-preview"
		} else if strings.Contains(model, "pro") {
			gemModel = "gemini-3.1-pro-preview"
		}

		type Part struct {
			Text string `json:"text"`
		}
		type ContentItem struct {
			Role  string `json:"role"`
			Parts []Part `json:"parts"`
		}
		var contents []ContentItem
		for _, m := range req.Messages {
			if m.Role == "system" {
				continue
			}
			role := "user"
			if m.Role == "assistant" || m.Role == "model" {
				role = "model"
			}
			contents = append(contents, ContentItem{
				Role:  role,
				Parts: []Part{{Text: m.Content}},
			})
		}
		reqMap := map[string]any{
			"contents": contents,
			"system_instruction": map[string]any{
				"parts": []Part{{Text: soulText}},
			},
		}
		reqBody, _ := json.Marshal(reqMap)

		geminiKeys := getGeminiKeys()
		for _, gKey := range geminiKeys {
			url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", gemModel, gKey)
			ctxReq, cancelReq := context.WithTimeout(r.Context(), 10*time.Second)
			httpReq, errReq := http.NewRequestWithContext(ctxReq, http.MethodPost, url, bytes.NewReader(reqBody))
			if errReq != nil {
				cancelReq()
				continue
			}
			httpReq.Header.Set("Content-Type", "application/json")
			resp, errH := http.DefaultClient.Do(httpReq)
			if errH == nil && resp.StatusCode == http.StatusOK {
				var gRes struct {
					Candidates []struct {
						Content struct {
							Parts []struct {
								Text string `json:"text"`
							} `json:"parts"`
						} `json:"content"`
					} `json:"candidates"`
				}
				errDec := json.NewDecoder(resp.Body).Decode(&gRes)
				_ = resp.Body.Close()
				cancelReq()
				if errDec == nil && len(gRes.Candidates) > 0 && len(gRes.Candidates[0].Content.Parts) > 0 {
					auth.WriteJSON(w, http.StatusOK, map[string]any{
						"role":    "assistant",
						"content": gRes.Candidates[0].Content.Parts[0].Text,
					})
					return
				}
			} else {
				if resp != nil && resp.Body != nil {
					_ = resp.Body.Close()
				}
				cancelReq()
			}
		}
	}

	bynaraModel := model
	if bynaraModel == "" || strings.Contains(bynaraModel, "gemini") {
		bynaraModel = "stepfun-3.7-flash"
	}
	var bynaraMessages []map[string]string
	bynaraMessages = append(bynaraMessages, map[string]string{
		"role":    "system",
		"content": soulText,
	})
	for _, m := range req.Messages {
		if m.Role != "system" {
			bynaraMessages = append(bynaraMessages, map[string]string{
				"role":    m.Role,
				"content": m.Content,
			})
		}
	}
	bynaraKeys := []string{}
	// Pool key ByNara via env (JANGAN hardcode di source publik):
	//   BYNARA_KEYS="sk-...,sk-..." di .env
	for _, k := range strings.Split(os.Getenv("BYNARA_KEYS"), ",") {
		if k != "" {
			bynaraKeys = append(bynaraKeys, k)
		}
	}
	for _, bKey := range bynaraKeys {
		reqBody, _ := json.Marshal(map[string]any{
			"model":      bynaraModel,
			"messages":   bynaraMessages,
			"max_tokens": 4096,
		})
		ctxReq, cancelReq := context.WithTimeout(r.Context(), 25*time.Second)
		httpReq, _ := http.NewRequestWithContext(ctxReq, http.MethodPost, "https://router.bynara.id/v1/chat/completions", bytes.NewReader(reqBody))
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+bKey)
		resp, errH := http.DefaultClient.Do(httpReq)
		cancelReq()
		if errH == nil && resp.StatusCode == http.StatusOK {
			var bRes struct {
				Choices []struct {
					Message struct {
						Role    string `json:"role"`
						Content string `json:"content"`
					} `json:"message"`
				} `json:"choices"`
			}
			if json.NewDecoder(resp.Body).Decode(&bRes) == nil && len(bRes.Choices) > 0 {
				_ = resp.Body.Close()
				auth.WriteJSON(w, http.StatusOK, map[string]any{
					"role":    "assistant",
					"content": bRes.Choices[0].Message.Content,
				})
				return
			}
			_ = resp.Body.Close()
		} else if resp != nil {
			_ = resp.Body.Close()
		}
	}
	auth.WriteError(w, http.StatusBadGateway, "AI Provider Unavailable")
}

func (h *Handler) HandleProjectMeta(w http.ResponseWriter, r *http.Request) {
	targetPath := r.URL.Query().Get("path")
	if targetPath == "" {
		targetPath = "/opt/data/home/agyremote"
	}
	targetPath = filepath.Clean(targetPath)
	if !strings.HasPrefix(targetPath, "/opt/data") {
		auth.WriteError(w, http.StatusForbidden, "Path outside allowed root")
		return
	}
	projName := filepath.Base(targetPath)
	techStack := []string{}
	entryPoints := []string{}
	summary := ""
	rules := []string{"NOKOMEN", "simpel-text", "hemat-token-wajib"}

	if pkgData, err := os.ReadFile(filepath.Join(targetPath, "package.json")); err == nil {
		techStack = append(techStack, "Node.js")
		var pkg struct {
			Name         string            `json:"name"`
			Dependencies map[string]string `json:"dependencies"`
		}
		if json.Unmarshal(pkgData, &pkg) == nil {
			if pkg.Name != "" {
				projName = pkg.Name
			}
			for dep := range pkg.Dependencies {
				if strings.Contains(dep, "react") {
					techStack = append(techStack, "React")
				} else if strings.Contains(dep, "tailwind") {
					techStack = append(techStack, "Tailwind CSS")
				} else if strings.Contains(dep, "vite") {
					techStack = append(techStack, "Vite")
				}
			}
		}
	}
	if modData, err := os.ReadFile(filepath.Join(targetPath, "go.mod")); err == nil {
		techStack = append(techStack, "Golang")
		lines := strings.Split(string(modData), "\n")
		for _, l := range lines {
			if strings.HasPrefix(l, "module ") {
				projName = strings.TrimSpace(strings.TrimPrefix(l, "module "))
			}
		}
	}
	if readmeData, err := os.ReadFile(filepath.Join(targetPath, "README.md")); err == nil {
		s := string(readmeData)
		if len(s) > 200 {
			summary = strings.TrimSpace(s[:200]) + "..."
		} else {
			summary = strings.TrimSpace(s)
		}
	}
	if summary == "" {
		summary = fmt.Sprintf("Project %s", projName)
	}

	auth.WriteJSON(w, http.StatusOK, map[string]any{
		"projectName": projName,
		"rootPath":    targetPath,
		"summary":     summary,
		"techStack":   techStack,
		"entryPoints": entryPoints,
		"rules":       rules,
		"updatedAt":   time.Now().Format(time.RFC3339),
	})
}

func (h *Handler) HandleGetFile(w http.ResponseWriter, r *http.Request) {
	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		auth.WriteError(w, http.StatusBadRequest, "Missing path parameter")
		return
	}
	cleanPath := filepath.Clean(filePath)
	if strings.Contains(cleanPath, "..") {
		auth.WriteError(w, http.StatusBadRequest, "Invalid file path traversal")
		return
	}

	candidates := []string{
		cleanPath,
		filepath.Join(h.workspaceRoot, cleanPath),
		filepath.Join("/opt/data/home", cleanPath),
		filepath.Join("/opt/data/home/agyremote", cleanPath),
	}

	var resolved string
	for _, p := range candidates {
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			resolved = p
			break
		}
	}

	if resolved == "" {
		auth.WriteError(w, http.StatusNotFound, "File not found")
		return
	}

	data, err := os.ReadFile(resolved)
	if err != nil {
		auth.WriteError(w, http.StatusInternalServerError, "Failed to read file")
		return
	}

	ext := strings.ToLower(filepath.Ext(resolved))
	lang := "plaintext"
	switch ext {
	case ".ts", ".tsx":
		lang = "typescript"
	case ".js", ".jsx", ".mjs", ".cjs":
		lang = "javascript"
	case ".go":
		lang = "go"
	case ".json":
		lang = "json"
	case ".css", ".scss":
		lang = "css"
	case ".html", ".htm":
		lang = "html"
	case ".md":
		lang = "markdown"
	case ".py":
		lang = "python"
	case ".sh", ".bash":
		lang = "bash"
	}

	lines := strings.Count(string(data), "\n") + 1
	auth.WriteJSON(w, http.StatusOK, map[string]any{
		"path":     resolved,
		"name":     filepath.Base(resolved),
		"content":  string(data),
		"language": lang,
		"lines":    lines,
		"size":     len(data),
	})
}
