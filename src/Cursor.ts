import { FileMutationHandler } from "./FileMutationHandler";

// IMPORTANT NOTE: EVERYTHING IS WRITTEN WITH THE NOTION OF A CONSTANT LINE HEIGHT OF 1EM = 16 PX

interface Line {
  el: HTMLElement;
  prev: Line | null;
  next: Line | null;
}

interface CursorPos {
  row: number;
  col: number;
}

export class Cursor {
  private editorEl: HTMLElement;

  private currentLine: Line;
  private lineCache: Map<number, Line>;

  private row: number;
  private col: number;
  private colAnchor: number | null;

  private file: FileMutationHandler;
  private keydownEventListener: (e: KeyboardEvent) => void;

  constructor(row: number, col: number, fileText: string) {
    this.row = row;
    this.col = col;
    this.colAnchor = null;
    this.lineCache = new Map();

    this.file = new FileMutationHandler(fileText, {
      attatchListenerToNewLine: (lineEl: HTMLElement) => {
        lineEl.addEventListener("mousedown", (e) => {
          let distanceFromLeft = e.clientX - lineEl.parentElement.getBoundingClientRect().left;

          let col = Math.round(distanceFromLeft / 7.8);
          if (col > lineEl.firstElementChild.textContent.length) {
            col = lineEl.firstElementChild.textContent.length;
          }

          const [newLine, newRow] = this.file.getLineFromNode(lineEl);
          this.col = col;
          this.row = newRow;
          this.updateCurrentLine(newLine);
        });
      },
    });

    const editorTemplate = document.getElementById("editor") as HTMLTemplateElement;
    this.editorEl = editorTemplate.content.firstElementChild.cloneNode(true) as HTMLElement;
    this.updateCurrentLine(this.file.head);
  }

  private navigateLeft() {
    this.colAnchor = null;
    this.col--;
    this.updateCurrentLine(this.currentLine);
    this.forceScrollToViewCursor();
  }

  private navigateRight() {
    this.colAnchor = null;
    this.col++;
    this.updateCurrentLine(this.currentLine);
    this.forceScrollToViewCursor();
  }

  private navigateUp() {
    this.row--;
    if (!this.colAnchor) this.colAnchor = this.col;
    if (this.currentLine.prev) {
      const textLength = this.currentLine.prev.el.firstElementChild.textContent.length;
      if (this.colAnchor > textLength) {
        this.col = textLength;
      } else {
        this.col = this.colAnchor;
      }
      this.updateCurrentLine(this.currentLine.prev);
    }
    this.forceScrollToViewCursor();
  }

  private navigateDown() {
    this.row++;
    if (!this.colAnchor) this.colAnchor = this.col;
    if (this.currentLine.next) {
      const textLength = this.currentLine.next.el.firstElementChild.textContent.length;
      if (this.colAnchor > textLength) {
        this.col = textLength;
      } else {
        this.col = this.colAnchor;
      }
      this.updateCurrentLine(this.currentLine.next);
    }
    this.forceScrollToViewCursor();
  }

  private forceScrollToViewCursor() {
    if (!this.currentLine.el.isConnected) {
      let offsetFromTop = 0;
      let curr = this.currentLine;
      while (curr) {
        offsetFromTop++;
        curr = curr.prev;
      }
      this.editorEl.scrollTo({
        top: offsetFromTop * 16 - 16,
        behavior: "instant",
      });
    }
  }

  private updateCurrentLine(currLine: Line) {
    if (this.currentLine) {
      this.currentLine.el.removeChild(this.currentLine.el.lastElementChild);
      this.currentLine.el.style.backgroundColor = "";
    }

    const cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.style.marginLeft = `${this.col * 7.8}px`;
    currLine.el.appendChild(cursor);
    currLine.el.style.backgroundColor = "rgba(219,221,223, 0.1)";

    this.currentLine = currLine;
  }

