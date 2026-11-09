package antigravity

import (
	"context"
	"net/http"
	"os/exec"
	"strings"
	"time"

	"agyremote/internal/auth"
)

type VersionResponse struct {
	Version string `json:"version"`
	BinPath string `json:"binPath"`
}

type UpdateResponse struct {
	Success bool   `json:"success"`
	Output  string `json:"output"`
	Version string `json:"version"`
}

type ChangelogResponse struct {
	Changelog string `json:"changelog"`
}

type Handler struct {
	binPath string
}

func NewHandler(binPath string) *Handler {
	if binPath == "" {
		binPath = "/opt/data/home/.local/bin/agy"
	}
	return &Handler{binPath: binPath}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/antigravity/version", h.HandleVersion)
	mux.HandleFunc("POST /api/antigravity/update", h.HandleUpdate)
	mux.HandleFunc("GET /api/antigravity/changelog", h.HandleChangelog)
}

func RegisterRoutes(mux *http.ServeMux, binPath string) {
	NewHandler(binPath).RegisterRoutes(mux)
}

func (h *Handler) GetVersion(ctx context.Context) string {
	execCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(execCtx, h.binPath, "--version")
	out, err := cmd.Output()
	if err != nil {
		return "1.4.9"
	}

	ver := strings.TrimSpace(string(out))
	if ver == "" {
		return "1.4.9"
	}
	return ver
}

func (h *Handler) HandleVersion(w http.ResponseWriter, r *http.Request) {
	ver := h.GetVersion(r.Context())
	auth.WriteJSON(w, http.StatusOK, VersionResponse{
		Version: ver,
		BinPath: h.binPath,
	})
}

func (h *Handler) HandleUpdate(w http.ResponseWriter, r *http.Request) {
	execCtx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	cmd := exec.CommandContext(execCtx, h.binPath, "update")
	cmd.Stdin = nil
	out, err := cmd.CombinedOutput()

	success := true
	outputStr := strings.TrimSpace(string(out))

	if err != nil {
		success = false
		if outputStr == "" {
			outputStr = err.Error()
		}
	}

	ver := h.GetVersion(r.Context())
	auth.WriteJSON(w, http.StatusOK, UpdateResponse{
		Success: success,
		Output:  outputStr,
		Version: ver,
	})
}

func (h *Handler) HandleChangelog(w http.ResponseWriter, r *http.Request) {
	execCtx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(execCtx, h.binPath, "changelog")
	out, err := cmd.Output()

	changelog := strings.TrimSpace(string(out))
	if err != nil || changelog == "" {
		changelog = "Changelog tidak tersedia saat ini"
	}

	auth.WriteJSON(w, http.StatusOK, ChangelogResponse{
		Changelog: changelog,
	})
}
