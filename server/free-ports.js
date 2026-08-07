import { execSync } from "child_process";

const ports = [3001, 5173, 5174];

function killPort(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
        { encoding: "utf8" }
      );
      const pids = out
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => /^\d+$/.test(s) && s !== "0");
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
          console.log(`Freed port ${port} (killed pid ${pid})`);
        } catch {
          /* ignore */
        }
      }
    } else {
      execSync(`lsof -ti:${port} | xargs -r kill -9`, { stdio: "ignore" });
    }
  } catch {
    /* nothing listening */
  }
}

for (const p of ports) killPort(p);
