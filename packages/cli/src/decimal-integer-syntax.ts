export const isDecimalIntegerSyntax = (
  value: string,
  allowLeadingMinus: boolean,
): boolean => {
  if (value.length === 0) return false;
  let index = 0;
  if (allowLeadingMinus && value.charCodeAt(0) === 45) {
    if (value.length === 1) return false;
    index = 1;
  }
  while (index < value.length) {
    const code = value.charCodeAt(index);
    if (code < 48 || code > 57) return false;
    index += 1;
  }
  return true;
};
