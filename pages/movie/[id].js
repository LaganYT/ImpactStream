import { useRouter } from "next/router";

export default function Movie() {
  const router = useRouter();
  const { id } = router.query;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Movie Player</h1>
      <iframe
        src={`https://vidsrc.me/embed/movie/${id}`}
        frameBorder="0"
        allowFullScreen
        className="w-full h-96 mt-4"
      ></iframe>
    </div>
  );
}
