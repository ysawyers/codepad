import "./index.css";

class Enviornment {
  // maps the tab element to the cursor for quick deletion
  cursors: Map<HTMLElement, Cursor>;
  foregroundedTab: HTMLElement | null;

  constructor() {
    this.cursors = new Map<HTMLElement, Cursor>();
    this.foregroundedTab = null;

    this.openTab("untitled-0", null);
    this.openTab("untitled-1", null);
    // this.openTab("untitled-2", null);
    // this.openTab("untitled-3", null);
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
    this.cursors.delete(existingTab); // any changed data will be deleted if not manually saved!
    existingTab.remove();
  }
}

// manages the cursor that navigates each file.
class Cursor {
  private editorReal: HTMLElement;
  private editorVirtual: DocumentFragment;
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
            if (this.row > 0) this.navigateUp();
            break;

          case "ArrowDown":
            const linesContainer = document.getElementById("line-group");
            if (linesContainer.children.length > this.row + 1) this.navigateDown();
            break;

          case "ArrowLeft":
            if (this.col > 0) this.col--;
            break;

          case "ArrowRight":
            {
              const currentLine = this.editorVirtual.getElementById(`line-${this.row}`);
              if (this.col < currentLine.firstElementChild.textContent.length) this.col++;
            }
            break;

          case "Tab":
            {
              const currentLine = this.editorVirtual.getElementById(`line-${this.row}`);
              // CONSTANT TAB LENGTH: 4
              for (let i = 0; i < 4; i++) {
                currentLine.firstElementChild.textContent += "\xa0";
                this.col++;
              }
            }
            break;

          case "Backspace":
            {
              const currentLine = this.editorVirtual.getElementById(`line-${this.row}`);
              if (currentLine.firstElementChild.textContent.length) {
                currentLine.firstElementChild.textContent =
                  currentLine.firstElementChild.textContent.slice(0, -1);
                this.col--;
              }
            }
            break;

          case "Shift":
            break;

          case "Meta":
            break;

          case "Enter":
            this.renderLine();
            this.row++;
            this.col = 0;
            break;

          default: {
            const currentLine = this.editorVirtual.getElementById(`line-${this.row}`);
            currentLine.firstElementChild.textContent += e.key === " " ? "\xa0" : e.key;
            this.col++;
          }
        }

        const newLine = this.editorVirtual.getElementById(`line-${this.row}`);
        this.renderCursor(newLine);
        this.repaint();
      }
    });
  }

  private navigateUp() {
    this.row--;
  }

  private navigateDown() {
    this.row++;
  }

  private renderCursor(line: HTMLElement) {
    if (this.cursorReal) this.cursorReal.remove();
    // @ts-ignore
    this.cursorReal = document.getElementById("cursor").content.firstElementChild.cloneNode(true);
    this.cursorReal.style.marginLeft = `${this.col * 9.6}px`;
    line.appendChild(this.cursorReal);
  }

  private renderLine() {
    const lines = this.editorVirtual.getElementById("line-group");

    // EDGE CASE: Since the last element of the group is the one being copied it may/may not contain cursor
    const newLine = lines.lastElementChild.cloneNode(true) as HTMLElement;
    if (newLine.children.length > 1) {
      newLine.lastElementChild.remove();
    }

    newLine.firstElementChild.textContent = "";
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

// inherintly implements rope data structure
class File {
  data: string;

  constructor(filePath: string | null) {
    this.data = "";

    if (filePath) {
      // // data structure!
      // (async () => {
      //   const res = (await fetch("example.txt")).text();
      //   const buffer = await res;
      // })();
    }
  }
}

new Enviornment();
