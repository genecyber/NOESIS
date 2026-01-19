# Semantic Trigger Detection Plan

**Date:** 2026-01-18
**Status:** Planning
**Goal:** Replace regex-based command triggers with semantic similarity using embeddings

---

## Current State

```typescript
// src/commands/memories.ts - Current regex approach
triggers: [
  {
    type: 'memory_query',
    patterns: [
      /remember when/i,
      /what do you recall/i,
      /earlier.*conversation/i,
      /you mentioned before/i
    ],
    confidence: 0.7
  }
]
```

**Problems with regex:**
- Brittle - misses paraphrases ("what did we discuss", "from before")
- Maintenance burden - constantly adding new patterns
- No nuance - can't detect semantic similarity

---

## Proposed State

```typescript
// Semantic trigger definition
triggers: [
  {
    type: 'memory_query',
    intents: [
      "recall something from earlier in our conversation",
      "remember what we discussed before",
      "what do you know about a previous topic",
      "retrieve past information"
    ],
    threshold: 0.7  // cosine similarity threshold
  }
]
```

**Benefits:**
- Catches paraphrases automatically
- More robust to natural language variation
- Easier to maintain (add intent examples, not regex)
- Can tune sensitivity with threshold

---

## Implementation Options

### Option A: @xenova/transformers (Recommended)

**Pros:**
- Pure JavaScript, runs in Node.js
- No external API, no cost, works offline
- Good quality models available
- Hugging Face ecosystem

**Cons:**
- First load downloads model (~23MB for MiniLM)
- Slightly slower than API (but fast enough for triggers)

```typescript
import { pipeline } from '@xenova/transformers';

// Initialize once at startup
const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

// Embed text
const embedding = await embedder(text, { pooling: 'mean', normalize: true });
```

**Model options:**
| Model | Size | Quality | Speed |
|-------|------|---------|-------|
| `all-MiniLM-L6-v2` | 23MB | Good | Fast |
| `all-MiniLM-L12-v2` | 33MB | Better | Medium |
| `all-mpnet-base-v2` | 110MB | Best | Slower |

### Option B: Ollama (If user has it)

```typescript
// Use ollama's embedding endpoint
const response = await fetch('http://localhost:11434/api/embeddings', {
  method: 'POST',
  body: JSON.stringify({ model: 'nomic-embed-text', prompt: text })
});
```

**Pros:** High quality, local
**Cons:** Requires Ollama installed

### Option C: OpenAI/Anthropic API

```typescript
const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: text
});
```

**Pros:** Best quality
**Cons:** Requires API key, has cost, needs network

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EmbeddingService                         │
├─────────────────────────────────────────────────────────────┤
│  interface EmbeddingProvider {                              │
│    embed(text: string): Promise<number[]>;                  │
│    embedBatch(texts: string[]): Promise<number[][]>;        │
│  }                                                          │
├─────────────────────────────────────────────────────────────┤
│  Providers:                                                 │
│  • LocalEmbeddingProvider (xenova/transformers) [default]   │
│  • OllamaEmbeddingProvider (if available)                   │
│  • OpenAIEmbeddingProvider (if API key)                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 SemanticTriggerDetector                     │
├─────────────────────────────────────────────────────────────┤
│  • Pre-computed intent embeddings (loaded at startup)       │
│  • detectTriggers(message) → finds similar intents          │
│  • Uses cosine similarity                                   │
│  • Caches recent message embeddings                         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    CommandRegistry                          │
├─────────────────────────────────────────────────────────────┤
│  • Calls SemanticTriggerDetector instead of regex           │
│  • Falls back to regex if embeddings unavailable            │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation

### 1. EmbeddingService

```typescript
// src/embeddings/service.ts

export interface EmbeddingProvider {
  name: string;
  dimensions: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  isAvailable(): Promise<boolean>;
}

export class EmbeddingService {
  private provider: EmbeddingProvider | null = null;
  private cache: Map<string, number[]> = new Map();

  async initialize(): Promise<void> {
    // Try providers in order of preference
    const providers = [
      new LocalEmbeddingProvider(),    // Always available
      new OllamaEmbeddingProvider(),   // If installed
      new OpenAIEmbeddingProvider(),   // If API key
    ];

    for (const provider of providers) {
      if (await provider.isAvailable()) {
        this.provider = provider;
        console.log(`Using embedding provider: ${provider.name}`);
        break;
      }
    }
  }

  async embed(text: string): Promise<number[]> {
    if (this.cache.has(text)) {
      return this.cache.get(text)!;
    }

    const embedding = await this.provider!.embed(text);
    this.cache.set(text, embedding);
    return embedding;
  }

  cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
```

