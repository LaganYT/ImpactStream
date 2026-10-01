import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import WatchPage from "../../components/WatchPage";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function AnimeWatchPage() {
  const router = useRouter();
  const mediaType = router.query.type === "movie" ? "anime:movie" : "anime:tv";

  return <WatchPage key={mediaType} mediaType={mediaType} />;
}
