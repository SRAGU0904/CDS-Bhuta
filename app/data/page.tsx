import Link from "next/link";
import DataInterface from "@/components/DataInterface";

export default function DataPage() {
  return (
    <>
      <Link
        href="/"
        className="fixed left-6 top-6 z-[100] rounded-full border border-white/15 bg-black/50 px-4 py-2 text-sm text-white/80 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
      >
        ← Home
      </Link>

      <DataInterface />
    </>
  );
}