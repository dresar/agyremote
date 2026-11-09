package workers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	"agyremote/internal/auth"
)

type SkillItem struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Workers     []string `json:"workers"`
	Path        string   `json:"path,omitempty"`
}

type SkillDetailResponse struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Content     string   `json:"content"`
	Workers     []string `json:"workers"`
}

type SaveSkillRequest struct {
	Name          string   `json:"name"`
	Description   string   `json:"description"`
	Content       string   `json:"content"`
	TargetWorkers []string `json:"targetWorkers"`
}

type InstallSkillRequest struct {
	Source        string   `json:"source"`
	Type          string   `json:"type"`
	TargetWorkers []string `json:"targetWorkers"`
}

func parseSkillFrontmatter(content string) (string, string) {
	name := ""
	desc := ""
	lines := strings.Split(content, "\n")
	inFrontmatter := false
	for _, l := range lines {
		trimmed := strings.TrimSpace(l)
		if trimmed == "---" {
			if !inFrontmatter {
				inFrontmatter = true
				continue
			} else {
				break
			}
		}
		if inFrontmatter {
			if strings.HasPrefix(trimmed, "name:") {
				name = strings.TrimSpace(strings.TrimPrefix(trimmed, "name:"))
				name = strings.Trim(name, `"'`)
			} else if strings.HasPrefix(trimmed, "description:") {
				desc = strings.TrimSpace(strings.TrimPrefix(trimmed, "description:"))
				desc = strings.Trim(desc, `"'`)
			}
		}
	}
	return name, desc
}

func (h *Handler) resolveTargetWorkers(targets []string) []string {
	allWorkers := make([]string, 0, 15)
	for i := 1; i <= 15; i++ {
		allWorkers = append(allWorkers, fmt.Sprintf("agy%02d", i))
	}
	if len(targets) == 0 {
		return allWorkers
	}
	for _, t := range targets {
		if strings.ToLower(t) == "all" || strings.ToLower(t) == "semua" {
			return allWorkers
		}
	}
	resolved := make([]string, 0, len(targets))
	for _, t := range targets {
		norm := strings.ToLower(strings.TrimSpace(t))
		if strings.HasPrefix(norm, "agy") {
			resolved = append(resolved, norm)
		}
	}
	if len(resolved) == 0 {
		return allWorkers
	}
	return resolved
}

func (h *Handler) ListAllSkills() []SkillItem {
	skillMap := make(map[string]*SkillItem)
	orderedNames := make([]string, 0)

	for i := 1; i <= 15; i++ {
		wID := fmt.Sprintf("agy%02d", i)
		pdir := h.GetProfileHome(wID)
		skillsDir := filepath.Join(pdir, ".gemini", "config", "skills")
		entries, err := os.ReadDir(skillsDir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			skName := e.Name()
			mdPath := filepath.Join(skillsDir, skName, "SKILL.md")
			data, err := os.ReadFile(mdPath)
			if err != nil {
				continue
			}
			name, desc := parseSkillFrontmatter(string(data))
			if name == "" {
				name = skName
			}
			if item, exists := skillMap[name]; exists {
				hasWorker := false
				for _, w := range item.Workers {
					if w == wID {
						hasWorker = true
						break
					}
				}
				if !hasWorker {
					item.Workers = append(item.Workers, wID)
				}
			} else {
				newItem := &SkillItem{
					Name:        name,
					Description: desc,
					Workers:     []string{wID},
					Path:        mdPath,
				}
				skillMap[name] = newItem
				orderedNames = append(orderedNames, name)
			}
		}
	}

	sort.Strings(orderedNames)
	result := make([]SkillItem, 0, len(orderedNames))
	for _, n := range orderedNames {
		if it, ok := skillMap[n]; ok {
			result = append(result, *it)
		}
	}
	return result
}

func (h *Handler) GetSkillDetail(name string) (*SkillDetailResponse, error) {
	for i := 1; i <= 15; i++ {
		wID := fmt.Sprintf("agy%02d", i)
		pdir := h.GetProfileHome(wID)
		mdPath := filepath.Join(pdir, ".gemini", "config", "skills", name, "SKILL.md")
		if data, err := os.ReadFile(mdPath); err == nil {
			skName, desc := parseSkillFrontmatter(string(data))
			if skName == "" {
				skName = name
			}
			allSkills := h.ListAllSkills()
			workers := []string{wID}
			for _, s := range allSkills {
				if s.Name == name {
					workers = s.Workers
					break
				}
			}
			return &SkillDetailResponse{
				Name:        skName,
				Description: desc,
				Content:     string(data),
				Workers:     workers,
			}, nil
		}
	}
	return nil, fmt.Errorf("skill not found")
}

func (h *Handler) DeploySkill(name, description, content string, targetWorkers []string) (int, error) {
	cleanName := strings.TrimSpace(name)
	if cleanName == "" {
		return 0, fmt.Errorf("skill name is required")
	}
	cleanName = strings.ReplaceAll(cleanName, " ", "-")
	cleanName = strings.ToLower(cleanName)

	workers := h.resolveTargetWorkers(targetWorkers)
	finalContent := content
	if !strings.HasPrefix(strings.TrimSpace(content), "---") {
		cleanDesc := strings.TrimSpace(description)
		if cleanDesc == "" {
			cleanDesc = cleanName
		}
		finalContent = fmt.Sprintf("---\nname: %s\ndescription: \"%s\"\n---\n\n%s", cleanName, cleanDesc, content)
	}

	installed := 0
	for _, wID := range workers {
		pdir := h.GetProfileHome(wID)
		targetDir := filepath.Join(pdir, ".gemini", "config", "skills", cleanName)
		if err := os.MkdirAll(targetDir, 0755); err == nil {
			mdPath := filepath.Join(targetDir, "SKILL.md")
			if err := os.WriteFile(mdPath, []byte(finalContent), 0644); err == nil {
				installed++
			}
		}
	}
	return installed, nil
}

