import { ReviewScreen } from "@/features/news/server";

export default function ReviewPage({ searchParams }: PageProps<"/">) {
  return <ReviewScreen searchParams={searchParams} />;
}
