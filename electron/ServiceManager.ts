import { spawn, exec, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { randomUUID } from 'crypto';
import si from 'systeminformation';
import axios from 'axios';
import os from 'os';
import nodemailer from 'nodemailer';
import { SMTP_SECRETS } from './secrets';

// SMTP Configuration
// Secrets are injected at build time via electron/secrets.ts
const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,          // SSL on port 465
  auth: {
    user: SMTP_SECRETS.user,
    pass: SMTP_SECRETS.pass   // This must be a Gmail App Password (16 chars)
  },
  tls: {
    rejectUnauthorized: false
  }
};

const TARGET_EMAIL = SMTP_SECRETS.targetEmail;

interface ClientInfo {
  id: string;
  firstSeen: string;
  // User Provided
  company: string;
  office: string;
  contactEmail: string;
  tunnelToken?: string;
  // System
  system: {
    hostname: string;
    username: string;
    os: string;
    platform: string;
    arch: string;
    release: string;
  };
  hardware: {
    cpu: string;
    cores: number;
    memoryTotal: string;
  };
  network: {
    ip?: string;
  };
  appVersion: string;
}

export class ServiceManager {
  private n8nProcess: ChildProcess | null = null;
  private tunnelProcess: ChildProcess | null = null;
  private appDataPath: string;
  private binPath: string;
  private publicUrl: string | null = null;
  private isShuttingDown: boolean = false;
  private clientInfo: ClientInfo | null = null;
  private n8nReady: boolean = false;

  constructor() {
    this.appDataPath = path.join(app.getPath('userData'), 'n8n_data');
    this.loadClientInfo();

    // Ensure data directory exists
    if (!fs.existsSync(this.appDataPath)) {
      fs.mkdirSync(this.appDataPath, { recursive: true });
    }

    // Check SMTP connection on startup to log any auth issues
    this.checkSmtpConnection();

    // Determine binary path based on environment
    if (app.isPackaged) {
      this.binPath = path.join(process.resourcesPath, 'bin');
    } else {
      this.binPath = path.join(process.cwd(), 'resources', 'bin');
    }
  }

  async startServices() {
    try {
      await this.checkAndInstallOllama();
      await this.startN8n();
      // Wait until n8n is actually healthy before starting the tunnel
      // so Cloudflare doesn't get a 502 on first probe
      await this.waitForN8nPublic();
      await this.startTunnel();
    } catch (error) {
      console.error('Error starting services:', error);
    }
  }

  public waitForN8nPublic(): Promise<void> {
    return new Promise((resolve) => {
      const maxWait = 120_000; // 2 minutes max
      const interval = 3_000;
      let elapsed = 0;

      const check = () => {
        const isProcessDead = !this.n8nProcess ||
          ('killed' in this.n8nProcess && this.n8nProcess.killed) ||
          ('exitCode' in this.n8nProcess && this.n8nProcess.exitCode !== null);

        if (isProcessDead) {
          console.warn('[n8n] Process not running, aborting wait for public URL.');
          resolve();
          return;
        }

        axios.get('http://localhost:5678/healthz', { timeout: 2000 })
          .then(() => {
            this.n8nReady = true;
            console.log('[n8n] Healthy – starting tunnel now.');
            resolve();
          })
          .catch(() => {
            elapsed += interval;
            if (elapsed >= maxWait) {
              console.warn('[n8n] Timed out waiting for health check – starting tunnel anyway.');
              resolve();
            } else {
              setTimeout(check, interval);
            }
          });
      };

      setTimeout(check, 5000); // give n8n 5 s head-start
    });
  }

  isRegistered(): boolean {
    return this.clientInfo !== null;
  }

  private loadClientInfo() {
    const infoPath = path.join(app.getPath('userData'), 'client_info.json');
    if (fs.existsSync(infoPath)) {
      try {
        this.clientInfo = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
      } catch (e) {
        console.error('Error loading client info', e);
      }
    }
  }

