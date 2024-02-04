import { Cursor } from "./Cursor";

// TODO: Work on tab precedence eventually; currently just in order of what has been appended to the Map
interface FileOrFolder {
  parentPath: string | null;
  name: string;
  children: FileOrFolder[] | null;
}

class DirNode {
  el: HTMLElement;

  parentPath: string | null;
  name: string; // ? keep if the state will live on the DOM?
  children: DirNode[] | null;

  constructor(parentPath: string | null, name: string, children: FileOrFolder[] | null, env: any) {
    this.parentPath = parentPath;
    this.name = name;

    if (children) {
      const el = (
        document.getElementById("folder") as HTMLTemplateElement
      ).content.firstElementChild.cloneNode(true);
      this.el = el as HTMLElement;
      this.el.firstElementChild.textContent = name;

      this.el.firstElementChild.addEventListener("click", () => {
        if (this.el.lastElementChild.children.length) {
          this.collapse();
        } else {
          this.expand();
        }
      });

      this.children = [];

      for (let i = 0; i < children.length; i++) {
        this.children.push(
          new DirNode(children[i].parentPath, children[i].name, children[i].children, env)
        );
      }
    } else {
      this.el = (
        document.getElementById("file") as HTMLTemplateElement
      ).content.firstElementChild.cloneNode(true) as HTMLElement;

      this.el.firstElementChild.textContent = name;

      this.el.addEventListener("click", async () => {
        // @ts-ignore
        const data = await window.electronAPI.openFileFromPath(parentPath, name);
        env.openNewTab(name, data);
      });
    }
  }

  expand() {
    if (this.children)
      for (let i = 0; i < this.children.length; i++)
        this.el.lastElementChild.append(this.children[i].el);
  }

  collapse() {
    if (this.children)
      for (let i = 0; i < this.children.length; i++)
        this.el.lastElementChild.removeChild(this.el.lastElementChild.lastElementChild);
  }
}

export class Enviornment {
  directory: DirNode | null;

  landingEl: HTMLElement;
  cursors: Map<HTMLElement, Cursor>;
  foregroundedTab: HTMLElement | null;

  constructor() {
    this.cursors = new Map<HTMLElement, Cursor>();
    this.foregroundedTab = null;

    this.landingEl = document
      .getElementById("workspace")
      // @ts-ignore
      .content.firstElementChild.cloneNode(true);

    // EDGE CASE: if enviornment is not opened with project automatically
    if (!this.cursors.size) {
      this.initializeWelcomePage();
    }
  }

  initializeWelcomePage() {
    document.getElementById("workspace-group").appendChild(this.landingEl);

    const newFile = document.getElementById("new-file");
    newFile.addEventListener("click", () => {
      this.directory = null;
      this.openNewTab("untitled-0", "");
    });

    const openFile = document.getElementById("open-file");
    openFile.addEventListener("click", async () => {
      this.directory = null;
      // @ts-ignore
      const file = await window.electronAPI.openFile();
      this.openNewTab(file.name, file.data);
    });

    const openFolder = document.getElementById("open-folder");
    openFolder.addEventListener("click", async () => {
      // @ts-ignore
      const folder: FileOrFolder = await window.electronAPI.openFolder();

      this.landingEl.remove();

      this.directory = new DirNode(folder.parentPath, folder.name, folder.children, {
        openNewTab: (name: string, data: string) => {
          this.openNewTab(name, data);
        },
      });
      this.directory.expand();

      document.getElementById("sidebar").appendChild(this.directory.el);
    });
  }

  openNewTab(name: string, data: string) {
    this.landingEl.remove();

    if (this.foregroundedTab) {
      const prevTabCursor = this.cursors.get(this.foregroundedTab);
      prevTabCursor.background();
    }

    // @ts-ignore
    const tab = document.getElementById("tab").content.cloneNode(true);
    const newTab = tab.firstElementChild as HTMLElement;
    newTab.firstElementChild.textContent = name;

    (newTab.lastElementChild as HTMLElement).addEventListener("click", () => {
      this.closeTab(newTab);
    });

    const tabs = document.getElementById("tab-group");
    tabs.appendChild(newTab);

    const newTabCursor = new Cursor(0, 0, data);
    this.cursors.set(newTab, newTabCursor);
    this.foregroundedTab = newTab;
    newTabCursor.foreground();
  }

  // TODO
  switchTab() {}

  closeTab(existingTab: HTMLElement) {
    existingTab.remove();

    const cursor = this.cursors.get(existingTab);
    cursor.background();
    this.cursors.delete(existingTab); // any changed data will be deleted if not manually saved!

    if (!this.cursors.size) {
      this.foregroundedTab = null;
      if (!this.directory) document.getElementById("workspace-group").appendChild(this.landingEl);
    } else {
      const cursor = this.cursors.get(this.foregroundedTab);
      cursor?.background();

      for (const key of this.cursors.keys()) {
        this.foregroundedTab = key;
        const cursor = this.cursors.get(this.foregroundedTab);
        cursor.foreground();
        break;
      }
    }
  }
}
