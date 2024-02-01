import { Editor } from "./Editor";

interface Line {
  el: HTMLElement;
  prev: Line | null;
  next: Line | null;
}

export class Cursor {
  private editorEl: HTMLElement;

  private lineRef: Line;
  private row: number;
  private col: number;
  private anchor: number | null;

  private file: Editor;
  private eventListner: any;

  constructor(row: number, col: number, fileText: string) {
    this.row = row;
    this.col = col;
    this.anchor = null;
    this.file = new Editor(fileText);

    const editorTemplate = document.getElementById("editor") as HTMLTemplateElement;
    this.editorEl = editorTemplate.content.firstElementChild.cloneNode(true) as HTMLElement;

    this.updateCurrentLine(this.file.getHead());
    this.renderCursor(null, this.lineRef);

    this.eventListner = (e: KeyboardEvent) => {
      const prevLine = this.lineRef;

      switch (e.key) {
        case "ArrowUp":
          if (this.row > 0) this.navigateUp();
          break;

        case "ArrowDown":
          const linesGroupEl = document.getElementById("line-group");
          if (linesGroupEl.children.length > this.row + 1) this.navigateDown();
          break;

        case "ArrowLeft":
          if (this.col > 0) this.navigateLeft();
          break;

        case "ArrowRight":
          {
            const text = this.lineRef.el.firstElementChild.textContent;
            if (this.col < text.length) this.navigateRight();
          }
          break;

        case "Tab":
          {
            for (let i = 0; i < 4; i++) {
              this.file.insertCharacter(this.lineRef, this.col, "\xa0");
              this.navigateRight();
            }
          }
          break;

        case "Backspace":
          {
            if (this.col != 0) {
              const text = this.lineRef.el.firstElementChild.textContent;
              const tab = "\xa0\xa0\xa0\xa0";
              if (this.col > 3 && text.slice(this.col - 4, this.col) === tab) {
                for (let i = 0; i < 4; i++) {
                  this.file.deleteCharacter(this.lineRef, this.col);
                  this.navigateLeft();
                }
              } else {
                this.file.deleteCharacter(this.lineRef, this.col);
                this.navigateLeft();
              }
            } else if (this.row > 0) {
              const textOverflow = this.lineRef.el.firstElementChild.textContent.slice(this.col);
              const newCol = this.file.removeCurrentLine(this.lineRef, textOverflow);
              this.navigateUp();
              this.col = newCol;
            }
          }
          break;

        case "Shift":
          break;

        case "Meta":
          break;

        case "Enter":
          {
            const textContent = this.lineRef.el.firstElementChild.textContent;
            this.lineRef.el.firstElementChild.textContent = textContent.slice(0, this.col);
            this.file.createNewLine(this.lineRef, textContent.slice(this.col));
            this.navigateDown();
            this.col = 0;
            this.anchor = null;
          }
          break;

        default: {
          const ch = e.key === " " ? "\xa0" : e.key;
          this.file.insertCharacter(this.lineRef, this.col, ch);
          this.navigateRight();
        }
      }

      this.renderCursor(prevLine, this.lineRef);
    };
  }

  private navigateLeft() {
    this.anchor = null;
    this.col--;
  }

  private navigateRight() {
    this.anchor = null;
    this.col++;
  }

  private navigateUp() {
    this.row--;
    if (!this.anchor) this.anchor = this.col;
    if (this.lineRef.prev) {
      const textLength = this.lineRef.prev.el.firstElementChild.textContent.length;
      if (this.anchor > textLength) {
        this.col = textLength;
      } else {
        this.col = this.anchor;
      }
      this.updateCurrentLine(this.lineRef.prev);
    }
  }

  private navigateDown() {
    this.row++;
    if (!this.anchor) this.anchor = this.col;
    if (this.lineRef.next) {
      const textLength = this.lineRef.next.el.firstElementChild.textContent.length;
      if (this.anchor > textLength) {
        this.col = textLength;
      } else {
        this.col = this.anchor;
      }
      this.updateCurrentLine(this.lineRef.next);
    }
  }

  private renderCursor(prevLine: Line | null, line: Line) {
    if (prevLine) prevLine.el.removeChild(prevLine.el.lastElementChild);
    const cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.style.marginLeft = `${this.col * 7.8}px`;
    line.el.appendChild(cursor);
  }

  private updateCurrentLine(currLine: Line) {
    if (this.lineRef) this.lineRef.el.style.backgroundColor = "";
    currLine.el.style.backgroundColor = "rgba(219,221,223, 0.1)";
    this.lineRef = currLine;
  }

  foreground() {
    document.getElementById("workspace-group").appendChild(this.editorEl);
    const lineGroup = document.getElementById("line-group");

    let curr = this.file.getHead();
    while (curr) {
      lineGroup.appendChild(curr.el);
      curr = curr.next;
    }

    document.addEventListener("keydown", this.eventListner);
  }

  // cursor is "backgrounded" by default
  background() {
    this.editorEl.remove();
    document.removeEventListener("keydown", this.eventListner);
  }
}
