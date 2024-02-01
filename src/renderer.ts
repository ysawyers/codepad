import "./index.css";
import { Cursor } from "./Cursor";

// create tree of linkedlist partialHeads for easy grouping! (use cases tho?)
// create type interface for window (contextBridge API)

// when logging document fragment it will see things from future mutations ?????

class Enviornment {
  landingEl: HTMLElement;

  cursors: Map<HTMLElement, Cursor>;
  tabPrecendence: HTMLElement[];
  foregroundedTab: HTMLElement | null;

  constructor() {
    this.cursors = new Map<HTMLElement, Cursor>();
    this.tabPrecendence = [];
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
      this.landingEl.remove();
      env.openNewTab("untitled-0", "");
    });

    const openFile = document.getElementById("open-file");
    openFile.addEventListener("click", async () => {
      // @ts-ignore
      const file = await window.electronAPI.openFile();
      this.landingEl.remove();
      env.openNewTab(file.name, file.data);
    });

    const openFolder = document.getElementById("open-folder");
    openFolder.addEventListener("click", async () => {
      // @ts-ignore
      const folder = await window.electronAPI.openFolder();

      // this.sidebar = new FileTree(folder, this.openNewTab);
      // document.getElementById("sidebar").appendChild(this.sidebar.el);
      // this.sidebar.expand();
    });
  }

  openNewTab(name: string, data: string) {
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

  switchTab() {}

  // TODO: work on tab precendence problem when closing tabs
  closeTab(existingTab: HTMLElement) {
    const cursor = this.cursors.get(existingTab);
    cursor.background();
    existingTab.remove();
    this.cursors.delete(existingTab); // any changed data will be deleted if not manually saved!

    if (!this.cursors.size) {
      this.foregroundedTab = null;
      document.getElementById("workspace-group").appendChild(this.landingEl);
    } else {
      for (const key of this.cursors.keys()) {
        this.foregroundedTab = key;
        const cursor = this.cursors.get(this.foregroundedTab);
        cursor.foreground();
        break;
      }
    }
  }
}

// prevents default behavior of keys
window.addEventListener(
  "keydown",
  function (e) {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.code) > -1) {
      e.preventDefault();
    }
  },
  false
);

const env = new Enviornment();
