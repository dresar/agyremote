package vitals

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"strconv"
	"testing"
	"time"
)

func TestReadCgroupCores(t *testing.T) {
	cores := ReadCgroupCores()
	if cores < 1 {
		t.Fatalf("expected cores >= 1, got %d", cores)
	}
}

func TestReadCgroupMemory(t *testing.T) {
	mem := ReadCgroupMemory()
	if mem.Total == 0 {
		t.Fatal("expected total memory > 0")
	}
	if mem.Used > mem.Total {
		t.Fatalf("expected used <= total, got used=%d, total=%d", mem.Used, mem.Total)
	}
	if mem.Percent < 0 || mem.Percent > 100 {
		t.Fatalf("expected percent in [0, 100], got %f", mem.Percent)
	}
}

func TestGetSystemVitals(t *testing.T) {
	v := GetSystemVitals("/opt/data")
	if v.CPU.Load1 < 0 || v.CPU.Load5 < 0 || v.CPU.Load15 < 0 {
		t.Fatalf("expected non-negative CPU load averages, got %f, %f, %f", v.CPU.Load1, v.CPU.Load5, v.CPU.Load15)
	}
	if v.CPU.Cores < 1 {
		t.Fatalf("expected CPU cores >= 1, got %d", v.CPU.Cores)
	}
	if v.Memory.Total == 0 {
		t.Fatal("expected memory total > 0")
	}
	if v.Memory.Percent < 0 || v.Memory.Percent > 100 {
		t.Fatalf("expected memory percent in [0, 100], got %f", v.Memory.Percent)
	}
	if v.Disk.Total == 0 {
		t.Fatal("expected disk total > 0")
	}
	if v.Disk.Percent < 0 || v.Disk.Percent > 100 {
		t.Fatalf("expected disk percent in [0, 100], got %f", v.Disk.Percent)
	}
	if v.Uptime <= 0 {
		t.Fatalf("expected uptime > 0, got %f", v.Uptime)
	}
}

func TestListProcesses(t *testing.T) {
	procs := ListProcesses()
	if len(procs) == 0 {
		t.Fatal("expected at least one process returned")
	}

	foundRootOrSelf := false
	for _, p := range procs {
		if p.PID <= 0 {
			t.Fatalf("invalid process PID: %d", p.PID)
		}
		if p.User == "" {
			t.Fatalf("process %d missing user", p.PID)
		}
		if p.Command == "" {
			t.Fatalf("process %d missing command", p.PID)
		}
		if p.PID == 1 || p.PID == os.Getpid() {
			foundRootOrSelf = true
		}
	}

	if !foundRootOrSelf {
		t.Fatal("expected process table to contain PID 1 or current process")
	}
}

func TestKillProcessGuards(t *testing.T) {
	res0 := KillProcess("0", "")
	if res0.Status != http.StatusForbidden || res0.Success {
		t.Fatalf("expected 403 for PID 0, got status=%d, success=%v", res0.Status, res0.Success)
	}

	res1 := KillProcess("1", "")
	if res1.Status != http.StatusForbidden || res1.Success {
		t.Fatalf("expected 403 for PID 1, got status=%d, success=%v", res1.Status, res1.Success)
	}

	res2 := KillProcess("2", "")
	if res2.Status != http.StatusForbidden || res2.Success {
		t.Fatalf("expected 403 for PID 2, got status=%d, success=%v", res2.Status, res2.Success)
	}

	resNeg := KillProcess("-1", "")
	if resNeg.Status != http.StatusBadRequest || resNeg.Success {
		t.Fatalf("expected 400 for PID -1, got status=%d, success=%v", resNeg.Status, resNeg.Success)
	}

	resNaN := KillProcess("not-a-number", "")
	if resNaN.Status != http.StatusBadRequest || resNaN.Success {
		t.Fatalf("expected 400 for non-numeric PID, got status=%d, success=%v", resNaN.Status, resNaN.Success)
	}

	resDead := KillProcess("99999999", "")
	if resDead.Status != http.StatusOK || !resDead.Success || resDead.Warning != "Process already terminated" {
		t.Fatalf("expected 200 with warning for dead PID, got status=%d, success=%v, warning=%s", resDead.Status, resDead.Success, resDead.Warning)
	}
}

