const { spawn } = require('child_process');

delete process.env.ELECTRON_RUN_AS_NODE;

const proc = spawn('node', ['node_modules/electron/cli.js', '.'], {
    stdio: 'inherit',
    env: process.env,
    shell: true
});

proc.on('exit', (code) => process.exit(code || 0));