### 2. LocalEmbeddingProvider

```typescript
// src/embeddings/providers/local.ts

import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

export class LocalEmbeddingProvider implements EmbeddingProvider {
  name = 'local-minilm';
  dimensions = 384;

  private model: FeatureExtractionPipeline | null = null;
  private modelLoading: Promise<FeatureExtractionPipeline> | null = null;

  async isAvailable(): Promise<boolean> {
    return true; // Always available, just needs to download model
  }

  private async getModel(): Promise<FeatureExtractionPipeline> {
    if (this.model) return this.model;

    if (!this.modelLoading) {
      this.modelLoading = pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { quantized: true }  // Smaller, faster
      );
    }

    this.model = await this.modelLoading;
    return this.model;
  }

  async embed(text: string): Promise<number[]> {
    const model = await this.getModel();
    const output = await model(text, {
      pooling: 'mean',
      normalize: true
    });
    return Array.from(output.data);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const model = await this.getModel();
    const results: number[][] = [];

    for (const text of texts) {
      const output = await model(text, {
        pooling: 'mean',
        normalize: true
      });
      results.push(Array.from(output.data));
    }

    return results;
  }
}
```

### 3. SemanticTriggerDetector

```typescript
// src/commands/semantic-triggers.ts

export interface SemanticTrigger {
  type: TriggerType;
  intents: string[];           // Example phrases representing the intent
  threshold: number;           // Cosine similarity threshold (0-1)
  stanceConditions?: StanceCondition[];
}

export interface SemanticCommandDefinition extends CommandDefinition {
  semanticTriggers?: SemanticTrigger[];  // New field
  // Keep 'triggers' for regex fallback
}

export class SemanticTriggerDetector {
  private embeddingService: EmbeddingService;
  private intentEmbeddings: Map<string, IntentEmbedding[]> = new Map();
  private initialized = false;

  constructor(embeddingService: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  /**
   * Pre-compute embeddings for all command intents
   */
  async initialize(commands: SemanticCommandDefinition[]): Promise<void> {
    console.log('Pre-computing intent embeddings...');

    for (const command of commands) {
      if (!command.semanticTriggers) continue;

      const commandIntents: IntentEmbedding[] = [];

      for (const trigger of command.semanticTriggers) {
        for (const intent of trigger.intents) {
          const embedding = await this.embeddingService.embed(intent);
          commandIntents.push({
            intent,
            embedding,
            trigger,
          });
        }
      }

      this.intentEmbeddings.set(command.name, commandIntents);
    }

    this.initialized = true;
    console.log(`Initialized ${this.intentEmbeddings.size} command intents`);
  }

  /**
   * Detect triggers based on semantic similarity
   */
  async detectTriggers(
    message: string,
    config: ModeConfig,
    maxTriggers: number = 2
  ): Promise<DetectedTrigger[]> {
    if (!this.initialized) {
      return []; // Fall back to regex in registry
    }

    const messageEmbedding = await this.embeddingService.embed(message);
    const detected: DetectedTrigger[] = [];

    for (const [commandName, intents] of this.intentEmbeddings) {
      // Check whitelist/blacklist
      const whitelist = config.autoCommandWhitelist || [];
      const blacklist = config.autoCommandBlacklist || [];

      if (whitelist.length > 0 && !whitelist.includes(commandName)) continue;
      if (blacklist.includes(commandName)) continue;

      // Find best matching intent
      let bestMatch: { similarity: number; intent: IntentEmbedding } | null = null;

      for (const intent of intents) {
        const similarity = this.embeddingService.cosineSimilarity(
          messageEmbedding,
          intent.embedding
        );

        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { similarity, intent };
        }
      }

      if (bestMatch && bestMatch.similarity >= bestMatch.intent.trigger.threshold) {
        detected.push({
          command: commandName,
          trigger: {
            type: bestMatch.intent.trigger.type,
            patterns: [], // Not used for semantic
            confidence: bestMatch.similarity,
          },
          confidence: bestMatch.similarity,
          matchedPattern: bestMatch.intent.intent, // The matched intent text
        });
      }
    }

    return detected
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxTriggers);
  }
}

interface IntentEmbedding {
  intent: string;
  embedding: number[];
  trigger: SemanticTrigger;
}
```

