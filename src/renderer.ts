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

  // TODO: Cover edge case if clearing out all tabs! (UI NOT BUILT YET.)
  closeTab(existingTab: HTMLElement) {
    const cursor = this.cursors.get(existingTab);
    cursor.background();

    existingTab.remove();
    this.cursors.delete(existingTab); // any changed data will be deleted if not manually saved!
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

  constructor(row: number, col: number, fileText: string) {
    this.row = row;
    this.col = col;
    this.file = new File(fileText);
    // @ts-ignore
    this.editorVirtual = document.getElementById("editor").content.cloneNode(true);

    const newLine = this.file.getCurrentLine(this.row).domNode;
    this.renderCursor(newLine);
    this.updateLinesVirtual();
    this.repaint();

    document.addEventListener("keydown", (e) => {
      if (this.editorReal.isConnected) {
        switch (e.key) {
          case "ArrowUp":
            if (this.row > 0) this.navigateUp();
            break;

          case "ArrowDown":
            const linesContainer = this.editorVirtual.getElementById("line-group");
            if (linesContainer.children.length > this.row + 1) this.navigateDown();
            break;

          case "ArrowLeft":
            if (this.col > 0) this.col--;
            break;

          case "ArrowRight":
            {
              const currentLine = this.file.getCurrentLine(this.row).domNode;
              if (this.col < currentLine.firstElementChild.textContent.length) this.col++;
            }
            break;

          case "Tab": // CONSTANT TAB LENGTH: 4
            {
              const currentLine = this.file.getCurrentLine(this.row);

              for (let i = 0; i < 4; i++) {
                currentLine.domNode.firstElementChild.textContent += "\xa0";
                this.file.insertCharacter(this.row, this.col, " ");
                this.col++;
              }
            }
            break;

          case "Backspace":
            {
              const currentLine = this.file.getCurrentLine(this.row);
              const lineText = currentLine.domNode.firstElementChild.textContent;
              const lineLength = lineText.length;

              if (lineLength) {
                // assumes 4 spaces == tab
                const tabWhitespace = "\xa0\xa0\xa0\xa0";
                if (lineText.slice(lineLength - 4, lineLength) === tabWhitespace) {
                  for (let i = 0; i < 4; i++) {
                    const updatedTextContent = this.file.deleteCharacter(this.row, this.col);
                    currentLine.domNode.firstElementChild.textContent = updatedTextContent;
                    this.col--;
                  }
                } else {
                  const updatedTextContent = this.file.deleteCharacter(this.row, this.col);
                  currentLine.domNode.firstElementChild.textContent = updatedTextContent;
                  this.col--;
                }
              } else {
                console.log("delete this entire node");
              }
            }
            break;

          case "Shift":
            break;

          case "Meta":
            break;

          case "Enter":
            this.renderNewLine();
            this.updateLinesVirtual();
            this.row++;
            this.col = 0;
            break;

          default: {
            const currentLine = this.file.getCurrentLine(this.row).domNode;
            const updatedTextContent = this.file.insertCharacter(this.row, this.col, e.key);
            currentLine.firstElementChild.textContent = updatedTextContent;
            this.col++;
          }
        }

        const newLine = this.file.getCurrentLine(this.row).domNode;
        this.renderCursor(newLine);
        this.repaint();
      }
    });
  }

  // make navigate up more polished.
  private navigateUp() {
    this.row--;
    const previousLine = this.file.getCurrentLine(this.row);
    if (previousLine.text.length < this.col) {
      this.col = previousLine.text.length;
    }
  }

  // make navigate down more polished
  private navigateDown() {
    this.row++;
    const nextLine = this.file.getCurrentLine(this.row);
    if (nextLine.text.length < this.col) {
      this.col = nextLine.text.length;
    }
  }

  private renderCursor(line: HTMLElement) {
    if (this.cursorReal) this.cursorReal.remove();
    // @ts-ignore
    this.cursorReal = document.getElementById("cursor").content.firstElementChild.cloneNode(true);
    this.cursorReal.style.marginLeft = `${this.col * 7.8}px`;
    line.appendChild(this.cursorReal);
  }

  private renderNewLine() {
    const lines = this.editorVirtual.getElementById("line-group").children;

    const prevLine = lines.item(this.row);
    const prevLineText = prevLine.firstElementChild.textContent;

    // remove all the text after the cursor on the previous line (being copied to the line after)
    prevLine.firstElementChild.textContent = prevLineText.slice(0, this.col);

    this.file.createNewLine(this.row, prevLineText.slice(this.col));

    const lineNumbers = this.editorVirtual.getElementById("line-number-group");
    const newLineNumber = lineNumbers.lastElementChild.cloneNode(true) as HTMLElement;
    newLineNumber.id = `line-number-${parseInt(newLineNumber.id.split("-")[2]) + 1}`;
    newLineNumber.firstElementChild.textContent = `${parseInt(newLineNumber.id.split("-")[2]) + 1}`;

    lineNumbers.appendChild(newLineNumber);
  }

  private updateLinesVirtual() {
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
  text: string;
  next: LineNode | null;
  domNode: HTMLElement;

  constructor(text: string, next: LineNode | null) {
    this.text = text;
    this.next = next;

    // @ts-ignore
    this.domNode = document.getElementById("line").content.firstElementChild.cloneNode(true);
  }
}

class File {
  head: LineNode;

  constructor(fileText: string) {
    this.head = new LineNode("", null); // line-0

    let curr = this.head;
    let buffer = "";

    for (let i = 0; i < fileText.length; i++) {
      const currentChar = fileText[i];

      if (currentChar === "\n") {
        curr.next = new LineNode(buffer, null);
        curr = curr.next;
        buffer = "";
      } else {
        buffer += currentChar;
      }
    }
  }

  // TODO: Add cache so we are not constantly creating looping through
  getCurrentLine(line: number): LineNode {
    let currentLine = this.head;
    for (let i = 0; i < line; i++) {
      currentLine = currentLine.next;
    }
    return currentLine;
  }

  // line-0 is first node
  insertCharacter(line: number, col: number, ch: string): string {
    const currentLine = this.getCurrentLine(line);
    const val = ch === " " ? "\xa0" : ch;
    currentLine.text = currentLine.text.slice(0, col) + val + currentLine.text.slice(col);
    return currentLine.text;
  }

  deleteCharacter(line: number, col: number): string {
    const currentLine = this.getCurrentLine(line);
    currentLine.text = currentLine.text.slice(0, col - 1) + currentLine.text.slice(col);
    return currentLine.text;
  }

  // returns the text that should start on the new line
  createNewLine(fromLine: number, textOverflow: string): string {
    const prevLine = this.getCurrentLine(fromLine);

    // removes the overflowed text that was removed from the previous line
    prevLine.text = prevLine.text.slice(0, prevLine.text.length - textOverflow.length);

    // adds the overflowed text to the new line
    const newNode = new LineNode(textOverflow, prevLine.next);

    newNode.domNode.firstElementChild.textContent = textOverflow;
    prevLine.next = newNode;
    return textOverflow;
  }

  // TO IMPLEMENT!
  removeCurrentLine(line: number) {
    console.log();
  }

  // chain nodes together by \n and return the entire content of the new modified file
  saveFile(): string {
    return "";
  }
}

new Enviornment();
