export function required(value, fieldName) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    throw new Error(`${fieldName} is required.`);
  }

  return value;
}

export function positiveNumber(value, fieldName) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${fieldName} must be greater than 0.`);
  }

  return number;
}

export function nonNegativeNumber(value, fieldName) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${fieldName} cannot be negative.`);
  }

  return number;
}

export function integerId(value, fieldName = "ID") {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${fieldName} must be a valid ID.`);
  }

  return number;
}

export function validEmail(value, fieldName = "Email") {
  if (!value) return null;

  const email = String(value).trim();

  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!pattern.test(email)) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return email;
}

export function maxLength(value, length, fieldName) {
  if (value && String(value).length > length) {
    throw new Error(
      `${fieldName} cannot exceed ${length} characters.`
    );
  }

  return value;
}

export function validateDate(value, fieldName = "Date") {
  if (!value) {
    throw new Error(`${fieldName} is required.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return value;
}

export function validateEnum(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    throw new Error(
      `${fieldName} must be one of: ${allowed.join(", ")}.`
    );
  }

  return value;
}