import type { GetServerSideProps } from "next";
import WatchPage from "../../components/WatchPage";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function TvWatchPage() {
  return <WatchPage mediaType="tv" />;
}
