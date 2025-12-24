// FILE: src-electron/services/ngrokManager.cjs

const ngrok = require('ngrok');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class NgrokManager {
  constructor() {
    this.url = null;
    this.isConnected = false;
    this.authToken = null;
    this._starting = false;
    this._cliProcess = null;
  }

  /**
   * Set ngrok auth token (REQUIRED for proper cleanup)
   * Get from: https://dashboard.ngrok.com/get-started/your-authtoken
   * @param {string} token - Ngrok auth token
   */
  setAuthToken(token) {
    this.authToken = token;
    console.log('🔐 Auth token configured');
  }

  /**
   * Kill ALL ngrok processes system-wide (Windows + Linux/Mac)
   */
  async killAllNgrokProcesses() {
    try {
      console.log('🔪 Killing ALL ngrok processes...');
      
      if (process.platform === 'win32') {
        // Windows: Kill ngrok.exe
        try {
          await execPromise('taskkill /F /IM ngrok.exe /T');
          console.log('✅ Killed ngrok.exe processes');
        } catch (e) {
          // Process not found is OK
        }
        
        // Windows: Kill anything on port 4040 (ngrok API)
        try {
          await execPromise('FOR /F "tokens=5" %a in (\'netstat -aon ^| find ":4040" ^| find "LISTENING"\') do taskkill /F /PID %a');
          console.log('✅ Killed port 4040 processes');
        } catch (e) {
          // Port not in use is OK
        }
      } else {
        // Linux/Mac: Kill ngrok
        try {
          await execPromise('pkill -9 ngrok');
          console.log('✅ Killed ngrok processes');
        } catch (e) {
          // Process not found is OK
        }
      }
      
      // Wait for processes to fully terminate
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('✅ All ngrok processes terminated');
    } catch (error) {
      console.warn('⚠️ Error killing ngrok:', error.message);
    }
  }

  /**
   * Kill ngrok daemon via API
   */
  async killNgrokDaemon() {
    try {
      console.log('🔪 Killing ngrok daemon via API...');
      await ngrok.kill();
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('✅ Ngrok daemon killed');
    } catch (e) {
      console.warn('⚠️ Could not kill daemon:', e.message);
    }
  }

  /**
   * Force cleanup of all ngrok connections and processes
   */
  async forceCleanup() {
    try {
      console.log('🧹 Force cleaning up ngrok...');
      
      // 1. Disconnect all tunnels via library
      try {
        await ngrok.disconnect();
      } catch (e) {
        console.warn('⚠️ Disconnect warning:', e.message);
      }
      
      // 2. Kill daemon
      try {
        await ngrok.kill();
      } catch (e) {
        console.warn('⚠️ Kill warning:', e.message);
      }
      
      // 3. Kill CLI process if exists
      await this._killCliProcess();
      
      // 4. Nuclear option: Kill all system processes
      await this.killAllNgrokProcesses();
      
      // Reset state
      this.url = null;
      this.isConnected = false;
      
      console.log('✅ Force cleanup complete');
    } catch (error) {
      console.warn('⚠️ Error during force cleanup:', error.message);
      // Reset state anyway
      this.url = null;
      this.isConnected = false;
    }
  }

  /**
   * Start ngrok tunnel with retry logic
   * @param {number} port - Local port to tunnel
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<string>} - Public ngrok URL
   */
  async startTunnel(port = 3001, maxRetries = 3) {
    // Guard against concurrent starts
    if (this.isConnected && this.url) {
      console.log('ℹ️ Ngrok already active:', this.url);
      return this.url;
    }
    
    if (this._starting) {
      // Wait for previous start to finish
      await new Promise((resolve) => {
        const t = setInterval(() => {
          if (!this._starting) {
            clearInterval(t);
            resolve();
          }
        }, 200);
      });
      return this.url;
    }

    this._starting = true;
    
    try {
      console.log(`🔄 Starting ngrok tunnel on port ${port}...`);

      // CRITICAL: Clean up BEFORE attempting connection
      console.log('🧹 Pre-cleanup: Killing all existing ngrok processes...');
      await this.killAllNgrokProcesses();
      await this.killNgrokDaemon();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

      // Try to connect with retries
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 Ngrok connect attempt ${attempt}/${maxRetries}...`);

          // Build conservative options object for ngrok.connect
          const options = {
            proto: 'http',
            addr: String(port)
          };

          // Avoid passing non-serializable values (functions) into the request payload
          // which can cause the ngrok API to reject the tunnel configuration.

          // If an auth token is available, set it via env var for the ngrok client.
          if (this.authToken) {
            try {
              process.env.NGROK_AUTHTOKEN = this.authToken;
              console.log('🔐 Using auth token (via NGROK_AUTHTOKEN env)');
            } catch (e) {
              console.warn('⚠️ Could not set NGROK_AUTHTOKEN env var:', e.message);
            }
          } else {
            console.warn('⚠️ No auth token provided - creation may be rate/lifetime limited by ngrok');
          }

          console.log('📥 Ngrok connect options:', options);
          const publicUrl = await ngrok.connect(options);
          this.url = publicUrl;
          this.isConnected = true;
          
          console.log('✅ Ngrok tunnel established:', this.url);
          return this.url;

        } catch (error) {
          const errorMsg = error.body?.msg || error.message || String(error);
          const errorDetails = error.body?.details?.err || '';
          
          console.error(`⚠️ Ngrok attempt ${attempt} failed:`, errorMsg);
          
          // Check if it's a tunnel conflict error
          if (errorDetails.includes('already exists') || errorMsg.includes('invalid tunnel configuration') || errorMsg.includes('tunnel') && errorMsg.includes('exists')) {
            console.log(`🔄 Detected existing/stale tunnel, aggressive cleanup attempt ${attempt}...`);
            
            // Aggressive cleanup between retries
            await this.forceCleanup();
            await new Promise(resolve => setTimeout(resolve, 4000)); // Longer wait between retries
            
            if (attempt === maxRetries) {
              throw new Error(`Ngrok tunnel conflict after ${maxRetries} attempts. Please:\n1. Close all ngrok processes manually\n2. Restart the application\n3. If problem persists, get auth token from https://dashboard.ngrok.com/get-started/your-authtoken`);
            }
          } else {
            // Non-tunnel error, throw immediately
            throw error;
          }
        }
      }

      // If all library attempts fail, try CLI fallback
      console.log('⚠️ All library attempts failed, trying CLI fallback...');
      try {
        const cliUrl = await this._spawnNgrokCli(port);
        if (cliUrl) {
          this.url = cliUrl;
          this.isConnected = true;
          console.log('✅ Ngrok CLI tunnel established (fallback):', this.url);
          return this.url;
        }
      } catch (cliErr) {
        console.warn('⚠️ Ngrok CLI fallback failed:', cliErr?.message || cliErr);
      }

      // Complete failure
      this.isConnected = false;
      this.url = null;
      throw new Error('Ngrok connection failed after all attempts. Please check your internet connection and try again.');
      
    } finally {
      this._starting = false;
    }
  }

  /**
   * Spawn local ngrok CLI as a fallback when the library API cannot create tunnels
   */
  async _spawnNgrokCli(port = 3001) {
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');

    // Common locations to look for an ngrok binary
    const candidates = [
      path.join(process.cwd(), 'node_modules', '.bin', 'ngrok'),
      path.join(process.cwd(), 'node_modules', 'ngrok', 'bin', 'ngrok.exe'),
      path.join(process.cwd(), 'tools', 'ngrok.exe'),
      'ngrok'
    ];

    let bin = null;
    for (const c of candidates) {
      try {
        if (c === 'ngrok') { bin = c; break; }
        if (fs.existsSync(c)) { bin = c; break; }
      } catch (e) {}
    }

    if (!bin) {
      throw new Error('ngrok CLI not found in expected locations');
    }

    console.log('🔁 Spawning ngrok CLI fallback using:', bin);

    // Windows needs explicit .exe, other platforms ok
    const args = ['http', String(port), '--log=stdout'];
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true });

    proc.stdout.on('data', (d) => {
      try { console.log('📝 ngrok-cli:', d.toString().trim()); } catch (e) {}
    });
    proc.stderr.on('data', (d) => {
      try { console.warn('📝 ngrok-cli-err:', d.toString().trim()); } catch (e) {}
    });

    // Save handle so we can kill later
    this._cliProcess = proc;

    // Detach so process continues beyond Node lifetime if needed
    try { proc.unref(); } catch (e) {}

    // Poll local API for tunnel URL
    const http = require('http');
    const apiUrl = 'http://127.0.0.1:4040/api/tunnels';
    const timeoutMs = 15000;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const data = await new Promise((resolve, reject) => {
          const req = http.get(apiUrl, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
          });
          req.on('error', reject);
          req.setTimeout(2000, () => req.destroy());
        });

        if (data && data.status === 200) {
          const json = JSON.parse(data.body);
          const t = (json.tunnels || []).find(tt => {
            const addr = tt.config && (tt.config.addr || '');
            return String(addr).includes(String(port)) || addr === `http://localhost:${port}`;
          });
          if (t && t.public_url) return t.public_url;
        }
      } catch (e) {
        // Wait and retry
      }
      await new Promise(r => setTimeout(r, 500));
    }

    throw new Error('Timed out waiting for ngrok CLI to expose tunnel API');
  }

  /**
   * Kill CLI process if it exists
   */
  async _killCliProcess() {
    try {
      if (this._cliProcess && !this._cliProcess.killed) {
        try {
          // Try to kill process group
          process.kill(-this._cliProcess.pid);
        } catch (e) {
          // Fallback to killing single process
          try { this._cliProcess.kill(); } catch (e) {}
        }
      }
    } catch (e) {}
    this._cliProcess = null;
  }

  /**
   * Disconnect ngrok tunnel
   */
  async disconnect() {
    try {
      if (this.isConnected || this.url) {
        console.log('🔄 Disconnecting ngrok tunnel...');
        
        // Disconnect specific URL first
        if (this.url) {
          try {
            await ngrok.disconnect(this.url);
          } catch (e) {
            console.warn('⚠️ Could not disconnect specific URL:', e.message);
          }
        }
        
        // Then disconnect all and kill
        await ngrok.disconnect();
        await ngrok.kill();
        await this._killCliProcess();
        await this.killAllNgrokProcesses();
        
        this.url = null;
        this.isConnected = false;
        console.log('✅ Ngrok tunnel disconnected');
      } else {
        console.log('ℹ️ No active ngrok tunnel to disconnect');
      }
    } catch (error) {
      console.error('❌ Error disconnecting ngrok:', error.message);
      // Force reset state even if disconnect fails
      this.url = null;
      this.isConnected = false;
    }
  }

  /**
   * Get current ngrok URL
   * @returns {string|null} - Current ngrok URL or null
   */
  getUrl() {
    return this.url;
  }

  /**
   * Check if ngrok is active
   * @returns {boolean} - True if tunnel is active
   */
  isActive() {
    return this.isConnected && this.url !== null;
  }

  /**
   * Restart tunnel (disconnect and reconnect)
   * @param {number} port - Local port to tunnel
   * @returns {Promise<string>} - New public ngrok URL
   */
  async restart(port = 3001) {
    console.log('🔄 Restarting ngrok tunnel...');
    await this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    return await this.startTunnel(port);
  }

  /**
   * Get ngrok API for advanced operations
   * @returns {Promise<Object>} - Ngrok API client
   */
  async getApi() {
    try {
      return await ngrok.getApi();
    } catch (error) {
      console.error('❌ Failed to get ngrok API:', error);
      return null;
    }
  }

  /**
   * List all active tunnels
   * @returns {Promise<Array>} - List of active tunnels
   */
  async listTunnels() {
    try {
      const api = await this.getApi();
      if (!api) return [];
      
      const response = await api.listTunnels();
      return response?.tunnels || [];
    } catch (error) {
      console.error('❌ Failed to list tunnels:', error);
      return [];
    }
  }
}

module.exports = NgrokManager;
