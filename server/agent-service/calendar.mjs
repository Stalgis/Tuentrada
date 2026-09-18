import { ToolInputError } from "./toolErrors.mjs";
export const assertISODate = (value, fieldName) => {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
  if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ToolInputError(`${fieldName} debe ser una fecha válida con formato YYYY-MM-DD.`);
  }
};
