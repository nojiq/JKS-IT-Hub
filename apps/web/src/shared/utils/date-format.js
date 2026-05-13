const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (value) => String(value).padStart(2, '0');

const parseDateValue = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const dateOnlyMatch = value.match(DATE_ONLY_PATTERN);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDisplayDate = (value, { fallback = 'N/A' } = {}) => {
  const date = parseDateValue(value);
  if (!date) return fallback;

  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
};

export const formatDisplayDateTime = (
  value,
  { fallback = 'N/A', includeSeconds = false } = {}
) => {
  const date = parseDateValue(value);
  if (!date) return fallback;

  const datePart = formatDisplayDate(date, { fallback });
  const timePart = [
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    ...(includeSeconds ? [pad2(date.getSeconds())] : [])
  ].join(':');

  return `${datePart}, ${timePart}`;
};
