import "./index.css";

class File {
  cursors: Cursor[];

  constructor() {
    this.cursors = [new Cursor(0, 0)]; // cursors[0] is root
  }
}

class Cursor {
  static template = document.getElementById("cursor");
  private cursor: HTMLDivElement;
  row: number;
  col: number;

  constructor(row: number, col: number) {
    this.row = row;
    this.col = col;

    const startingLocation = document.getElementById(`line-${row}`);
    this.renderCursor(startingLocation);

    window.addEventListener("keydown", (e) => {
      this.cursor.remove();
      switch (e.key) {
        case "ArrowUp":
          this.up();
          break;
        case "ArrowDown":
          this.down();
          break;
        case "ArrowLeft":
          break;
        case "ArrowRight":
          break;
        case "Backspace":
          break;
        case "Enter":
          this.renderLine();
          this.down();
          break;
        default:
          break;
      }
      const newLocation = document.getElementById(`line-${this.row}`);
      this.renderCursor(newLocation);
    });
  }

  // wraps cursor around div to have a direct reference for cleanup and other operations
  renderCursor(line: HTMLElement) {
    // @ts-ignore
    const cursor = Cursor.template.content.cloneNode(true);
    const cursorFragmentWrapper = document.createElement("div");
    cursorFragmentWrapper.appendChild(cursor);
    line.appendChild(cursorFragmentWrapper);
    this.cursor = cursorFragmentWrapper;
  }

  renderLine() {
    const lines = document.getElementById("line-group");
    const newLine = lines.lastElementChild.cloneNode(true);
    newLine.id = `line-${parseInt(newLine.id.split("-")[1]) + 1}`;

    const lineNumbers = document.getElementById("line-number-group");
    const newLineNumber = lineNumbers.lastElementChild.cloneNode(true);
    newLineNumber.id = `line-number-${parseInt(newLineNumber.id.split("-")[2]) + 1}`;
    newLineNumber.textContent = `${parseInt(newLineNumber.id.split("-")[2]) + 1}`;

    lines.appendChild(newLine);
    lineNumbers.appendChild(newLineNumber);
  }

  left() {}

  right() {}

  up() {
    this.row -= 1;
  }

  down() {
    this.row += 1;
  }

  downAndNewLine() {}
}

new File();
