type NumericRecord = Record<string, number>;

const IDENTIFIER_REGEX = /\b[a-zA-Z_]\w*\b/g;

const sanitizeIdentifier = (token: string, context: NumericRecord) => {
  if (Object.prototype.hasOwnProperty.call(context, token)) {
    const value = context[token];
    return Number.isFinite(value) ? String(value) : "0";
  }
  return "0";
};

const evaluateExpression = (expression: string, context: NumericRecord) => {
  const replaced = expression.replace(IDENTIFIER_REGEX, (token) =>
    sanitizeIdentifier(token, context),
  );
  if (/[^0-9+\-*/().\s]/.test(replaced)) {
    throw new Error("Invalid characters in expression");
  }
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${replaced || "0"});`);
    const result = Number(fn());
    if (Number.isFinite(result)) {
      return result;
    }
    throw new Error("Expression result not finite");
  } catch (error) {
    throw new Error("Failed to evaluate expression");
  }
};

export const evaluateDataboxes = (
  databoxes: { id: string; defaultValue: string; expression: string }[],
  context: NumericRecord,
) => {
  const results: NumericRecord = {};
  databoxes.forEach((box) => {
    const baseValue = Number(box.defaultValue) || 0;
    try {
      const value = evaluateExpression(box.expression || box.defaultValue, {
        ...context,
        ...results,
      });
      results[box.id] = value;
    } catch {
      results[box.id] = baseValue;
    }
  });
  return results;
};
