package workers

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"agyremote/internal/auth"
)

type TranscriptSummary struct {
	ConversationID string `json:"conversation_id"`
	StartedAt      string `json:"started_at"`
	LastUpdatedAt  string `json:"last_updated_at"`
	TurnCount      int    `json:"turn_count"`
	FirstPrompt    string `json:"first_prompt"`
	LastResponse   string `json:"last_response"`
}

type TranscriptsResponse struct {
	ID          string              `json:"id"`
	Transcripts []TranscriptSummary `json:"transcripts"`
}

type ConversationMessage struct {
	ID        string `json:"id"`
	Sender    string `json:"sender"`
	Content   string `json:"content"`
	Timestamp string `json:"timestamp"`
}

type MessagesResponse struct {
	ConversationID string                `json:"conversationId"`
	Messages       []ConversationMessage `json:"messages"`
}

type FileChangeItem struct {
	Path      string `json:"path"`
	Name      string `json:"name"`
	Action    string `json:"action"`
	Timestamp string `json:"timestamp,omitempty"`
}

type FileChangesSummary struct {
	Modified int `json:"modified"`
	Created  int `json:"created"`
	Deleted  int `json:"deleted"`
	Total    int `json:"total"`
}

type FileChangesResponse struct {
	Worker         string             `json:"worker"`
	ConversationID string             `json:"conversation_id"`
	Changes        []FileChangeItem   `json:"changes"`
	Summary        FileChangesSummary `json:"summary"`
}

func CleanPrompt(p string) string {
	lines := strings.Split(p, "\n")
	first := ""
	for _, l := range lines {
		t := strings.TrimSpace(l)
		if t != "" {
			first = t
			break
		}
	}
	if len(first) > 120 {
		return first[:117] + "..."
	}
	return first
}

func ExecutiveSummary(text string, maxLen int) string {
	clean := strings.TrimSpace(text)
	if len(clean) > maxLen {
		return clean[:maxLen-3] + "..."
	}
	return clean
}

func (h *Handler) GetTranscripts(id string, limit int) *TranscriptsResponse {
	pdir := h.GetProfileHome(id)
	brainDir := filepath.Join(pdir, ".gemini", "antigravity-cli", "brain")

	res := &TranscriptsResponse{
		ID:          id,
		Transcripts: make([]TranscriptSummary, 0),
	}

	type candidate struct {
		id      string
		logPath string
		mtime   time.Time
	}

	entries, err := os.ReadDir(brainDir)
	if err != nil {
		return res
	}

	var candidates []candidate
	for _, e := range entries {
		if e.IsDir() {
			logPath := filepath.Join(brainDir, e.Name(), ".system_generated", "logs", "transcript.jsonl")
			if fi, err := os.Stat(logPath); err == nil {
				candidates = append(candidates, candidate{
					id:      e.Name(),
					logPath: logPath,
					mtime:   fi.ModTime(),
				})
			}
		}
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].mtime.After(candidates[j].mtime)
	})

	if len(candidates) > limit {
		candidates = candidates[:limit]
	}

	for _, c := range candidates {
		startedAt := c.mtime.UTC().Format("2006-01-02T15:04:05.000Z")
		firstPrompt := ""
		lastResponse := ""
		turnCount := 0

		if f, err := os.Open(c.logPath); err == nil {
			scanner := bufio.NewScanner(f)
			for scanner.Scan() {
				line := strings.TrimSpace(scanner.Text())
				if line == "" {
					continue
				}
				var item struct {
					CreatedAt string `json:"created_at"`
					Type      string `json:"type"`
					Content   string `json:"content"`
				}
				if json.Unmarshal([]byte(line), &item) == nil {
					if firstPrompt == "" && item.CreatedAt != "" {
						startedAt = item.CreatedAt
					}
					if item.Type == "USER_INPUT" {
						turnCount++
						if firstPrompt == "" {
							firstPrompt = CleanPrompt(item.Content)
						}
					}
					if item.Type == "PLANNER_RESPONSE" && item.Content != "" {
						lastResponse = ExecutiveSummary(item.Content, 200)
					}
				}
			}
			_ = f.Close()
		}

		if firstPrompt == "" {
			firstPrompt = "(No prompt recorded)"
		}
		if lastResponse == "" {
			lastResponse = "(No response recorded)"
		}

		res.Transcripts = append(res.Transcripts, TranscriptSummary{
			ConversationID: c.id,
			StartedAt:      startedAt,
			LastUpdatedAt:  c.mtime.UTC().Format("2006-01-02T15:04:05.000Z"),
			TurnCount:      turnCount,
			FirstPrompt:    firstPrompt,
			LastResponse:   lastResponse,
		})
	}

	return res
}

