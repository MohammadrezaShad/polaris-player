'use client';

import { getImageUrl } from '../utils/get-image-url';
import { getVodImageUrl } from '../utils/get-vod-image-url';

export const imageLoader = ({ src, width, quality }: { src: string; width: number; quality?: number }) => {
  return `${getImageUrl(src)}?w=${width}&q=${quality || 75}`;
};

export const videoImageLoader = ({ src, width, quality }: { src: string; width: number; quality?: number }) => {
  return `${getVodImageUrl(src)}?w=${width}&q=${quality || 75}`;
};
