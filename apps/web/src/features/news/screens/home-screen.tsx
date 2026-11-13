import { Suspense } from "react";
import { HomeContent } from "@/features/news/components/layout/home-content";
import { HomeSkeleton } from "@/features/news/components/layout/home-skeleton";

export function HomeScreen() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
