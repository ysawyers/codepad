import { EditorCursor } from "./editor/cursor";

interface FileOrFolder {
  path: string | null;
  basename: string;
  children: FileOrFolder[] | null;
}

interface EnviornmentProps {
  openNewTab: (dirNode: DirNode, name: string, data: string) => void;
}

class DirNode {
  el: HTMLElement;

  depth: number;
  props: EnviornmentProps;
  parent: DirNode | null;

  path: string | null;
  children: DirNode[] | null;

  // do not load all this bs at once.
  constructor(
    parent: DirNode | null,
    depth: number,
    fileOrFolder: FileOrFolder,
    props: EnviornmentProps
  ) {
    this.parent = parent;
    this.path = fileOrFolder.path;
    this.depth = depth;
    this.props = props;

    if (fileOrFolder.children) {
      this.children = [];

      this.el = (
        document.getElementById("folder") as HTMLTemplateElement
      ).content.firstElementChild.cloneNode(true) as HTMLElement;

      this.el.firstElementChild.firstElementChild.className = "fa fa-chevron-right fa";
      this.el.firstElementChild.className = "sidebar-item";
      // @ts-ignore
      this.el.firstElementChild.firstElementChild.style.paddingLeft = `${depth * 8}px`;
      this.el.firstElementChild.lastElementChild.textContent = fileOrFolder.basename;

      this.el.firstElementChild.addEventListener("click", async () => {
        if (this.el.lastElementChild.children.length) {
          this.collapse();
        } else {
          await this.expand();
        }
      });

      for (let i = 0; i < fileOrFolder.children.length; i++)
        this.children.push(new DirNode(this, depth + 1, fileOrFolder.children[i], props));
    } else {
      this.el = document.createElement("p");
      this.el.className = "sidebar-item";
      this.el.textContent = fileOrFolder.basename;
      this.el.style.paddingLeft = `${depth * 8}px`;

      this.el.addEventListener("click", async () => {
        // @ts-ignore
        const data = await window.electronAPI.openFileFromPath(fileOrFolder.path);
        props.openNewTab(this, fileOrFolder.basename, data);
      });
    }
  }

  async expand() {
    const container = this.el.firstElementChild as HTMLElement;
    container.firstElementChild.className = "fa fa-chevron-down fa";

    if (!this.children.length) {
      // @ts-ignore
      const data: FileOrFolder[] = await window.electronAPI.openFolderFromPath(this.path);
      for (let i = 0; i < data.length; i++)
        this.children.push(new DirNode(this, this.depth + 1, data[i], this.props));
    }

    for (let i = 0; i < this.children.length; i++)
      this.el.lastElementChild.appendChild(this.children[i].el);
  }

  collapse() {
    const container = this.el.firstElementChild as HTMLElement;
    container.firstElementChild.className = "fa fa-chevron-right";
    for (let i = 0; i < this.children.length; i++) this.children[i].el.remove();
  }
}

export class Enviornment {
  directory: DirNode | null;

  landingEl: HTMLElement;

  files: Map<HTMLElement, [EditorCursor, DirNode | null]>;
  foregroundedTab: HTMLElement | null;
  tabPrecedence: HTMLElement[];

  constructor() {
    this.files = new Map<HTMLElement, [EditorCursor, DirNode]>();
    this.tabPrecedence = [];
    this.foregroundedTab = null;

    this.landingEl = document
      .getElementById("workspace")
      // @ts-ignore
      .content.firstElementChild.cloneNode(true);

    if (!this.files.size) {
      this.directory = null;
      this.initializeWelcomePage();
    }
  }

  initializeWelcomePage() {
    document.getElementById("workspace-group").appendChild(this.landingEl);

    const newFile = document.getElementById("new-file");
    newFile.addEventListener("click", () => {
      this.openNewTab(null, "untitled-0", "");
    });

    const openFile = document.getElementById("open-file");
    openFile.addEventListener("click", async () => {
      // @ts-ignore
      const file = await window.electronAPI.openFile();
      this.openNewTab(null, file.name, file.data);
    });

    const openFolder = document.getElementById("open-folder");
    openFolder.addEventListener("click", async () => {
      // @ts-ignore
      const folder: FileOrFolder = await window.electronAPI.openFolder();

      this.landingEl.remove();

      this.directory = new DirNode(null, 1, folder, {
        openNewTab: (dirNode: DirNode, name: string, data: string) => {
          // after this foregroundedTab will have the value of the HTMLElement of the newly opened tab
          this.openNewTab(dirNode, name, data);
        },
      });

      document.getElementById("sidebar").appendChild(this.directory.el);

      await this.directory.expand();
    });
  }

