module.exports = {
  apps: [{
    name: "colyseus-app",
    script: "build/index.js",
    time: true,
    watch: false,
    instances: 1,
    exec_mode: "fork",
    wait_ready: true,
    max_memory_restart: "512M",
  }],
};