func (h *Handler) GetConversationMessages(id, conversationID string) *MessagesResponse {
	pdir := h.GetProfileHome(id)
	transcriptPath := filepath.Join(pdir, ".gemini", "antigravity-cli", "brain", conversationID, ".system_generated", "logs", "transcript.jsonl")

	res := &MessagesResponse{
		ConversationID: conversationID,
		Messages:       make([]ConversationMessage, 0),
	}

	f, err := os.Open(transcriptPath)
	if err != nil {
		return res
	}
	defer f.Close()

	userReqRe := regexp.MustCompile(`(?s)<USER_REQUEST>(.*?)</USER_REQUEST>`)
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var item struct {
			StepIndex int    `json:"step_index"`
			Type      string `json:"type"`
			Content   string `json:"content"`
			CreatedAt string `json:"created_at"`
		}
		if json.Unmarshal([]byte(line), &item) == nil {
			ts := ""
			if item.CreatedAt != "" {
				if t, err := time.Parse(time.RFC3339Nano, item.CreatedAt); err == nil {
					ts = t.UTC().Format("03:04 PM")
				} else if t, err := time.Parse(time.RFC3339, item.CreatedAt); err == nil {
					ts = t.UTC().Format("03:04 PM")
				}
			}

			if item.Type == "USER_INPUT" {
				content := item.Content
				if match := userReqRe.FindStringSubmatch(content); len(match) > 1 {
					content = strings.TrimSpace(match[1])
				}
				res.Messages = append(res.Messages, ConversationMessage{
					ID:        fmt.Sprintf("u_%d", item.StepIndex),
					Sender:    "user",
					Content:   content,
					Timestamp: ts,
				})
			} else if item.Type == "PLANNER_RESPONSE" && item.Content != "" {
				res.Messages = append(res.Messages, ConversationMessage{
					ID:        fmt.Sprintf("a_%d", item.StepIndex),
					Sender:    "agent",
					Content:   item.Content,
					Timestamp: ts,
				})
			}
		}
	}

	return res
}

func (h *Handler) GetFileChanges(id string) *FileChangesResponse {
	pdir := h.GetProfileHome(id)
	brainDir := filepath.Join(pdir, ".gemini", "antigravity-cli", "brain")

	res := &FileChangesResponse{
		Worker:         id,
		ConversationID: "",
		Changes:        make([]FileChangeItem, 0),
		Summary:        FileChangesSummary{},
	}

	entries, err := os.ReadDir(brainDir)
	if err != nil {
		return res
	}

	type candidate struct {
		id      string
		logPath string
		mtime   time.Time
	}

	var candidates []candidate
	for _, e := range entries {
		if e.IsDir() {
			logPath := filepath.Join(brainDir, e.Name(), ".system_generated", "logs", "transcript.jsonl")
			if fi, err := os.Stat(logPath); err == nil {
				candidates = append(candidates, candidate{
					id:      e.Name(),
					logPath: logPath,
					mtime:   fi.ModTime(),
				})
			}
		}
	}

	if len(candidates) == 0 {
		return res
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].mtime.After(candidates[j].mtime)
	})

	latest := candidates[0]
	res.ConversationID = latest.id

	changesMap := make(map[string]FileChangeItem)

	f, err := os.Open(latest.logPath)
	if err != nil {
		return res
	}
	defer f.Close()

	rmRe := regexp.MustCompile(`\brm\s+(?:-[a-zA-Z]+\s+)?([^\s&|;]+)`)
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var item struct {
			CreatedAt string `json:"created_at"`
			ToolCalls []struct {
				Name string         `json:"name"`
				Args map[string]any `json:"args"`
			} `json:"tool_calls"`
		}
		if json.Unmarshal([]byte(line), &item) == nil {
			for _, tc := range item.ToolCalls {
				name := tc.Name
				filePath := ""
				if p, ok := tc.Args["Path"].(string); ok {
					filePath = strings.Trim(strings.TrimSpace(p), `"'`)
				} else if p, ok := tc.Args["path"].(string); ok {
					filePath = strings.Trim(strings.TrimSpace(p), `"'`)
				}

				if filePath == "" {
					if name == "run_command" {
						if cmd, ok := tc.Args["CommandLine"].(string); ok {
							if match := rmRe.FindStringSubmatch(cmd); len(match) > 1 {
								filePath = strings.Trim(strings.TrimSpace(match[1]), `"'`)
								base := filepath.Base(filePath)
								changesMap[filePath] = FileChangeItem{
									Path:      filePath,
									Name:      base,
									Action:    "deleted",
									Timestamp: item.CreatedAt,
								}
							}
						}
					}
					continue
				}

				base := filepath.Base(filePath)
				if name == "edit_file" {
					changesMap[filePath] = FileChangeItem{
						Path:      filePath,
						Name:      base,
						Action:    "modified",
						Timestamp: item.CreatedAt,
					}
				} else if name == "write_file" {
					act := "created"
					if ov, ok := tc.Args["Overwrite"].(bool); ok && ov {
						act = "modified"
					} else if ap, ok := tc.Args["Append"].(bool); ok && ap {
						act = "modified"
					}
					changesMap[filePath] = FileChangeItem{
						Path:      filePath,
						Name:      base,
						Action:    act,
						Timestamp: item.CreatedAt,
					}
				}
			}
		}
	}

	for _, item := range changesMap {
		res.Changes = append(res.Changes, item)
		switch item.Action {
		case "modified":
			res.Summary.Modified++
		case "created":
			res.Summary.Created++
		case "deleted":
			res.Summary.Deleted++
		}
	}
	res.Summary.Total = len(res.Changes)

	return res
}

func (h *Handler) HandleTranscripts(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if code, msg := ValidateWorkerID(id); code != 0 {
		auth.WriteError(w, code, msg)
		return
	}
	data := h.GetTranscripts(id, 10)
	auth.WriteJSON(w, http.StatusOK, data)
}

func (h *Handler) HandleMessages(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if code, msg := ValidateWorkerID(id); code != 0 {
		auth.WriteError(w, code, msg)
		return
	}
	cid := r.PathValue("cid")
	data := h.GetConversationMessages(id, cid)
	auth.WriteJSON(w, http.StatusOK, data)
}

func (h *Handler) HandleFileChanges(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if code, msg := ValidateWorkerID(id); code != 0 {
		auth.WriteError(w, code, msg)
		return
	}
	data := h.GetFileChanges(id)
	auth.WriteJSON(w, http.StatusOK, data)
}
