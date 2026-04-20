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
        PATH: `${basePath.join(":")}:${process.env.PATH || ""}`
      }
    }
  ]
};