func TestKillProcessRealSpawn(t *testing.T) {
	cmd := exec.Command("sleep", "30")
	if err := cmd.Start(); err != nil {
		t.Fatalf("failed to spawn test sleep process: %v", err)
	}
	targetPid := cmd.Process.Pid
	defer func() {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
	}()

	time.Sleep(50 * time.Millisecond)

	res := KillProcess(strconv.Itoa(targetPid), "SIGTERM")
	if res.Status != http.StatusOK || !res.Success {
		t.Fatalf("expected 200 success killing spawned process, got %v", res)
	}
	if res.PID != targetPid {
		t.Fatalf("expected pid=%d, got %d", targetPid, res.PID)
	}

	_ = cmd.Wait()

	time.Sleep(50 * time.Millisecond)
	resAfter := KillProcess(strconv.Itoa(targetPid), "SIGTERM")
	if resAfter.Status != http.StatusOK || !resAfter.Success || resAfter.Warning != "Process already terminated" {
		t.Fatalf("expected already terminated warning on dead pid, got %v", resAfter)
	}
}

func TestHTTPHandlers(t *testing.T) {
	h := NewHandler("/opt/data")

	reqVitals := httptest.NewRequest(http.MethodGet, "/api/system/vitals", nil)
	recVitals := httptest.NewRecorder()
	h.HandleVitals(recVitals, reqVitals)
	if recVitals.Code != http.StatusOK {
		t.Fatalf("expected 200 from HandleVitals, got %d", recVitals.Code)
	}
	var vitalsResp SystemVitals
	if err := json.Unmarshal(recVitals.Body.Bytes(), &vitalsResp); err != nil {
		t.Fatal(err)
	}
	if vitalsResp.CPU.Cores < 1 {
		t.Fatalf("expected CPU cores >= 1, got %d", vitalsResp.CPU.Cores)
	}

	reqProcs := httptest.NewRequest(http.MethodGet, "/api/processes", nil)
	recProcs := httptest.NewRecorder()
	h.HandleListProcesses(recProcs, reqProcs)
	if recProcs.Code != http.StatusOK {
		t.Fatalf("expected 200 from HandleListProcesses, got %d", recProcs.Code)
	}
	var procsResp struct {
		Processes []ProcessInfo `json:"processes"`
	}
	if err := json.Unmarshal(recProcs.Body.Bytes(), &procsResp); err != nil {
		t.Fatal(err)
	}
	if len(procsResp.Processes) == 0 {
		t.Fatal("expected non-empty processes array")
	}

	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	reqKill0 := httptest.NewRequest(http.MethodPost, "/api/processes/0/kill", nil)
	recKill0 := httptest.NewRecorder()
	mux.ServeHTTP(recKill0, reqKill0)
	if recKill0.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for PID 0, got %d", recKill0.Code)
	}

	reqKill1 := httptest.NewRequest(http.MethodPost, "/api/processes/1/kill", nil)
	recKill1 := httptest.NewRecorder()
	mux.ServeHTTP(recKill1, reqKill1)
	if recKill1.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for PID 1, got %d", recKill1.Code)
	}

	reqKillNeg := httptest.NewRequest(http.MethodPost, "/api/processes/-1/kill", nil)
	recKillNeg := httptest.NewRecorder()
	mux.ServeHTTP(recKillNeg, reqKillNeg)
	if recKillNeg.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for PID -1, got %d", recKillNeg.Code)
	}

	reqKillNaN := httptest.NewRequest(http.MethodPost, "/api/processes/not-a-number/kill", nil)
	recKillNaN := httptest.NewRecorder()
	mux.ServeHTTP(recKillNaN, reqKillNaN)
	if recKillNaN.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for non-numeric PID, got %d", recKillNaN.Code)
	}
}
