import { spawn, exec, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { randomUUID } from 'crypto';
import si from 'systeminformation';
import axios from 'axios';
import os from 'os';
import nodemailer from 'nodemailer';

// SMTP Configuration
// WARNING: Use an App Password for Gmail, not your main password.
// TODO: Replace with secure storage or environment variables in production.
const SMTP_CONFIG = {
  service: 'gmail',
  auth: {
    user: 'viicttoriius@gmail.com', // TODO: Reemplazar con tu correo real
    pass: 'bjauypawzfipsexj' // TODO: Reemplazar con tu contraseña de aplicación
  }
};

const TARGET_EMAIL = 'viicttoriius@gmail.com';

interface ClientInfo {
  id: string;
  firstSeen: string;
  // User Provided
  company: string;
  office: string;
  contactEmail: string;
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

  constructor() {
    this.appDataPath = path.join(app.getPath('userData'), 'n8n_data');
    this.loadClientInfo();
    
    // Ensure data directory exists
    if (!fs.existsSync(this.appDataPath)) {
      fs.mkdirSync(this.appDataPath, { recursive: true });
    }

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
      await this.startTunnel();
    } catch (error) {
      console.error('Error starting services:', error);
    }
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

  async registerClient(data: { company: string; office: string; contactEmail: string }) {
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
    if (SMTP_CONFIG.auth.user === 'tu_correo@gmail.com') return;

    const transporter = nodemailer.createTransport(SMTP_CONFIG);

    const mailOptions = {
      from: SMTP_CONFIG.auth.user,
      to: TARGET_EMAIL,
      subject: `Nuevo Cliente: ${info.company} - ${info.office}`,
      text: `
Nuevo Registro de Cliente LocalMind
===================================

Organización
------------
Empresa    : ${info.company}
Oficina    : ${info.office}
Email      : ${info.contactEmail}

Identificación
--------------
ID Cliente : ${info.id}
Fecha      : ${info.firstSeen}
Versión App: ${info.appVersion}

Sistema
-------
Hostname   : ${info.system.hostname}
Usuario    : ${info.system.username}
OS         : ${info.system.os} (${info.system.platform} ${info.system.arch})
Release    : ${info.system.release}

Hardware
--------
CPU        : ${info.hardware.cpu}
Núcleos    : ${info.hardware.cores}
Memoria    : ${info.hardware.memoryTotal}

Red
---
IP Pública : ${info.network.ip || 'Unknown'}
      `.trim()
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Email de registro enviado correctamente.');
    } catch (error) {
      console.error('Error enviando email de registro:', error);
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

  private async sendUrlEmail(url: string) {
    if (SMTP_CONFIG.auth.user === 'tu_correo@gmail.com') {
      console.warn('SMTP credentials not configured. Skipping email.');
      return;
    }

    const clientId = this.clientInfo?.id || this.getOrCreateClientId();
    const company = this.clientInfo?.company || 'Unknown Company';
    const office = this.clientInfo?.office || 'Unknown Office';
    const hostname = os.hostname();
    const username = os.userInfo().username;

    const transporter = nodemailer.createTransport(SMTP_CONFIG);

    const mailOptions = {
      from: SMTP_CONFIG.auth.user,
      to: TARGET_EMAIL,
      subject: `LocalMind URL - ${company} (${office})`,
      text: `
New LocalMind Tunnel URL Detected

Client Details:
----------------------------------------
Company  : ${company}
Office   : ${office}
Hostname : ${hostname}
User     : ${username}
Client ID: ${clientId}
----------------------------------------

URL: ${url}

Please configure your n8n webhook with this URL.
      `.trim()
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${TARGET_EMAIL}`);
    } catch (error) {
      console.error('Error sending email:', error);
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
        n8nPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'n8n', 'bin', 'n8n');
    } else {
        n8nPath = path.join(process.cwd(), 'node_modules', 'n8n', 'bin', 'n8n');
    }

    // If direct binary doesn't exist, try resolving via node
    const env = {
      ...process.env,
      N8N_USER_MANAGEMENT_DISABLED: 'true',
      N8N_PORT: '5678',
      N8N_USER_FOLDER: this.appDataPath,
      // N8N_ENCRYPTION_KEY: 'some-secure-key-generated-once' // Good practice for prod
    };

    try {
      // Use ELECTRON_RUN_AS_NODE to execute the script using Electron's internal Node.js
      const env = {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        N8N_USER_MANAGEMENT_DISABLED: 'true',
        N8N_PORT: '5678',
        N8N_USER_FOLDER: this.appDataPath,
      };

      this.n8nProcess = spawn(process.execPath, [n8nPath, 'start'], {
        env,
        stdio: ['ignore', 'pipe', 'pipe'], 
        windowsHide: true
      });

      this.n8nProcess.stdout?.on('data', (data) => {
        console.log(`[n8n] ${data}`);
      });

      this.n8nProcess.stderr?.on('data', (data) => {
        console.error(`[n8n ERR] ${data}`);
      });

      this.n8nProcess.on('exit', (code) => {
        console.log(`n8n exited with code ${code}`);
        this.n8nProcess = null;
      });

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
    
    try {
      const args = token 
        ? ['tunnel', 'run', '--token', token]
        : ['tunnel', '--url', 'http://localhost:5678'];

      this.tunnelProcess = spawn(cloudflaredPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });

      const handleOutput = (data: Buffer) => {
        const output = data.toString();
        console.log(`[Tunnel] ${output}`);
        
        // Capture trycloudflare URL
        const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (urlMatch) {
          this.publicUrl = urlMatch[0];
          console.log('Public URL captured:', this.publicUrl);
          this.sendUrlEmail(this.publicUrl);
        }
      };

      this.tunnelProcess.stdout?.on('data', handleOutput);
      this.tunnelProcess.stderr?.on('data', handleOutput); // Cloudflare often outputs to stderr

      this.tunnelProcess.on('exit', (code) => {
        console.log(`Tunnel exited with code ${code}`);
        this.tunnelProcess = null;
        this.publicUrl = null;

        // Retry logic for temporary tunnels if exit code is non-zero
        if (code !== 0 && !token) {
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

  // --- SYSTEM STATUS ---
  getStatus() {
    return {
      n8n: !!this.n8nProcess,
      tunnel: !!this.tunnelProcess,
      publicUrl: this.publicUrl,
      ollama: true // Simplified, ideally check health endpoint
    };
  }
}
