import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: async () => {
    const fileResult = await ipcRenderer.invoke("dialog:openFile");
    return fileResult;
  },
  // openFolder: () => {
  //   const filePaths = ipcRenderer.invoke("dialog:openFile");
  // },
});
