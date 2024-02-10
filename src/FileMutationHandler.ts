// TODO: Think about how to make opening extremely large files fast.

interface Line {
  el: HTMLElement;
  prev: Line | null;
  next: Line | null;
}

interface Highlight {
  startingLine: Line;
  startingCol: number;
  endingLine: Line;
  endingCol: number;
  isBackwards: boolean;
}

function createLineEl(): HTMLElement {
  const lineContainer = (
    document.getElementById("line") as HTMLTemplateElement
  ).content.firstElementChild.cloneNode(true) as HTMLElement;

  return lineContainer;
}

export class FileMutationHandler {
  head: Line;
  size: number;

  constructor(fileText: string) {
    this.size = 1;

    this.head = {
      next: null,
      prev: null,
      el: createLineEl(),
    };
    if (fileText.length) this.head = null;

    let curr = this.head;
    let buff = "";

    for (let i = 0; i < fileText.length; i++) {
      const ch = fileText[i];

      if (ch === "\n") {
        const newLine: Line = {
          next: null,
          prev: curr,
          el: createLineEl(),
        };
        newLine.el.firstElementChild.textContent = buff;

        if (curr) {
          curr.next = newLine;
          curr = curr.next;
        } else {
          this.head = newLine;
          curr = this.head;
        }
        buff = "";

        this.size++;
      } else {
        buff += ch === " " ? "\xa0" : ch;
      }
    }

    if (buff.length) {
      const newLine: Line = {
        next: null,
        prev: curr,
        el: createLineEl(),
      };
      newLine.el.firstElementChild.textContent = buff;

      if (curr) {
        curr.next = newLine;
        curr = curr.next;
      } else {
        this.head = newLine;
        curr = this.head;
      }
      this.size++;
    }
  }

  insertCharacter(line: Line, col: number, ch: string) {
    let text = line.el.firstElementChild.textContent;
    text = text.slice(0, col) + ch + text.slice(col);
    line.el.firstElementChild.textContent = text;
  }

  deleteCharacter(line: Line, col: number) {
    let text = line.el.firstElementChild.textContent;
    text = text.slice(0, col - 1) + text.slice(col);
    line.el.firstElementChild.textContent = text;
  }

  createNewLine(prevLine: Line, textOverflow: string) {
    const newLine: Line = {
      prev: prevLine,
      next: prevLine.next,
      el: createLineEl(),
    };
    // assign overflow from previous line to new line
    newLine.el.firstElementChild.textContent = textOverflow;

    if (prevLine?.next?.prev) prevLine.next.prev = newLine;
    prevLine.next = newLine;

    // directly append new element after node on the DOM
    prevLine.el.after(newLine.el);

    this.size++;
  }

  removeCurrentLine(currLine: Line, textOverflow: string): number {
    if (currLine.next) {
      currLine.next.prev = currLine.prev;
      currLine.prev.next = currLine.next;
    } else {
      currLine.prev.next = null;
    }

    // where the cursor will jump to on the previous line
    const oldLength = currLine.prev.el.firstElementChild.textContent.length;

    // append the contents of the line past the cursor to the previous line
    currLine.prev.el.firstElementChild.textContent += textOverflow;

    // directly remove the current line from the DOM
    currLine.el.remove();

    this.size--;

    return oldLength;
  }

  batchRemove(range: Highlight) {
    // EDGE CASE: have to handle uniquely otherwise reference to all nodes below will be destroyed
    if (range.endingLine == range.startingLine) {
      let oldText = range.startingLine.el.firstElementChild.textContent;

      if (range.isBackwards) {
        range.endingLine.el.firstElementChild.textContent =
          oldText.slice(0, range.endingCol) + oldText.slice(range.startingCol);
      } else {
        range.startingLine.el.firstElementChild.textContent =
          oldText.slice(0, range.startingCol) + oldText.slice(range.endingCol);
      }
      return;
    }

    if (range.isBackwards) {
      const endingLineText = range.endingLine.el.firstElementChild.textContent;
      range.endingLine.el.firstElementChild.textContent = endingLineText.slice(0, range.endingCol);

      const startingLineText = range.startingLine.el.firstElementChild.textContent;
      range.startingLine.el.firstElementChild.textContent = startingLineText.slice(
        range.startingCol
      );

      range.endingLine.next = range.startingLine;
      range.startingLine.prev = range.endingLine;
    } else {
      const startingLineText = range.startingLine.el.firstElementChild.textContent;
      range.startingLine.el.firstElementChild.textContent = startingLineText.slice(
        0,
        range.startingCol
      );

      const endingLineText = range.endingLine.el.firstElementChild.textContent;
      range.endingLine.el.firstElementChild.textContent = endingLineText.slice(range.endingCol);

      range.startingLine.next = range.endingLine;
      range.endingLine.prev = range.startingLine;
    }
  }
}
