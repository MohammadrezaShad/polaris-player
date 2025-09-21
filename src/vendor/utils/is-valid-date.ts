export function isValidDate(dateString: string | Date) {
  const dateObject = new Date(dateString);

  return !Number.isNaN(dateObject.getTime());
}
