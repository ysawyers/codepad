import { FileMutationHandler } from "./FileMutationHandler";
import { throttledEventListener } from "./utils";

const LINE_HEIGHT = 16;

interface Line {
  prev: Line | null;
  next: Line | null;
  value: string;
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
  isBackwards: boolean;
}

export class FileDisplayRenderer {
  private editorEl: HTMLElement;
  private cursorEl: HTMLElement;

  private lineRenderingQueue: HTMLElement[];
  private lineCache: Map<HTMLElement, [number, Line]>;

  private viewportHeight: number;
  private scrollOffsetFromTop: number;

  private row: number;
  private col: number;
  private colAnchor: number | null;

  private file: FileMutationHandler;
  private keydownEventListener: (e: KeyboardEvent) => void;

  private hovering: Hover | null;
  private highlightedRegion: Highlight | null;

  constructor(row: number, col: number, fileText: string) {
    this.viewportHeight = window.innerHeight;
    this.scrollOffsetFromTop = 0;
    this.row = row;
    this.col = col;

    this.lineRenderingQueue = [];
    this.lineCache = new Map();

    this.hovering = null;
    this.highlightedRegion = null;
    this.colAnchor = null;

    this.file = new FileMutationHandler(fileText);

    const editorTemplate = document.getElementById("editor") as HTMLTemplateElement;
    this.editorEl = editorTemplate.content.firstElementChild.cloneNode(true) as HTMLElement;
  }

  private navigateLeft() {
    this.highlightedRegion = null;
    this.colAnchor = null;
    this.col--;
    // this.updateCurrentLine(this.currentLine);
    // this.forceScrollToViewCursor();
  }

  private navigateRight() {
    this.highlightedRegion = null;
    this.colAnchor = null;
    this.col++;
    // this.updateCurrentLine(this.currentLine);
    // this.forceScrollToViewCursor();
  }

  private navigateUp() {
    // this.highlightedRegion = null;
    // this.row--;
    // if (!this.colAnchor) this.colAnchor = this.col;
    // if (this.currentLine.prev) {
    //   const textLength = this.currentLine.prev.el.firstElementChild.textContent.length;
    //   if (this.colAnchor > textLength) {
    //     this.col = textLength;
    //   } else {
    //     this.col = this.colAnchor;
    //   }
    //   this.updateCurrentLine(this.currentLine.prev);
    // }
    // this.forceScrollToViewCursor();
  }

  private navigateDown() {
    // this.highlightedRegion = null;
    // this.row++;
    // if (!this.colAnchor) this.colAnchor = this.col;
    // if (this.currentLine.next) {
    //   const textLength = this.currentLine.next.el.firstElementChild.textContent.length;
    //   if (this.colAnchor > textLength) {
    //     this.col = textLength;
    //   } else {
    //     this.col = this.colAnchor;
    //   }
    //   this.updateCurrentLine(this.currentLine.next);
    // }
    // this.forceScrollToViewCursor();
  }

  private forceScrollToViewCursor() {
    // if (!this.currentLine.el.isConnected) {
    //   let offsetFromTop = 0;
    //   let curr = this.currentLine;
    //   while (curr) {
    //     offsetFromTop++;
    //     curr = curr.prev;
    //   }
    //   this.editorEl.scrollTo({
    //     top: offsetFromTop * 16 - 16,
    //     behavior: "instant",
    //   });
    // }
  }

  // returns true if deletion was successful
  private deleteHighlightedRegion() {
    // if (this.highlightedRegion) {
    //   this.lineCache = new Map();
    //   this.file.batchRemove(this.highlightedRegion);
    //   if (this.highlightedRegion.isBackwards) {
    //     this.col = this.highlightedRegion.endingCol;
    //     this.updateCurrentLine(this.highlightedRegion.endingLine);
    //   } else {
    //     this.col = this.highlightedRegion.startingCol;
    //     this.updateCurrentLine(this.highlightedRegion.startingLine);
    //   }
    //   this.highlightedRegion = null;
    //   return true;
    // }
    // return false;
  }

  private updateHighlightedRegion() {
    // TODO
  }

  private remapRenderingQueue() {
    this.lineCache = new Map();

    const startingRow = Math.floor(this.scrollOffsetFromTop / 16);
    let currLine = this.file.getLineFromRow(startingRow);

    for (let i = 0; i < this.lineRenderingQueue.length; i++) {
      this.lineCache.set(this.lineRenderingQueue[i], [startingRow + i, currLine]);
      this.lineRenderingQueue[i].style.top = `${startingRow + i}em`;
      this.lineRenderingQueue[i].firstElementChild.textContent = currLine.value;
      currLine = currLine.next;
    }
  }

