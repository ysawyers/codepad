import "./index.css";

// create tree of linkedlist partialHeads for easy grouping!
// generic state management for vanilla, not as a framework but as an extension

// a b c enter enter enter backspace and then go to bottom then move cursor to top (navigate)

class Enviornment {
  cursors: Map<HTMLElement, Cursor>;
  tabPrecendence: HTMLElement[];
  foregroundedTab: HTMLElement | null;

  constructor() {
    this.cursors = new Map<HTMLElement, Cursor>();
    this.tabPrecendence = [];
    this.foregroundedTab = null;

    this.openTab("untitled-1", null);
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

    this.tabPrecendence.push(newTab || existingTab);

    // foreground new tab "highest precendence"
    if (newTab) {
      const newTabCursor = new Cursor(0, 0, "");
      this.cursors.set(newTab, newTabCursor);
      this.foregroundedTab = newTab;
      newTabCursor.foreground();
    } else {
      const currentTabCursor = this.cursors.get(existingTab);
      this.foregroundedTab = existingTab;
      currentTabCursor.foreground();
    }
  }

  // TODO: work on tab precendence problem when closing tabs
  closeTab(existingTab: HTMLElement) {
    const cursor = this.cursors.get(existingTab);
    cursor.background();
    existingTab.remove();
    this.cursors.delete(existingTab); // any changed data will be deleted if not manually saved!

    if (!this.cursors.size) this.foregroundedTab = null;
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
  currentLine: LineNode;

  // used to remember the original position of the cursor when moving up/down (reset when moving any other direction)
  colAnchor: number | null;

  constructor(row: number, col: number, fileText: string) {
    this.row = row;
    this.col = col;
    this.colAnchor = null;
    this.file = new File(fileText);
    // @ts-ignore
    this.editorVirtual = document.getElementById("editor").content.cloneNode(true);

    this.updateCurrentLine(this.file.getCurrentLine(this.row));
    this.renderCursor(this.currentLine);
    this.updateLineOrdering();

    // REFACTOR: MEMORY LEAK: A DELETED CURSOR DOES NOT HAVE THEIR EVENT LISTENER REMOVED FROM DOCUMENT?
    document.addEventListener("keydown", (e) => {
      if (this.editorReal.isConnected) {
        switch (e.key) {
          case "ArrowUp":
            if (this.row > 0) this.navigateUp();
            break;

          case "ArrowDown":
            const linesGroupEl = this.editorVirtual.getElementById("line-group");
            if (linesGroupEl.children.length > this.row + 1) this.navigateDown();
            break;

          case "ArrowLeft":
            if (this.col > 0) this.navigateLeft();
            break;

          case "ArrowRight":
            {
              if (this.col < this.currentLine.text.length) this.navigateRight();
            }
            break;

          case "Tab":
            {
              for (let i = 0; i < 4; i++) {
                const textContent = this.file.insertCharacter(this.currentLine, this.col, "\xa0");
                this.currentLine.vLineEl.firstElementChild.textContent = textContent;
                this.navigateRight();
              }
            }
            break;

          case "Backspace":
            {
              if (this.col != 0) {
                const tab = "\xa0\xa0\xa0\xa0";
                if (this.col > 3 && this.currentLine.text.slice(this.col - 4, this.col) === tab) {
                  for (let i = 0; i < 4; i++) {
                    const textContent = this.file.deleteCharacter(this.currentLine, this.col);
                    this.currentLine.vLineEl.firstElementChild.textContent = textContent;
                    this.navigateLeft();
                  }
                } else {
                  const textContent = this.file.deleteCharacter(this.currentLine, this.col);
                  this.currentLine.vLineEl.firstElementChild.textContent = textContent;
                  this.navigateLeft();
                }
              } else if (this.row > 0) {
                this.deleteCurrentLine();
              }
            }
            break;

          case "Shift":
            break;

          case "Meta":
            break;

          case "Enter":
            this.addNewLine();
            break;

          default: {
            const ch = e.key === " " ? "\xa0" : e.key;
            const textContent = this.file.insertCharacter(this.currentLine, this.col, ch);
            this.currentLine.vLineEl.firstElementChild.textContent = textContent;
            this.navigateRight();
          }
        }

        this.renderCursor(this.currentLine);
        this.repaint();
      }
    });
  }

  private navigateLeft() {
    this.colAnchor = null;
    this.col--;
  }

  private navigateRight() {
    this.colAnchor = null;
    this.col++;
  }

  private navigateUp() {
    this.row--;
    if (!this.colAnchor) this.colAnchor = this.col;
    if (this.currentLine.prev) {
      if (this.colAnchor > this.currentLine.prev.text.length) {
        this.col = this.currentLine.prev.text.length;
      } else {
        this.col = this.colAnchor;
      }

      this.updateCurrentLine(this.currentLine.prev);
    }
  }

  private navigateDown() {
    this.row++;
    if (!this.colAnchor) this.colAnchor = this.col;
    if (this.currentLine.next) {
      if (this.colAnchor > this.currentLine.next.text.length) {
        this.col = this.currentLine.next.text.length;
      } else {
        this.col = this.colAnchor;
      }

      this.updateCurrentLine(this.currentLine.next);
    }
  }

  private renderCursor(line: LineNode) {
    if (this.cursorReal) this.cursorReal.remove();
    // @ts-ignore
    this.cursorReal = document.getElementById("cursor").content.firstElementChild.cloneNode(true);
    this.cursorReal.style.marginLeft = `${this.col * 7.8}px`;
    line.vLineEl.appendChild(this.cursorReal);
  }

  private addNewLine() {
    const textContent = this.currentLine.text;

    // remove all the text after the cursor on the previous line (being copied to the line after)
    this.currentLine.vLineEl.firstElementChild.textContent = textContent.slice(0, this.col);

    // mutates the doubling linked list at the currentLine changing its next value to the newly appended line
    this.file.createNewLine(this.currentLine, textContent.slice(this.col));
    this.updateLineOrdering();

    // adjust cursor
    this.navigateDown();
    this.col = 0;
  }

  private deleteCurrentLine() {
    const textOverflow = this.currentLine.text.slice(this.col);

    const newCol = this.file.removeCurrentLine(this.currentLine, textOverflow);
    this.updateLineOrdering();

    // adjust cursor
    this.navigateUp();
    this.col = newCol;
  }

  // corrects ordering of lines on the vDOM
  private updateLineOrdering() {
    const lineGroup = this.editorVirtual.getElementById("line-group");
    const lineNumberGroup = this.editorVirtual.getElementById("line-number-group");

    // remove all the nodes on the DOM since it is out of order
    while (lineGroup.firstElementChild) {
      lineGroup.removeChild(lineGroup.lastElementChild);
      lineNumberGroup.removeChild(lineNumberGroup.lastElementChild);
    }

    // repopulate the line nodes in order
    let currentLineNumber = 1;
    let curr = this.file.head;
    while (curr) {
      lineGroup.appendChild(curr.vLineEl);
      curr.vLineNumberEl.firstElementChild.textContent = currentLineNumber.toString();
      lineNumberGroup.appendChild(curr.vLineNumberEl);

      curr = curr.next;
      currentLineNumber++;
    }
  }

  // add background to "focused" currentLine
  private updateCurrentLine(newCurrentLine: LineNode) {
    if (this.currentLine) {
      this.currentLine.vLineEl.style.backgroundColor = "";
    }
    newCurrentLine.vLineEl.style.backgroundColor = "rgba(219,221,223, 0.1)";
    this.currentLine = newCurrentLine;
  }

  private repaint() {
    const parent = document.getElementById("workspace-group");
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

class LineNode {
  vLineEl: HTMLElement;
  vLineNumberEl: HTMLElement;
  text: string;
  prev: LineNode | null;
  next: LineNode | null;

  constructor(text: string, next: LineNode | null, prev: LineNode | null) {
    this.text = text;
    this.next = next;
    this.prev = prev;

    // @ts-ignore
    this.vLineEl = document.getElementById("line").content.firstElementChild.cloneNode(true);

    this.vLineNumberEl = document
      .getElementById("line-number")
      // @ts-ignore
      .content.firstElementChild.cloneNode(true);
  }
}

class File {
  head: LineNode;

  constructor(fileText: string) {
    this.head = new LineNode("", null, null); // line-0

    let curr = this.head;
    let buffer = "";

    for (let i = 0; i < fileText.length; i++) {
      const currentChar = fileText[i];

      if (currentChar === "\n") {
        curr.next = new LineNode(buffer, null, curr);
        curr = curr.next;
        buffer = "";
      } else {
        buffer += currentChar;
      }
    }
  }

  getCurrentLine(line: number): LineNode {
    let currentLine = this.head;
    for (let i = 0; i < line; i++) {
      currentLine = currentLine.next;
    }
    return currentLine;
  }

  insertCharacter(line: LineNode, col: number, ch: string): string {
    line.text = line.text.slice(0, col) + ch + line.text.slice(col);
    return line.text;
  }

  deleteCharacter(line: LineNode, col: number): string {
    line.text = line.text.slice(0, col - 1) + line.text.slice(col);
    return line.text;
  }

  createNewLine(fromLine: LineNode, textOverflow: string) {
    // removes the overflowed text that was removed from the previous line
    fromLine.text = fromLine.text.slice(0, fromLine.text.length - textOverflow.length);

    // adds the overflowed text to the new line
    const newNode = new LineNode(textOverflow, fromLine.next, fromLine);
    if (fromLine?.next?.prev) fromLine.next.prev = newNode;
    fromLine.next = newNode;

    newNode.vLineEl.firstElementChild.textContent = textOverflow;
  }

  removeCurrentLine(currentLine: LineNode, textOverflow: string): number {
    if (currentLine.next) {
      currentLine.next.prev = currentLine.prev;
      currentLine.prev.next = currentLine.next;
    } else {
      currentLine.prev.next = null;
    }

    currentLine.prev.text += textOverflow;
    currentLine.prev.vLineEl.firstElementChild.textContent += textOverflow;

    // if the line above was empty column should just be set to 0
    if (currentLine.prev.text.length === textOverflow.length) {
      return 0;
    }
    return currentLine.prev.text.length - textOverflow.length;
  }

  // chain nodes together by \n and return the entire content of the new modified file
  readFileState(): string {
    let file = "";

    let curr = this.head;
    while (curr) {
      file += curr.text;
      file += "\n";
      curr = curr.next;
    }

    return file;
  }
}

const env = new Enviornment();

// this.welcomePage = document
//   .getElementById("workspace")
//   // @ts-ignore
//   .content.firstElementChild.cloneNode(true);

// this.welcomePage.getElementById("new-file").addEventListener("click", () => {
//   env.openTab("untitled-0", null);
// });

// document.getElementById("workspace-group").appendChild(this.welcomePage);
