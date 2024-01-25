import "./index.css";
import fs from "node:fs";

class Enviornment {
  // maps the tab element to the cursor for quick deletion
  cursors: Map<HTMLElement, Cursor>;
  foregroundedTab: HTMLElement | null;

  constructor() {
    this.cursors = new Map<HTMLElement, Cursor>();
    this.foregroundedTab = null;

    this.openTab("untitled-0", null);
    this.openTab("untitled-1", null);
    this.openTab("untitled-2", null);
    this.openTab("untitled-3", null);
  }

  openTab(fileName: string, existingTab: HTMLElement | null) {
    // if there is a tab already open, close it
    if (this.foregroundedTab) {
      const prevTabCursor = this.cursors.get(this.foregroundedTab);
      prevTabCursor.background();
    }

    // if the tab being opened doesn't exist, create it
    let newTab: HTMLElement | null = null;
    if (!existingTab) {
      // @ts-ignore
      const tabCopy = document.getElementById("tab").content.cloneNode(true);
      newTab = tabCopy.firstElementChild as HTMLElement;
      newTab.firstElementChild.textContent = fileName;

      // attatch event listener to close tab
      (newTab.lastElementChild as HTMLElement).addEventListener("click", () => {
        this.closeTab(newTab);
      });

      const tabs = document.getElementById("tab-group");
      tabs.appendChild(newTab);
    }

    if (newTab) {
      const newTabCursor = new Cursor(0, 0, null);
      this.cursors.set(newTab, newTabCursor);
      this.foregroundedTab = newTab;
      newTabCursor.foreground();
    } else {
      const currentTabCursor = this.cursors.get(existingTab);
      this.foregroundedTab = existingTab;
      currentTabCursor.foreground();
    }
  }

  // TODO: Cover edge case if clearing out all tabs!
  closeTab(existingTab: HTMLElement) {
    this.cursors.delete(existingTab);
    existingTab.remove();
  }
}

// manages the cursor that navigates each file.
class Cursor {
  private editorReal: HTMLElement;
  private editorVirtual: DocumentFragment;

  // since no mutations are made on the cursor specifically mutations directly to the DOM is fine.
  private cursorReal: HTMLElement;

  file: File;
  row: number;
  col: number;

  constructor(row: number, col: number, filePath: string | null) {
    this.row = row;
    this.col = col;
    this.file = new File(filePath);
    // @ts-ignore
    this.editorVirtual = document.getElementById("editor").content.cloneNode(true);
    const line = this.editorVirtual.getElementById(`line-${row}`);
    this.renderCursor(line);

    document.addEventListener("keydown", (e) => {
      if (this.editorReal.isConnected) {
        switch (e.key) {
          case "ArrowUp":
            if (this.row > 0) this.row -= 1;
            break;
          case "ArrowDown":
            if (document.getElementById("line-group").children.length > this.row + 1) this.row++;
            break;
          case "ArrowLeft":
            break;
          case "ArrowRight":
            break;
          case "Backspace":
            break;
          case "Enter":
            this.renderLine();
            this.row++;
            break;
          default:
            break;
        }

        const newLine = this.editorVirtual.getElementById(`line-${this.row}`);
        this.renderCursor(newLine);
        this.repaint();
      }
    });
  }

  private renderCursor(line: HTMLElement) {
    // removes the cursor that currently resides on the real DOM for the new cursor being drawn onto the virtual DOM
    if (this.cursorReal) this.cursorReal.remove();

    // @ts-ignore
    this.cursorReal = document.getElementById("cursor").content.firstElementChild.cloneNode(true);
    line.appendChild(this.cursorReal);
  }

  private renderLine() {
    const lines = this.editorVirtual.getElementById("line-group");

    // we only want to clone the container of the line but not the contents to the new line!
    const newLine = lines.lastElementChild.cloneNode(false) as HTMLElement;
    newLine.id = `line-${parseInt(newLine.id.split("-")[1]) + 1}`;

    const lineNumbers = this.editorVirtual.getElementById("line-number-group");
    const newLineNumber = lineNumbers.lastElementChild.cloneNode(true) as HTMLElement;
    newLineNumber.id = `line-number-${parseInt(newLineNumber.id.split("-")[2]) + 1}`;
    newLineNumber.firstElementChild.textContent = `${parseInt(newLineNumber.id.split("-")[2]) + 1}`;

    lines.appendChild(newLine);
    lineNumbers.appendChild(newLineNumber);
  }

  private repaint() {
    const parent = document.getElementById("main-group");
    if (this.editorReal) this.editorReal.remove();
    this.editorReal = this.editorVirtual.firstElementChild.cloneNode(true) as HTMLElement;
    parent.appendChild(this.editorReal);
  }

  foreground() {
    this.repaint();
  }

  // cursor is "backgrounded" by default
  background() {
    this.editorReal.remove();
  }
}

// data for each file
class File {
  constructor(filePath: string | null) {}
}

new Enviornment();
