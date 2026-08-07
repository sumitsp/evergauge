import http from "http";

const port = Number(process.env.PORT || 3001);

export function isPortFree(p = port) {
  return new Promise((resolve) => {
    const tester = http.createServer();
    tester.once("error", (err) => {
      resolve(err.code !== "EADDRINUSE");
    });
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(p, "127.0.0.1");
  });
}

export async function assertPortFree(p = port) {
  const free = await isPortFree(p);
  if (!free) {
    const err = new Error(
      `Port ${p} is already in use. Close the other terminal running the API, or run: Get-NetTCPConnection -LocalPort ${p} | Stop-Process -Id {OwningProcess} -Force`
    );
    err.code = "EADDRINUSE";
    throw err;
  }
}
