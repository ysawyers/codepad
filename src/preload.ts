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
  openFileFromPath: async (root: string, file: string) => {
    const data = await ipcRenderer.invoke("openFileFromPath", root, file);
    return data;
  },
});
