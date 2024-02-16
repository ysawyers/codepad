import { FileMutationHandler } from "./FileMutationHandler";

// REFACTOR IDEA: Everytime this.col is updated, this.colAnchor has to be set accoringly. Make update function instead?

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

function throttledEventListener(
  el: HTMLElement,
  ev: keyof DocumentEventMap,
  cb: (e: Event) => void
) {
  let waiting = false;

  const f = (e: Event) => {
    if (waiting) return;
    waiting = true;

    requestAnimationFrame(() => {
      cb(e);
      waiting = false;
    });
  };

  el.addEventListener(ev, f);

  return () => el.removeEventListener(ev, f);
}

export class FileDisplayRenderer {
  private editorEl: HTMLElement;

  private cursor: {
    el: HTMLElement;
    visibleOnDOM: boolean;
    line: Line;
  };

  private lineRenderingQueue: HTMLElement[];
  private lineCache: Map<HTMLElement, [number, Line]>;

  private viewportHeight: number;
  private scrollOffsetFromTop: number;

  private row: number;
  private col: number;
  private colAnchor: number;

  private file: FileMutationHandler;

  private keydownEventListener: (e: KeyboardEvent) => void;
  private throttledScrollEventListenerCleanup: () => void;

  private hovering: Hover | null;
  private highlightedRegion: Highlight | null;

  constructor(row: number, col: number, fileText: string) {
    this.viewportHeight = window.innerHeight;
    this.scrollOffsetFromTop = 0;
    this.row = row;
    this.col = col;
    this.colAnchor = this.col;

    this.lineRenderingQueue = [];
    this.lineCache = new Map();

    this.hovering = null;
    this.highlightedRegion = null;

    this.file = new FileMutationHandler(fileText);

    const editorTemplate = document.getElementById("editor") as HTMLTemplateElement;
    this.editorEl = editorTemplate.content.firstElementChild.cloneNode(true) as HTMLElement;

    const cursor = document.createElement("div");
    cursor.className = "cursor";

    this.cursor = {
      el: cursor,
      visibleOnDOM: false,
      line: this.file.head,
    };
  }

  private navigateLeft() {
    const newCol = this.col - 1;
    if (newCol >= 0) {
      this.highlightedRegion = null;
      this.col = newCol;
    } else {
      this.col = this.cursor.line.prev.value.length;
      this.navigateUp();
    }
    this.colAnchor = this.col;

    const updatedCursor = this.cursor.el.cloneNode(true) as HTMLDivElement;
    updatedCursor.style.left = `${this.col * 7.8}px`;
    this.cursor.el.replaceWith(updatedCursor);
    this.cursor.el = updatedCursor;
  }

  private navigateRight() {
    const newCol = this.col + 1;
    if (newCol <= this.cursor.line.value.length) {
      this.highlightedRegion = null;
      this.col = newCol;
    } else {
      this.col = 0;
      this.navigateDown();
    }
    this.colAnchor = this.col;

    const updatedCursor = this.cursor.el.cloneNode(true) as HTMLDivElement;
    updatedCursor.style.left = `${this.col * 7.8}px`;
    this.cursor.el.replaceWith(updatedCursor);
    this.cursor.el = updatedCursor;
  }

  private navigateUp() {
    if (this.cursor.line.prev) {
      this.highlightedRegion = null;
      this.row--;

      this.cursor.line = this.cursor.line.prev;

      const prevLineEl = this.cursor.el.parentElement.previousElementSibling;

      let computedCol = this.colAnchor;
      if (this.colAnchor > this.cursor.line.value.length)
        computedCol = this.cursor.line.value.length;

      const updatedCursor = this.cursor.el.cloneNode(true) as HTMLDivElement;
      updatedCursor.style.left = `${computedCol * 7.8}px`;
      this.cursor.el.remove();

      prevLineEl.appendChild(updatedCursor);
      this.cursor.el = updatedCursor;
    }
  }

