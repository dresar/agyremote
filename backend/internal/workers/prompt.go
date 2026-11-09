package workers

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"time"

	"agyremote/internal/auth"
)

var (
	ansiRegex    = regexp.MustCompile(`\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])`)
	userReqRegex = regexp.MustCompile(`(?is)<USER_REQUEST>.*?</USER_REQUEST>`)
	addMetaRegex = regexp.MustCompile(`(?is)<ADDITIONAL_METADATA>.*?</ADDITIONAL_METADATA>`)
	userSetRegex = regexp.MustCompile(`(?is)<USER_SETTINGS_CHANGE>.*?</USER_SETTINGS_CHANGE>`)
	sysMsgRegex  = regexp.MustCompile(`(?is)<SYSTEM_MESSAGE>.*?</SYSTEM_MESSAGE>`)
	xmlTagsRegex = regexp.MustCompile(`(?i)</?(USER_REQUEST|ADDITIONAL_METADATA|USER_SETTINGS_CHANGE|SYSTEM_MESSAGE)[^>]*>`)
)

func StripClutter(text string) string {
	if text == "" {
		return ""
	}
	cleaned := ansiRegex.ReplaceAllString(text, "")
	cleaned = userReqRegex.ReplaceAllString(cleaned, "")
	cleaned = addMetaRegex.ReplaceAllString(cleaned, "")
	cleaned = userSetRegex.ReplaceAllString(cleaned, "")
	cleaned = sysMsgRegex.ReplaceAllString(cleaned, "")
	cleaned = xmlTagsRegex.ReplaceAllString(cleaned, "")
	return cleaned
}

type PromptRequest struct {
	Prompt         *string `json:"prompt"`
	Model          string  `json:"model"`
	ConversationID string  `json:"conversationId"`
	WorkspaceDir   string  `json:"workspaceDir"`
}

