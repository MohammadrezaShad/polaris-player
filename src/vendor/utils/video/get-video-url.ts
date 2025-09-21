export const getVideoUrl = (videoId: string, isVertical?: boolean | null) =>
  `${isVertical ? process.env.NEXT_PUBLIC_VIKO_API : process.env.NEXT_PUBLIC_VIDEO_API}/${videoId}/master.m3u8`;
