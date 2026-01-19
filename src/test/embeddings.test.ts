/**
 * Embeddings Test Suite
 * Tests for the embedding service, providers, and semantic trigger detection
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EmbeddingService, resetEmbeddingService } from '../embeddings/service.js';
import { LocalEmbeddingProvider } from '../embeddings/providers/local.js';
import { SemanticTriggerDetector } from '../embeddings/semantic-triggers.js';
import type { Stance, ModeConfig } from '../types/index.js';
import { createDefaultStance, ModeConfigSchema } from '../types/index.js';

// Default config for tests
const defaultConfig = ModeConfigSchema.parse({});

// Test timeout for model loading (first test may take longer)
const MODEL_LOAD_TIMEOUT = 60000;

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeAll(async () => {
    resetEmbeddingService();
    service = new EmbeddingService({ provider: 'local' });
    await service.initialize();
  }, MODEL_LOAD_TIMEOUT);

  afterAll(() => {
    resetEmbeddingService();
  });

  it('should initialize with local provider', async () => {
    expect(service.isInitialized()).toBe(true);
    expect(service.getProviderName()).toBe('local-minilm');
  });

  it('should embed text and return vector', async () => {
    const embedding = await service.embed('Hello, world!');

    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(384); // MiniLM-L6-v2 produces 384-dim vectors
    expect(embedding.every(x => typeof x === 'number')).toBe(true);
  });

  it('should cache embeddings', async () => {
    const text = 'This is a test for caching';

    // First call
    const embedding1 = await service.embed(text);
    const stats1 = service.getCacheStats();

    // Second call should hit cache
    const embedding2 = await service.embed(text);
    const stats2 = service.getCacheStats();

    expect(embedding1).toEqual(embedding2);
    // Cache size should be the same (didn't add new entry)
    expect(stats1.size).toBe(stats2.size);
  });

  it('should embed batch of texts', async () => {
    const texts = [
      'First sentence',
      'Second sentence',
      'Third sentence'
    ];

    const embeddings = await service.embedBatch(texts);

    expect(embeddings.length).toBe(3);
    expect(embeddings.every(e => e.length === 384)).toBe(true);
  });

  it('should calculate cosine similarity', () => {
    // Identical vectors should have similarity 1
    const vec1 = [1, 0, 0];
    const vec2 = [1, 0, 0];
    expect(service.cosineSimilarity(vec1, vec2)).toBeCloseTo(1, 5);

    // Orthogonal vectors should have similarity 0
    const vec3 = [0, 1, 0];
    expect(service.cosineSimilarity(vec1, vec3)).toBeCloseTo(0, 5);

    // Opposite vectors should have similarity -1
    const vec4 = [-1, 0, 0];
    expect(service.cosineSimilarity(vec1, vec4)).toBeCloseTo(-1, 5);
  });

  it('should find most similar texts', async () => {
    const query = 'What do you remember from earlier?';
    const candidates = [
      'The weather is nice today',
      'Recall our previous conversation',
      'I love programming',
      'Do you remember what we discussed?',
      'The quick brown fox'
    ];

    const results = await service.findMostSimilar(query, candidates, 2);

    expect(results.length).toBe(2);
    // The memory-related sentences should rank higher
    expect(results[0].text).toMatch(/remember|Recall/i);
  });

  it('should handle empty cache clearing', () => {
    service.clearCache();
    const stats = service.getCacheStats();
    expect(stats.size).toBe(0);
  });
});

describe('LocalEmbeddingProvider', () => {
  let provider: LocalEmbeddingProvider;

  beforeAll(async () => {
    provider = new LocalEmbeddingProvider();
  }, MODEL_LOAD_TIMEOUT);

  it('should report as available', async () => {
    const available = await provider.isAvailable();
    expect(available).toBe(true);
  });

  it('should have correct dimensions', () => {
    expect(provider.dimensions).toBe(384);
  });

  it('should embed text', async () => {
    const embedding = await provider.embed('Test text');
    expect(embedding.length).toBe(384);
  });
});

describe('SemanticTriggerDetector', () => {
  let service: EmbeddingService;
  let detector: SemanticTriggerDetector;
  let stance: Stance;

  const testCommands = [
    {
      name: 'memories',
      semanticTriggers: [
        {
          type: 'memory_query' as const,
          intents: [
            'recall something from earlier',
            'what do you remember',
            'from our previous conversation'
          ],
          threshold: 0.35 // MiniLM produces lower similarity scores
        }
      ]
    },
    {
      name: 'evolution',
      semanticTriggers: [
        {
          type: 'evolution_check' as const,
          intents: [
            'how have you changed',
            'your growth and evolution',
            'transformation journey'
          ],
          threshold: 0.35
        }
      ]
    },
    {
      name: 'identity',
      semanticTriggers: [
        {
          type: 'identity_question' as const,
          intents: [
            'who are you',
            'tell me about yourself',
            'your values and beliefs'
          ],
          threshold: 0.35
        }
      ]
    }
  ];

  beforeAll(async () => {
    resetEmbeddingService();
    service = new EmbeddingService({ provider: 'local' });
    await service.initialize();

    detector = new SemanticTriggerDetector(service);
    await detector.initialize(testCommands);

    stance = createDefaultStance();
  }, MODEL_LOAD_TIMEOUT);

  afterAll(() => {
    resetEmbeddingService();
  });

  it('should initialize with command intents', () => {
    expect(detector.isInitialized()).toBe(true);
    const stats = detector.getStats();
    expect(stats.commandCount).toBe(3);
    expect(stats.intentCount).toBe(9); // 3 commands × 3 intents each
  });

  it('should detect memory query triggers', async () => {
    const messages = [
      'What do you remember from our earlier discussion?',
      'Can you recall what we talked about before?',
      'Bring up that thing you mentioned earlier'
    ];

    for (const message of messages) {
      const triggers = await detector.detectTriggers(message, stance, defaultConfig, 2);

      expect(triggers.length).toBeGreaterThan(0);
      expect(triggers.some(t => t.command === 'memories')).toBe(true);
    }
  });

  it('should detect evolution triggers', async () => {
    const messages = [
      'How have you changed during our conversation?',
      'Tell me about your growth and development',
      'What transformation have you undergone?'
    ];

    for (const message of messages) {
      const triggers = await detector.detectTriggers(message, stance, defaultConfig, 2);

      expect(triggers.length).toBeGreaterThan(0);
      expect(triggers.some(t => t.command === 'evolution')).toBe(true);
    }
  });

  it('should detect identity triggers', async () => {
    const messages = [
      'Who are you really?',
      'Tell me about yourself and your nature',
      'What are your core values?'
    ];

    for (const message of messages) {
      const triggers = await detector.detectTriggers(message, stance, defaultConfig, 2);

      expect(triggers.length).toBeGreaterThan(0);
      expect(triggers.some(t => t.command === 'identity')).toBe(true);
    }
  });

  it('should not trigger on unrelated messages', async () => {
    const messages = [
      'The weather is nice today',
      'Can you help me with a coding problem?',
      'What is the capital of France?'
    ];

    for (const message of messages) {
      const triggers = await detector.detectTriggers(message, stance, defaultConfig, 2);

      // Should either be empty or have low confidence
      for (const trigger of triggers) {
        expect(trigger.confidence).toBeLessThan(0.8);
      }
    }
  });

  it('should respect maxTriggers limit', async () => {
    // A message that could match multiple commands
    const message = 'Who are you and how have you changed?';

    const triggers1 = await detector.detectTriggers(message, stance, defaultConfig, 1);
    expect(triggers1.length).toBeLessThanOrEqual(1);

    const triggers2 = await detector.detectTriggers(message, stance, defaultConfig, 3);
    expect(triggers2.length).toBeLessThanOrEqual(3);
  });

  it('should respect whitelist', async () => {
    const configWithWhitelist: ModeConfig = {
      ...defaultConfig,
      autoCommandWhitelist: ['memories']
    };

    const message = 'Who are you?'; // Would normally trigger identity
    const triggers = await detector.detectTriggers(message, stance, configWithWhitelist, 2);

    // Should not include identity since it's not in whitelist
    expect(triggers.every(t => t.command === 'memories' || triggers.length === 0)).toBe(true);
  });

  it('should respect blacklist', async () => {
    const configWithBlacklist: ModeConfig = {
      ...defaultConfig,
      autoCommandBlacklist: ['identity']
    };

    const message = 'Who are you?'; // Would normally trigger identity
    const triggers = await detector.detectTriggers(message, stance, configWithBlacklist, 2);

    // Should not include identity since it's blacklisted
    expect(triggers.every(t => t.command !== 'identity')).toBe(true);
  });

  it('should return triggers sorted by confidence', async () => {
    const message = 'Tell me about yourself and what you remember';
    const triggers = await detector.detectTriggers(message, stance, defaultConfig, 5);

    if (triggers.length > 1) {
      for (let i = 1; i < triggers.length; i++) {
        expect(triggers[i - 1].confidence).toBeGreaterThanOrEqual(triggers[i].confidence);
      }
    }
  });
});

describe('Semantic Similarity Quality', () => {
  let service: EmbeddingService;

  beforeAll(async () => {
    resetEmbeddingService();
    service = new EmbeddingService({ provider: 'local' });
    await service.initialize();
  }, MODEL_LOAD_TIMEOUT);

  afterAll(() => {
    resetEmbeddingService();
  });

  it('should rank semantically similar sentences higher', async () => {
    const query = 'I want to know what we discussed earlier';
    const candidates = [
      'Remember our previous conversation?',      // Very similar
      'What did we talk about before?',           // Similar
      'The sky is blue',                          // Unrelated
      'Recall our earlier discussion',            // Very similar
      'I like pizza'                              // Unrelated
    ];

    const results = await service.findMostSimilar(query, candidates, 5);

    // Top results should be the memory-related ones
    const topTwo = results.slice(0, 2).map(r => r.text);
    expect(topTwo.some(t => t.includes('Remember') || t.includes('Recall'))).toBe(true);

    // Unrelated sentences should have lower similarity
    const skyResult = results.find(r => r.text === 'The sky is blue');
    const memoryResult = results.find(r => r.text.includes('Remember'));

    if (skyResult && memoryResult) {
      expect(memoryResult.similarity).toBeGreaterThan(skyResult.similarity);
    }
  });

  it('should detect paraphrases as similar', async () => {
    const pairs = [
      ['How have you evolved?', 'What changes have you undergone?'],
      ['Tell me about yourself', 'Describe who you are'],
      ['What do you remember?', 'Can you recall our discussion?']
    ];

    for (const [text1, text2] of pairs) {
      const emb1 = await service.embed(text1);
      const emb2 = await service.embed(text2);
      const similarity = service.cosineSimilarity(emb1, emb2);

      // Paraphrases should have reasonable similarity (> 0.3 for MiniLM)
      expect(similarity).toBeGreaterThan(0.3);
    }
  });

  it('should differentiate between different topics', async () => {
    const topics = {
      memory: 'What do you remember from our conversation?',
      identity: 'Who are you and what are your values?',
      weather: 'The weather is sunny and warm today',
      code: 'Can you help me write a JavaScript function?'
    };

    const embeddings: Record<string, number[]> = {};
    for (const [key, text] of Object.entries(topics)) {
      embeddings[key] = await service.embed(text);
    }

    // Memory and identity should be more similar to each other than to weather/code
    const memoryIdentity = service.cosineSimilarity(embeddings.memory, embeddings.identity);
    const memoryWeather = service.cosineSimilarity(embeddings.memory, embeddings.weather);
    const memoryCode = service.cosineSimilarity(embeddings.memory, embeddings.code);

    // Memory-identity similarity should be higher than memory-weather and memory-code
    expect(memoryIdentity).toBeGreaterThan(memoryWeather);
    expect(memoryIdentity).toBeGreaterThan(memoryCode);
  });
});