  foreground() {
    document.getElementById("workspace-group").appendChild(this.editorEl);

    const cursor = document.createElement("div");
    cursor.className = "cursor";
    this.cursorEl = cursor;

    const lineGroup = document.getElementById("line-group");

    lineGroup.style.height = `${this.file.size}em`;

    const initialQueueSize =
      (Math.ceil(this.viewportHeight / LINE_HEIGHT) * LINE_HEIGHT) / LINE_HEIGHT;

    let curr = this.file.head;

    for (let i = 0; i < initialQueueSize; i++) {
      const lineContainer = document.createElement("div");
      lineContainer.className = "line";
      lineContainer.style.top = `${i}em`;

      const textEl = document.createElement("span");
      textEl.className = "default-line-text";
      textEl.textContent = curr.value;

      lineContainer.appendChild(textEl);

      this.lineRenderingQueue.push(lineContainer);
      lineGroup.appendChild(lineContainer);

      this.lineCache.set(lineContainer, [i, curr]);
      curr = curr.next;
    }

    throttledEventListener(this.editorEl, "scroll", () => {
      const isScrollingDown = this.editorEl.scrollTop > this.scrollOffsetFromTop;
      this.scrollOffsetFromTop = this.editorEl.scrollTop;

      const lastVisibleLinePos =
        this.lineRenderingQueue[this.lineRenderingQueue.length - 1].getBoundingClientRect().top;
      const firstVisibleLinePos = this.lineRenderingQueue[0].getBoundingClientRect().top;

      const shouldRemapQueue = lastVisibleLinePos < 0 || firstVisibleLinePos > this.viewportHeight;

      if (shouldRemapQueue) {
        this.remapRenderingQueue();
      } else if (isScrollingDown) {
        const distanceAwayFromViewport = 0 - firstVisibleLinePos;

        if (distanceAwayFromViewport > 0) {
          const numLinesToRecompute = Math.ceil(distanceAwayFromViewport / LINE_HEIGHT);

          for (let i = 0; i < numLinesToRecompute; i++) {
            const lastLineRendered = this.lineRenderingQueue[this.lineRenderingQueue.length - 1];
            const [row, line] = this.lineCache.get(lastLineRendered);

            // no more lines to render at the bottom
            if (!line.next) break;

            const lineEl = this.lineRenderingQueue.shift();

            lineEl.style.top = `${row + 1}em`;
            lineEl.firstElementChild.textContent = line.next.value;

            this.lineCache.set(lineEl, [row + 1, line.next]);

            this.lineRenderingQueue.push(lineEl);
          }
        }
      } else {
        const distanceAwayFromViewport = lastVisibleLinePos - this.viewportHeight;

        if (distanceAwayFromViewport > 0) {
          const numLinesToRecompute = Math.ceil(distanceAwayFromViewport / LINE_HEIGHT);

          for (let i = 0; i < numLinesToRecompute; i++) {
            const firstLineRendered = this.lineRenderingQueue[0];
            const [row, line] = this.lineCache.get(firstLineRendered);

            // no more lines to render at the top
            if (!line.prev) break;

            const lineEl = this.lineRenderingQueue.pop();

            lineEl.style.top = `${row - 1}em`;
            lineEl.firstElementChild.textContent = line.prev.value;

            this.lineCache.set(lineEl, [row - 1, line.prev]);

            this.lineRenderingQueue.unshift(lineEl);
          }
        }
      }

      // const lineElWithFocus = this.lineRenderingQueue[this.row % this.lineRenderingQueue.length];
      // const [row, _] = this.lineCache.get(lineElWithFocus);

      // if (this.cursorEl.isConnected) this.cursorEl.remove();

      // // checks if cursor is within the current region scoped and if so it should be rendered
      // if (row === this.row) {
      //   this.cursorEl.style.left = `${7.8 * this.col}px`;
      //   lineElWithFocus.appendChild(this.cursorEl);
      // }
    });

    this.keydownEventListener = (e: KeyboardEvent) => {
      // switch (e.key) {
      //   case "ArrowUp":
      //     if (this.row > 0) this.navigateUp();
      //     break;
      //   case "ArrowDown":
      //     const linesGroupEl = document.getElementById("line-group");
      //     if (!this.currentLine.el.isSameNode(linesGroupEl.lastElementChild)) this.navigateDown();
      //     break;
      //   case "ArrowLeft":
      //     if (this.col > 0) {
      //       this.navigateLeft();
      //     } else if (this.row > 0) {
      //       this.col = this.currentLine.prev.el.textContent.length;
      //       this.navigateUp();
      //     }
      //     break;
      //   case "ArrowRight":
      //     {
      //       const linesGroupEl = document.getElementById("line-group");
      //       const text = this.currentLine.el.firstElementChild.textContent;
      //       if (this.col < text.length) {
      //         this.navigateRight();
      //       } else if (!this.currentLine.el.isSameNode(linesGroupEl.lastElementChild)) {
      //         this.col = 0;
      //         this.navigateDown();
      //       }
      //     }
      //     break;
      //   case "Tab":
      //     {
      //       if (this.highlightedRegion) {
      //         // TODO: apply tab to all highlighted rows
      //       }
      //       for (let i = 0; i < 4; i++) {
      //         this.file.insertCharacter(this.currentLine, this.col, "\xa0");
      //         this.navigateRight();
      //       }
      //     }
      //     break;
      //   case "Backspace":
      //     {
      //       if (this.deleteHighlightedRegion()) break;
      //       if (this.col != 0) {
      //         const text = this.currentLine.el.firstElementChild.textContent;
      //         const tab = "\xa0\xa0\xa0\xa0";
      //         if (this.col > 3 && text.slice(this.col - 4, this.col) === tab) {
      //           for (let i = 0; i < 4; i++) {
      //             this.file.deleteCharacter(this.currentLine, this.col);
      //             this.navigateLeft();
      //           }
      //         } else {
      //           this.file.deleteCharacter(this.currentLine, this.col);
      //           this.navigateLeft();
      //         }
      //       } else if (this.row > 0) {
      //         const textOverflow = this.currentLine.el.firstElementChild.textContent.slice(
      //           this.col
      //         );
      //         this.lineCache = new Map();
      //         this.col = this.file.removeCurrentLine(this.currentLine, textOverflow);
      //         this.colAnchor = null;
      //         this.navigateUp();
      //       }
      //     }
      //     break;
      //   case "Shift":
      //     break;
      //   case "Meta":
      //     break;
      //   case "Enter":
      //     {
      //       this.deleteHighlightedRegion();
      //       const textContent = this.currentLine.el.firstElementChild.textContent;
      //       this.currentLine.el.firstElementChild.textContent = textContent.slice(0, this.col);
      //       this.file.createNewLine(this.currentLine, textContent.slice(this.col));
      //       this.col = 0;
      //       // clear cache before rerendering lines since lines are now reordered
      //       this.lineCache = new Map();
      //       this.colAnchor = null;
      //       this.navigateDown();
      //     }
      //     break;
      //   default: {
      //     this.deleteHighlightedRegion();
      //     const ch = e.key === " " ? "\xa0" : e.key;
      //     this.file.insertCharacter(this.currentLine, this.col, ch);
      //     this.navigateRight();
      //   }
      // }
    };

    // contained to line-group specifically, hovering will not be active anywhere else
    this.editorEl.lastElementChild.addEventListener("mousemove", (e: MouseEvent) => {
      // if (this.hovering) {
      //   // if not scrolled perfectly aligned on a new line add the additional offset to get to the correct row
      //   const offset = this.editorEl.scrollTop % 16;
      //   const computedRow = Math.floor(this.offsetFromTop) + (Math.floor((e.y + offset) / 16) - 2); // - 2 just cause thats what works ?
      //   const computedCol = Math.round(e.offsetX / 7.8);
      //   const lineHovering = this.lineCache.get(computedRow);
      //   if (computedCol > lineHovering.el.firstElementChild.textContent.length) {
      //     this.col = lineHovering.el.firstElementChild.textContent.length;
      //   } else if (computedCol > 0) {
      //     this.col = computedCol;
      //   }
      //   this.highlightedRegion = {
      //     ...this.hovering,
      //     endingLine: lineHovering,
      //     endingCol: this.col,
      //     isBackwards:
      //       this.hovering.startingRow === computedRow
      //         ? this.hovering.startingCol > this.col
      //         : this.hovering.startingRow > computedRow,
      //   };
      //   this.updateCurrentLine(lineHovering, false);
      // }
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

// this.editorEl.scrollTo({
//   top: this.offsetFromTop * 16,
//   behavior: "instant",
// });
