import { FileMutationHandler } from "./FileMutationHandler";

// IMPORTANT NOTE: EVERYTHING IS WRITTEN WITH THE NOTION OF A CONSTANT LINE HEIGHT OF 1EM = 16 PX

interface Line {
  el: HTMLElement;
  prev: Line | null;
  next: Line | null;
}

interface Hover {
  startingLine: Line;
  startingCol: number;
  startingRow: number;
}

interface Highlight {
  startingLine: Line;
  startingCol: number;
  endingLine: Line;
  endingCol: number;
}

export class Cursor {
  private editorEl: HTMLElement;

  // used to remember the region scoped
  private offsetFromTop: number;

  private currentLine: Line;
  private lineCache: Map<number, Line>;

  // TODO: eventually turn this into a proxy
  private row: number;
  private col: number;
  private colAnchor: number | null;

  private file: FileMutationHandler;
  private keydownEventListener: (e: KeyboardEvent) => void;

  private hovering: Hover | null;
  private highlightedRegion: Highlight | null;

  constructor(row: number, col: number, fileText: string) {
    this.offsetFromTop = 0;
    this.row = row;
    this.col = col;
    this.lineCache = new Map();

    this.hovering = null;
    this.highlightedRegion = null;
    this.colAnchor = null;

    this.file = new FileMutationHandler(fileText);

    const editorTemplate = document.getElementById("editor") as HTMLTemplateElement;
    this.editorEl = editorTemplate.content.firstElementChild.cloneNode(true) as HTMLElement;
    this.updateCurrentLine(this.file.head);
  }

  private navigateLeft() {
    this.highlightedRegion = null;
    this.colAnchor = null;
    this.col--;
    this.updateCurrentLine(this.currentLine);
    this.forceScrollToViewCursor();
  }

  private navigateRight() {
    this.highlightedRegion = null;
    this.colAnchor = null;
    this.col++;
    this.updateCurrentLine(this.currentLine);
    this.forceScrollToViewCursor();
  }

  private navigateUp() {
    this.highlightedRegion = null;
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
    this.highlightedRegion = null;
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
    const scopedRegion = document.createDocumentFragment();
    const startingRow = Math.floor(this.editorEl.scrollTop / 16);

    this.offsetFromTop = this.editorEl.scrollTop / 16;

    let currLine = this.lineCache.get(startingRow);
    if (!currLine) {
      currLine = this.file.head;
      for (let row = 0; row < startingRow; row++) {
        if (!currLine) break;
        if (currLine.next) currLine = currLine.next;
      }
    }

    const lineGroup = document.getElementById("line-group");

    let offset = 0;
    do {
      if (!currLine) break;

      if (!this.lineCache.has(startingRow + offset))
        this.lineCache.set(startingRow + offset, currLine);

      let lineEl = currLine.el;
      currLine.el.addEventListener("mousedown", (e: MouseEvent) => {
        this.highlightedRegion = null;

        const distanceFromLeft = e.clientX - lineEl.parentElement.getBoundingClientRect().left;

        // divided by the width of each char to get the column
        let col = Math.round(distanceFromLeft / 7.8);
        if (col > lineEl.firstElementChild.textContent.length) {
          col = lineEl.firstElementChild.textContent.length;
        }

        // get relative row of the rendered region (all the lines will be cached at this point)
        let regionRow = 0;
        for (let row = 0; row < lineGroup.children.length; row++) {
          if (lineGroup.children[row].isSameNode(lineEl)) {
            regionRow = row;
            break;
          }
        }

        const computedRow = Math.floor(this.offsetFromTop) + regionRow;
        const newLine = this.lineCache.get(computedRow);
        this.col = col;
        this.row = computedRow;
        this.updateCurrentLine(newLine);

        this.hovering = {
          startingLine: newLine,
          startingCol: col,
          startingRow: computedRow,
        };
      });

      currLine.el.style.top = `${startingRow + offset}em`;
      scopedRegion.appendChild(currLine.el);

      currLine = currLine.next;
      offset++;
    } while (offset * 16 <= window.innerHeight);

    // TODO: Add diffing instead of just destroying the whole thing
    while (lineGroup.children.length) lineGroup.removeChild(lineGroup.lastElementChild);
    lineGroup.appendChild(scopedRegion);
  }

