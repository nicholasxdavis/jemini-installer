const { ipcRenderer } = require('electron');

const installBtn = document.getElementById('installBtn');
const cancelBtn = document.getElementById('cancelBtn');
const progressText = document.getElementById('progress');
const title = document.getElementById('title');

let installing = false;

installBtn.addEventListener('click', () => {
  if (installing) return;
  
  installing = true;
  installBtn.disabled = true;
  cancelBtn.disabled = true;
  
  const createDesktopShortcut = document.getElementById('desktopShortcut').checked;
  
  ipcRenderer.send('install', {
    createDesktopShortcut: createDesktopShortcut
  });
});

cancelBtn.addEventListener('click', () => {
  if (!installing) {
    window.close();
  }
});

ipcRenderer.on('progress', (event, message) => {
  progressText.textContent = message;
});

ipcRenderer.on('complete', (event, result) => {
  if (result.success) {
    title.textContent = 'INSTALL COMPLETE';
    progressText.textContent = 'Jemini has been installed successfully.';
    document.getElementById('optionsGroup').style.display = 'none';
    installBtn.textContent = 'CLOSE';
    installBtn.disabled = false;
    cancelBtn.style.display = 'none';
    
    installBtn.addEventListener('click', () => {
      window.close();
    }, { once: true });
  } else {
    title.textContent = 'Installation Failed';
    progressText.textContent = `Error: ${result.error}`;
    installBtn.textContent = 'CLOSE';
    installBtn.disabled = false;
    cancelBtn.style.display = 'none';
    
    installBtn.addEventListener('click', () => {
      window.close();
    }, { once: true });
  }
});

