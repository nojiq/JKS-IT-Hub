const path = require("path");

const repoRoot = __dirname;
const basePath = ["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];

module.exports = {
  apps: [
    {
      name: "jks-it-hub-frontend",
      cwd: repoRoot,
      script: "/usr/local/bin/pnpm",
      args: "--filter web dev",
      interpreter: "none",
      env: {
        PATH: `${basePath.join(":")}:${process.env.PATH || ""}`
      }
    },
    {
      name: "jks-it-hub-backend",
      cwd: repoRoot,
      script: "/usr/local/bin/pnpm",
      args: "--filter api dev",
      interpreter: "none",
      env: {
        SCRAPER_ENABLED: process.env.SCRAPER_ENABLED || "true",
        SCRAPER_BASE_URL: process.env.SCRAPER_BASE_URL || "http://localhost:3016",
        PATH: `${basePath.join(":")}:${process.env.PATH || ""}`
      }
    },
    {
      name: "jks-it-hub-scraper",
      cwd: path.join(repoRoot, "apps/scraper"),
      script: "/bin/sh",
      args: "-c \"test -d .venv || python3 -m venv .venv; .venv/bin/pip install -r requirements.txt; .venv/bin/python -m playwright install chromium; exec .venv/bin/uvicorn main:app --host 0.0.0.0 --port ${SCRAPER_PORT:-3016}\"",
      interpreter: "none",
      env: {
        PATH: `${basePath.join(":")}:${process.env.PATH || ""}`
      }
    }
  ]
};
