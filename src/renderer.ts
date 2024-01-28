import "./index.css";

class Enviornment {
  // maps the tab element to the cursor for quick deletion
  cursors: Map<HTMLElement, Cursor>;
  tabPrecendence: HTMLElement[];
  foregroundedTab: HTMLElement | null;

  constructor() {
    this.cursors = new Map<HTMLElement, Cursor>();
    this.tabPrecendence = [];
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

  closeTab(existingTab: HTMLElement) {
    const cursor = this.cursors.get(existingTab);
    cursor.background();
    existingTab.remove();
    this.cursors.delete(existingTab); // any changed data will be deleted if not manually saved!

    this.tabPrecendence.pop();

    // if there are still tabs left fallback on the next most recent one selected
    if (this.tabPrecendence.length) {
      let tabFallback = this.tabPrecendence.pop();
      // EDGE CASE: If there are tabs that have already been deleted in the stack, ignore and remove
      while (!this.cursors.get(tabFallback)) {
        tabFallback = this.tabPrecendence.pop();
      }
      const cursor = this.cursors.get(tabFallback);

      cursor.foreground();
    }
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

  constructor(row: number, col: number, fileText: string) {
    this.row = row;
    this.col = col;
    this.file = new File(fileText);
    // @ts-ignore
    this.editorVirtual = document.getElementById("editor").content.cloneNode(true);

    this.currentLine = this.file.getCurrentLine(this.row);
    this.renderCursor(this.currentLine);
    this.updateLineOrdering();
    this.repaint();

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

          case "Tab": // CONSTANT TAB LENGTH: 4
            {
              for (let i = 0; i < 4; i++) {
                this.currentLine.domNode.firstElementChild.textContent += "\xa0";
                this.file.insertCharacter(this.currentLine, this.col, " ");
                this.col++;
              }
            }
            break;

          case "Backspace":
            {
              const lineText = this.currentLine.domNode.firstElementChild.textContent;
              const lineLength = lineText.length;

              if (lineLength) {
                // assumes 4 spaces == tab
                const tabWhitespace = "\xa0\xa0\xa0\xa0";
                if (lineText.slice(lineLength - 4, lineLength) === tabWhitespace) {
                  for (let i = 0; i < 4; i++) {
                    const updatedTextContent = this.file.deleteCharacter(
                      this.currentLine,
                      this.col
                    );
                    this.currentLine.domNode.firstElementChild.textContent = updatedTextContent;
                    this.col--;
                  }
                } else {
                  const updatedTextContent = this.file.deleteCharacter(this.currentLine, this.col);
                  this.currentLine.domNode.firstElementChild.textContent = updatedTextContent;
                  this.col--;
                }
              } else {
                console.log("move line up!");
              }
            }
            break;

          case "Shift":
            break;

          case "Meta":
            break;

          case "Enter":
            this.renderNewLine();
            this.row++;
            this.col = 0;
            break;

          default: {
            const updatedTextContent = this.file.insertCharacter(this.currentLine, this.col, e.key);
            this.currentLine.domNode.firstElementChild.textContent = updatedTextContent;
            this.col++;
          }
        }

        this.renderCursor(this.currentLine);
        this.repaint();
      }
    });
  }

  private navigateLeft() {
    this.col--;
  }

  private navigateRight() {
    this.col++;
  }

  private navigateUp() {
    this.row--;
    this.currentLine = this.currentLine.prev;
  }

  private navigateDown() {
    this.row++;
    this.currentLine = this.currentLine.next;
  }

  private renderCursor(line: LineNode) {
    if (this.cursorReal) this.cursorReal.remove();
    // @ts-ignore
    this.cursorReal = document.getElementById("cursor").content.firstElementChild.cloneNode(true);
    this.cursorReal.style.marginLeft = `${this.col * 7.8}px`;
    line.domNode.appendChild(this.cursorReal);
  }

  private renderNewLine() {
    const lines = this.editorVirtual.getElementById("line-group").children;

    const prevLine = lines.item(this.row);
    const prevLineText = prevLine.firstElementChild.textContent;

    // remove all the text after the cursor on the previous line (being copied to the line after)
    prevLine.firstElementChild.textContent = prevLineText.slice(0, this.col);

    // mutates the doubling linked list at the currentLine changing its next value to the newly appended line
    this.file.createNewLine(this.currentLine, prevLineText.slice(this.col));

    this.currentLine = this.currentLine.next;
    this.updateLineOrdering();

    const lineNumbers = this.editorVirtual.getElementById("line-number-group");
    const newLineNumber = lineNumbers.lastElementChild.cloneNode(true) as HTMLElement;
    newLineNumber.id = `line-number-${parseInt(newLineNumber.id.split("-")[2]) + 1}`;
    newLineNumber.firstElementChild.textContent = `${parseInt(newLineNumber.id.split("-")[2]) + 1}`;

    lineNumbers.appendChild(newLineNumber);
  }

  // corrects ordering of lines on the vDOM
  private updateLineOrdering() {
    const group = this.editorVirtual.getElementById("line-group");

    // remove all the nodes on the DOM since it is out of order
    while (group.firstElementChild) {
      group.removeChild(group.lastElementChild);
    }

    // repopulate the line nodes in order
    let curr = this.file.head;
    while (curr) {
      group.appendChild(curr.domNode);
      curr = curr.next;
    }
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

class LineNode {
  domNode: HTMLElement;
  text: string;
  prev: LineNode | null;
  next: LineNode | null;

  constructor(text: string, next: LineNode | null, prev: LineNode | null) {
    this.text = text;
    this.next = next;
    this.prev = prev;

    // @ts-ignore
    this.domNode = document.getElementById("line").content.firstElementChild.cloneNode(true);
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

  // line-0 is first node
  insertCharacter(line: LineNode, col: number, ch: string): string {
    const val = ch === " " ? "\xa0" : ch;
    line.text = line.text.slice(0, col) + val + line.text.slice(col);
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

    newNode.domNode.firstElementChild.textContent = textOverflow;
  }

  removeCurrentLine(line: number) {}

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

new Enviornment();
