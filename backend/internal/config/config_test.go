package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConfigDefault(t *testing.T) {
	cfg := LoadConfig("/nonexistent/.env")
	if cfg.Port != 8787 && cfg.Port != 8788 {
		t.Fatalf("expected port 8787 (default) atau 8788 (.env VPS), got %d", cfg.Port)
	}
	if cfg.Host != "127.0.0.1" {
		t.Fatalf("expected host 127.0.0.1, got %s", cfg.Host)
	}
	if cfg.ProfilesRoot != "/opt/data/home/agy-profiles" {
		t.Fatalf("expected profiles root /opt/data/home/agy-profiles, got %s", cfg.ProfilesRoot)
	}
	if cfg.AgyBinPath != "/opt/data/home/.local/bin/agy" {
		t.Fatalf("expected agy bin /opt/data/home/.local/bin/agy, got %s", cfg.AgyBinPath)
	}
	if cfg.WorkspaceRoot != "/opt/data" {
		t.Fatalf("expected workspace /opt/data, got %s", cfg.WorkspaceRoot)
	}
}

func TestLoadConfigFromEnvFile(t *testing.T) {
	tmpDir := t.TempDir()
	envFile := filepath.Join(tmpDir, ".env")
	content := "PORT=9999\n# comment\nHOST=\"0.0.0.0\"\nADMIN_AUTH_KEY='custom-key'\n"
	if err := os.WriteFile(envFile, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	cfg := LoadConfig(envFile)
	if cfg.Port != 9999 {
		t.Fatalf("expected port 9999, got %d", cfg.Port)
	}
	if cfg.Host != "0.0.0.0" {
		t.Fatalf("expected host 0.0.0.0, got %s", cfg.Host)
	}
	if cfg.AdminAuthKey != "custom-key" {
		t.Fatalf("expected custom-key, got %s", cfg.AdminAuthKey)
	}
}

func TestLoadConfigEnvPrecedence(t *testing.T) {
	tmpDir := t.TempDir()
	envFile := filepath.Join(tmpDir, ".env")
	content := "PORT=9000\n"
	if err := os.WriteFile(envFile, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	t.Setenv("PORT", "9111")
	cfg := LoadConfig(envFile)
	if cfg.Port != 9111 {
		t.Fatalf("expected env var port 9111, got %d", cfg.Port)
	}
}

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()
	if cfg == nil {
		t.Fatal("expected non-nil config")
	}
}
