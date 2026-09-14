export type VidsrcDownloadRequest = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  season?: number;
  episode?: number;
};
