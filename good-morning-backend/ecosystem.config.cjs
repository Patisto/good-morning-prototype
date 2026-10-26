module.exports = {
  apps: [{
    name: 'good-morning-api',
    script: 'dist/index.js',
    cwd: __dirname,
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    time: true,
    env: {
      NODE_ENV: 'production',
      PORT: '4000',
    },
  }],
};
