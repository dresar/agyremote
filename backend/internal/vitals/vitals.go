package vitals

import (
	"encoding/json"
	"net/http"

	"agyremote/internal/auth"
)

type Handler struct {
	workspaceRoot string
}

func NewHandler(workspaceRoot string) *Handler {
	if workspaceRoot == "" {
		workspaceRoot = "/opt/data"
	}
	return &Handler{workspaceRoot: workspaceRoot}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/system/vitals", h.HandleVitals)
	mux.HandleFunc("GET /api/vitals", h.HandleVitals)
	mux.HandleFunc("GET /api/processes", h.HandleListProcesses)
	mux.HandleFunc("GET /api/system/processes", h.HandleListProcesses)
	mux.HandleFunc("POST /api/processes/{pid}/kill", h.HandleKillProcess)
	mux.HandleFunc("POST /api/system/processes/{pid}/kill", h.HandleKillProcess)
}

func RegisterRoutes(mux *http.ServeMux, workspaceRoot string) {
	NewHandler(workspaceRoot).RegisterRoutes(mux)
}

func (h *Handler) HandleVitals(w http.ResponseWriter, r *http.Request) {
	vitals := GetSystemVitals(h.workspaceRoot)
	auth.WriteJSON(w, http.StatusOK, vitals)
}

func (h *Handler) HandleListProcesses(w http.ResponseWriter, r *http.Request) {
	procs := ListProcesses()
	auth.WriteJSON(w, http.StatusOK, map[string]any{
		"processes": procs,
	})
}

func (h *Handler) HandleKillProcess(w http.ResponseWriter, r *http.Request) {
	pidStr := r.PathValue("pid")
	signalName := ""
	if r.Body != nil {
		var req struct {
			Signal string `json:"signal"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		signalName = req.Signal
	}

	res := KillProcess(pidStr, signalName)
	if res.Status != http.StatusOK {
		auth.WriteJSON(w, res.Status, map[string]any{
			"error":   res.Error,
			"success": false,
		})
		return
	}

	resp := map[string]any{
		"success": res.Success,
		"pid":     res.PID,
		"signal":  res.Signal,
	}
	if res.Warning != "" {
		resp["warning"] = res.Warning
	}
	auth.WriteJSON(w, http.StatusOK, resp)
}
