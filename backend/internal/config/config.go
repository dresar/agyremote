package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Config struct {
	Port          int
	Host          string
	AdminAuthKey  string
	ProfilesRoot  string
	AgyBinPath    string
	WorkspaceRoot string
	DistDir       string
	APKPath       string
}

func LoadConfig(envPath string) *Config {
	cfg := &Config{
		Port:          8787,
		Host:          "127.0.0.1",
		// Fail-closed: key di-supply via .env (ADMIN_AUTH_KEY). Kosong = endpoint proteksi ditolak semua.
		AdminAuthKey:  "",
		ProfilesRoot:  "/opt/data/home/agy-profiles",
		AgyBinPath:    "/opt/data/home/.local/bin/agy",
		WorkspaceRoot: "/opt/data",
		DistDir:       "/opt/data/home/agyremote/dist",
		APKPath:       "/opt/data/home/agyremote/dist/agyremote.apk",
	}

	envVars := make(map[string]string)
	if envPath == "" {
		envPath = ".env"
	}

	candidates := []string{envPath, ".env", "../.env", "/opt/data/home/agyremote-backend/.env", "/opt/data/home/agyremote/.env"}
	for _, p := range candidates {
		if p == "" {
			continue
		}
		if f, err := os.Open(p); err == nil {
			scanner := bufio.NewScanner(f)
			for scanner.Scan() {
				line := strings.TrimSpace(scanner.Text())
				if line == "" || strings.HasPrefix(line, "#") {
					continue
				}
				parts := strings.SplitN(line, "=", 2)
				if len(parts) == 2 {
					key := strings.TrimSpace(parts[0])
					val := strings.TrimSpace(parts[1])
					val = strings.Trim(val, `"'`)
					envVars[key] = val
				}
			}
			_ = f.Close()
			break
		}
	}

	if val := getEnvOrMap("PORT", envVars); val != "" {
		if p, err := strconv.Atoi(val); err == nil {
			cfg.Port = p
		}
	}
	if val := getEnvOrMap("HOST", envVars); val != "" {
		cfg.Host = val
	}
	if val := getEnvOrMap("ADMIN_AUTH_KEY", envVars); val != "" {
		cfg.AdminAuthKey = val
	}
	if val := getEnvOrMap("PROFILES_ROOT", envVars); val != "" {
		cfg.ProfilesRoot = val
	}
	if val := getEnvOrMap("AGY_BIN_PATH", envVars); val != "" {
		cfg.AgyBinPath = val
	}
	if val := getEnvOrMap("WORKSPACE_ROOT", envVars); val != "" {
		cfg.WorkspaceRoot = val
	}
	if val := getEnvOrMap("DIST_DIR", envVars); val != "" {
		cfg.DistDir = val
		cfg.APKPath = filepath.Join(val, "agyremote.apk")
	}

	return cfg
}

func DefaultConfig() *Config {
	return LoadConfig(".env")
}

func getEnvOrMap(key string, fileVars map[string]string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fileVars[key]
}