  foreground() {
    document.getElementById("workspace-group").appendChild(this.editorEl);
    const lineGroup = document.getElementById("line-group");

    this.editorEl.scrollTo({
      top: this.offsetFromTop * 16,
      behavior: "instant",
    });

    lineGroup.style.height = `${this.file.size}em`;
    this.rerenderLines();

    this.keydownEventListener = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
          if (this.row > 0) this.navigateUp();
          break;

        case "ArrowDown":
          const linesGroupEl = document.getElementById("line-group");
          if (!this.currentLine.el.isSameNode(linesGroupEl.lastElementChild)) this.navigateDown();
          break;

        case "ArrowLeft":
          if (this.col > 0) {
            this.navigateLeft();
          } else if (this.row > 0) {
            this.col = this.currentLine.prev.el.textContent.length;
            this.navigateUp();
          }
          break;

        case "ArrowRight":
          {
            const linesGroupEl = document.getElementById("line-group");

            const text = this.currentLine.el.firstElementChild.textContent;
            if (this.col < text.length) {
              this.navigateRight();
            } else if (!this.currentLine.el.isSameNode(linesGroupEl.lastElementChild)) {
              this.col = 0;
              this.navigateDown();
            }
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
            } else if (this.highlightedRegion) {
              console.log("batch delete");
            } else if (this.row > 0) {
              const textOverflow = this.currentLine.el.firstElementChild.textContent.slice(
                this.col
              );

              this.col = this.file.removeCurrentLine(this.currentLine, textOverflow);

              // clear cache before rerendering lines since lines are now reordered
              this.lineCache = new Map();
              this.rerenderLines();

              this.colAnchor = null;
              this.navigateUp();
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

            if (this.highlightedRegion) {
              console.log("batch delete");
            }

            this.file.createNewLine(this.currentLine, textContent.slice(this.col));

            this.col = 0;

            // clear cache before rerendering lines since lines are now reordered
            this.lineCache = new Map();
            this.rerenderLines();

            this.colAnchor = null;
            this.navigateDown();
          }
          break;

        default: {
          const ch = e.key === " " ? "\xa0" : e.key;

          if (this.highlightedRegion) {
            console.log("batch delete");
          }

          this.file.insertCharacter(this.currentLine, this.col, ch);
          this.navigateRight();
        }
      }
    };

    this.editorEl.addEventListener("scroll", (e: Event) => {
      this.rerenderLines();
    });

    // contained to line-group specifically, hovering will not be active anywhere else
    this.editorEl.lastElementChild.addEventListener("mousemove", (e: MouseEvent) => {
      if (this.hovering) {
        // if not scrolled perfectly aligned on a new line add the additional offset to get to the correct row
        const offset = this.editorEl.scrollTop % 16;

        const computedRow = Math.floor(this.offsetFromTop) + (Math.floor((e.y + offset) / 16) - 2); // - 2 just cause thats what works ?
        const computerCol = Math.round(e.offsetX / 7.8);

        const lineHovering = this.lineCache.get(computedRow);

        if (computerCol > lineHovering.el.firstElementChild.textContent.length) {
          this.col = lineHovering.el.firstElementChild.textContent.length;
        } else if (computerCol > 0) {
          this.col = computerCol;
        }

        this.updateCurrentLine(lineHovering);
        if (this.hovering.startingRow > computedRow) {
          console.log("highlight backwards");
        } else if (this.hovering.startingRow < computedRow) {
          console.log("highlight forwards");
        }
        this.highlightedRegion = {
          ...this.hovering,
          endingLine: lineHovering,
          endingCol: computerCol,
        };
      }
    });

    window.addEventListener("mouseup", (e: MouseEvent) => {
      this.hovering = null;
    });

    document.addEventListener("keydown", this.keydownEventListener);
  }

  // cursor is "backgrounded" by default
  background() {
    this.editorEl.remove();
    document.removeEventListener("keydown", this.keydownEventListener);
  }
}
