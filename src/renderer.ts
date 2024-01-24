import "./index.css";

class Cursor {
  private cursorEl: HTMLElement;
  private editorFragment: DocumentFragment;
  file: File;
  row: number;
  col: number;

  constructor(row: number, col: number, filePath: string | null) {
    this.row = row;
    this.col = col;
    this.file = new File(filePath);
    // @ts-ignore
    this.editorFragment = document.getElementById("editor").content;

    const line = this.editorFragment.getElementById(`line-${row}`);
    this.renderCursor(line);
    this.propogateChangesToDOM();

    window.addEventListener("keydown", (e) => {
      switch (e.key) {
        case "ArrowUp":
          if (this.row > 0) {
            this.row -= 1;
          }
          break;
        case "ArrowDown":
          this.row += 1;
          break;
        case "ArrowLeft":
          break;
        case "ArrowRight":
          break;
        case "Backspace":
          break;
        case "Enter":
          this.renderLine();
          this.row += 1;
          break;
        default:
          break;
      }

      const newLine = this.editorFragment.getElementById(`line-${this.row}`);
      this.renderCursor(newLine);
      this.propogateChangesToDOM();
    });
  }

  // copies cursor "component" and appends to virtual DOM
  renderCursor(line: HTMLElement) {
    if (this.cursorEl) {
      this.cursorEl.remove();
    }
    // @ts-ignore
    this.cursorEl = document.getElementById("cursor").content.firstElementChild.cloneNode(true);
    line.appendChild(this.cursorEl);
  }

  renderLine() {
    const lines = this.editorFragment.getElementById("line-group");
    const newLine = lines.lastElementChild.cloneNode(false) as HTMLElement;
    newLine.id = `line-${parseInt(newLine.id.split("-")[1]) + 1}`;

    const lineNumbers = this.editorFragment.getElementById("line-number-group");
    const newLineNumber = lineNumbers.lastElementChild.cloneNode(true) as HTMLElement;
    newLineNumber.id = `line-number-${parseInt(newLineNumber.id.split("-")[2]) + 1}`;
    newLineNumber.firstElementChild.textContent = `${parseInt(newLineNumber.id.split("-")[2]) + 1}`;

    lines.appendChild(newLine);
    lineNumbers.appendChild(newLineNumber);
  }

  left() {}

  right() {}

  downAndNewLine() {}

  propogateChangesToDOM() {
    const realDOM = document.getElementById("main-group");
    // written assuming main-group will only contain 2 children.
    if (realDOM.children.length > 1) {
      realDOM.replaceChild(this.editorFragment.cloneNode(true), realDOM.children[1]);
    } else {
      realDOM.appendChild(this.editorFragment.cloneNode(true));
    }
  }
}

class File {
  private tabRef: HTMLDivElement;

  constructor(filePath: string | null) {
    if (filePath === null) {
      this.renderTab("Untitled-1");
    } else {
      // handle parsing the actual file
    }
  }

  renderTab(fileName: string) {
    // @ts-ignore
    const tabDeepClone = document.getElementById("tab").content.cloneNode(true);
    const tabRef = tabDeepClone.firstElementChild;
    tabRef.firstElementChild.textContent = fileName;
    const tabs = document.getElementById("tab-group");
    tabs.appendChild(tabRef);
    this.tabRef = tabRef;
  }
}

let c1 = new Cursor(0, 0, null);
