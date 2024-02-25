import { CoreFileHandler } from "./CoreFileHandler";

// NOTE: Performance starts to break down (as well as display?) with very large files (only tested on file with ~1m lines).
// TODO: Start implementing syntax highlighting.

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

export class CoreRenderingEngine {
  private editorEl: HTMLElement;

  private cursor: {
    lineEl: HTMLElement;
    cursorEl: HTMLElement;
    visibleOnDOM: boolean;
    line: Line;
  };

  private visibleLines: RingBuffer<HTMLElement>;
  private visibleLineNumbers: RingBuffer<HTMLElement>;
  private scopedRegion: Map<HTMLElement, [number, Line]>;

  private viewportHeight: number;
  private scrollOffsetFromTop: number;

  private row: number;
  private col: number;
  private colAnchor: number;

  private file: CoreFileHandler;

  private keydownEventListener: (e: KeyboardEvent) => void;
  private throttledScrollEventListenerCleanup: () => void;

  constructor(row: number, col: number, fileText: string) {
    this.viewportHeight = window.innerHeight;
    this.scrollOffsetFromTop = 0;
    this.row = row;
    this.col = col;
    this.colAnchor = this.col;

    this.file = new CoreFileHandler(fileText);
    this.scopedRegion = new Map();

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
      for (let i = 0; i < this.visibleLines.size(); i++) {
        if (this.visibleLines.get(i).isSameNode(this.cursor.lineEl)) {
          prevLineEl = this.visibleLines.get(i - 1);
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
      for (let i = 0; i < this.visibleLines.size(); i++) {
        if (this.visibleLines.get(i).isSameNode(this.cursor.lineEl)) {
          nextLineEl = this.visibleLines.get(i + 1);
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

  private flushRenderingQueueAndRemount() {
    const startingRow = Math.floor(this.scrollOffsetFromTop / 16);
    let currLine = this.file.getLineFromRow(startingRow);

    for (let i = 0; i < this.visibleLines.size(); i++) {
      const lineEl = this.visibleLines.get(i);

      this.scopedRegion.set(lineEl, [startingRow + i, currLine]);

      lineEl.style.top = `${startingRow + i}em`;
      lineEl.firstElementChild.textContent = currLine.value;

      if (this.row === startingRow + i) {
        this.cursor.cursorEl.remove();
        lineEl.appendChild(this.cursor.cursorEl);
        this.cursor.lineEl = lineEl;
      }
      currLine = currLine.next;
    }

    const visibleLines = (Math.ceil(this.viewportHeight / LINE_HEIGHT) * LINE_HEIGHT) / LINE_HEIGHT;

    if (currLine && this.visibleLines.size() < visibleLines) {
      const lineGroup = document.getElementById("line-group");
      const lineNumberGroup = document.getElementById("line-number-group");

      const row = startingRow + this.visibleLines.size();

      const [lineNumberContainer, lineContainer] = this.renderNewLine(row);

      const textEl = document.createElement("span");
      textEl.className = "default-line-text";
      textEl.textContent = currLine.value;

      lineContainer.appendChild(textEl);
      lineGroup.appendChild(lineContainer);

      lineNumberGroup.appendChild(lineNumberContainer);

      this.scopedRegion.set(lineContainer, [row, currLine]);
      this.visibleLines.append(lineContainer);

      lineGroup.style.height = `${this.file.size}em`;
      lineNumberGroup.style.height = `${this.file.size}em`;
    }
  }

  renderNewLine(row: number): [HTMLElement, HTMLElement] {
    const lineContainer = document.createElement("div");
    lineContainer.className = "line";
    lineContainer.style.top = `${row}em`;

    const lineNumberContainer = document.createElement("div");
    lineNumberContainer.className = "line-number";
    lineNumberContainer.style.top = `${row}em`;

    const lineNumberValue = document.createElement("div");
    lineNumberValue.className = "line-number-value";
    lineNumberValue.textContent = `${row + 1}`;

    lineNumberContainer.appendChild(lineNumberValue);

    lineContainer.addEventListener("mousedown", (e) => {
      const [row, line] = this.scopedRegion.get(lineContainer);

      const distanceFromLeft = e.clientX - lineContainer.parentElement.getBoundingClientRect().left;

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

    return [lineNumberContainer, lineContainer];
  }

  foreground() {
    document.getElementById("workspace-group").appendChild(this.editorEl);

    const lineGroup = document.getElementById("line-group");
    lineGroup.style.height = `${this.file.size}em`;

    const lineNumberGroup = document.getElementById("line-number-group");
    lineNumberGroup.style.height = `${this.file.size}em`;

    const visibleLines = (Math.ceil(this.viewportHeight / LINE_HEIGHT) * LINE_HEIGHT) / LINE_HEIGHT;

    if (!this.visibleLines) {
      let visibleLinesData = [];
      let visibleLineNumbersData = [];
      let curr = this.file.head;

      for (let i = 0; i < visibleLines; i++) {
        if (!curr) break;

        const textEl = document.createElement("span");
        textEl.className = "default-line-text";
        textEl.textContent = curr.value;

        const [lineNumberContainer, lineContainer] = this.renderNewLine(i);

        lineContainer.appendChild(textEl);
        lineGroup.appendChild(lineContainer);
        lineNumberGroup.appendChild(lineNumberContainer);

        visibleLinesData.push(lineContainer);
        visibleLineNumbersData.push(lineNumberContainer);
        this.scopedRegion.set(lineContainer, [i, curr]);

        curr = curr.next;
      }

      this.visibleLines = new RingBuffer<HTMLElement>(visibleLinesData);
      this.visibleLineNumbers = new RingBuffer<HTMLElement>(visibleLineNumbersData);

      lineGroup.firstElementChild.appendChild(this.cursor.cursorEl);
      this.cursor.visibleOnDOM = true;
      this.cursor.lineEl = lineGroup.firstElementChild as HTMLElement;
    } else {
      this.editorEl.scrollTo({
        top: this.scrollOffsetFromTop,
        behavior: "instant",
      });
    }

    const cleanup = throttledEventListener(this.editorEl, "scroll", () => {
      const newScrollOffset = this.editorEl.scrollTop;
      const isScrollingDown = newScrollOffset > this.scrollOffsetFromTop;
      this.scrollOffsetFromTop = newScrollOffset;

      const firstLineEl = this.visibleLines.getHeadRef();
      const lastLineEl = this.visibleLines.getTailRef();

      const firstVisibleLineOffset = firstLineEl.offsetTop - this.scrollOffsetFromTop + 16;

      const lastVisibleLineOffset =
        lastLineEl.offsetTop - this.scrollOffsetFromTop - this.viewportHeight + 16;

      if (isScrollingDown && firstVisibleLineOffset < 0) {
        const numLinesToRecompute = Math.ceil((0 - firstVisibleLineOffset) / LINE_HEIGHT);

        for (let i = 0; i < numLinesToRecompute; i++) {
          const [row, line] = this.scopedRegion.get(this.visibleLines.getTailRef());

          // no more lines to render at the bottom
          if (!line.next) break;

          // elements (lines) at the top that have been scrolled off-screen getting adjusted
          const oldLineEl = this.visibleLines.getHeadRef();
          const oldLineNumberEl = this.visibleLineNumbers.getHeadRef();

          oldLineEl.style.top = `${row + 1}em`;
          oldLineEl.firstElementChild.textContent = line.next.value;
          this.scopedRegion.set(oldLineEl, [row + 1, line.next]);

          oldLineNumberEl.style.top = `${row + 1}em`;
          oldLineNumberEl.firstElementChild.textContent = `${row + 1}`;

          this.visibleLines.moveForward();
          this.visibleLineNumbers.moveForward();
        }
      } else if (!isScrollingDown && lastVisibleLineOffset > 0) {
        const numLinesToRecompute = Math.ceil(lastVisibleLineOffset / LINE_HEIGHT);

        for (let i = 0; i < numLinesToRecompute; i++) {
          const [row, line] = this.scopedRegion.get(this.visibleLines.getHeadRef());

          // no more lines to render at the top
          if (!line.prev) break;

          // elements (lines) at the bottom that have been scrolled off-screen getting adjusted
          const oldLineEl = this.visibleLines.getTailRef();
          const oldLineNumberEl = this.visibleLineNumbers.getTailRef();

          oldLineEl.style.top = `${row - 1}em`;
          oldLineEl.firstElementChild.textContent = line.prev.value;
          this.scopedRegion.set(oldLineEl, [row - 1, line.prev]);

          oldLineNumberEl.style.top = `${row - 1}em`;
          oldLineNumberEl.firstElementChild.textContent = `${row}`;

          this.visibleLines.moveBackward();
          this.visibleLineNumbers.moveBackward();
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
          if (this.col > 0) {
            this.file.deleteCharacter(this.cursor.line, this.col);
            this.cursor.cursorEl.previousElementSibling.textContent = this.cursor.line.value;
            this.navigateLeft();
          } else {
            const snapTo = this.file.removeCurrentLine(this.cursor.line);
            lineGroup.style.height = `${this.file.size}em`;
            lineNumberGroup.style.height = `${this.file.size}em`;
            this.updateColWithAnchor(snapTo);
            this.navigateUp();
            this.flushRenderingQueueAndRemount();
          }
          break;

        case "Shift":
          break;

        case "Meta":
          break;

        case "Enter":
          this.file.createNewLine(this.cursor.line, this.col);
          lineGroup.style.height = `${this.file.size + 1}em`;
          lineNumberGroup.style.height = `${this.file.size + 1}em`;
          this.updateColWithAnchor(0);
          this.navigateDown();
          this.flushRenderingQueueAndRemount();
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

// manages true ordering of lines outside of the DOM (all lines physically on the DOM are just absolutely positioned arbitrarily)
class RingBuffer<T> {
  private data: T[];
  private headP: number;
  private tailP: number;

  constructor(data: T[]) {
    this.data = data;
    this.headP = 0;
    this.tailP = this.data.length - 1;
  }

  getHeadRef() {
    return this.data[this.headP % this.data.length];
  }

  getTailRef() {
    return this.data[this.tailP % this.data.length];
  }

  moveForward() {
    this.headP++;
    this.tailP++;
  }

  moveBackward() {
    this.headP = this.tailP;
    this.tailP = this.headP - 1;
  }

  get(idx: number) {
    return this.data[(this.headP + idx) % this.data.length];
  }

  append(el: T) {
    this.data.splice(this.tailP + 1, 0, el);
    this.tailP++;
  }

  size() {
    return this.data.length;
  }
}
