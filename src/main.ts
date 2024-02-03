import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import fs from "fs";

interface FileOrFolder {
  parentPath: string | null;
  name: string;
  children: FileOrFolder[] | null;
}

interface File {
  name: string;
  data: string;
}

async function handleFileOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
  });

  const file: File = { name: "", data: "" };
  if (!canceled) {
    file.name = path.parse(filePaths[0]).base;
    file.data = fs.readFileSync(filePaths[0], "utf-8");
  }
  return file;
}

async function handleFolderOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  const folder: FileOrFolder = {
    parentPath: path.parse(filePaths[0]).dir,
    name: path.parse(filePaths[0]).base,
    children: [],
  };

  let subFolders = [folder];

  if (!canceled) {
    while (subFolders.length) {
      let currentFolder = subFolders.pop();

      const files = fs.readdirSync(path.join(currentFolder.parentPath, currentFolder.name));
      for (let i = 0; i < files.length; i++) {
        const parentPath = path.join(currentFolder.parentPath, currentFolder.name);

        const isFolder = fs.lstatSync(path.join(parentPath, files[i])).isDirectory();

        let fileOrFolder: FileOrFolder;
        if (isFolder) {
          fileOrFolder = { parentPath, name: files[i], children: [] };
          subFolders.push(fileOrFolder);
        } else {
          fileOrFolder = { parentPath, name: files[i], children: null };
        }
        currentFolder.children.push(fileOrFolder);
      }
    }
  }
  return folder;
}

async function openFileFromPath(_: any, root: string, file: string) {
  const data = fs.readFileSync(path.join(root, file), "utf-8");
  return data;
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

app.on("ready", () => {
  ipcMain.handle("openFile", handleFileOpen);
  ipcMain.handle("openFolder", handleFolderOpen);
  ipcMain.handle("openFileFromPath", openFileFromPath);

  // create initial window
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