  openNewTab(dirNode: DirNode | null, name: string, data: string) {
    this.landingEl.remove();

    const clone = (document.getElementById("tab") as HTMLTemplateElement).content.cloneNode(true);
    // @ts-ignore
    const newForegroundedTab = clone.firstElementChild as HTMLElement;
    newForegroundedTab.firstElementChild.textContent = name;

    newForegroundedTab.addEventListener("click", (e) => {
      // @ts-ignore
      if (e.target.className === "tab-close-container") {
        this.closeTab(newForegroundedTab);
      } else {
        this.switchTab(newForegroundedTab);
      }
    });

    this.updateForegroundedTab(dirNode, newForegroundedTab);

    document.getElementById("tab-group").appendChild(newForegroundedTab);

    const file = new EditorCursor(0, 0, data);
    this.files.set(newForegroundedTab, [file, dirNode]);
    file.foreground();
    this.tabPrecedence.push(newForegroundedTab);
  }

  switchTab(newForegroundedTab: HTMLElement) {
    const [oldCursor, _] = this.files.get(this.foregroundedTab);
    oldCursor.background();

    const [newCursor, newDirNode] = this.files.get(newForegroundedTab);
    newCursor.foreground();

    this.updateForegroundedTab(newDirNode, newForegroundedTab);
  }

  closeTab(existingTab: HTMLElement) {
    const [oldCursor, oldDirNode] = this.files.get(existingTab);
    oldCursor.background();

    // have to copy the code here from the updateForeground function because of edge case:
    // tab being deleted will be removed from DOM so state does not matter but the state of the sidebar must be updated.
    if (oldDirNode) {
      let curr = oldDirNode.parent;
      while (curr) {
        // @ts-ignore
        curr.el.firstElementChild.style.backgroundColor = "";
        curr = curr.parent;
      }
      oldDirNode.el.style.color = "#cacdcc";
      oldDirNode.el.style.fontWeight = "400";
      oldDirNode.el.style.backgroundColor = "";
    }

    this.files.delete(existingTab);

    existingTab.remove();

    if (existingTab.isSameNode(this.foregroundedTab)) {
      this.foregroundedTab = null;

      while (this.tabPrecedence.length) {
        const tabFallback = this.tabPrecedence[this.tabPrecedence.length - 1];
        if (this.files.has(tabFallback)) {
          const [newCursor, newDirNode] = this.files.get(tabFallback);
          newCursor.foreground();

          this.updateForegroundedTab(newDirNode, tabFallback);
          break;
        }
        this.tabPrecedence.pop();
      }
    }
  }

  updateForegroundedTab(dirNode: DirNode | null, newForegroundedTab: HTMLElement) {
    if (this.foregroundedTab) {
      this.foregroundedTab.style.backgroundColor = "";
      // @ts-ignore
      this.foregroundedTab.firstElementChild.style.color = "#b8b8b8";
      // @ts-ignore
      this.foregroundedTab.firstElementChild.style.fontWeight = "400";

      const [file, oldDirNode] = this.files.get(this.foregroundedTab);
      file.background();

      if (oldDirNode) {
        let curr = oldDirNode.parent;
        while (curr) {
          // @ts-ignore
          curr.el.firstElementChild.style.backgroundColor = "";
          curr = curr.parent;
        }
        oldDirNode.el.style.color = "#cacdcc";
        oldDirNode.el.style.fontWeight = "400";
        oldDirNode.el.style.backgroundColor = "";
      }
    }

    if (dirNode) {
      let curr = dirNode.parent;
      while (curr) {
        // @ts-ignore
        curr.el.firstElementChild.style.backgroundColor = "rgba(219, 221, 223, 0.1)";
        curr = curr.parent;
      }
      dirNode.el.style.color = "white";
      dirNode.el.style.fontWeight = "bold";
      dirNode.el.style.backgroundColor = "rgba(219, 221, 223, 0.1)";
    }

    newForegroundedTab.style.backgroundColor = "#1b1c26";
    // @ts-ignore
    newForegroundedTab.firstElementChild.style.color = "white";
    // @ts-ignore
    newForegroundedTab.firstElementChild.style.fontWeight = "bold";

    this.foregroundedTab = newForegroundedTab;
  }
}
