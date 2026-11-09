package workers

import (
	"database/sql"
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

	_ "modernc.org/sqlite"
)

type ConversationItem struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Preview      string `json:"preview"`
	StepCount    int    `json:"stepCount"`
	LastModified string `json:"lastModified"`
	WorkspaceURI string `json:"workspaceUri"`
}

type WorkspaceFolder struct {
	Name          string             `json:"name"`
	Path          string             `json:"path"`
	URI           string             `json:"uri"`
	Conversations []ConversationItem `json:"conversations"`
}

type WorkspaceData struct {
	WorkerID                string             `json:"workerId"`
	Folders                 []WorkspaceFolder  `json:"folders"`
	NonProjectConversations []ConversationItem `json:"nonProjectConversations"`
}

func (h *Handler) GetWorkerConversations(id string) (*WorkspaceData, error) {
	pdir := h.GetProfileHome(id)
	dbPath := filepath.Join(pdir, ".gemini", "antigravity-cli", "conversation_summaries.db")

	folderMap := make(map[string]*WorkspaceFolder)
	orderedPaths := make([]string, 0)
	nonProject := make([]ConversationItem, 0)

	homeDir := "/opt/data/home"
	if entries, err := os.ReadDir(homeDir); err == nil {
		for _, e := range entries {
			if e.IsDir() && !strings.HasPrefix(e.Name(), ".") && !strings.HasPrefix(e.Name(), "agy-profiles") {
				fPath := filepath.Join(homeDir, e.Name())
				uri := fmt.Sprintf("file://%s", fPath)
				folderMap[fPath] = &WorkspaceFolder{
					Name:          e.Name(),
					Path:          fPath,
					URI:           uri,
					Conversations: make([]ConversationItem, 0),
				}
				orderedPaths = append(orderedPaths, fPath)
			}
		}
	}

	if _, err := os.Stat(dbPath); err == nil {
		dsn := fmt.Sprintf("file:%s?mode=ro&_query_only=true&_pragma=cache_size(-256)&_pragma=mmap_size(0)", dbPath)
		db, err := sql.Open("sqlite", dsn)
		if err == nil {
			defer db.Close()
			db.SetMaxOpenConns(1)
			db.SetMaxIdleConns(0)

			query := "SELECT conversation_id, title, preview, step_count, last_modified_time, workspace_uris, project_id FROM conversation_summaries ORDER BY last_modified_time DESC"
			rows, err := db.Query(query)
			if err == nil {
				defer rows.Close()
				for rows.Next() {
					var cid, title, preview, urisRaw, projID string
					var stepCount int
					var lastMod string

					_ = rows.Scan(&cid, &title, &preview, &stepCount, &lastMod, &urisRaw, &projID)

					var uris []string
					if strings.HasPrefix(urisRaw, "[") {
						_ = json.Unmarshal([]byte(urisRaw), &uris)
					}

					title = strings.TrimSpace(title)
					preview = strings.TrimSpace(preview)

					if (title == "" && preview == "") || stepCount <= 0 {
						continue
					}

					if title == "" {
						title = "Percakapan Tanpa Judul"
					}

					firstURI := ""
					if len(uris) > 0 {
						firstURI = uris[0]
					}

					conv := ConversationItem{
						ID:           cid,
						Title:        title,
						Preview:      preview,
						StepCount:    stepCount,
						LastModified: lastMod,
						WorkspaceURI: firstURI,
					}

					if firstURI != "" {
						fPath := strings.TrimPrefix(firstURI, "file://")
						if f, exists := folderMap[fPath]; exists {
							f.Conversations = append(f.Conversations, conv)
						} else {
							newFolder := &WorkspaceFolder{
								Name:          filepath.Base(fPath),
								Path:          fPath,
								URI:           firstURI,
								Conversations: []ConversationItem{conv},
							}
							folderMap[fPath] = newFolder
							orderedPaths = append(orderedPaths, fPath)
						}
					} else {
						nonProject = append(nonProject, conv)
					}
				}
			}
		}
	}

	withConvs := make([]WorkspaceFolder, 0)
	withoutConvs := make([]WorkspaceFolder, 0)
	for _, p := range orderedPaths {
		if f, exists := folderMap[p]; exists {
			if len(f.Conversations) > 0 {
				withConvs = append(withConvs, *f)
			} else {
				withoutConvs = append(withoutConvs, *f)
			}
		}
	}

	sort.Slice(withConvs, func(i, j int) bool {
		if len(withConvs[i].Conversations) > 0 && len(withConvs[j].Conversations) > 0 {
			return withConvs[i].Conversations[0].LastModified > withConvs[j].Conversations[0].LastModified
		}
		return len(withConvs[i].Conversations) > len(withConvs[j].Conversations)
	})

	folders := append(withConvs, withoutConvs...)

	sort.Slice(nonProject, func(i, j int) bool {
		return nonProject[i].LastModified > nonProject[j].LastModified
	})

	return &WorkspaceData{
		WorkerID:                id,
		Folders:                 folders,
		NonProjectConversations: nonProject,
	}, nil
}

func (h *Handler) CreateQuickFolder(folderName string) (*WorkspaceFolder, error) {
	safeName := folderName
	if safeName == "" {
		safeName = fmt.Sprintf("workspace-%s", time.Now().Format("150405"))
	}
	re := regexp.MustCompile(`[^a-zA-Z0-9_-]`)
	safeName = re.ReplaceAllString(safeName, "_")
	targetPath := filepath.Join("/opt/data/home", safeName)

	if err := os.MkdirAll(targetPath, 0755); err != nil {
		return nil, err
	}

	return &WorkspaceFolder{
		Name:          safeName,
		Path:          targetPath,
		URI:           fmt.Sprintf("file://%s", targetPath),
		Conversations: make([]ConversationItem, 0),
	}, nil
}

func (h *Handler) HandleConversations(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if code, msg := ValidateWorkerID(id); code != 0 {
		auth.WriteError(w, code, msg)
		return
	}
	data, err := h.GetWorkerConversations(id)
	if err != nil {
		auth.WriteError(w, http.StatusInternalServerError, "Gagal mengambil riwayat percakapan")
		return
	}
	auth.WriteJSON(w, http.StatusOK, data)
}

func (h *Handler) HandleQuickFolder(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if code, msg := ValidateWorkerID(id); code != 0 {
		auth.WriteError(w, code, msg)
		return
	}
	var req struct {
		FolderName string `json:"folderName"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	folder, err := h.CreateQuickFolder(req.FolderName)
	if err != nil {
		auth.WriteError(w, http.StatusInternalServerError, "Gagal membuat quick folder")
		return
	}
	auth.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"folder":  folder,
	})
}
