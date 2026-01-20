import { MemoryStore } from '../src/memory/store.js';

async function main() {
  const store = new MemoryStore();

  // Check current coverage
  const before = store.getEmbeddingCoverage();
  console.log('Current embedding coverage:');
  console.log(`  Total memories: ${before.total}`);
  console.log(`  With embeddings: ${before.withEmbedding}`);
  console.log(`  Without embeddings: ${before.withoutEmbedding}`);
  console.log(`  Coverage: ${before.coveragePercent.toFixed(1)}%`);

  if (before.withoutEmbedding === 0) {
    console.log('\nAll memories already have embeddings!');
    return;
  }

  console.log('\nBackfilling embeddings...');
  const result = await store.backfillEmbeddings({
    batchSize: 10,
    onProgress: (processed, total) => {
      console.log(`  Progress: ${processed}/${total}`);
    }
  });

  console.log('\nBackfill complete:');
  console.log(`  Processed: ${result.processed}`);
  console.log(`  Failed: ${result.failed}`);
  console.log(`  Skipped: ${result.skipped}`);

  // Check final coverage
  const after = store.getEmbeddingCoverage();
  console.log(`\nFinal coverage: ${after.coveragePercent.toFixed(1)}%`);
}

main().catch(console.error);
