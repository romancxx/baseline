import { pipeline } from "@huggingface/transformers";
import { serverEnv } from "@/shared/config/server-env";

type Extractor = Awaited<ReturnType<typeof pipeline<"feature-extraction">>>;

let extractor: Extractor | null = null;

/** Loaded once per process */
async function getExtractor(): Promise<Extractor> {
  extractor ??= await pipeline("feature-extraction", serverEnv.EMBEDDING_MODEL);
  return extractor;
}

export async function embed(texts: readonly string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = await getExtractor();
  const output = await model([...texts], { pooling: "mean", normalize: true });
  const vectors = output.tolist() as number[][];

  const wrong = vectors.find((vector) => vector.length !== serverEnv.EMBEDDING_DIMENSIONS);
  if (wrong) {
    throw new Error(
      `${serverEnv.EMBEDDING_MODEL} emits ${wrong.length} dimensions, but ` +
        `EMBEDDING_DIMENSIONS is ${serverEnv.EMBEDDING_DIMENSIONS}. The articles.embedding ` +
        "column would reject these.",
    );
  }

  return vectors;
}