### 4. Updated Command Definition

```typescript
// src/commands/memories.ts - Updated with semantic triggers

export const memoriesCommand: SemanticCommandDefinition = {
  name: 'memories',
  aliases: ['mem'],
  description: 'List and search stored memories',

  // NEW: Semantic triggers (preferred)
  semanticTriggers: [
    {
      type: 'memory_query',
      intents: [
        "recall something from earlier",
        "what do you remember about",
        "you mentioned before",
        "from our previous discussion",
        "what did we talk about",
        "bring up that thing from before",
        "earlier you said",
        "do you recall when"
      ],
      threshold: 0.65
    }
  ],

  // Keep regex as fallback
  triggers: [
    {
      type: 'memory_query',
      patterns: [/remember when/i, /you mentioned/i],
      confidence: 0.7
    }
  ],

  agentInvocable: true,
  hookTriggerable: true,
  execute: (context, args) => { /* ... */ }
};
```

---

## Integration with CommandRegistry

```typescript
// src/commands/registry.ts - Updated

class CommandRegistry {
  private semanticDetector: SemanticTriggerDetector | null = null;

  async initializeSemanticTriggers(embeddingService: EmbeddingService): Promise<void> {
    this.semanticDetector = new SemanticTriggerDetector(embeddingService);
    await this.semanticDetector.initialize(this.list());
  }

  async detectTriggers(
    message: string,
    stance: Stance,
    config: ModeConfig,
    maxTriggers: number = 2
  ): Promise<DetectedTrigger[]> {
    if (!config.enableAutoCommands) {
      return [];
    }

    // Try semantic detection first
    if (this.semanticDetector) {
      const semanticTriggers = await this.semanticDetector.detectTriggers(
        message,
        config,
        maxTriggers
      );

      if (semanticTriggers.length > 0) {
        return semanticTriggers;
      }
    }

    // Fall back to regex detection
    return this.detectTriggersRegex(message, stance, config, maxTriggers);
  }
}
```

---

## Configuration

```typescript
// In ModeConfig
interface ModeConfig {
  // Existing
  enableAutoCommands: boolean;
  autoCommandThreshold: number;

  // New
  embeddingProvider: 'local' | 'ollama' | 'openai' | 'auto';  // default: 'auto'
  semanticTriggerThreshold: number;  // default: 0.65
}
```

---

## Package Dependencies

```json
{
  "dependencies": {
    "@xenova/transformers": "^2.17.0"
  }
}
```

**Note:** First run will download model (~23MB) to `~/.cache/huggingface/`.

---

## Performance Considerations

1. **Startup time**: Pre-computing intent embeddings adds ~1-2s on first load
2. **Model loading**: First embedding call loads model (~2-3s), cached after
3. **Inference**: ~10-50ms per embedding (fast enough for real-time)
4. **Caching**: Message embeddings cached to avoid re-computation

---

## Migration Path

1. **Phase 1**: Add embedding service with local provider
2. **Phase 2**: Add semantic triggers to existing commands (keep regex fallback)
3. **Phase 3**: Tune thresholds based on testing
4. **Phase 4**: Add more intent examples based on usage patterns
5. **Phase 5**: Optionally remove regex fallback once stable

---

## Testing

```typescript
describe('SemanticTriggerDetector', () => {
  it('should detect memory queries with paraphrases', async () => {
    const detector = new SemanticTriggerDetector(embeddingService);
    await detector.initialize(commands);

    const variations = [
      "what do you remember from before",
      "recall our earlier discussion",
      "you mentioned something about X",
      "bring up that thing we talked about",
      "from our previous chat"
    ];

    for (const message of variations) {
      const triggers = await detector.detectTriggers(message, config, 2);
      expect(triggers.some(t => t.command === 'memories')).toBe(true);
    }
  });
});
```

---

## Future Enhancements

1. **Memory search**: Use same embeddings for semantic memory retrieval
2. **Intent clustering**: Auto-discover new intents from conversation patterns
3. **Fine-tuning**: Train custom model on Metamorph-specific intents
4. **Hybrid scoring**: Combine semantic similarity with other signals (stance, context)