  private navigateDown() {
    if (this.cursor.line.next) {
      this.highlightedRegion = null;
      this.row++;

      this.cursor.line = this.cursor.line.next;

      const nextLineEl = this.cursor.el.parentElement.nextElementSibling;

      let computedCol = this.colAnchor;
      if (this.colAnchor > this.cursor.line.value.length)
        computedCol = this.cursor.line.value.length;

      const updatedCursor = this.cursor.el.cloneNode(true) as HTMLDivElement;
      updatedCursor.style.left = `${computedCol * 7.8}px`;
      this.cursor.el.remove();

      nextLineEl.appendChild(updatedCursor);
      this.cursor.el = updatedCursor;
    }
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

    const lineGroup = document.getElementById("line-group");
    lineGroup.style.height = `${this.file.size}em`;

    const visibleLines = (Math.ceil(this.viewportHeight / LINE_HEIGHT) * LINE_HEIGHT) / LINE_HEIGHT;

    let curr = this.file.head;

    for (let i = 0; i < visibleLines; i++) {
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

    const cleanup = throttledEventListener(this.editorEl, "scroll", () => {
      const newScrollOffset = this.editorEl.scrollTop;

      const isScrollingDown = newScrollOffset > this.scrollOffsetFromTop;
      this.scrollOffsetFromTop = newScrollOffset;

      const lastVisibleLinePos =
        this.lineRenderingQueue[this.lineRenderingQueue.length - 1].getBoundingClientRect().top;
      const firstVisibleLinePos = this.lineRenderingQueue[0].getBoundingClientRect().top;

      const shouldRemapQueue = lastVisibleLinePos < 0 || firstVisibleLinePos > this.viewportHeight;

      if (shouldRemapQueue) {
        // TODO: Expensive here. Is there a better way of doing this?
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

      const lineEl = this.lineRenderingQueue[this.row % this.lineRenderingQueue.length];
      const [row, _] = this.lineCache.get(lineEl);

      if (row === this.row) {
        if (!this.cursor.visibleOnDOM) {
          this.cursor.el.style.left = `${7.8 * this.col}px`;
          lineEl.appendChild(this.cursor.el);
          this.cursor.visibleOnDOM = true;
        }
      } else {
        this.cursor.el.remove();
        this.cursor.visibleOnDOM = false;
      }
    });
    this.throttledScrollEventListenerCleanup = cleanup;

    this.keydownEventListener = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
          this.navigateUp();
          break;

        case "ArrowDown":
          this.navigateDown();
          break;

        case "ArrowLeft":
          this.navigateLeft();
          break;

        case "ArrowRight":
          this.navigateRight();
          break;

        case "Backspace":
          {
            // if (this.deleteHighlightedRegion()) break;
            // if (this.col != 0) {
            //   const text = this.currentLine.el.firstElementChild.textContent;
            //   const tab = "\xa0\xa0\xa0\xa0";
            //   if (this.col > 3 && text.slice(this.col - 4, this.col) === tab) {
            //     for (let i = 0; i < 4; i++) {
            //       this.file.deleteCharacter(this.currentLine, this.col);
            //       this.navigateLeft();
            //     }
            //   } else {
            //     this.file.deleteCharacter(this.currentLine, this.col);
            //     this.navigateLeft();
            //   }
            // } else if (this.row > 0) {
            //   const textOverflow = this.currentLine.el.firstElementChild.textContent.slice(
            //     this.col
            //   );
            //   this.lineCache = new Map();
            //   this.col = this.file.removeCurrentLine(this.currentLine, textOverflow);
            //   this.navigateUp();
            // }

            if (this.col > 0) {
              this.file.deleteCharacter(this.cursor.line, this.col);
              this.cursor.el.previousElementSibling.textContent = this.cursor.line.value;
              this.navigateLeft();
            } else {
              const snapTo = this.file.removeCurrentLine(this.cursor.line);
              this.remapRenderingQueue();

              this.col = snapTo;
              this.colAnchor = this.col;
              this.navigateUp();
            }
          }
          break;

        case "Shift":
          break;

        case "Meta":
          break;

        case "Enter":
          this.file.createNewLine(this.cursor.line, this.col);
          this.remapRenderingQueue();

          this.col = 0;
          this.colAnchor = this.col;
          this.navigateDown();
          break;

        default: {
          this.file.insertCharacter(this.cursor.line, this.col, e.key);
          this.cursor.el.previousElementSibling.textContent = this.cursor.line.value;
          this.navigateRight();
        }
      }
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
    this.throttledScrollEventListenerCleanup();
  }
}

// this.editorEl.scrollTo({
//   top: this.offsetFromTop * 16,
//   behavior: "instant",
// });
