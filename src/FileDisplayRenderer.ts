import { FileMutationHandler } from "./FileMutationHandler";

const LINE_HEIGHT = 16;

interface Line {
  prev: Line | null;
  next: Line | null;
  value: string;
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
    lineEl: HTMLElement;
    cursorEl: HTMLElement;
    visibleOnDOM: boolean;
    line: Line;
  };

  // TODO: Replace lineRenderingQueue with circular buffer instead to reduce GC pressure
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

  constructor(row: number, col: number, fileText: string) {
    this.viewportHeight = window.innerHeight;
    this.scrollOffsetFromTop = 0;
    this.row = row;
    this.col = col;
    this.colAnchor = this.col;

    this.lineRenderingQueue = [];
    this.lineCache = new Map();

    this.file = new FileMutationHandler(fileText);

    const editorTemplate = document.getElementById("editor") as HTMLTemplateElement;
    this.editorEl = editorTemplate.content.firstElementChild.cloneNode(true) as HTMLElement;

    const cursor = document.createElement("div");
    cursor.className = "cursor";

    this.cursor = {
      lineEl: null,
      cursorEl: cursor,
      visibleOnDOM: false,
      line: this.file.head,
    };
  }

  private updateColWithAnchor(col: number) {
    this.col = col;
    this.colAnchor = this.col;
  }

  private navigateLeft() {
    const newCol = this.col - 1;
    if (newCol >= 0) {
      this.updateColWithAnchor(newCol);
    } else {
      this.updateColWithAnchor(this.cursor.line.prev.value.length);
      this.navigateUp();
    }

    const updatedCursor = this.cursor.cursorEl.cloneNode(true) as HTMLDivElement;
    updatedCursor.style.left = `${this.col * 7.8}px`;
    this.cursor.cursorEl.replaceWith(updatedCursor);
    this.cursor.cursorEl = updatedCursor;
  }

  private navigateRight() {
    const newCol = this.col + 1;
    if (newCol <= this.cursor.line.value.length) {
      this.updateColWithAnchor(newCol);
    } else {
      this.updateColWithAnchor(0);
      this.navigateDown();
    }

    const updatedCursor = this.cursor.cursorEl.cloneNode(true) as HTMLDivElement;
    updatedCursor.style.left = `${this.col * 7.8}px`;
    this.cursor.cursorEl.replaceWith(updatedCursor);
    this.cursor.cursorEl = updatedCursor;
  }

  private navigateUp() {
    if (this.cursor.line.prev) {
      this.row--;

      this.cursor.line = this.cursor.line.prev;

      let prevLineEl;
      for (let i = 0; i < this.lineRenderingQueue.length; i++) {
        if (this.lineRenderingQueue[i].isSameNode(this.cursor.lineEl)) {
          prevLineEl = this.lineRenderingQueue[i - 1];
          break;
        }
      }

      let computedCol = this.colAnchor;
      if (this.colAnchor > this.cursor.line.value.length)
        computedCol = this.cursor.line.value.length;

      this.col = computedCol;

      const updatedCursor = this.cursor.cursorEl.cloneNode(true) as HTMLDivElement;
      updatedCursor.style.left = `${this.col * 7.8}px`;
      this.cursor.cursorEl.remove();

      prevLineEl.appendChild(updatedCursor);
      this.cursor.cursorEl = updatedCursor;
      this.cursor.lineEl = prevLineEl;
    }
  }

  private navigateDown() {
    if (this.cursor.line.next) {
      this.row++;

      this.cursor.line = this.cursor.line.next;

      let nextLineEl;
      for (let i = 0; i < this.lineRenderingQueue.length; i++) {
        if (this.lineRenderingQueue[i].isSameNode(this.cursor.lineEl)) {
          nextLineEl = this.lineRenderingQueue[i + 1];
          break;
        }
      }

      let computedCol = this.colAnchor;
      if (this.colAnchor > this.cursor.line.value.length)
        computedCol = this.cursor.line.value.length;

      this.col = computedCol;

      const updatedCursor = this.cursor.cursorEl.cloneNode(true) as HTMLDivElement;
      updatedCursor.style.left = `${this.col * 7.8}px`;
      this.cursor.cursorEl.remove();

      nextLineEl.appendChild(updatedCursor);
      this.cursor.cursorEl = updatedCursor;
      this.cursor.lineEl = nextLineEl;

      const cursorDistanceFromTop = this.cursor.cursorEl.getBoundingClientRect().top;
      if (this.viewportHeight - LINE_HEIGHT * 2 < cursorDistanceFromTop) {
        this.editorEl.scrollTo({
          top:
            this.scrollOffsetFromTop +
            (cursorDistanceFromTop - (this.viewportHeight - LINE_HEIGHT * 2)),
          behavior: "instant",
        });
      }
    }
  }

  // For any drastic changes that needs a total repaint for the scoped region
  private flushRenderingQueueAndRemount() {
    this.lineCache = new Map();

    const startingRow = Math.floor(this.scrollOffsetFromTop / 16);
    let currLine = this.file.getLineFromRow(startingRow);

    for (let i = 0; i < this.lineRenderingQueue.length; i++) {
      this.lineCache.set(this.lineRenderingQueue[i], [startingRow + i, currLine]);
      this.lineRenderingQueue[i].style.top = `${startingRow + i}em`;
      this.lineRenderingQueue[i].firstElementChild.textContent = currLine.value;

      if (this.row === startingRow + i) {
        this.cursor.cursorEl.remove();
        this.lineRenderingQueue[i].appendChild(this.cursor.cursorEl);
        this.cursor.lineEl = this.lineRenderingQueue[i];
      }

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

      lineContainer.addEventListener("mousedown", (e) => {
        const [row, line] = this.lineCache.get(lineContainer);

        const distanceFromLeft =
          e.clientX - lineContainer.parentElement.getBoundingClientRect().left;

        let col = Math.round(distanceFromLeft / 7.8);
        if (col > lineContainer.firstElementChild.textContent.length) {
          col = lineContainer.firstElementChild.textContent.length;
        }

        this.row = row;
        this.updateColWithAnchor(col);

        const updatedCursor = this.cursor.cursorEl.cloneNode(true) as HTMLDivElement;
        updatedCursor.style.left = `${this.col * 7.8}px`;
        this.cursor.cursorEl.remove();

        this.cursor = {
          cursorEl: updatedCursor,
          line,
          visibleOnDOM: true,
          lineEl: lineContainer,
        };
        lineContainer.appendChild(updatedCursor);
      });

      lineContainer.appendChild(textEl);

      this.lineRenderingQueue.push(lineContainer);
      lineGroup.appendChild(lineContainer);

      this.lineCache.set(lineContainer, [i, curr]);
      curr = curr.next;
    }

    lineGroup.firstElementChild.appendChild(this.cursor.cursorEl);
    this.cursor.visibleOnDOM = true;
    this.cursor.lineEl = lineGroup.firstElementChild as HTMLElement;

    this.editorEl.addEventListener("scroll", () => {
      const newScrollOffset = this.editorEl.scrollTop;

      const isScrollingDown = newScrollOffset > this.scrollOffsetFromTop;
      this.scrollOffsetFromTop = newScrollOffset;

      const firstVisibleLineOffset =
        this.lineRenderingQueue[0].offsetTop - this.scrollOffsetFromTop + 16;

      const lastVisibleLineOffset =
        this.lineRenderingQueue[this.lineRenderingQueue.length - 1].offsetTop -
        this.scrollOffsetFromTop -
        this.viewportHeight +
        16;

      if (isScrollingDown && firstVisibleLineOffset < 0) {
        const numLinesToRecompute = Math.ceil((0 - firstVisibleLineOffset) / LINE_HEIGHT);

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
      } else if (!isScrollingDown && lastVisibleLineOffset > 0) {
        const numLinesToRecompute = Math.ceil(lastVisibleLineOffset / LINE_HEIGHT);

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

      const firstVisibleRow = Math.floor(this.scrollOffsetFromTop / 16);

      if (this.row >= firstVisibleRow && this.row <= firstVisibleRow + visibleLines) {
        if (!this.cursor.visibleOnDOM) {
          this.cursor.cursorEl.style.left = `${7.8 * this.col}px`;
          this.cursor.lineEl.append(this.cursor.cursorEl);
          this.cursor.visibleOnDOM = true;
        }
      } else if (this.cursor.visibleOnDOM) {
        this.cursor.cursorEl.remove();
        this.cursor.visibleOnDOM = false;
      }
    });

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
            if (this.col > 0) {
              this.file.deleteCharacter(this.cursor.line, this.col);
              this.cursor.cursorEl.previousElementSibling.textContent = this.cursor.line.value;
              this.navigateLeft();
            } else {
              const snapTo = this.file.removeCurrentLine(this.cursor.line);
              this.flushRenderingQueueAndRemount();
              this.updateColWithAnchor(snapTo);
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
          this.flushRenderingQueueAndRemount();
          this.updateColWithAnchor(0);
          this.navigateDown();
          break;

        default:
          this.file.insertCharacter(this.cursor.line, this.col, e.key);
          this.cursor.cursorEl.previousElementSibling.textContent = this.cursor.line.value;
          this.navigateRight();
      }
    };

    document.addEventListener("keydown", this.keydownEventListener);
  }

  background() {
    this.editorEl.remove();
    document.removeEventListener("keydown", this.keydownEventListener);
    this.throttledScrollEventListenerCleanup();
  }
}
