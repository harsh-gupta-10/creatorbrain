export function youtubeMoment(videoId: string, seconds = 0) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}${seconds ? `&t=${Math.floor(seconds)}s` : ''}`;
}
