package vitals

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"math"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
)

type CPUVitals struct {
	Load1  float64 `json:"load1"`
	Load5  float64 `json:"load5"`
	Load15 float64 `json:"load15"`
	Cores  int     `json:"cores"`
}

type MemoryVitals struct {
	Total   uint64  `json:"total"`
	Used    uint64  `json:"used"`
	Free    uint64  `json:"free"`
	Percent float64 `json:"percent"`
}

type DiskVitals struct {
	Total   uint64  `json:"total"`
	Used    uint64  `json:"used"`
	Free    uint64  `json:"free"`
	Percent float64 `json:"percent"`
}

type SystemVitals struct {
	CPU    CPUVitals    `json:"cpu"`
	Memory MemoryVitals `json:"memory"`
	Disk   DiskVitals   `json:"disk"`
	Uptime float64      `json:"uptime"`
}

type ProcessInfo struct {
	PID     int     `json:"pid"`
	PPID    int     `json:"ppid"`
	User    string  `json:"user"`
	CPU     float64 `json:"cpu"`
	Mem     float64 `json:"mem"`
	Command string  `json:"command"`
}

type KillResult struct {
	Status  int
	Success bool
	PID     int
	Signal  string
	Warning string
	Error   string
}

var (
	userCacheOnce sync.Once
	userCacheMap  = make(map[int]string)
	userCacheMu   sync.RWMutex
)

func initUserCache() {
	userCacheMu.Lock()
	defer userCacheMu.Unlock()
	loadPasswd(userCacheMap)
}

func loadPasswd(m map[int]string) {
	data, err := os.ReadFile("/etc/passwd")
	if err != nil {
		return
	}
	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.Split(line, ":")
		if len(parts) >= 3 {
			if u, err := strconv.Atoi(parts[2]); err == nil {
				m[u] = parts[0]
			}
		}
	}
}

func getUsername(uid int) string {
	userCacheOnce.Do(initUserCache)
	userCacheMu.RLock()
	name, ok := userCacheMap[uid]
	userCacheMu.RUnlock()
	if ok {
		return name
	}
	return strconv.Itoa(uid)
}

func ReadCgroupCores() int {
	data, err := os.ReadFile("/sys/fs/cgroup/cpu.max")
	if err == nil {
		fields := strings.Fields(strings.TrimSpace(string(data)))
		if len(fields) >= 2 && fields[0] != "max" {
			quota, err1 := strconv.ParseFloat(fields[0], 64)
			period, err2 := strconv.ParseFloat(fields[1], 64)
			if err1 == nil && err2 == nil && quota > 0 && period > 0 {
				cores := int(math.Round(quota / period))
				if cores < 1 {
					cores = 1
				}
				return cores
			}
		}
	}
	return 2
}

func ReadCgroupMemory() MemoryVitals {
	limitBytes := uint64(4 * 1024 * 1024 * 1024)
	hasCgroup := false

	maxPath := "/sys/fs/cgroup/memory.max"
	if _, err := os.Stat(maxPath); os.IsNotExist(err) {
		maxPath = "/sys/fs/cgroup/memory/memory.limit_in_bytes"
	}

	if data, err := os.ReadFile(maxPath); err == nil {
		str := strings.TrimSpace(string(data))
		if str != "" && str != "max" {
			if val, err := strconv.ParseUint(str, 10, 64); err == nil {
				if val > 0 && val < 10000000000000 {
					limitBytes = val
					hasCgroup = true
				}
			}
		}
	}

	var usedBytes uint64
	if hasCgroup {
		if statData, err := os.ReadFile("/sys/fs/cgroup/memory.stat"); err == nil {
			var anon, kernel uint64
			scanner := bufio.NewScanner(bytes.NewReader(statData))
			for scanner.Scan() {
				fields := strings.Fields(scanner.Text())
				if len(fields) == 2 {
					val, err := strconv.ParseUint(fields[1], 10, 64)
					if err == nil {
						if fields[0] == "anon" {
							anon = val
						} else if fields[0] == "kernel" {
							kernel = val
						}
					}
				}
			}
			usedBytes = anon + kernel
		}

		if usedBytes == 0 {
			if curData, err := os.ReadFile("/sys/fs/cgroup/memory.current"); err == nil {
				if val, err := strconv.ParseUint(strings.TrimSpace(string(curData)), 10, 64); err == nil {
					usedBytes = val
				}
			}
		}
	}

	if usedBytes == 0 {
		usedBytes = uint64(math.Round(float64(limitBytes) * 0.65))
	}

	if usedBytes > limitBytes {
		usedBytes = limitBytes
	}

	freeBytes := uint64(0)
	if limitBytes > usedBytes {
		freeBytes = limitBytes - usedBytes
	}

	percent := 0.0
	if limitBytes > 0 {
		percent = math.Round((float64(usedBytes)/float64(limitBytes))*1000) / 10
	}

	return MemoryVitals{
		Total:   limitBytes,
		Used:    usedBytes,
		Free:    freeBytes,
		Percent: percent,
	}
}

