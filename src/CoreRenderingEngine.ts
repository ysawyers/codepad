import { CoreFileHandler, insertCharacter, deleteCharacter, tokenize } from "./CoreFileHandler";

// TODO: Bug with creating new line when the last line is visible after rendering all viewport lines.

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
    lineContainer.style.top = `${row}em`;

    const lineNumberContainer = document.createElement("div");
    lineNumberContainer.style.top = `${row}em`;

    const lineNumberValue = document.createElement("div");
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

  // TODO: reduce garbage being generated
  // will render more <spans> than what is needed but will reduce on the amount of DOM operations by a lot
  private renderTokens(line: Line, tokenWrapper: HTMLElement) {
    const tokens: Token[] = tokenize(line);

    const children = tokenWrapper.children;
    for (let i = 0; i < children.length; i++) {
      if (i < tokens.length) {
        // @ts-ignore
        children[i].style.color = tokens[i].type == TokenType.Ident ? "#91CCEB" : "";
        children[i].textContent = tokens[i].lexeme;
      } else {
        // @ts-ignore
        children[i].style.color = "";
        children[i].textContent = "";
      }
    }

    if (tokens.length > children.length) {
      const fragment = new DocumentFragment();

      for (let i = children.length; i < tokens.length; i++) {
        const tokenEl = document.createElement("span");
        tokenEl.style.fontSize = "13px";
        tokenEl.style.color = tokens[i].type == TokenType.Ident ? "#91CCEB" : "";
        tokenEl.textContent = tokens[i].lexeme;
        fragment.appendChild(tokenEl);
      }

      tokenWrapper.append(fragment);
    }
  }

  foreground() {
    document.getElementById("workspace-group").appendChild(this.editorEl);

    const lineGroup = document.getElementById("line-group");
    lineGroup.style.height = `${this.file.size}em`;

    const lineNumberGroup = document.getElementById("line-number-group");
    lineNumberGroup.style.height = `${this.file.size}em`;
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
        tokenWrapper.style.height = "16px";
        this.renderTokens(curr, tokenWrapper);

        lineContainer.appendChild(tokenWrapper);
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
          this.renderTokens(line.next, oldLineEl.firstElementChild as HTMLElement);
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
          this.renderTokens(line.prev, oldLineEl.firstElementChild as HTMLElement);
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
            deleteCharacter(this.cursor.line, this.col);
            this.renderTokens(
              this.cursor.line,
              this.cursor.lineEl.firstElementChild as HTMLElement
            );
            this.navigateLeft();
          } else {
            const snapTo = this.file.removeLine(this.cursor.line);
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

        // TODO: Fix for shits
        case "Enter":
          this.file.createLine(this.cursor.line, this.col);
          // this.flushRenderingQueueAndRemount();

          lineGroup.style.height = `${this.file.size + 1}em`;
          lineNumberGroup.style.height = `${this.file.size + 1}em`;

          // this.updateColWithAnchor(0);
          // this.navigateDown();

          break;

        default:
          insertCharacter(this.cursor.line, this.col, e.key);
          this.renderTokens(this.cursor.line, this.cursor.lineEl.firstElementChild as HTMLElement);
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
