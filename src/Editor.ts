interface CursorProps {
  attatchListenerToNewLine: (newLineEl: HTMLElement) => void;
}

interface Line {
  el: HTMLElement;
  prev: Line | null;
  next: Line | null;
}

export class Editor {
  head: Line;

  size: number;

  private cursorProps: CursorProps;

  constructor(fileText: string, cursorProps: CursorProps) {
    this.cursorProps = cursorProps;
    this.size = 0;

    this.head = null;
    if (!fileText.length) {
      this.head = {
        next: null,
        prev: null,
        el: this.createLineEl(),
      };
      this.size++;
    }

    let curr = this.head;
    let buff = "";

    for (let i = 0; i < fileText.length; i++) {
      const ch = fileText[i];

      if (ch === "\n") {
        const newLine: Line = {
          next: null,
          prev: curr,
          el: this.createLineEl(),
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
        el: this.createLineEl(),
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

  getLineFromNode(el: HTMLElement): [Line | null, number] | null {
    let row = 0;
    let curr = this.head;
    while (curr) {
      if (curr.el.isSameNode(el)) {
        return [curr, row];
      }
      row++;
      curr = curr.next;
    }
    return null;
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
      el: this.createLineEl(),
    };
    // assign overflow from previous line to new line
    newLine.el.firstElementChild.textContent = textOverflow;

    if (prevLine?.next?.prev) prevLine.next.prev = newLine;
    prevLine.next = newLine;

    // directly append new element after node on the DOM
    prevLine.el.after(newLine.el);

    this.size++;
    this.updateSize(this.size);
  }

  removeCurrentLine(currLine: Line, textOverflow: string): number {
    if (currLine.next) {
      currLine.next.prev = currLine.prev;
      currLine.prev.next = currLine.next;
    } else {
      currLine.prev.next = null;
    }

    // append the contents of the line past the cursor to the previous line
    currLine.prev.el.firstElementChild.textContent += textOverflow;

    // directly remove the current line from the DOM
    currLine.el.remove();

    this.size--;
    this.updateSize(this.size);

    // if the line above was empty, new cursor column should just be set to 0
    if (currLine.prev.el.textContent.length === textOverflow.length) {
      return 0;
    }
    return currLine.prev.el.textContent.length - textOverflow.length;
  }

  createLineEl(): HTMLElement {
    const lineContainer = document.createElement("div");
    lineContainer.className = "line";
    const lineSpan = document.createElement("span");
    lineSpan.className = "default-line-text";
    lineContainer.appendChild(lineSpan);

    this.cursorProps.attatchListenerToNewLine(lineContainer);

    return lineContainer;
  }

  updateSize(newSize: number) {
    this.size = newSize;

    const lineGroup = document.getElementById("line-group");
    lineGroup.style.height = `${this.size}em`;
  }

  // chain nodes together by \n and return the entire content of the new modified file
  //   readFileState(): string {
  //     let file = "";

  //     let curr = this.head;
  //     while (curr) {
  //       file += curr.text;
  //       file += "\n";
  //       curr = curr.next;
  //     }

  //     return file;
  //   }
}
