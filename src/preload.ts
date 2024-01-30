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
  openFileFromPath: async (path: string) => {
    const data = await ipcRenderer.invoke("openFileFromPath", path);
    console.log(data);
    return data;
  },
});
