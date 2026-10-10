import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const LanguageIslands = lazy(() => import("@/components/world/LanguageIslands"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Language Islands — Your Korean Vocabulary, Floating" },
      {
        name: "description",
        content:
          "Orbit a floating archipelago of your Korean vocabulary. Each island is a domain; its size is word count, its greenery is how healthy the cards are.",
      },
      { property: "og:title", content: "Language Islands — Your Korean Vocabulary, Floating" },
      {
        property: "og:description",
        content: "A 3D archipelago of your Korean vocab, grown from your Anki deck.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Loader() {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-[var(--sky)]">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-border border-t-primary" />
        <p className="mt-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">Raising the islands…</p>
      </div>
    </div>
  );
}

function Index() {
  return (
    <main>
      <ClientOnly fallback={<Loader />}>
        <Suspense fallback={<Loader />}>
          <LanguageIslands />
        </Suspense>
      </ClientOnly>
    </main>
  );
}
