import { isAlphaNum, isLetter, isNum } from "../../utils";

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

// combine whitespace with tokens to reduce amount of elements
export function renderTokensJS(lineVal: string, lineEl: HTMLElement) {
  let tokens = "";
  let pt = 0;
  let bracketStack: number[] = [];

  while (pt < lineVal.length) {
    let basept = pt;

    if (isLetter(lineVal[basept])) {
      while (isAlphaNum(lineVal[pt])) pt++;

      const lexeme = lineVal.slice(basept, pt);
      if (JSKeywords.has(lexeme)) {
        tokens += "<span>" + lexeme + "</span>";
      } else {
        tokens += "<span>" + lexeme + "</span>";
      }
    }

    if (isNum(lineVal[basept])) {
      while (isNum(lineVal[pt])) pt++;
      const lexeme = lineVal.slice(basept, pt);
      tokens += "<span>" + lexeme + "</span>";
    }

    switch (lineVal[basept]) {
      case " ":
        {
          let whitespace = "";
          while (lineVal[pt] === " ") {
            whitespace += "\xa0";
            pt++;
          }
          // tokens += "<span>" + whitespace + "</span>";
        }
        break;

      case "{":
      case "[":
      case "(":
        {
          let bracketType;

          if (bracketStack.length && bracketStack[bracketStack.length - 1] === 1) {
            bracketType = 2;
          } else {
            bracketType = 1;
          }

          const bracket = lineVal[pt++];

          if (bracketType === 1) {
            tokens += "<span>" + bracket + "</span>";
            bracketStack.push(1);
          } else {
            tokens += "<span>" + bracket + "</span>";
            bracketStack.push(2);
          }
        }
        break;

      case "}":
      case "]":
      case ")":
        {
          let bracketType = 1;
          if (bracketStack.length) bracketType = bracketStack.pop();

          const bracket = lineVal[pt++];

          if (bracketType === 1) {
            tokens += "<span>" + bracket + "</span>";
            bracketStack.push(1);
          } else {
            tokens += "<span>" + bracket + "</span>";
            bracketStack.push(2);
          }
        }
        break;

      case "+":
      case "-":
      case "/":
      case "*":
      case ">":
      case "<":
      case "&":
      case "^":
      case "|":
      case "%":
      case "!":
      case "?":
        tokens += "<span>" + lineVal[pt++] + "</span>";
        break;

      case ".":
      case ";":
      case ":":
        tokens += "<span>" + lineVal[pt++] + "</span>";
        break;

      case "=":
        {
          if (lineVal[pt + 1] === ">") {
            tokens += "<span>=></span>";
            pt += 2;
          } else {
            tokens += "<span>" + lineVal[pt++] + "</span>";
          }
        }
        break;

      case '"':
        {
          pt++;
          while (lineVal[pt] !== '"') pt++;
          const lexeme = lineVal.slice(basept, ++pt);
          tokens += "<span>" + lexeme + "</span>";
        }
        break;

      case "'":
        {
          pt++;
          while (lineVal[pt] !== "'") pt++;
          const lexeme = lineVal.slice(basept, ++pt);
          tokens += "<span>" + lexeme + "</span>";
        }
        break;
    }
  }

  lineEl.innerHTML = tokens;
}
