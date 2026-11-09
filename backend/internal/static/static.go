package static

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"os"
	"path"
	"strings"
)

//go:embed dist
var distFS embed.FS

var customMIMETypes = map[string]string{
	".html":  "text/html; charset=utf-8",
	".js":    "text/javascript; charset=utf-8",
	".css":   "text/css; charset=utf-8",
	".json":  "application/json",
	".png":   "image/png",
	".ico":   "image/vnd.microsoft.icon",
	".svg":   "image/svg+xml",
	".wasm":  "application/wasm",
	".apk":   "application/vnd.android.package-archive",
	".idsig": "application/octet-stream",
}

const fallbackIndexHTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>agyremote</title></head><body><div id="root">agyremote</div></body></html>`

func init() {
	for ext, mimeType := range customMIMETypes {
		_ = mime.AddExtensionType(ext, mimeType)
	}
}

type Handler struct {
	fsys    fs.FS
	diskDir string
}

func NewHandler(diskDir string) *Handler {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic(err)
	}
	return &Handler{
		fsys:    sub,
		diskDir: diskDir,
	}
}

func (h *Handler) ServeAPK(w http.ResponseWriter, r *http.Request) {
	if h.diskDir != "" {
		diskApkPath := path.Join(h.diskDir, "agyremote.apk")
		if stat, err := os.Stat(diskApkPath); err == nil && !stat.IsDir() {
			file, err := os.Open(diskApkPath)
			if err == nil {
				defer file.Close()
				w.Header().Set("Content-Type", "application/vnd.android.package-archive")
				w.Header().Set("Content-Disposition", `attachment; filename="agyremote.apk"`)
				http.ServeContent(w, r, "agyremote.apk", stat.ModTime(), file)
				return
			}
		}
	}

	file, err := h.fsys.Open("agyremote.apk")
	if err != nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "APK binary not found"})
		return
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Failed to read APK"})
		return
	}

	w.Header().Set("Content-Type", "application/vnd.android.package-archive")
	w.Header().Set("Content-Disposition", `attachment; filename="agyremote.apk"`)

	if seeker, ok := file.(io.ReadSeeker); ok {
		http.ServeContent(w, r, "agyremote.apk", stat.ModTime(), seeker)
		return
	}

	w.Header().Set("Content-Length", fmt.Sprintf("%d", stat.Size()))
	_, _ = io.Copy(w, file)
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	reqPath := r.URL.Path

	if reqPath == "/agyremote.apk" || reqPath == "/dist/agyremote.apk" {
		h.ServeAPK(w, r)
		return
	}

	if strings.HasPrefix(reqPath, "/api/") || reqPath == "/api" {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Not Found"})
		return
	}

	cleanPath := path.Clean(strings.TrimPrefix(reqPath, "/dist"))
	cleanPath = strings.TrimPrefix(cleanPath, "/")
	if cleanPath == "" || cleanPath == "." {
		cleanPath = "index.html"
	}

	if h.diskDir != "" {
		diskFilePath := path.Join(h.diskDir, cleanPath)
		if stat, err := os.Stat(diskFilePath); err == nil && !stat.IsDir() {
			file, err := os.Open(diskFilePath)
			if err == nil {
				defer file.Close()
				h.applyCacheHeaders(w, cleanPath)
				h.applyContentType(w, cleanPath)
				http.ServeContent(w, r, stat.Name(), stat.ModTime(), file)
				return
			}
		}
	}

	file, err := h.fsys.Open(cleanPath)
	if err == nil {
		stat, statErr := file.Stat()
		if statErr == nil && !stat.IsDir() {
			defer file.Close()

			h.applyCacheHeaders(w, cleanPath)
			h.applyContentType(w, cleanPath)

			if seeker, ok := file.(io.ReadSeeker); ok {
				http.ServeContent(w, r, stat.Name(), stat.ModTime(), seeker)
				return
			}
			w.Header().Set("Content-Length", fmt.Sprintf("%d", stat.Size()))
			_, _ = io.Copy(w, file)
			return
		}
		_ = file.Close()
	}

	h.serveSPAIndex(w, r)
}

func (h *Handler) applyCacheHeaders(w http.ResponseWriter, filePath string) {
	if filePath == "index.html" || filePath == "sw.js" || strings.HasSuffix(filePath, "/index.html") || strings.HasSuffix(filePath, "/sw.js") {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
		return
	}

	if strings.HasPrefix(filePath, "assets/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=3600")
}

func (h *Handler) applyContentType(w http.ResponseWriter, filePath string) {
	ext := path.Ext(filePath)
	if ct, found := customMIMETypes[ext]; found {
		w.Header().Set("Content-Type", ct)
		return
	}

	if ct := mime.TypeByExtension(ext); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
}

func (h *Handler) serveSPAIndex(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")

	if h.diskDir != "" {
		diskIndexPath := path.Join(h.diskDir, "index.html")
		if stat, err := os.Stat(diskIndexPath); err == nil && !stat.IsDir() {
			file, err := os.Open(diskIndexPath)
			if err == nil {
				defer file.Close()
				http.ServeContent(w, r, "index.html", stat.ModTime(), file)
				return
			}
		}
	}

	file, err := h.fsys.Open("index.html")
	if err == nil {
		defer file.Close()
		stat, statErr := file.Stat()
		if statErr == nil {
			if seeker, ok := file.(io.ReadSeeker); ok {
				http.ServeContent(w, r, "index.html", stat.ModTime(), seeker)
				return
			}
		}
		w.Header().Set("Content-Length", fmt.Sprintf("%d", stat.Size()))
		_, _ = io.Copy(w, file)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(fallbackIndexHTML))
}
