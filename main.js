const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.on('launch-app', () => {
  const installPath = path.join(process.env.LOCALAPPDATA, 'Jemini');
  const installedExe = path.join(installPath, 'Jemini.exe');
  
  if (fs.existsSync(installedExe)) {
    exec(`"${installedExe}"`, (error) => {
      if (error) {
        console.error('Failed to launch app:', error.message);
      }
    });
    // Close installer window after launching
    if (mainWindow) {
      setTimeout(() => {
        mainWindow.close();
      }, 500);
    }
  } else {
    console.error('Installed executable not found:', installedExe);
  }
});

ipcMain.on('install', async (event, options) => {
  const { createDesktopShortcut = true } = options || {};
  console.log('Install started, createDesktopShortcut:', createDesktopShortcut);
  
  try {
    const jeminiLovePath = path.join(__dirname, 'jemini-love');
    
    // Check if jemini-love exists
    if (!fs.existsSync(jeminiLovePath)) {
      throw new Error(`jemini-love folder not found: ${jeminiLovePath}`);
    }
    
    // Install to Local AppData (avoids EPERM)
    event.reply('progress', 'Installing to system...');
    const installPath = path.join(process.env.LOCALAPPDATA, 'Jemini');
    if (!fs.existsSync(installPath)) {
      await fsPromises.mkdir(installPath, { recursive: true });
    }
    
    // Copy all files from jemini-love to install location
    event.reply('progress', 'Copying files...');
    const files = await fsPromises.readdir(jeminiLovePath);
    console.log('Files to copy:', files);
    for (const file of files) {
      const srcPath = path.join(jeminiLovePath, file);
      const dstPath = path.join(installPath, file);
      const stat = await fsPromises.stat(srcPath);
      if (stat.isFile()) {
        await fsPromises.copyFile(srcPath, dstPath);
        console.log(`Copied: ${file}`);
      }
    }
    
    const installedExe = path.join(installPath, 'Jemini.exe');
    
    // Verify exe exists
    if (!fs.existsSync(installedExe)) {
      throw new Error(`Jemini.exe not found after copy: ${installedExe}`);
    }
    console.log('Jemini.exe installed at:', installedExe);
    
    // Create shortcuts
    event.reply('progress', 'Creating shortcuts...');
    
    // Start Menu shortcut
    try {
      const startMenuPath = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs');
      if (!fs.existsSync(startMenuPath)) {
        fs.mkdirSync(startMenuPath, { recursive: true });
      }
      const startMenuShortcut = path.join(startMenuPath, 'Jemini.lnk');
      await createShortcut(installedExe, startMenuShortcut, 'Jemini');
      console.log('Start Menu shortcut created:', startMenuShortcut);
    } catch (err) {
      console.error('Failed to create Start Menu shortcut:', err.message);
    }
    
    // Desktop shortcut (if requested)
    if (createDesktopShortcut) {
      try {
        // Try to get actual desktop path (handles OneDrive Desktop)
        let desktopPath = path.join(process.env.USERPROFILE, 'Desktop');
        console.log('Checking desktop path:', desktopPath);
        
        // Check if Desktop folder exists, if not try OneDrive Desktop
        if (!fs.existsSync(desktopPath)) {
          console.log('Desktop not found, trying OneDrive Desktop');
          const oneDriveDesktop = path.join(process.env.USERPROFILE, 'OneDrive', 'Desktop');
          console.log('OneDrive Desktop path:', oneDriveDesktop);
          if (fs.existsSync(oneDriveDesktop)) {
            desktopPath = oneDriveDesktop;
          }
        }
        
        // Ensure desktop directory exists
        if (!fs.existsSync(desktopPath)) {
          console.error('Desktop path not found, tried:', desktopPath);
          console.error('USERPROFILE:', process.env.USERPROFILE);
        } else {
          console.log('Desktop path found:', desktopPath);
          const desktopShortcut = path.join(desktopPath, 'Jemini.lnk');
          console.log('Creating desktop shortcut at:', desktopShortcut);
          await createShortcut(installedExe, desktopShortcut, 'Jemini');
          console.log('Desktop shortcut created:', desktopShortcut);
        }
      } catch (err) {
        console.error('Failed to create Desktop shortcut:', err.message);
        console.error('Error stack:', err.stack);
      }
    } else {
      console.log('Desktop shortcut not requested (createDesktopShortcut =', createDesktopShortcut, ')');
    }
    
    event.reply('complete', { success: true });
    
  } catch (error) {
    console.error('Install error:', error);
    event.reply('complete', { success: false, error: error.message });
  }
});

function createShortcut(targetPath, shortcutPath, description) {
  return new Promise((resolve, reject) => {
    // Escape paths for VBScript
    const escapedShortcut = shortcutPath.replace(/\\/g, '\\\\').replace(/'/g, "''");
    const escapedTarget = targetPath.replace(/\\/g, '\\\\').replace(/'/g, "''");
    const escapedWorkingDir = path.dirname(targetPath).replace(/\\/g, '\\\\').replace(/'/g, "''");
    const escapedDesc = description.replace(/'/g, "''");
    
    const script = `Set oWS = WScript.CreateObject("WScript.Shell")\n` +
      `sLinkFile = "${escapedShortcut}"\n` +
      `Set oLink = oWS.CreateShortcut(sLinkFile)\n` +
      `oLink.TargetPath = "${escapedTarget}"\n` +
      `oLink.WorkingDirectory = "${escapedWorkingDir}"\n` +
      `oLink.Description = "${escapedDesc}"\n` +
      `oLink.Save\n`;
    
    const scriptPath = path.join(__dirname, 'temp_shortcut.vbs');
    try {
      fs.writeFileSync(scriptPath, script);
      console.log('Running VBScript to create shortcut:', shortcutPath);
      exec(`cscript //nologo "${scriptPath}"`, (error, stdout, stderr) => {
        try {
          if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
        if (error) {
          console.error('VBScript error:', error.message);
          console.error('VBScript stderr:', stderr);
          reject(error);
          return;
        }
        console.log('Shortcut created successfully:', shortcutPath);
        resolve();
      });
    } catch (err) {
      console.error('Error writing VBScript:', err.message);
      reject(err);
    }
  });
}