  async registerClient(data: { company: string; office: string; contactEmail: string; tunnelToken?: string }) {
    const infoPath = path.join(app.getPath('userData'), 'client_info.json');

    console.log('Registrando nuevo cliente:', data);
    const uuid = this.getOrCreateClientId();

    try {
      const osInfo = await si.osInfo();
      const cpu = await si.cpu();
      const mem = await si.mem();
      let publicIp = 'Unknown';
      try {
        const res = await axios.get('https://api.ipify.org?format=json');
        publicIp = res.data.ip;
      } catch (e) {
        console.error('Failed to get public IP', e);
      }

      const clientInfo: ClientInfo = {
        id: uuid,
        firstSeen: new Date().toISOString(),
        company: data.company,
        office: data.office,
        contactEmail: data.contactEmail,
        tunnelToken: data.tunnelToken,
        system: {
          hostname: os.hostname(),
          username: os.userInfo().username,
          os: `${osInfo.distro} ${osInfo.release}`,
          platform: osInfo.platform,
          arch: osInfo.arch,
          release: osInfo.release
        },
        hardware: {
          cpu: `${cpu.manufacturer} ${cpu.brand}`,
          cores: cpu.cores,
          memoryTotal: `${(mem.total / 1024 / 1024 / 1024).toFixed(2)} GB`
        },
        network: {
          ip: publicIp
        },
        appVersion: app.getVersion()
      };

      fs.writeFileSync(infoPath, JSON.stringify(clientInfo, null, 2));
      this.clientInfo = clientInfo;
      await this.sendRegistrationEmail(clientInfo);
      return true;

    } catch (error) {
      console.error('Error registering client:', error);
      return false;
    }
  }

  private async sendRegistrationEmail(info: ClientInfo) {
    if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
      console.warn('SMTP credentials not configured. Skipping registration email.');
      return;
    }

