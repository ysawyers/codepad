import { isAlphaNum, isLetter, isNum } from "./utils";

const BLUE = "#60a5fa";
const PURPLE = "#9333ea";
const RED = "#f43f5e";
const ORANGE = "#fb923c";

const JSKeywords = new Set([
  "var",
  "let",
  "const",
  "export",
  "function",
  "case",
  "switch",
  "await",
  "async",
  "class",
  "new",
  "this",
  "private",
  "try",
  "catch",
  "finally",
  "default",
  "import",
  "from",
  "return",
  "for",
  "while",
  "if",
  "else",
  "break",
]);

export function parseJS(pt: number, line: string, textEl: HTMLElement): number {
  // if token starts with a letter it will be either an identifier or reserved keyword
  if (isLetter(line[pt])) {
    let basept = pt;
    while (isAlphaNum(line[pt])) pt++;
    const lexeme = line.slice(basept, pt);
    textEl.textContent = lexeme;

    if (JSKeywords.has(lexeme)) {
      textEl.style.color = PURPLE;
    } else if (line[pt] === "(") {
      textEl.style.color = BLUE;
    } else {
      textEl.style.color = RED;
    }

    return pt;
  }

  // if token starts with a digit it will be interpreted as a number
  if (isNum(line[pt])) {
    let basept = pt;
    while (isNum(line[pt])) pt++;
    const lexeme = line.slice(basept, pt);
    textEl.textContent = lexeme;
    textEl.style.color = ORANGE;
    return pt;
  }

  switch (line[pt]) {
    case " ":
      {
        let lexeme = "";
        while (line[pt] === " ") {
          lexeme += "\xa0";
          pt++;
        }
        textEl.textContent = lexeme;
        // textEl.style.color = "";
      }
      break;

    case '"':
      {
        let baseptr = pt++;
        while (line[pt] !== '"') pt++;
        const lexeme = line.slice(baseptr, pt);
        textEl.textContent = lexeme;
        textEl.style.color = "#0A6E2B";
      }
      break;

    case "'":
      {
        let baseptr = pt++;
        while (line[pt] !== "'") pt++;
        const lexeme = line.slice(baseptr, pt);
        textEl.textContent = lexeme;
        textEl.style.color = "#0A6E2B";
      }
      break;

    case "(":
    case ")":
    case "[":
    case "]":
    case "{":
    case "}":
    case "+":
    case "-":
    case ";":
    case "=":
    case "&":
    case "|":
    case ">":
    case "<":
      textEl.textContent = line[pt++];
      textEl.style.color = BLUE;
      break;

    case ":":
    case ",":
    case ".":
      textEl.textContent = line[pt++];
      textEl.style.color = "#d4d4d8";
      break;
  }

  return pt;
}
