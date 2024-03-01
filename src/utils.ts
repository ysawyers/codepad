export function isLetter(char: string) {
  const code = char.charCodeAt(0);
  if (code >= 65 && code <= 90) return true;
  if (code >= 97 && code <= 122) return true;
  return false;
}

export function isAlphaNum(char: string) {
  const code = char.charCodeAt(0);
  if (code >= 48 && code <= 57) return true;
  if (code >= 65 && code <= 90) return true;
  if (code >= 97 && code <= 122) return true;
  return false;
}

export function isNum(char: string) {
  const code = char.charCodeAt(0);
  if (code >= 48 && code <= 57) return true;
  return false;
}
