export const getImageUrl = (src?: string | null) => {
  if (!src) return '';
  return `${process.env.NEXT_PUBLIC_IMAGE_CDN_URL}/${src}`;
};