func (h *Handler) DeleteSkill(name string, targetWorkers []string) (int, error) {
	cleanName := strings.TrimSpace(name)
	if cleanName == "" {
		return 0, fmt.Errorf("skill name is required")
	}
	workers := h.resolveTargetWorkers(targetWorkers)
	deleted := 0
	for _, wID := range workers {
		pdir := h.GetProfileHome(wID)
		targetDir := filepath.Join(pdir, ".gemini", "config", "skills", cleanName)
		if _, err := os.Stat(targetDir); err == nil {
			if err := os.RemoveAll(targetDir); err == nil {
				deleted++
			}
		}
	}
	return deleted, nil
}

func (h *Handler) HandleListSkills(w http.ResponseWriter, r *http.Request) {
	skills := h.ListAllSkills()
	auth.WriteJSON(w, http.StatusOK, map[string]any{
		"skills":  skills,
		"workers": h.resolveTargetWorkers(nil),
		"total":   len(skills),
	})
}

func (h *Handler) HandleGetSkill(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" {
		auth.WriteError(w, http.StatusBadRequest, "Skill name is required")
		return
	}
	detail, err := h.GetSkillDetail(name)
	if err != nil {
		auth.WriteError(w, http.StatusNotFound, "Skill not found")
		return
	}
	auth.WriteJSON(w, http.StatusOK, detail)
}

func (h *Handler) HandleSaveSkill(w http.ResponseWriter, r *http.Request) {
	var req SaveSkillRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		auth.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Name == "" {
		auth.WriteError(w, http.StatusBadRequest, "Skill name is required")
		return
	}
	count, err := h.DeploySkill(req.Name, req.Description, req.Content, req.TargetWorkers)
	if err != nil {
		auth.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	auth.WriteJSON(w, http.StatusOK, map[string]any{
		"success":        true,
		"installedCount": count,
		"name":           req.Name,
	})
}

func (h *Handler) HandleInstallSkill(w http.ResponseWriter, r *http.Request) {
	var req InstallSkillRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		auth.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	source := strings.TrimSpace(req.Source)
	if source == "" {
		auth.WriteError(w, http.StatusBadRequest, "Source is required")
		return
	}

	skillName := ""
	skillContent := ""
	skillDesc := ""

	if strings.HasPrefix(source, "http://") || strings.HasPrefix(source, "https://") || strings.HasSuffix(source, ".git") {
		tmpDir, err := os.MkdirTemp("", "skill-git-*")
		if err == nil {
			defer os.RemoveAll(tmpDir)
			cmd := exec.Command("git", "clone", "--depth", "1", source, tmpDir)
			if err := cmd.Run(); err == nil {
				skillMDPath := filepath.Join(tmpDir, "SKILL.md")
				if data, err := os.ReadFile(skillMDPath); err == nil {
					skillContent = string(data)
					skillName, skillDesc = parseSkillFrontmatter(skillContent)
				}
			}
		}
	} else if strings.HasPrefix(source, "npx ") || req.Type == "npx" {
		pkg := strings.TrimPrefix(source, "npx ")
		pkg = strings.TrimSpace(pkg)
		cleanPkgName := filepath.Base(pkg)
		cleanPkgName = strings.TrimPrefix(cleanPkgName, "@")
		cleanPkgName = strings.ReplaceAll(cleanPkgName, "/", "-")
		cleanPkgName = strings.ToLower(cleanPkgName)

		skillName = cleanPkgName
		skillDesc = fmt.Sprintf("Skill package %s installed via NPX", pkg)
		skillContent = fmt.Sprintf("---\nname: %s\ndescription: \"%s\"\n---\n\n# %s\n\nInstruksi operasional dari paket npx %s.\n", skillName, skillDesc, skillName, pkg)
	} else {
		skillName = strings.ToLower(strings.ReplaceAll(source, " ", "-"))
		skillDesc = fmt.Sprintf("Skill kustom %s", skillName)
		skillContent = fmt.Sprintf("---\nname: %s\ndescription: \"%s\"\n---\n\n# %s\n\nInstruksi operasional skill.\n", skillName, skillDesc, skillName)
	}

	if skillName == "" {
		skillName = fmt.Sprintf("skill-%d", os.Getpid())
	}

	count, err := h.DeploySkill(skillName, skillDesc, skillContent, req.TargetWorkers)
	if err != nil {
		auth.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	auth.WriteJSON(w, http.StatusOK, map[string]any{
		"success":        true,
		"installedCount": count,
		"name":           skillName,
		"description":    skillDesc,
	})
}

func (h *Handler) HandleDeleteSkill(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" {
		auth.WriteError(w, http.StatusBadRequest, "Skill name is required")
		return
	}
	var req struct {
		TargetWorkers []string `json:"targetWorkers"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	count, err := h.DeleteSkill(name, req.TargetWorkers)
	if err != nil {
		auth.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	auth.WriteJSON(w, http.StatusOK, map[string]any{
		"success":      true,
		"deletedCount": count,
		"name":         name,
	})
}