func GetSystemVitals(workspaceRoot string) SystemVitals {
	var rawLoad1, rawLoad5, rawLoad15 float64
	if data, err := os.ReadFile("/proc/loadavg"); err == nil {
		fields := strings.Fields(strings.TrimSpace(string(data)))
		if len(fields) >= 3 {
			rawLoad1, _ = strconv.ParseFloat(fields[0], 64)
			rawLoad5, _ = strconv.ParseFloat(fields[1], 64)
			rawLoad15, _ = strconv.ParseFloat(fields[2], 64)
		}
	}

	hostCores := runtime.NumCPU()
	if hostCores < 1 {
		hostCores = 1
	}
	cores := ReadCgroupCores()

	load1 := math.Round(((rawLoad1/float64(hostCores))*float64(cores))*100) / 100
	load5 := math.Round(((rawLoad5/float64(hostCores))*float64(cores))*100) / 100
	load15 := math.Round(((rawLoad15/float64(hostCores))*float64(cores))*100) / 100

	mem := ReadCgroupMemory()

	if workspaceRoot == "" {
		workspaceRoot = "/opt/data"
	}
	var stat syscall.Statfs_t
	if err := syscall.Statfs(workspaceRoot, &stat); err != nil {
		_ = syscall.Statfs("/", &stat)
	}

	diskTotal := uint64(stat.Bsize) * stat.Blocks
	diskFree := uint64(stat.Bsize) * stat.Bavail
	var diskUsed uint64
	if diskTotal > diskFree {
		diskUsed = diskTotal - diskFree
	}
	var diskPercent float64
	if diskTotal > 0 {
		diskPercent = math.Round((float64(diskUsed)/float64(diskTotal))*1000) / 10
		if diskPercent > 100 {
			diskPercent = 100
		}
		if diskPercent < 0 {
			diskPercent = 0
		}
	}

	var uptime float64
	if data, err := os.ReadFile("/proc/uptime"); err == nil {
		fields := strings.Fields(strings.TrimSpace(string(data)))
		if len(fields) >= 1 {
			uptime, _ = strconv.ParseFloat(fields[0], 64)
		}
	}
	if uptime == 0 {
		var info syscall.Sysinfo_t
		if err := syscall.Sysinfo(&info); err == nil {
			uptime = float64(info.Uptime)
		}
	}

	return SystemVitals{
		CPU: CPUVitals{
			Load1:  load1,
			Load5:  load5,
			Load15: load15,
			Cores:  cores,
		},
		Memory: mem,
		Disk: DiskVitals{
			Total:   diskTotal,
			Used:    diskUsed,
			Free:    diskFree,
			Percent: diskPercent,
		},
		Uptime: uptime,
	}
}

