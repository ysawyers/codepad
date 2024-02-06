import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import fs from "fs";

interface FileOrFolder {
  path: string | null;
  basename: string;
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
    path: filePaths[0],
    basename: path.parse(filePaths[0]).base,
    children: [],
  };

  if (!canceled) {
    const files = fs.readdirSync(folder.path);
    for (let i = 0; i < files.length; i++) {
      const filePath = path.join(folder.path, files[i]);

      let fileOrFolder: FileOrFolder = {
        path: filePath,
        basename: files[i],
        children: null,
      };
      if (fs.lstatSync(filePath).isDirectory()) fileOrFolder.children = [];

      folder.children.push(fileOrFolder);
    }
  }
  return folder;
}

async function openFileFromPath(_: any, filePath: string) {
  const data = fs.readFileSync(filePath, "utf-8");
  return data;
}

async function openFolderFromPath(_: any, folderPath: string) {
  let children: FileOrFolder[] = [];

  const files = fs.readdirSync(folderPath);
  for (let i = 0; i < files.length; i++) {
    const filePath = path.join(folderPath, files[i]);

    let fileOrFolder: FileOrFolder = {
      path: filePath,
      basename: files[i],
      children: null,
    };
    if (fs.lstatSync(filePath).isDirectory()) fileOrFolder.children = [];

    children.push(fileOrFolder);
  }
  return children;
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
  ipcMain.handle("openFolderFromPath", openFolderFromPath);

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