func (h *Handler) HandlePrompt(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if code, msg := ValidateWorkerID(id); code != 0 {
		auth.WriteError(w, code, msg)
		return
	}

	var req PromptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Prompt == nil {
		auth.WriteError(w, http.StatusBadRequest, "Prompt field is required and must be a non-empty string")
		return
	}

	promptText := strings.TrimSpace(*req.Prompt)
	if promptText == "" {
		auth.WriteError(w, http.StatusBadRequest, "Prompt must not be empty")
		return
	}

	if len(promptText) > 1000000 {
		auth.WriteError(w, http.StatusRequestEntityTooLarge, "Prompt exceeds maximum payload size")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		auth.WriteError(w, http.StatusInternalServerError, "Streaming unsupported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	startEvent, _ := json.Marshal(map[string]any{
		"type":   "start",
		"worker": id,
	})
	fmt.Fprintf(w, "data: %s\n\n", startEvent)
	flusher.Flush()

	pdir := h.GetProfileHome(id)
	args := []string{"-p", promptText, "--output-format", "stream-json", "--dangerously-skip-permissions"}
	if req.Model != "" {
		args = append(args, "--model", req.Model)
	}
	if req.ConversationID != "" {
		args = append(args, "--conversation", req.ConversationID)
	}
	if req.WorkspaceDir != "" {
		if fi, err := os.Stat(req.WorkspaceDir); err == nil && fi.IsDir() {
			args = append(args, "--add-dir", req.WorkspaceDir)
		}
	}

	env := append(os.Environ(),
		fmt.Sprintf("HOME=%s", pdir),
		fmt.Sprintf("GEMINI_HOME=%s/.gemini", pdir),
		fmt.Sprintf("PATH=/opt/data/tools/go/bin:/opt/data/home/.local/bin:%s", os.Getenv("PATH")),
	)

	defaultCwd := "/opt/data"
	if fi, err := os.Stat("/opt/data/home/AgyRemoteTele"); err == nil && fi.IsDir() {
		defaultCwd = "/opt/data/home/AgyRemoteTele"
	}
	workspaceCwd := defaultCwd
	if req.WorkspaceDir != "" {
		if fi, err := os.Stat(req.WorkspaceDir); err == nil && fi.IsDir() {
			workspaceCwd = req.WorkspaceDir
		}
	}

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	cmd := exec.CommandContext(ctx, h.binPath, args...)
	cmd.Dir = workspaceCwd
	cmd.Env = env
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errEvent, _ := json.Marshal(map[string]any{"type": "error", "message": err.Error()})
		fmt.Fprintf(w, "data: %s\n\ndata: [DONE]\n\n", errEvent)
		flusher.Flush()
		return
	}

	activeSessions.Store(id, fmt.Sprintf("running_%d", time.Now().UnixMilli()))
	defer activeSessions.Delete(id)

	if err := cmd.Start(); err != nil {
		errEvent, _ := json.Marshal(map[string]any{"type": "error", "message": err.Error()})
		fmt.Fprintf(w, "data: %s\n\ndata: [DONE]\n\n", errEvent)
		flusher.Flush()
		return
	}

	pingTicker := time.NewTicker(10 * time.Second)
	defer pingTicker.Stop()

	doneCh := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			if cmd.Process != nil {
				_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM)
			}
		case <-doneCh:
		}
	}()
	defer close(doneCh)

	go func() {
		for {
			select {
			case <-pingTicker.C:
				fmt.Fprintf(w, ": ping\n\n")
				flusher.Flush()
			case <-ctx.Done():
				return
			case <-doneCh:
				return
			}
		}
	}()

	scanner := bufio.NewScanner(stdout)
	fullResponse := ""
	convID := ""
	resultEmitted := false

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var event struct {
			Event          string `json:"event"`
			ConversationID string `json:"conversation_id"`
			StepUpdate     *struct {
				ConversationID  string  `json:"conversation_id"`
				StepType        string  `json:"step_type"`
				TextDelta       string  `json:"text_delta"`
				ToolName        string  `json:"tool_name"`
				State           string  `json:"state"`
				DurationSeconds float64 `json:"duration_seconds"`
				ToolInfo        *struct {
					Name       string         `json:"name"`
					Parameters map[string]any `json:"parameters"`
					Output     string         `json:"output"`
					Error      *struct {
						Type    string `json:"type"`
						Message string `json:"message"`
					} `json:"error"`
				} `json:"tool_info"`
				Args map[string]any `json:"args"`
			} `json:"step_update"`
			Result *struct {
				Status         string `json:"status"`
				Response       string `json:"response"`
				ConversationID string `json:"conversation_id"`
			} `json:"result"`
		}

		if err := json.Unmarshal([]byte(line), &event); err != nil {
			cleanLine := StripClutter(line)
			if cleanLine != "" {
				fullResponse += cleanLine
				deltaEv, _ := json.Marshal(map[string]any{"type": "text_delta", "text": cleanLine})
				fmt.Fprintf(w, "data: %s\n\n", deltaEv)
				flusher.Flush()
			}
			continue
		}

		if event.ConversationID != "" && convID == "" {
			convID = event.ConversationID
		}

		if event.Event == "step_update" && event.StepUpdate != nil {
			u := event.StepUpdate
			if u.ConversationID != "" && convID == "" {
				convID = u.ConversationID
			}

			if u.StepType == "agent_response" && u.TextDelta != "" {
				cleanDelta := StripClutter(u.TextDelta)
				if cleanDelta != "" {
					fullResponse += cleanDelta
					deltaEv, _ := json.Marshal(map[string]any{"type": "text_delta", "text": cleanDelta})
					fmt.Fprintf(w, "data: %s\n\n", deltaEv)
					flusher.Flush()
				}
			}

			if u.StepType == "tool" {
				toolName := u.ToolName
				if toolName == "" && u.ToolInfo != nil {
					toolName = u.ToolInfo.Name
				}
				if toolName == "" {
					toolName = "tool"
				}

				targetPath := ""
				action := ""
				detail := ""
				outputStr := ""

				var params map[string]any
				if u.ToolInfo != nil && u.ToolInfo.Parameters != nil {
					params = u.ToolInfo.Parameters
					outputStr = u.ToolInfo.Output
					if outputStr == "" && u.ToolInfo.Error != nil {
						outputStr = u.ToolInfo.Error.Message
					}
				} else if u.Args != nil {
					params = u.Args
				}

				if params != nil {
					if p, ok := params["Path"].(string); ok {
						targetPath = strings.Trim(strings.TrimSpace(p), `"'`)
					} else if p, ok := params["path"].(string); ok {
						targetPath = strings.Trim(strings.TrimSpace(p), `"'`)
					} else if p, ok := params["AbsolutePath"].(string); ok {
						targetPath = strings.Trim(strings.TrimSpace(p), `"'`)
					}

					if cmdLine, ok := params["CommandLine"].(string); ok {
						detail = strings.Trim(strings.TrimSpace(cmdLine), `"'`)
					} else if ts, ok := params["toolSummary"].(string); ok {
						detail = strings.Trim(strings.TrimSpace(ts), `"'`)
					}
				}

				if detail == "" && targetPath != "" {
					detail = targetPath
				}

				switch toolName {
				case "edit_file":
					action = "modified"
				case "write_file", "write_to_file":
					action = "created"
				case "read_file", "view_file":
					action = "read"
				case "run_command":
					action = "command"
				default:
					action = "tool"
				}

				st := u.State
				if st == "" {
					st = "DONE"
				}

				toolEv, _ := json.Marshal(map[string]any{
					"type":   "tool_status",
					"name":   toolName,
					"state":  st,
					"path":   targetPath,
					"action": action,
					"detail": detail,
					"output": outputStr,
				})
				fmt.Fprintf(w, "data: %s\n\n", toolEv)

				if targetPath != "" && (action == "modified" || action == "created" || action == "deleted") {
					fileEv, _ := json.Marshal(map[string]any{
						"type": "file_change",
						"file": map[string]string{
							"path":   targetPath,
							"action": action,
							"name":   filepath.Base(targetPath),
						},
					})
					fmt.Fprintf(w, "data: %s\n\n", fileEv)
				}
				flusher.Flush()
			}
		}

		if event.Event == "result" && event.Result != nil {
			res := event.Result
			if res.ConversationID != "" {
				convID = res.ConversationID
			}
			summary := ExecutiveSummary(res.Response, 300)
			if summary == "" {
				summary = ExecutiveSummary(fullResponse, 300)
			}
			st := res.Status
			if st == "" {
				st = "COMPLETED"
			}
			resEv, _ := json.Marshal(map[string]any{
				"type":            "result",
				"status":          st,
				"summary":         summary,
				"conversation_id": convID,
			})
			fmt.Fprintf(w, "data: %s\n\n", resEv)
			flusher.Flush()
			resultEmitted = true
		}
	}

	_ = cmd.Wait()

	if !resultEmitted {
		summary := ExecutiveSummary(fullResponse, 300)
		if summary == "" {
			summary = "Execution finished"
		}
		resEv, _ := json.Marshal(map[string]any{
			"type":            "result",
			"status":          "COMPLETED",
			"summary":         summary,
			"conversation_id": convID,
		})
		fmt.Fprintf(w, "data: %s\n\n", resEv)
	}

	fmt.Fprintf(w, "data: [DONE]\n\n")
	flusher.Flush()
}
