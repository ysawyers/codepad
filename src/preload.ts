import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: async () => {
    const file = await ipcRenderer.invoke("openFile");
    return file;
  },
  openFolder: async () => {
    const folder = await ipcRenderer.invoke("openFolder");
    return folder;
  },
  openFileFromPath: async (filePath: string) => {
    const data = await ipcRenderer.invoke("openFileFromPath", filePath);
    return data;
  },
  openFolderFromPath: async (folderPath: string) => {
    const data = await ipcRenderer.invoke("openFolderFromPath", folderPath);
    return data;
  },
});
