import { Cursor } from "./Cursor";

// TODO: (PERFORMANCE) LAZY LOAD LINES
// TODO: (PERFROAMNCE) LOAD ON REQUEST FILES UNDER DIRECTORY AFTER EXPAND

interface FileOrFolder {
  parentPath: string | null;
  name: string;
  children: FileOrFolder[] | null;
}

interface ActiveFile {
  parent: DirNode | null;
  parentPath: string | null;
  name: string;
  sidebarEl: HTMLElement;
}

interface EnviornmentProps {
  openNewTab: (name: string, data: string) => void;
  updateActiveFile: (
    parent: DirNode,
    parentPath: string | null,
    name: string,
    sidebarEl: HTMLElement
  ) => void;
}

class DirNode {
  el: HTMLElement;
  parent: DirNode | null;

  parentPath: string | null;
  children: DirNode[] | null;

  // do not load all this bs at once.
  constructor(
    parent: DirNode | null,
    depth: number,
    parentPath: string | null,
    name: string,
    children: FileOrFolder[] | null,
    props: EnviornmentProps
  ) {
    this.parent = parent;
    this.parentPath = parentPath;

    if (children) {
      this.el = (
        document.getElementById("folder") as HTMLTemplateElement
      ).content.firstElementChild.cloneNode(true) as HTMLElement;

      this.el.firstElementChild.firstElementChild.className = "fa fa-chevron-right fa";
      this.el.firstElementChild.className = "sidebar-item";
      // @ts-ignore
      this.el.firstElementChild.firstElementChild.style.paddingLeft = `${depth * 8}px`;
      this.el.firstElementChild.lastElementChild.textContent = name;

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
          new DirNode(
            this,
            depth + 1,
            children[i].parentPath,
            children[i].name,
            children[i].children,
            props
          )
        );
      }
    } else {
      // might be bad for very large folders
      this.el = document.createElement("p");
      this.el.className = "sidebar-item";
      this.el.textContent = name;
      this.el.style.paddingLeft = `${depth * 8}px`;

      this.el.addEventListener("click", async () => {
        // @ts-ignore
        const data = await window.electronAPI.openFileFromPath(parentPath, name);
        props.updateActiveFile(this.parent, parentPath, name, this.el);
        props.openNewTab(name, data);
      });
    }
  }

  expand() {
    const container = this.el.firstElementChild as HTMLElement;
    container.firstElementChild.className = "fa fa-chevron-down fa";
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

  activeFile: ActiveFile | null;

  landingEl: HTMLElement;

  cursors: Map<HTMLElement, Cursor>;
  foregroundedTab: HTMLElement | null;
  tabPrecedence: HTMLElement[];

  constructor() {
    this.cursors = new Map<HTMLElement, Cursor>();
    this.tabPrecedence = [];
    this.foregroundedTab = null;

    this.landingEl = document
      .getElementById("workspace")
      // @ts-ignore
      .content.firstElementChild.cloneNode(true);

    if (!this.cursors.size) {
      this.activeFile = null;
      this.directory = null;
      this.initializeWelcomePage();
    }
  }

  initializeWelcomePage() {
    document.getElementById("workspace-group").appendChild(this.landingEl);

    const newFile = document.getElementById("new-file");
    newFile.addEventListener("click", () => {
      this.openNewTab("untitled-0", "");
    });

    const openFile = document.getElementById("open-file");
    openFile.addEventListener("click", async () => {
      // @ts-ignore
      const file = await window.electronAPI.openFile();
      this.openNewTab(file.name, file.data);
    });

    const openFolder = document.getElementById("open-folder");
    openFolder.addEventListener("click", async () => {
      // @ts-ignore
      const folder: FileOrFolder = await window.electronAPI.openFolder();

      this.landingEl.remove();

      this.directory = new DirNode(null, 1, folder.parentPath, folder.name, folder.children, {
        openNewTab: (name: string, data: string) => {
          this.openNewTab(name, data);
        },

        updateActiveFile: (
          parent: DirNode,
          parentPath: string | null,
          name: string,
          sidebarEl: HTMLElement
        ) => {
          if (this.activeFile) {
            let curr = this.activeFile.parent;
            while (curr) {
              // @ts-ignore
              curr.el.firstElementChild.style.backgroundColor = "";
              curr = curr.parent;
            }
            this.activeFile.sidebarEl.style.color = "#cacdcc";
            this.activeFile.sidebarEl.style.fontWeight = "400";
            this.activeFile.sidebarEl.style.backgroundColor = "";
          }

          let curr = parent;
          while (curr) {
            // @ts-ignore
            curr.el.firstElementChild.style.backgroundColor = "rgba(219, 221, 223, 0.1)";
            curr = curr.parent;
          }
          sidebarEl.style.color = "white";
          sidebarEl.style.fontWeight = "bold";
          sidebarEl.style.backgroundColor = "rgba(219, 221, 223, 0.1)";

          this.activeFile = {
            parent,
            parentPath,
            name,
            sidebarEl,
          };
        },
      });

      document.getElementById("sidebar").appendChild(this.directory.el);

      this.directory.expand();
    });
  }

  openNewTab(name: string, data: string) {
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

    this.updateForegroundedTab(newForegroundedTab);

    document.getElementById("tab-group").appendChild(newForegroundedTab);

    const tabCursor = new Cursor(0, 0, data);
    this.cursors.set(newForegroundedTab, tabCursor);
    tabCursor.foreground();
    this.tabPrecedence.push(newForegroundedTab);
  }

  switchTab(newForegroundedTab: HTMLElement) {
    const oldCursor = this.cursors.get(this.foregroundedTab);
    oldCursor.background();

    const newCursor = this.cursors.get(newForegroundedTab);
    newCursor.foreground();

    this.updateForegroundedTab(newForegroundedTab);
  }

  closeTab(existingTab: HTMLElement) {
    const oldCursor = this.cursors.get(existingTab);
    oldCursor.background();

    this.cursors.delete(existingTab);

    existingTab.remove();

    if (existingTab.isSameNode(this.foregroundedTab)) {
      this.foregroundedTab = null;

      while (this.tabPrecedence.length) {
        const tabFallback = this.tabPrecedence[this.tabPrecedence.length - 1];
        if (this.cursors.has(tabFallback)) {
          const newCursor = this.cursors.get(tabFallback);
          newCursor.foreground();

          this.updateForegroundedTab(tabFallback);
          break;
        }
        this.tabPrecedence.pop();
      }
    }
  }

  updateForegroundedTab(newForegroundedTab: HTMLElement) {
    if (this.foregroundedTab) {
      this.foregroundedTab.style.backgroundColor = "";
      // @ts-ignore
      this.foregroundedTab.firstElementChild.style.color = "#b8b8b8";
      // @ts-ignore
      this.foregroundedTab.firstElementChild.style.fontWeight = "400";

      const prevTabCursor = this.cursors.get(this.foregroundedTab);
      prevTabCursor.background();
    }

    newForegroundedTab.style.backgroundColor = "#1b1c26";
    // @ts-ignore
    newForegroundedTab.firstElementChild.style.color = "white";
    // @ts-ignore
    newForegroundedTab.firstElementChild.style.fontWeight = "bold";

    this.foregroundedTab = newForegroundedTab;
  }
}
