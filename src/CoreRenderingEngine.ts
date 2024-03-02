import { CoreFileHandler, insertCharacter, deleteCharacter } from "./CoreFileHandler";
import { parseJS } from "./lexer";

// FINDINGS: display: inline-block on tokens are extremely cause crazy rendering issues.

// FINDINGS: absolute with translate() will be much faster since paint is deferred on the GPU layer

const LINE_HEIGHT = 16;

enum TokenType {
  Whitespace = 0,
  Ident,
}

interface Token {
  type: TokenType;
  lexeme: string;
}

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
  private renderedLinesCache: Map<HTMLElement, [number, Line, HTMLElement[]]>;

  private viewportHeight: number;
  private scrollOffsetFromTop: number;

  private row: number;
  private col: number;
  private colAnchor: number;

  private file: CoreFileHandler;

  private scrollingRender: (e: Event) => void;
  private keydownEventListener: (e: KeyboardEvent) => void;
  private throttledScrollEventListenerCleanup: () => void;

  constructor(row: number, col: number, fileText: string) {
    this.viewportHeight = window.innerHeight;
    this.scrollOffsetFromTop = 0;
    this.row = row;
    this.col = col;
    this.colAnchor = this.col;

    this.file = new CoreFileHandler(fileText);
    this.renderedLinesCache = new Map();

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

      const cursorDistanceFromTop =
        this.cursor.lineEl.getBoundingClientRect().top % this.viewportHeight;

      if (cursorDistanceFromTop < LINE_HEIGHT * 6) {
        this.editorEl.scrollTo({
          top:
            Math.floor(
              (this.scrollOffsetFromTop - Math.floor(Math.abs(81 - cursorDistanceFromTop))) / 16
            ) * 16,
          behavior: "instant",
        });
      }
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
    let currLine = this.file.getLine(startingRow);

    for (let i = 0; i < this.visibleLines.size(); i++) {
      const lineEl = this.visibleLines.get(i);

      const oldValues = this.renderedLinesCache.get(lineEl);
      oldValues[0] = startingRow + i;
      oldValues[1] = currLine;

      lineEl.style.top = `${(startingRow + i) * 16}px`;
      lineEl.firstElementChild.textContent = currLine.value;

      if (this.row === startingRow + i) {
        this.cursor.cursorEl.remove();
        lineEl.appendChild(this.cursor.cursorEl);
        this.cursor.lineEl = lineEl;
      }
      currLine = currLine.next;
    }

    // const visibleLines = (Math.ceil(this.viewportHeight / LINE_HEIGHT) * LINE_HEIGHT) / LINE_HEIGHT;

    // creating new lines to fill the buffer with enough elements to fit the visible viewport
    // if (currLine && this.visibleLines.size() < visibleLines) {
    //   const lineGroup = document.getElementById("line-group");
    //   const lineNumberGroup = document.getElementById("line-number-group");

    //   const row = startingRow + this.visibleLines.size();

    //   const [lineNumberContainer, lineContainer] = this.renderNewLine(row);

    //   const textEl = document.createElement("span");
    //   textEl.textContent = currLine.value;

    //   lineContainer.appendChild(textEl);
    //   lineGroup.appendChild(lineContainer);

    //   lineNumberGroup.appendChild(lineNumberContainer);

    //   // TODO
    //   this.renderedLinesCache.set(lineContainer, [row, currLine, []]);

    //   const oldValues = this.renderedLinesCache.get(lineContainer);
    //   oldValues[0] = row;
    //   oldValues[1] = currLine;

    //   this.visibleLines.append(lineContainer);

    //   lineGroup.style.height = `${this.file.size * 16}px`;
    //   lineNumberGroup.style.height = `${this.file.size * 16}px`;
    // }
  }

  renderNewLine(row: number): [HTMLElement, HTMLElement] {
    const lineNumberContainer = document.createElement("div");
    lineNumberContainer.style.transform = `translate3d(0px, ${row * 16}px, 0px)`;

    const lineNumberValue = document.createElement("div");
    lineNumberValue.textContent = `${row + 1}`;

    const lineContainer = document.createElement("div");
    lineContainer.style.transform = `translate3d(0px, ${row * 16}px, 0px)`;

    lineNumberContainer.appendChild(lineNumberValue);

    lineContainer.addEventListener("mousedown", (e) => {
      const [row, line, _] = this.renderedLinesCache.get(lineContainer);

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

  // memory tradeoff for less GC + DOM manip.
  private renderTokens(line: Line, tokenWrapper: HTMLElement) {
    const renderedTokens = this.renderedLinesCache.get(tokenWrapper.parentElement)[2];

    let currTok = 0;
    let pt = 0;
    while (pt < line.value.length) {
      if (currTok >= renderedTokens.length) {
        const tokenEl = document.createElement("span");
        tokenWrapper.appendChild(tokenEl);
        renderedTokens.push(tokenEl);
      }

      pt = parseJS(pt, line.value, renderedTokens[currTok]);
      // console.log(pt, line.value.length, line.value[pt]);
      currTok++;
    }

    for (let i = currTok; i < renderedTokens.length; i++) {
      renderedTokens[i].textContent = "";
    }
  }

  foreground() {
    document.getElementById("workspace-group").appendChild(this.editorEl);

    const lineGroup = document.getElementById("line-group");
    lineGroup.style.height = `${this.file.size * 16}px`;

    const lineNumberGroup = document.getElementById("line-number-group");
    lineNumberGroup.style.height = `${this.file.size * 16}px`;
    lineNumberGroup.style.width = `${this.file.size.toString().length * 7.8 + 30}px`;

    const visibleLines = (Math.ceil(this.viewportHeight / LINE_HEIGHT) * LINE_HEIGHT) / LINE_HEIGHT;

    if (!this.visibleLines) {
      let visibleLinesData = [];
      let visibleLineNumbersData = [];
      let curr = this.file.head;

      for (let i = 0; i < visibleLines; i++) {
        if (!curr) break;

        const [lineNumberContainer, lineContainer] = this.renderNewLine(i);

        const tokenWrapper = document.createElement("span");
        tokenWrapper.style.position = "absolute";
        tokenWrapper.style.height = `${LINE_HEIGHT}px`;

        // @ts-ignore
        this.renderedLinesCache.set(lineContainer, [i, curr, []]);
        lineContainer.appendChild(tokenWrapper);
        this.renderTokens(curr, tokenWrapper);

        lineGroup.appendChild(lineContainer);
        lineNumberGroup.appendChild(lineNumberContainer);

        visibleLinesData.push(lineContainer);
        visibleLineNumbersData.push(lineNumberContainer);

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

    this.scrollingRender = () => {
      const newScrollOffset = this.editorEl.scrollTop;
      const isScrollingDown = newScrollOffset > this.scrollOffsetFromTop;
      this.scrollOffsetFromTop = newScrollOffset;

      const firstLineEl = this.visibleLines.getHeadRef();
      const lastLineEl = this.visibleLines.getTailRef();

      const firstVisibleLineOffset =
        this.scrollOffsetFromTop - (this.renderedLinesCache.get(firstLineEl)[0] * 16 + 16);

      const lastVisibleLineOffset =
        this.renderedLinesCache.get(lastLineEl)[0] * 16 +
        16 -
        (this.scrollOffsetFromTop + this.viewportHeight);

      if (isScrollingDown && firstVisibleLineOffset > 0) {
        const numLinesToRecompute = Math.ceil(firstVisibleLineOffset / LINE_HEIGHT);

        for (let i = 0; i < numLinesToRecompute; i++) {
          const [row, line, _] = this.renderedLinesCache.get(this.visibleLines.getTailRef());

          // no more lines to render at the bottom
          if (!line.next) break;

          // elements (lines) at the top that have been scrolled off-screen getting adjusted
          const oldLineEl = this.visibleLines.getHeadRef();
          const oldLineNumberEl = this.visibleLineNumbers.getHeadRef();

          const oldValues = this.renderedLinesCache.get(oldLineEl);
          oldValues[0] = row + 1;
          oldValues[1] = line.next;

          oldLineEl.style.transform = `translate3d(0px, ${(row + 1) * 16}px, 0px)`;
          this.renderTokens(oldValues[1], oldLineEl.firstElementChild as HTMLElement);

          oldLineNumberEl.style.transform = `translate3d(0px, ${(row + 1) * 16}px, 0px)`;
          oldLineNumberEl.firstElementChild.textContent = `${row + 1}`;

          this.visibleLines.moveForward();
          this.visibleLineNumbers.moveForward();
        }
      } else if (!isScrollingDown && lastVisibleLineOffset > 0) {
        const numLinesToRecompute = Math.ceil(lastVisibleLineOffset / LINE_HEIGHT);

        for (let i = 0; i < numLinesToRecompute; i++) {
          const [row, line, _] = this.renderedLinesCache.get(this.visibleLines.getHeadRef());

          // no more lines to render at the top
          if (!line.prev) break;

          // elements (lines) at the bottom that have been scrolled off-screen getting adjusted
          const oldLineEl = this.visibleLines.getTailRef();
          const oldLineNumberEl = this.visibleLineNumbers.getTailRef();

          const oldValues = this.renderedLinesCache.get(oldLineEl);
          oldValues[0] = row - 1;
          oldValues[1] = line.prev;

          oldLineEl.style.transform = `translate3d(0px, ${(row - 1) * 16}px, 0px)`;
          this.renderTokens(oldValues[1], oldLineEl.firstElementChild as HTMLElement);

          oldLineNumberEl.style.transform = `translate3d(0px, ${(row - 1) * 16}px, 0px)`;
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
    };

    const cleanup = throttledEventListener(this.editorEl, "scroll", this.scrollingRender);
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
            deleteCharacter(this.cursor.line, this.col);
            const tokenWrapper = this.cursor.lineEl.firstElementChild as HTMLElement;
            this.renderTokens(this.cursor.line, tokenWrapper);
            this.navigateLeft();
          } else {
            const snapTo = this.file.removeLine(this.cursor.line);
            lineGroup.style.height = `${this.file.size * 16}px`;
            lineNumberGroup.style.height = `${this.file.size * 16}px`;
            this.updateColWithAnchor(snapTo);
            this.navigateUp();
            this.flushRenderingQueueAndRemount();
          }
          break;

        case "Shift":
          break;

        case "Meta":
          break;

        // TODO: Fix for shits
        case "Enter":
          this.file.createLine(this.cursor.line, this.col);
          // this.flushRenderingQueueAndRemount();

          lineGroup.style.height = `${(this.file.size + 1) * 16}px`;
          lineNumberGroup.style.height = `${(this.file.size + 1) * 16}px`;

          // this.updateColWithAnchor(0);
          // this.navigateDown();

          break;

        default:
          insertCharacter(this.cursor.line, this.col, e.key);
          const tokenWrapper = this.cursor.lineEl.firstElementChild as HTMLElement;
          this.renderTokens(this.cursor.line, tokenWrapper);
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
