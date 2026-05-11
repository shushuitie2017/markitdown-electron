const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const http = require('http');

let pythonProcess = null;
let mainWindow = null;
let serverPort = null;

// Find a free port
function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

// Get the path to the Python server executable
function getServerPath() {
  if (app.isPackaged) {
    // Production: PyInstaller output in resources/server/
    const binaryName = process.platform === 'win32' ? 'server.exe' : 'server';
    return path.join(process.resourcesPath, 'server', binaryName);
  }
  // Development: run python directly
  return null;
}

// Start the Python backend server
function startServer(port) {
  return new Promise((resolve, reject) => {
    const serverExe = getServerPath();
    let proc;

    if (serverExe) {
      // Production mode: run the bundled exe
      console.log(`Starting server: ${serverExe} --port ${port}`);
      const prodOpts = { stdio: ['ignore', 'pipe', 'pipe'] };
      if (process.platform === 'win32') prodOpts.windowsHide = true;
      proc = spawn(serverExe, ['--port', String(port)], prodOpts);
    } else {
      // Development mode: run python script
      const scriptPath = path.join(__dirname, 'python', 'server_standalone.py');
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      console.log(`Starting server: ${pythonCmd} ${scriptPath} --port ${port}`);
      const devOpts = { stdio: ['ignore', 'pipe', 'pipe'] };
      if (process.platform === 'win32') devOpts.windowsHide = true;
      proc = spawn(pythonCmd, [scriptPath, '--port', String(port)], devOpts);
    }

    proc.stdout.on('data', (data) => {
      console.log(`[server] ${data.toString().trim()}`);
    });

    proc.stderr.on('data', (data) => {
      console.log(`[server] ${data.toString().trim()}`);
    });

    proc.on('error', (err) => {
      console.error('Failed to start server:', err);
      reject(err);
    });

    proc.on('exit', (code) => {
      console.log(`Server exited with code ${code}`);
      pythonProcess = null;
    });

    pythonProcess = proc;
    resolve(proc);
  });
}

// Poll the server until it's ready
function waitForServer(port, timeout = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      if (Date.now() - start > timeout) {
        return reject(new Error('Server startup timeout'));
      }

      const req = http.get(`http://127.0.0.1:${port}/api/formats`, (res) => {
        if (res.statusCode === 200) {
          res.resume();
          resolve();
        } else {
          res.resume();
          setTimeout(check, 300);
        }
      });

      req.on('error', () => {
        setTimeout(check, 300);
      });

      req.setTimeout(2000, () => {
        req.destroy();
        setTimeout(check, 300);
      });
    }

    check();
  });
}

// Create the main application window
function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 600,
    minHeight: 500,
    title: 'MarkItDown',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);
  if (process.platform !== 'darwin') {
    mainWindow.removeMenu();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Kill the Python process and its children
function killServer() {
  if (pythonProcess) {
    try {
      // On Windows, use taskkill to kill the process tree
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(pythonProcess.pid), '/f', '/t'], {
          windowsHide: true,
        });
      } else {
        pythonProcess.kill('SIGTERM');
      }
    } catch (e) {
      console.error('Error killing server:', e);
    }
    pythonProcess = null;
  }
}

// --- App lifecycle ---

app.whenReady().then(async () => {
  try {
    serverPort = await getFreePort();
    console.log(`Using port: ${serverPort}`);

    await startServer(serverPort);
    console.log('Waiting for server to be ready...');

    await waitForServer(serverPort);
    console.log('Server is ready!');

    createWindow(serverPort);
  } catch (err) {
    console.error('Failed to start application:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    killServer();
    app.quit();
  }
});

app.on('before-quit', () => {
  killServer();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverPort) {
    createWindow(serverPort);
  }
});