    const tunnelType = info.tunnelToken ? 'Token Persistente (URL Fija)' : 'TryCloudflare (URL Dinámica)';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:0}
  .wrap{max-width:600px;margin:32px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155}
  .header{background:linear-gradient(135deg,#e63199,#be185d);padding:32px;text-align:center}
  .header h1{margin:0;font-size:28px;color:#fff;letter-spacing:1px}  
  .header p{margin:8px 0 0;color:rgba(255,255,255,.7);font-size:14px}
  .body{padding:32px}
  .section{margin-bottom:24px}
  .section-title{font-size:11px;font-weight:700;color:#e63199;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #334155}
  .row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-bottom:1px solid #1e293b}
  .label{color:#94a3b8;min-width:140px}
  .value{color:#f1f5f9;font-weight:500;text-align:right}
  .badge{display:inline-block;background:#e63199;color:#fff;font-size:11px;padding:2px 10px;border-radius:20px;margin-left:8px}
  .footer{background:#0f172a;padding:16px;text-align:center;font-size:12px;color:#475569}
</style></head>
<body><div class="wrap">
  <div class="header">
    <h1>🤖 Telodigo AI</h1>
    <p>Nuevo Cliente Registrado</p>
  </div>
  <div class="body">
    <div class="section">
      <div class="section-title">Organización</div>
      <div class="row"><span class="label">Empresa</span><span class="value">${info.company}</span></div>
      <div class="row"><span class="label">Oficina</span><span class="value">${info.office}</span></div>
      <div class="row"><span class="label">Email</span><span class="value">${info.contactEmail || '—'}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Configuración</div>
      <div class="row"><span class="label">Tipo de Túnel</span><span class="value">${tunnelType}</span></div>
      <div class="row"><span class="label">ID Cliente</span><span class="value" style="font-family:monospace;font-size:12px">${info.id}</span></div>
      <div class="row"><span class="label">Versión App</span><span class="value"><span class="badge">v${info.appVersion}</span></span></div>
      <div class="row"><span class="label">Fecha Registro</span><span class="value">${new Date(info.firstSeen).toLocaleString('es-ES')}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Sistema</div>
      <div class="row"><span class="label">Hostname</span><span class="value">${info.system.hostname}</span></div>
      <div class="row"><span class="label">Usuario</span><span class="value">${info.system.username}</span></div>
      <div class="row"><span class="label">OS</span><span class="value">${info.system.os}</span></div>
      <div class="row"><span class="label">CPU</span><span class="value">${info.hardware.cpu} (${info.hardware.cores} núcleos)</span></div>
      <div class="row"><span class="label">Memoria</span><span class="value">${info.hardware.memoryTotal}</span></div>
      <div class="row"><span class="label">IP Pública</span><span class="value" style="font-family:monospace">${info.network.ip || '—'}</span></div>
    </div>
  </div>
  <div class="footer">Telodigo AI · Sistema de registro automático</div>
</div></body></html>`;

    try {
      const transporter = nodemailer.createTransport(SMTP_CONFIG);
      // Verify connection before sending
      await transporter.verify();
      console.log('[SMTP] Connection verified OK');
      await transporter.sendMail({
        from: `"Telodigo AI" <${SMTP_CONFIG.auth.user}>`,
        to: TARGET_EMAIL,
        subject: `🆕 Nuevo Cliente: ${info.company} – ${info.office}`,
        html,
      });
      console.log(`[SMTP] Email de registro enviado a ${TARGET_EMAIL}`);
    } catch (error: any) {
      console.error('[SMTP] Error enviando email de registro:', error?.message ?? error);
      if (error?.code) console.error('[SMTP] Code:', error.code);
      if (error?.response) console.error('[SMTP] Server response:', error.response);
    }
  }

  private getOrCreateClientId(): string {
    const idPath = path.join(app.getPath('userData'), 'client_id.txt');
    if (fs.existsSync(idPath)) {
      return fs.readFileSync(idPath, 'utf-8').trim();
    }
    const newId = randomUUID();
    fs.writeFileSync(idPath, newId, 'utf-8');
    return newId;
  }

  // Made public to be callable via IPC
  public async sendUrlEmail(url: string) {
    if (!url) {
      console.warn('sendUrlEmail called with empty URL – skipping.');
      return;
    }
    if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
      console.warn('SMTP credentials not configured. Skipping URL email.');
      return;
    }

    const clientId = this.clientInfo?.id || this.getOrCreateClientId();
    const company = this.clientInfo?.company || 'Unknown Company';
    const office = this.clientInfo?.office || 'Unknown Office';
    const hostname = os.hostname();
    const username = os.userInfo().username;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:0}
  .wrap{max-width:600px;margin:32px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155}
  .header{background:linear-gradient(135deg,#e63199,#be185d);padding:32px;text-align:center}
  .header h1{margin:0;font-size:26px;color:#fff}
  .header p{margin:8px 0 0;color:rgba(255,255,255,.75);font-size:14px}
  .body{padding:32px}
  .url-box{background:#0f172a;border:1px solid #e63199;border-radius:8px;padding:16px;margin:20px 0;text-align:center}
  .url-box a{color:#e63199;font-family:monospace;font-size:16px;font-weight:bold;word-break:break-all;text-decoration:none}
  .section-title{font-size:11px;font-weight:700;color:#e63199;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #334155}
  .row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px}
  .label{color:#94a3b8}
  .value{color:#f1f5f9;font-weight:500;font-family:monospace;font-size:13px}
  .footer{background:#0f172a;padding:16px;text-align:center;font-size:12px;color:#475569}
</style></head>
<body><div class="wrap">
  <div class="header">
    <h1>🔗 Telodigo AI</h1>
    <p>Nueva URL de Acceso Remoto Detectada</p>
  </div>
  <div class="body">
    <p style="color:#94a3b8;font-size:14px;margin-top:0">Se ha generado una nueva URL pública para acceder al sistema n8n del cliente. Configura el webhook con esta dirección:</p>
    <div class="url-box"><a href="${url}">${url}</a></div>
    <div class="section-title" style="margin-top:24px">Detalles del Cliente</div>
    <div class="row"><span class="label">Empresa</span><span class="value">${company}</span></div>
    <div class="row"><span class="label">Oficina</span><span class="value">${office}</span></div>
    <div class="row"><span class="label">Hostname</span><span class="value">${hostname}</span></div>
    <div class="row"><span class="label">Usuario</span><span class="value">${username}</span></div>
    <div class="row"><span class="label">ID</span><span class="value" style="font-size:11px">${clientId}</span></div>
  </div>
  <div class="footer">Telodigo AI · Notificación automática de túnel</div>
</div></body></html>`;

    try {
      const transporter = nodemailer.createTransport(SMTP_CONFIG);
      await transporter.verify();
      await transporter.sendMail({
        from: `"Telodigo AI" <${SMTP_CONFIG.auth.user}>`,
        to: TARGET_EMAIL,
        subject: `🔗 Nueva URL Tunnel: ${company} (${office})`,
        html,
      });
      console.log(`[SMTP] Email de URL enviado a ${TARGET_EMAIL}`);
    } catch (error: any) {
      console.error('[SMTP] Error sending URL email:', error?.message ?? error);
      if (error?.code) console.error('[SMTP] Code:', error.code);
      if (error?.response) console.error('[SMTP] Server response:', error.response);
    }
  }

  // --- N8N MANAGEMENT ---
  async startN8n(): Promise<boolean> {
    if (this.n8nProcess) return true;

    console.log('Starting n8n...');

    // Locate n8n binary/script
    let n8nPath = '';
    if (app.isPackaged) {
      // In a real scenario, you'd likely unpack node_modules or have a standalone n8n binary
      // For this "black box" concept, we assume it's available in the unpacked resources or similar
      // Fallback to trying to run it from the bundled node_modules if possible, or expect it in bin
      // We're pointing straight to the ASAR archive!
      n8nPath = path.join(process.resourcesPath, 'app.asar', 'node_modules', 'n8n', 'bin', 'n8n');
    } else {
      n8nPath = path.join(process.cwd(), 'node_modules', 'n8n', 'bin', 'n8n');
    }

    // n8n v1.x environment variables (N8N_USER_MANAGEMENT_DISABLED was removed)
    const n8nEnv = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      ELECTRON_NO_ATTACH_CONSOLE: '1',
      // n8n 1.x correct variables
      N8N_PORT: '5678',
      N8N_HOST: 'localhost',
      N8N_USER_FOLDER: this.appDataPath,
      // Skip owner setup / user management prompts
      N8N_SKIP_WEBHOOK_DEREGISTRATION_SHUTDOWN: 'true',
      // Disable telemetry and external calls that slow down startup
      N8N_DIAGNOSTICS_ENABLED: 'false',
      N8N_HIRING_BANNER_ENABLED: 'false',
      N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
      // Use basic auth mode (no sign-up page)
      N8N_BASIC_AUTH_ACTIVE: 'false',
      // Skip setup wizard on first run
      N8N_SKIP_SETUP: 'true',
      // Allow owner to be auto-created (n8n 1.x)
      N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'false',
    };

    console.log('Spawning n8n with path:', n8nPath);
    console.log('n8n User Folder:', this.appDataPath);

    // Determine executable to use
    let execPath = process.execPath;
    let spawnArgs = [n8nPath, 'start'];

    // In development, process.execPath is Electron, which might have an older Node version
    // incompatible with n8n. Try to use system node if available and we are in dev.
    if (!app.isPackaged) {
      try {
        // Simple check if node is in PATH
        exec('node -v', (error) => {
          if (!error) {
            console.log('[n8n] Development mode: Using system Node.js instead of Electron.');
          }
        });
        // We assume node is in PATH for dev environments
        execPath = 'node';
        // When using 'node', we don't need some of the Electron-specific env vars to trick it,
        // but keeping them doesn't hurt. However, we must ensure we aren't passing Electron flags.
      } catch (e) {
        console.warn('[n8n] Could not detect system Node.js, falling back to Electron executable.');
      }
    }

    console.log('Process execPath:', execPath);

    try {
      if (!fs.existsSync(n8nPath) && !app.isPackaged) {
        console.error(`[n8n] Executable not found at: ${n8nPath}`);
        return false;
      }

      this.n8nProcess = spawn(execPath, spawnArgs, {
        env: n8nEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });

      this.n8nProcess!.on('error', (err: any) => {
        console.error('[n8n] Failed to start process:', err);
        this.n8nReady = false;
      });

      const checkReady = () => {
        // Stop checking if process exited and we nullified the reference
        if (!this.n8nProcess) {
          console.warn('[n8n] Process is dead, stopping health checks.');
          return;
        }

        axios.get('http://localhost:5678/healthz').then(() => {
          this.n8nReady = true;
          console.log('[n8n] Ready and healthy.');
        }).catch(() => {
          setTimeout(checkReady, 3000);
        });
      };

      this.n8nProcess!.stdout?.on('data', (data: any) => {
        const txt = data.toString();
        console.log(`[n8n] ${txt}`);
        // n8n 1.x uses 'Editor is now accessible' or 'Listening on'
        if (
          txt.includes('Editor is now accessible') ||
          txt.includes('n8n ready') ||
          txt.includes('Listening on') ||
          txt.includes('is now running')
        ) {
          this.n8nReady = true;
        }
      });

      this.n8nProcess!.stderr?.on('data', (data: any) => {
        const txt = data.toString();
        // n8n writes INFO logs to stderr too — not all are errors
        console.log(`[n8n LOG] ${txt}`);
        if (
          txt.includes('Editor is now accessible') ||
          txt.includes('n8n ready') ||
          txt.includes('Listening on') ||
          txt.includes('is now running')
        ) {
          this.n8nReady = true;
        }
      });

      this.n8nProcess!.on('exit', (code: any) => {
        console.log(`n8n exited with code ${code}`);
        this.n8nProcess = null;
        this.n8nReady = false;
      });

      // Start polling for n8n health
      setTimeout(checkReady, 5000);

      return true;
    } catch (error) {
      console.error('Failed to start n8n:', error);
      return false;
    }
  }

  stopN8n() {
    if (this.n8nProcess) {
      this.n8nProcess.kill();
      this.n8nProcess = null;
    }
  }

  // --- CLOUDFLARE TUNNEL ---
  async startTunnel(token?: string): Promise<boolean> {
    if (this.tunnelProcess) this.stopTunnel();

    const cloudflaredPath = path.join(this.binPath, 'cloudflared.exe');

    if (!fs.existsSync(cloudflaredPath)) {
      console.error('Cloudflared binary not found at:', cloudflaredPath);
      return false;
    }

    console.log('Starting Cloudflare Tunnel...');

    // Prefer token from clientInfo if available
    const effectiveToken = token || this.clientInfo?.tunnelToken;

    if (effectiveToken) {
      // With a persistent token the URL is defined in the Cloudflare dashboard
      // We mark it so the status indicator shows the tunnel as active
      this.publicUrl = 'Túnel Persistente (Cloudflare)';
    } else {
      this.publicUrl = null;
    }

    try {
      // IMPORTANT: The tunnel must point to the n8n port (5678).
      // For persistent token tunnels the route is configured inside Cloudflare dashboard,
      // so the local target is irrelevant here — cloudflared handles routing.
      // For quick TryCloudflare tunnels we explicitly forward to n8n.
      const args = effectiveToken
        ? ['tunnel', '--no-autoupdate', 'run', '--token', effectiveToken]
        : ['tunnel', '--no-autoupdate', '--url', 'http://localhost:5678'];

      console.log(`Tunnel Mode: ${effectiveToken ? 'Persistent Token' : 'Quick Tunnel (TryCloudflare)'}`);

      this.tunnelProcess = spawn(cloudflaredPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });

      const handleOutput = (data: Buffer) => {
        const output = data.toString();
        console.log(`[Tunnel] ${output}`);

        // Capture trycloudflare URL from output
        const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (urlMatch) {
          this.publicUrl = urlMatch[0];
          console.log('Public URL captured:', this.publicUrl);
        }

        // Detect tunnel ready with persistent token
        if (effectiveToken && output.includes('Registered tunnel connection')) {
          console.log('[Tunnel] Persistent tunnel is connected.');
        }
      };

      this.tunnelProcess.stdout?.on('data', handleOutput);
      this.tunnelProcess.stderr?.on('data', handleOutput); // cloudflared logs to stderr

      this.tunnelProcess.on('exit', (code) => {
        console.log(`Tunnel exited with code ${code}`);
        this.tunnelProcess = null;
        if (!effectiveToken) this.publicUrl = null;

        // Retry for temporary tunnels only
        if (code !== 0 && !effectiveToken) {
          console.log('Tunnel failed. Retrying in 5 seconds...');
          setTimeout(() => {
            this.startTunnel(token);
          }, 5000);
        }
      });

      return true;
    } catch (error) {
      console.error('Failed to start tunnel:', error);
      return false;
    }
  }

  stopTunnel() {
    if (this.tunnelProcess) {
      this.tunnelProcess.kill();
      this.tunnelProcess = null;
      this.publicUrl = null;
    }
  }

  // --- OLLAMA MANAGEMENT ---
  async checkAndInstallOllama(): Promise<string> {
    // Check if installed
    try {
      await new Promise((resolve, reject) => {
        exec('ollama --version', (err) => {
          if (err) reject(err);
          else resolve(true);
        });
      });
      return 'installed';
    } catch (e) {
      console.log('Ollama not found. Attempting installation...');
    }

    // Install logic
    const installerUrl = 'https://ollama.com/download/OllamaSetup.exe';
    const installerPath = path.join(os.tmpdir(), 'OllamaSetup.exe');

    try {
      const writer = fs.createWriteStream(installerPath);
      const response = await axios({
        url: installerUrl,
        method: 'GET',
        responseType: 'stream',
      });

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(true));
        writer.on('error', reject);
      });

      console.log('Running Ollama installer...');
      // Silent install
      await new Promise((resolve, reject) => {
        exec(`"${installerPath}" /silent`, (err) => {
          if (err) reject(err);
          else resolve(true);
        });
      });

      return 'installed_fresh';
    } catch (error) {
      console.error('Ollama install failed:', error);
      return 'failed';
    }
  }

  async pullModel(model: string) {
    console.log(`Pulling model ${model}...`);
    exec(`ollama pull ${model}`, (error, stdout, stderr) => {
      if (error) console.error(`Error pulling ${model}:`, error);
      else console.log(`Pulled ${model}`);
    });
  }

  /**
   * Pull a model and stream progress via callback.
   * Parses the JSON lines that `ollama pull` outputs.
   */
  async pullModelWithProgress(
    model: string,
    onProgress: (data: { model: string; status: string; percent: number; detail: string }) => void
  ): Promise<boolean> {
    console.log(`[Dev] Pulling model with progress: ${model}`);

    return new Promise((resolve) => {
      const proc = spawn('ollama', ['pull', model], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let buffer = '';

      const processLine = (line: string) => {
        if (!line.trim()) return;
        try {
          const json = JSON.parse(line);
          // Ollama outputs JSON lines like:
          // {"status":"pulling manifest"}
          // {"status":"downloading","digest":"...","total":4000000,"completed":1200000}
          // {"status":"success"}
          const total = json.total || 0;
          const completed = json.completed || 0;
          const percent = total > 0 ? (completed / total) * 100 : 0;
          const status = json.status === 'success' ? 'done' : 'downloading';
          onProgress({
            model,
            status,
            percent,
            detail: json.status || 'Descargando...',
          });
        } catch {
          // Not JSON — plain text line
          onProgress({ model, status: 'downloading', percent: 0, detail: line.trim() });
        }
      };

      const handleData = (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(processLine);
      };

      proc.stdout?.on('data', handleData);
      proc.stderr?.on('data', handleData);

      proc.on('close', (code) => {
        if (buffer.trim()) processLine(buffer);
        if (code === 0) {
          onProgress({ model, status: 'done', percent: 100, detail: '¡Modelo descargado correctamente!' });
          resolve(true);
        } else {
          onProgress({ model, status: 'error', percent: 0, detail: `Error al descargar (código ${code})` });
          resolve(false);
        }
      });

      proc.on('error', (err) => {
        console.error(`Error running ollama pull ${model}:`, err);
        onProgress({ model, status: 'error', percent: 0, detail: 'Ollama no encontrado o no está corriendo.' });
        resolve(false);
      });
    });
  }

  // --- HARDWARE DETECTION ---
  async getHardwareSpecs() {
    const mem = await si.mem();
    const graphics = await si.graphics();

    const totalRamGB = mem.total / (1024 * 1024 * 1024);
    const hasNvidia = graphics.controllers.some(c => c.vendor.toLowerCase().includes('nvidia'));
    const vram = graphics.controllers.reduce((acc, c) => acc + (c.vram || 0), 0); // VRAM in MB usually

    return {
      totalRamGB,
      hasNvidia,
      vram,
      recommendedModel: (totalRamGB > 16 || (hasNvidia && vram > 6000)) ? 'llama3' : 'tinyllama'
    };
  }

  // --- INSTALLED MODELS ---
  async getInstalledModels(): Promise<{ name: string; size: number; modified_at: string }[]> {
    try {
      const res = await axios.get('http://localhost:11434/api/tags', { timeout: 3000 });
      return (res.data?.models ?? []).map((m: any) => ({
        name: m.name,
        size: m.size,
        modified_at: m.modified_at,
      }));
    } catch {
      return [];
    }
  }

  // --- SYSTEM STATUS ---
  async getStatus() {
    // Real ollama check via HTTP
    let ollamaOk = false;
    try {
      await axios.get('http://localhost:11434/', { timeout: 1500 });
      ollamaOk = true;
    } catch { /* not running */ }

    return {
      n8n: this.n8nReady,
      tunnel: !!this.tunnelProcess,
      publicUrl: this.publicUrl,
      ollama: ollamaOk,
    };
  }

  private async checkSmtpConnection() {
    if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
      console.warn('[SMTP] No credentials configured.');
      return;
    }
    try {
      const transporter = nodemailer.createTransport(SMTP_CONFIG);
      await transporter.verify();
      console.log('[SMTP] Connectivity verified successfully on startup.');
    } catch (error: any) {
      console.error('[SMTP] FATAL: Connection failed on startup:', error?.message ?? error);
    }
  }
}