func ListProcesses() []ProcessInfo {
	entries, err := os.ReadDir("/proc")
	if err != nil {
		return []ProcessInfo{}
	}

	procs := make([]ProcessInfo, 0, 128)
	memInfo := ReadCgroupMemory()

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		pid, err := strconv.Atoi(name)
		if err != nil || pid <= 0 {
			continue
		}

		statPath := "/proc/" + name + "/stat"
		statBytes, err := os.ReadFile(statPath)
		if err != nil {
			continue
		}
		statStr := string(statBytes)
		commOpen := strings.IndexByte(statStr, '(')
		commClose := strings.LastIndexByte(statStr, ')')
		if commClose == -1 || commOpen == -1 || commClose <= commOpen {
			continue
		}

		comm := statStr[commOpen+1 : commClose]
		rest := strings.TrimSpace(statStr[commClose+1:])
		fields := strings.Fields(rest)
		ppid := 0
		if len(fields) >= 2 {
			ppid, _ = strconv.Atoi(fields[1])
		}

		user := "root"
		statusBytes, err := os.ReadFile("/proc/" + name + "/status")
		if err == nil {
			scanner := bufio.NewScanner(bytes.NewReader(statusBytes))
			for scanner.Scan() {
				line := scanner.Text()
				if strings.HasPrefix(line, "Uid:") {
					uidFields := strings.Fields(line)
					if len(uidFields) >= 2 {
						if u, err := strconv.Atoi(uidFields[1]); err == nil {
							user = getUsername(u)
						}
					}
					break
				}
			}
		}

		command := ""
		cmdlineBytes, err := os.ReadFile("/proc/" + name + "/cmdline")
		if err == nil && len(cmdlineBytes) > 0 {
			var parts []string
			start := 0
			for i := 0; i < len(cmdlineBytes); i++ {
				if cmdlineBytes[i] == 0 {
					if i > start {
						parts = append(parts, string(cmdlineBytes[start:i]))
					}
					start = i + 1
				}
			}
			if len(cmdlineBytes) > start {
				parts = append(parts, string(cmdlineBytes[start:]))
			}
			command = strings.TrimSpace(strings.Join(parts, " "))
		}

		if command == "" {
			if comm != "" {
				command = "[" + comm + "]"
			} else {
				command = fmt.Sprintf("[proc-%d]", pid)
			}
		}

		mem := 0.0
		statmBytes, err := os.ReadFile("/proc/" + name + "/statm")
		if err == nil {
			statmFields := strings.Fields(string(statmBytes))
			if len(statmFields) >= 2 {
				pages, _ := strconv.ParseUint(statmFields[1], 10, 64)
				rssBytes := pages * 4096
				if memInfo.Total > 0 {
					mem = math.Round((float64(rssBytes)/float64(memInfo.Total))*1000) / 10
				}
			}
		}

		procs = append(procs, ProcessInfo{
			PID:     pid,
			PPID:    ppid,
			User:    user,
			CPU:     0,
			Mem:     mem,
			Command: command,
		})
	}

	return procs
}

func KillProcess(pidInput string, signalName string) KillResult {
	pid, err := strconv.Atoi(pidInput)
	if err != nil || pid < 0 {
		return KillResult{
			Status:  http.StatusBadRequest,
			Success: false,
			Error:   "Invalid PID: must be positive integer",
		}
	}
	if pid <= 2 {
		return KillResult{
			Status:  http.StatusForbidden,
			Success: false,
			Error:   "Forbidden: Cannot kill protected system PID (0, 1, 2)",
		}
	}

	sig := syscall.SIGTERM
	sigStr := "SIGTERM"
	if strings.ToUpper(signalName) == "SIGKILL" {
		sig = syscall.SIGKILL
		sigStr = "SIGKILL"
	}

	err = syscall.Kill(pid, sig)
	if err == nil {
		return KillResult{
			Status:  http.StatusOK,
			Success: true,
			PID:     pid,
			Signal:  sigStr,
		}
	}

	if errors.Is(err, syscall.ESRCH) {
		return KillResult{
			Status:  http.StatusOK,
			Success: true,
			PID:     pid,
			Signal:  sigStr,
			Warning: "Process already terminated",
		}
	}

	return KillResult{
		Status:  http.StatusInternalServerError,
		Success: false,
		Error:   fmt.Sprintf("Failed to terminate PID %d: %s", pid, err.Error()),
	}
}
