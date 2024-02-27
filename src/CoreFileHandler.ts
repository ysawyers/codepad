enum TokenType {
  Whitespace = 0,
  Ident,
}

interface Token {
  type: TokenType;
  lexeme: string;
}

interface Line {
  value: string;
  prev: Line | null;
  next: Line | null;
}

export function insertCharacter(line: Line, col: number, ch: string) {
  line.value = line.value.slice(0, col) + ch + line.value.slice(col);
}

export function deleteCharacter(line: Line, col: number) {
  line.value = line.value.slice(0, col - 1) + line.value.slice(col);
}

export function tokenize(line: Line): Token[] {
  let tokens: Token[] = [];

  let state = 0;
  let baseptr = 0;

  for (let i = 0; i < line.value.length; i++) {
    switch (state) {
      // WHITESPACE
      case 0:
        if (line.value[i] !== " ") {
          const lexeme = line.value.slice(baseptr, i);
          if (lexeme.length > 0) {
            tokens.push({
              lexeme,
              type: TokenType.Whitespace,
            });
          }
          baseptr = i;
          state = 1;
        }
        break;

      // ANYTHING ELSE
      case 1:
        if (line.value[i] === " ") {
          const lexeme = line.value.slice(baseptr, i);
          if (lexeme.length > 0) {
            tokens.push({
              lexeme,
              type: TokenType.Ident,
            });
          }
          baseptr = i;
          state = 0;
        }
        break;
    }
  }

  const finalLexeme = line.value.slice(baseptr, line.value.length);
  tokens.push({
    lexeme: finalLexeme,
    type: state === 0 ? TokenType.Whitespace : TokenType.Ident,
  });

  return tokens;
}

export class CoreFileHandler {
  head: Line;
  size: number;

  constructor(fileText: string) {
    this.size = 1;

    this.head = {
      next: null,
      prev: null,
      value: "",
    };
    if (fileText.length) {
      this.head = null;
      this.size = 0;
    }

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

  getLine(row: number): Line | null {
    let curr = this.head;
    for (let i = 0; i < row; i++) {
      if (!curr) return null;
      curr = curr.next;
    }
    return curr;
  }

  createLine(prevLine: Line, breakpoint: number) {
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

  removeLine(line: Line): number {
    if (line.next) {
      line.next.prev = line.prev;
      line.prev.next = line.next;
    } else {
      line.prev.next = null;
    }

    const newColPos = line.prev.value.length;

    line.prev.value += line.value;

    this.size--;

    return newColPos;
  }
}
