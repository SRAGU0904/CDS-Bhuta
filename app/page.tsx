import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 py-16">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-white/50">
            CDS Bhuta Sculpture Prototype
          </p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight">
            Two-screen museum proof of concept
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/70">
            Use one browser window for the rotating sculpture display and a second
            browser window for the metadata and interpretation interface.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/screen"
            className="rounded-3xl border border-white/10 bg-white/10 p-6 transition hover:bg-white/15"
          >
            <p className="text-sm uppercase tracking-[0.25em] text-white/50">
              Screen 1
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Sculpture display</h2>
            <p className="mt-3 text-white/65">
              A focused rotating 3D display of the Panjurli sculpture and its
              recolored interpretation.
            </p>
          </Link>

          <Link
            href="/data"
            className="rounded-3xl border border-white/10 bg-white/10 p-6 transition hover:bg-white/15"
          >
            <p className="text-sm uppercase tracking-[0.25em] text-white/50">
              Screen 2
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Metadata interface</h2>
            <p className="mt-3 text-white/65">
              Select sculptures and move between archive, interpretation, and
              recoloring information layers.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
