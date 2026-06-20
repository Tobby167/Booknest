import { BookNestLoader } from "@/components/BookNestLoader";

export default function EmbedLoading() {
  return (
    <main className="min-h-screen bg-white">
      <BookNestLoader label="Loading booking" fullScreen />
    </main>
  );
}
