interface Line {
  value: string;
  prev: Line | null;
  next: Line | null;
}

export class FileMutationHandler {
  head: Line;
  size: number;

  constructor(fileText: string) {
    this.size = 1;

    this.head = {
      next: null,
      prev: null,
      value: "",
    };
    if (fileText.length) this.head = null;

    let curr = this.head;
    let lineAnch = 0;

    for (let i = 0; i < fileText.length; i++) {
      const ch = fileText[i];

      if (ch === "\n") {
        const newLine: Line = {
          next: null,
          prev: curr,
          value: fileText.slice(lineAnch, i),
        };

        if (curr) {
          curr.next = newLine;
          curr = curr.next;
        } else {
          this.head = newLine;
          curr = this.head;
        }
        lineAnch = i + 1;

        this.size++;
      }
    }

    const lastLine = fileText.slice(lineAnch);

    if (lastLine.length) {
      const newLine: Line = {
        next: null,
        prev: curr,
        value: lastLine,
      };

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

  getLineFromRow(row: number): Line | null {
    let curr = this.head;
    for (let i = 0; i < row; i++) {
      if (!curr) return null;
      curr = curr.next;
    }
    return curr;
  }

  insertCharacter(line: Line, col: number, ch: string) {
    line.value = line.value.slice(0, col) + ch + line.value.slice(col);
  }

  deleteCharacter(line: Line, col: number) {
    line.value = line.value.slice(0, col - 1) + line.value.slice(col);
  }

  createNewLine(prevLine: Line, breakpoint: number) {
    const newLine: Line = {
      prev: prevLine,
      next: prevLine.next,
      value: prevLine.value.slice(breakpoint),
    };

    prevLine.value = prevLine.value.slice(0, breakpoint);

    if (prevLine?.next?.prev) prevLine.next.prev = newLine;
    prevLine.next = newLine;

    this.size++;
  }

  removeCurrentLine(currLine: Line): number {
    if (currLine.next) {
      currLine.next.prev = currLine.prev;
      currLine.prev.next = currLine.next;
    } else {
      currLine.prev.next = null;
    }

    const newColPos = currLine.prev.value.length;

    currLine.prev.value += currLine.value;

    this.size--;

    return newColPos;
  }
}
