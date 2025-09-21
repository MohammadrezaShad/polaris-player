export const getAbsoulteUri = (path = '') => {
  return `${process.env.NEXT_PUBLIC_SITE_URL}${path}`;
};