  private rerenderLines() {
    const lineGroup = document.getElementById("line-group");
    while (lineGroup.children.length) lineGroup.removeChild(lineGroup.lastElementChild);

    const scopedRegion = document.createDocumentFragment();
    const startingRow = Math.floor(this.editorEl.scrollTop / 16);

    let currLine = this.lineCache.get(startingRow);
    if (!currLine) {
      currLine = this.file.head;
      for (let row = 0; row < startingRow; row++) {
        if (!currLine) break;
        if (currLine.next) currLine = currLine.next;
      }
    }

    let offset = 0;
    do {
      if (!currLine) break;

      if (!this.lineCache.has(startingRow + offset))
        this.lineCache.set(startingRow + offset, currLine);

      currLine.el.style.top = `${startingRow + offset}em`;
      scopedRegion.appendChild(currLine.el);
      currLine = currLine.next;
      offset++;
    } while (offset * 16 <= window.innerHeight);

    lineGroup.appendChild(scopedRegion);
  }

  foreground() {
    document.getElementById("workspace-group").appendChild(this.editorEl);
    const lineGroup = document.getElementById("line-group");

    lineGroup.style.height = `${this.file.size}em`;
    this.rerenderLines();

    this.keydownEventListener = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
          if (this.row > 0) this.navigateUp();
          break;

        case "ArrowDown":
          const linesGroupEl = document.getElementById("line-group");
          if (linesGroupEl.children.length > this.row + 1) this.navigateDown();
          break;

        case "ArrowLeft":
          if (this.col > 0) this.navigateLeft();
          break;

        case "ArrowRight":
          {
            const text = this.currentLine.el.firstElementChild.textContent;
            if (this.col < text.length) this.navigateRight();
          }
          break;

        case "Tab":
          {
            for (let i = 0; i < 4; i++) {
              this.file.insertCharacter(this.currentLine, this.col, "\xa0");
              this.navigateRight();
            }
          }
          break;

        case "Backspace":
          {
            if (this.col != 0) {
              const text = this.currentLine.el.firstElementChild.textContent;
              const tab = "\xa0\xa0\xa0\xa0";
              if (this.col > 3 && text.slice(this.col - 4, this.col) === tab) {
                for (let i = 0; i < 4; i++) {
                  this.file.deleteCharacter(this.currentLine, this.col);
                  this.navigateLeft();
                }
              } else {
                this.file.deleteCharacter(this.currentLine, this.col);
                this.navigateLeft();
              }
            } else if (this.row > 0) {
              const textOverflow = this.currentLine.el.firstElementChild.textContent.slice(
                this.col
              );
              const newCol = this.file.removeCurrentLine(this.currentLine, textOverflow);
              this.navigateUp();
              this.rerenderLines();
              this.lineCache = new Map();
              this.col = newCol;
            }
          }
          break;

        case "Shift":
          break;

        case "Meta":
          break;

        case "Enter":
          {
            const textContent = this.currentLine.el.firstElementChild.textContent;
            this.currentLine.el.firstElementChild.textContent = textContent.slice(0, this.col);
            this.file.createNewLine(this.currentLine, textContent.slice(this.col));
            this.navigateDown();
            this.rerenderLines();
            this.lineCache = new Map();
            this.col = 0;
            this.colAnchor = null;
          }
          break;

        default: {
          const ch = e.key === " " ? "\xa0" : e.key;
          this.file.insertCharacter(this.currentLine, this.col, ch);
          this.navigateRight();
        }
      }
    };

    this.editorEl.addEventListener("scroll", (e: Event) => {
      this.rerenderLines();
    });

    document.addEventListener("keydown", this.keydownEventListener);
  }

  // cursor is "backgrounded" by default
  background() {
    const lineGroup = document.getElementById("line-group");
    while (lineGroup?.children.length) lineGroup.removeChild(lineGroup.lastElementChild);
    this.editorEl.remove();
    document.removeEventListener("keydown", this.keydownEventListener);
  }
}
