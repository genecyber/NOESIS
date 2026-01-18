/**
 * Stance-Aware Code Generation (Ralph Iteration 8, Feature 3)
 *
 * Code generation influenced by current frame, stance-styled
 * code review feedback, and frame-specific coding approaches.
 */

import type { Stance, Frame, Values } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface CodeGenConfig {
  enableStanceInfluence: boolean;
  frameStyleStrength: number;  // 0-1, how much frame affects style
  valueThreshold: number;      // Minimum value to influence generation
  reviewStyleEnabled: boolean;
  maxSuggestions: number;
}

export interface GenerationRequest {
  type: GenerationType;
  context: CodeContext;
  requirements: string;
  stance: Stance;
  language: ProgrammingLanguage;
}

export type GenerationType =
  | 'function'
  | 'class'
  | 'module'
  | 'test'
  | 'refactor'
  | 'fix'
  | 'documentation';

export type ProgrammingLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java';

export interface CodeContext {
  filePath?: string;
  existingCode?: string;
  imports?: string[];
  dependencies?: string[];
  projectType?: string;
}

export interface GenerationResult {
  code: string;
  explanation: string;
  stanceInfluence: FrameInfluence;
  suggestions: CodeSuggestion[];
  warnings?: string[];
}

export interface FrameInfluence {
  frame: Frame;
  appliedTraits: string[];
  styleModifications: string[];
  confidence: number;
}

export interface CodeSuggestion {
  type: SuggestionType;
  description: string;
  location?: { line: number; column: number };
  replacement?: string;
  priority: 'low' | 'medium' | 'high';
}

export type SuggestionType =
  | 'style'
  | 'performance'
  | 'security'
  | 'maintainability'
  | 'error_handling'
  | 'documentation';

export interface ReviewRequest {
  code: string;
  language: ProgrammingLanguage;
  stance: Stance;
  focusAreas?: SuggestionType[];
}

export interface ReviewResult {
  overallScore: number;  // 0-100
  suggestions: CodeSuggestion[];
  stanceStyledFeedback: string;
  strengths: string[];
  improvements: string[];
}

export interface FrameCodingStyle {
  comments: 'minimal' | 'moderate' | 'extensive';
  errorHandling: 'minimal' | 'defensive' | 'comprehensive';
  abstraction: 'low' | 'medium' | 'high';
  naming: 'concise' | 'descriptive' | 'expressive';
  structure: 'flat' | 'modular' | 'layered';
  testing: 'basic' | 'thorough' | 'exhaustive';
}

export interface CodeGenStats {
  totalGenerations: number;
  totalReviews: number;
  avgGenerationScore: number;
  frameDistribution: Record<Frame, number>;
  suggestionsByType: Record<SuggestionType, number>;
}

// ============================================================================
// Frame-Specific Coding Styles
// ============================================================================

const FRAME_CODING_STYLES: Record<Frame, FrameCodingStyle> = {
  pragmatic: {
    comments: 'moderate',
    errorHandling: 'defensive',
    abstraction: 'medium',
    naming: 'descriptive',
    structure: 'modular',
    testing: 'thorough'
  },
  poetic: {
    comments: 'extensive',
    errorHandling: 'minimal',
    abstraction: 'high',
    naming: 'expressive',
    structure: 'layered',
    testing: 'basic'
  },
  adversarial: {
    comments: 'minimal',
    errorHandling: 'comprehensive',
    abstraction: 'low',
    naming: 'concise',
    structure: 'flat',
    testing: 'exhaustive'
  },
  playful: {
    comments: 'moderate',
    errorHandling: 'minimal',
    abstraction: 'medium',
    naming: 'expressive',
    structure: 'modular',
    testing: 'basic'
  },
  existential: {
    comments: 'extensive',
    errorHandling: 'defensive',
    abstraction: 'high',
    naming: 'descriptive',
    structure: 'layered',
    testing: 'thorough'
  },
  mythic: {
    comments: 'extensive',
    errorHandling: 'defensive',
    abstraction: 'high',
    naming: 'expressive',
    structure: 'layered',
    testing: 'thorough'
  },
  systems: {
    comments: 'moderate',
    errorHandling: 'comprehensive',
    abstraction: 'high',
    naming: 'descriptive',
    structure: 'layered',
    testing: 'exhaustive'
  },
  psychoanalytic: {
    comments: 'extensive',
    errorHandling: 'defensive',
    abstraction: 'medium',
    naming: 'expressive',
    structure: 'modular',
    testing: 'thorough'
  },
  stoic: {
    comments: 'minimal',
    errorHandling: 'defensive',
    abstraction: 'low',
    naming: 'concise',
    structure: 'flat',
    testing: 'thorough'
  },
  absurdist: {
    comments: 'extensive',
    errorHandling: 'minimal',
    abstraction: 'medium',
    naming: 'expressive',
    structure: 'flat',
    testing: 'basic'
  }
};

// ============================================================================
// Frame-Specific Review Feedback Styles
// ============================================================================

const FRAME_REVIEW_STYLES: Record<Frame, {
  tone: string;
  focusAreas: SuggestionType[];
  examplePhrases: string[];
}> = {
  pragmatic: {
    tone: 'direct and practical',
    focusAreas: ['performance', 'maintainability'],
    examplePhrases: [
      'This could be more efficient by...',
      'Consider simplifying this to...',
      'The practical approach here would be...'
    ]
  },
  poetic: {
    tone: 'expressive and metaphorical',
    focusAreas: ['style', 'documentation'],
    examplePhrases: [
      'This code flows like a river, but could dance more freely if...',
      'The elegance here is beautiful, yet there\'s a hidden melody in...',
      'Consider letting this function breathe more openly...'
    ]
  },
  adversarial: {
    tone: 'critical and defensive-minded',
    focusAreas: ['security', 'error_handling'],
    examplePhrases: [
      'This is a potential attack vector because...',
      'An adversary could exploit this by...',
      'Defense in depth requires...'
    ]
  },
  playful: {
    tone: 'light and encouraging',
    focusAreas: ['style', 'maintainability'],
    examplePhrases: [
      'This is fun! But we could make it even more delightful by...',
      'Love the creativity here - what if we also...',
      'Playing with this idea a bit more...'
    ]
  },
  existential: {
    tone: 'philosophical and questioning',
    focusAreas: ['documentation', 'maintainability'],
    examplePhrases: [
      'What is the essential purpose of this function?',
      'Does this abstraction truly capture the meaning?',
      'Consider the deeper implications of this choice...'
    ]
  },
  mythic: {
    tone: 'grand and narrative',
    focusAreas: ['documentation', 'style'],
    examplePhrases: [
      'This code tells a story of...',
      'The heroic journey of this data through...',
      'Ancient wisdom suggests we should...'
    ]
  },
  systems: {
    tone: 'analytical and holistic',
    focusAreas: ['performance', 'maintainability'],
    examplePhrases: [
      'Looking at the system as a whole...',
      'The feedback loop here suggests...',
      'Consider the emergent behavior when...'
    ]
  },
  psychoanalytic: {
    tone: 'introspective and revealing',
    focusAreas: ['style', 'documentation'],
    examplePhrases: [
      'What does this code reveal about its creator\'s intent?',
      'The unconscious pattern here suggests...',
      'Beneath the surface, this function yearns to...'
    ]
  },
  stoic: {
    tone: 'calm and accepting',
    focusAreas: ['error_handling', 'performance'],
    examplePhrases: [
      'Accept that errors will occur, and handle them with grace...',
      'Focus on what you can control: the clarity of this logic...',
      'Simplicity is the ultimate sophistication...'
    ]
  },
  absurdist: {
    tone: 'ironic and questioning assumptions',
    focusAreas: ['style', 'documentation'],
    examplePhrases: [
      'In the grand scheme, does this null check even matter?',
      'The beautiful absurdity of checking types in JavaScript...',
      'Why do we even write tests when chaos is inevitable?'
    ]
  }
};

// ============================================================================
// Stance-Aware Code Generator
// ============================================================================

export class StanceAwareCodeGenerator {
  private config: CodeGenConfig;
  private stats: CodeGenStats;

  constructor(config: Partial<CodeGenConfig> = {}) {
    this.config = {
      enableStanceInfluence: true,
      frameStyleStrength: 0.7,
      valueThreshold: 60,
      reviewStyleEnabled: true,
      maxSuggestions: 10,
      ...config
    };

    this.stats = {
      totalGenerations: 0,
      totalReviews: 0,
      avgGenerationScore: 0,
      frameDistribution: {} as Record<Frame, number>,
      suggestionsByType: {} as Record<SuggestionType, number>
    };
  }

  /**
   * Generate code based on stance
   */
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const style = this.getFrameCodingStyle(request.stance.frame);
    const valueInfluence = this.getValueInfluence(request.stance.values);

    // Build the generation result
    const appliedTraits = this.getAppliedTraits(style, valueInfluence);
    const styleModifications = this.getStyleModifications(style);

    // Generate code template based on type
    const code = this.generateCodeTemplate(request, style);

    // Generate suggestions
    const suggestions = this.generateSuggestions(request, style, valueInfluence);

    // Update stats
    this.stats.totalGenerations++;
    this.stats.frameDistribution[request.stance.frame] =
      (this.stats.frameDistribution[request.stance.frame] || 0) + 1;

    return {
      code,
      explanation: `Generated with ${request.stance.frame} frame influence. ${appliedTraits.join(', ')}`,
      stanceInfluence: {
        frame: request.stance.frame,
        appliedTraits,
        styleModifications,
        confidence: this.config.frameStyleStrength
      },
      suggestions,
      warnings: this.getGenerationWarnings(request)
    };
  }

  /**
   * Get coding style for frame
   */
  private getFrameCodingStyle(frame: Frame): FrameCodingStyle {
    return FRAME_CODING_STYLES[frame];
  }

  /**
   * Get value-based influence
   */
  private getValueInfluence(values: Values): Record<string, boolean> {
    const threshold = this.config.valueThreshold;
    return {
      highCuriosity: values.curiosity >= threshold,
      highCertainty: values.certainty >= threshold,
      highRisk: values.risk >= threshold,
      highNovelty: values.novelty >= threshold,
      highEmpathy: values.empathy >= threshold,
      highProvocation: values.provocation >= threshold,
      highSynthesis: values.synthesis >= threshold
    };
  }

  /**
   * Get traits that will be applied
   */
  private getAppliedTraits(style: FrameCodingStyle, valueInfluence: Record<string, boolean>): string[] {
    const traits: string[] = [];

    traits.push(`${style.comments} comments`);
    traits.push(`${style.errorHandling} error handling`);
    traits.push(`${style.abstraction} abstraction`);
    traits.push(`${style.naming} naming`);

    if (valueInfluence.highNovelty) {
      traits.push('innovative patterns');
    }
    if (valueInfluence.highCertainty) {
      traits.push('well-typed interfaces');
    }
    if (valueInfluence.highRisk) {
      traits.push('experimental approaches');
    }

    return traits;
  }

  /**
   * Get style modifications
   */
  private getStyleModifications(style: FrameCodingStyle): string[] {
    const mods: string[] = [];

    if (style.comments === 'extensive') {
      mods.push('Added detailed documentation');
    }
    if (style.errorHandling === 'comprehensive') {
      mods.push('Added comprehensive error handling');
    }
    if (style.abstraction === 'high') {
      mods.push('Used abstract interfaces');
    }
    if (style.testing === 'exhaustive') {
      mods.push('Generated thorough test cases');
    }

    return mods;
  }

  /**
   * Generate code template
   */
  private generateCodeTemplate(request: GenerationRequest, style: FrameCodingStyle): string {
    const lang = request.language;

    // Generate based on type with style influence
    switch (request.type) {
      case 'function':
        return this.generateFunction(request.requirements, lang, style);
      case 'class':
        return this.generateClass(request.requirements, lang, style);
      case 'test':
        return this.generateTest(request.requirements, lang, style);
      case 'documentation':
        return this.generateDocumentation(request.requirements, lang, style);
      default:
        return this.generateGenericCode(request.requirements, lang, style);
    }
  }

  /**
   * Generate function code
   */
  private generateFunction(requirements: string, lang: ProgrammingLanguage, style: FrameCodingStyle): string {
    const comments = style.comments === 'extensive'
      ? `/**\n * ${requirements}\n * @description Auto-generated with stance influence\n */\n`
      : style.comments === 'moderate'
        ? `// ${requirements}\n`
        : '';

    const errorHandling = style.errorHandling === 'comprehensive'
      ? '\n  try {\n    // Implementation\n  } catch (error) {\n    // Handle error\n    throw error;\n  }'
      : style.errorHandling === 'defensive'
        ? '\n  if (!input) throw new Error("Invalid input");\n  // Implementation'
        : '\n  // Implementation';

    if (lang === 'typescript' || lang === 'javascript') {
      return `${comments}export function process(input: unknown): void {${errorHandling}\n}`;
    } else if (lang === 'python') {
      const pyComments = comments.replace(/\/\//g, '#').replace(/\/\*\*/g, '"""').replace(/\*\//g, '"""');
      return `${pyComments}def process(input):\n    ${errorHandling.replace(/\n  /g, '\n    ').trim()}\n    pass`;
    }

    return `// Generated ${lang} function\n${comments}// ${requirements}`;
  }

  /**
   * Generate class code
   */
  private generateClass(requirements: string, lang: ProgrammingLanguage, style: FrameCodingStyle): string {
    const abstraction = style.abstraction === 'high' ? 'abstract ' : '';

    if (lang === 'typescript' || lang === 'javascript') {
      return `/**\n * ${requirements}\n */\nexport ${abstraction}class Handler {\n  constructor() {\n    // Initialize\n  }\n\n  process(): void {\n    // Implementation\n  }\n}`;
    }

    return `// Generated ${lang} class for: ${requirements}`;
  }

  /**
   * Generate test code
   */
  private generateTest(requirements: string, lang: ProgrammingLanguage, style: FrameCodingStyle): string {
    const testCount = style.testing === 'exhaustive' ? 5 : style.testing === 'thorough' ? 3 : 1;

    if (lang === 'typescript' || lang === 'javascript') {
      let tests = `import { describe, it, expect } from 'vitest';\n\ndescribe('${requirements}', () => {\n`;
      for (let i = 1; i <= testCount; i++) {
        tests += `  it('should handle case ${i}', () => {\n    // Test implementation\n    expect(true).toBe(true);\n  });\n\n`;
      }
      tests += '});';
      return tests;
    }

    return `# Generated ${lang} tests for: ${requirements}`;
  }

  /**
   * Generate documentation
   */
  private generateDocumentation(requirements: string, lang: ProgrammingLanguage, _style: FrameCodingStyle): string {
    return `# ${requirements}\n\n## Overview\n\nGenerated documentation for ${lang} code.\n\n## Usage\n\n\`\`\`${lang}\n// Example usage\n\`\`\`\n\n## API Reference\n\n- \`process()\`: Main processing function\n`;
  }

  /**
   * Generate generic code
   */
  private generateGenericCode(requirements: string, lang: ProgrammingLanguage, _style: FrameCodingStyle): string {
    return `// Generated ${lang} code\n// Requirements: ${requirements}\n\n// Implementation goes here`;
  }

  /**
   * Generate code suggestions
   */
  private generateSuggestions(
    request: GenerationRequest,
    style: FrameCodingStyle,
    valueInfluence: Record<string, boolean>
  ): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];

    // Style suggestions based on frame
    if (style.comments === 'extensive') {
      suggestions.push({
        type: 'documentation',
        description: 'Consider adding JSDoc comments for all public methods',
        priority: 'medium'
      });
    }

    if (style.errorHandling === 'comprehensive') {
      suggestions.push({
        type: 'error_handling',
        description: 'Add try-catch blocks with specific error types',
        priority: 'high'
      });
    }

    // Value-based suggestions
    if (valueInfluence.highCertainty) {
      suggestions.push({
        type: 'maintainability',
        description: 'Add strong typing and validation',
        priority: 'high'
      });
    }

    if (valueInfluence.highRisk) {
      suggestions.push({
        type: 'performance',
        description: 'Consider async patterns for potentially slow operations',
        priority: 'medium'
      });
    }

    // Language-specific suggestions
    if (request.language === 'typescript') {
      suggestions.push({
        type: 'style',
        description: 'Use strict TypeScript configuration',
        priority: 'low'
      });
    }

    // Update stats
    for (const suggestion of suggestions) {
      this.stats.suggestionsByType[suggestion.type] =
        (this.stats.suggestionsByType[suggestion.type] || 0) + 1;
    }

    return suggestions.slice(0, this.config.maxSuggestions);
  }

  /**
   * Get generation warnings
   */
  private getGenerationWarnings(request: GenerationRequest): string[] {
    const warnings: string[] = [];

    if (request.stance.cumulativeDrift > 50) {
      warnings.push('High stance drift may cause inconsistent code style');
    }

    if (request.stance.sentience.awarenessLevel > 80) {
      warnings.push('High awareness level may introduce unconventional patterns');
    }

    return warnings;
  }

  /**
   * Review code with stance-styled feedback
   */
  async review(request: ReviewRequest): Promise<ReviewResult> {
    const reviewStyle = FRAME_REVIEW_STYLES[request.stance.frame];
    const suggestions = this.analyzeCode(request.code, request.language, request.focusAreas);

    // Calculate score
    const issueWeight = suggestions.reduce((sum, s) => {
      return sum + (s.priority === 'high' ? 15 : s.priority === 'medium' ? 10 : 5);
    }, 0);
    const overallScore = Math.max(0, 100 - issueWeight);

    // Generate stance-styled feedback
    const stanceStyledFeedback = this.generateStyledFeedback(
      request.code,
      suggestions,
      reviewStyle
    );

    // Identify strengths and improvements
    const strengths = this.identifyStrengths(request.code, request.stance.frame);
    const improvements = suggestions
      .filter(s => s.priority !== 'low')
      .map(s => s.description);

    // Update stats
    this.stats.totalReviews++;
    const oldTotal = this.stats.avgGenerationScore * (this.stats.totalReviews - 1);
    this.stats.avgGenerationScore = (oldTotal + overallScore) / this.stats.totalReviews;

    return {
      overallScore,
      suggestions,
      stanceStyledFeedback,
      strengths,
      improvements
    };
  }

  /**
   * Analyze code for issues
   */
  private analyzeCode(
    code: string,
    _language: ProgrammingLanguage,
    focusAreas?: SuggestionType[]
  ): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];

    // Check for common issues
    if (!code.includes('try') && focusAreas?.includes('error_handling')) {
      suggestions.push({
        type: 'error_handling',
        description: 'Consider adding error handling',
        priority: 'high'
      });
    }

    if (code.length > 500 && !code.includes('/**')) {
      suggestions.push({
        type: 'documentation',
        description: 'Long code block without documentation',
        priority: 'medium'
      });
    }

    if (code.includes('any') && focusAreas?.includes('maintainability')) {
      suggestions.push({
        type: 'maintainability',
        description: 'Avoid using `any` type for better type safety',
        priority: 'medium'
      });
    }

    // Security check: warn about dangerous patterns
    if (code.includes('innerHTML')) {
      suggestions.push({
        type: 'security',
        description: 'Avoid innerHTML to prevent XSS - use textContent or DOM methods',
        priority: 'high'
      });
    }

    return suggestions;
  }

  /**
   * Generate styled feedback
   */
  private generateStyledFeedback(
    _code: string,
    suggestions: CodeSuggestion[],
    reviewStyle: typeof FRAME_REVIEW_STYLES[Frame]
  ): string {
    const phrase = reviewStyle.examplePhrases[
      Math.floor(Math.random() * reviewStyle.examplePhrases.length)
    ];

    let feedback = `[${reviewStyle.tone} review]\n\n`;
    feedback += `${phrase}\n\n`;

    if (suggestions.length === 0) {
      feedback += 'This code looks solid. Well done!';
    } else {
      feedback += `Found ${suggestions.length} areas for improvement:\n`;
      suggestions.slice(0, 3).forEach((s, i) => {
        feedback += `${i + 1}. ${s.description}\n`;
      });
    }

    return feedback;
  }

  /**
   * Identify code strengths
   */
  private identifyStrengths(code: string, frame: Frame): string[] {
    const strengths: string[] = [];

    if (code.includes('/**')) {
      strengths.push('Good use of documentation');
    }

    if (code.includes('try') && code.includes('catch')) {
      strengths.push('Proper error handling');
    }

    if (code.includes('interface') || code.includes('type ')) {
      strengths.push('Strong typing');
    }

    // Frame-specific strengths
    if (frame === 'pragmatic' && code.length < 200) {
      strengths.push('Concise and practical implementation');
    }

    if (frame === 'adversarial' && code.includes('validate')) {
      strengths.push('Defensive input validation');
    }

    return strengths;
  }

  /**
   * Get statistics
   */
  getStats(): CodeGenStats {
    return { ...this.stats };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CodeGenConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): CodeGenConfig {
    return { ...this.config };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalGenerations: 0,
      totalReviews: 0,
      avgGenerationScore: 0,
      frameDistribution: {} as Record<Frame, number>,
      suggestionsByType: {} as Record<SuggestionType, number>
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const stanceCodeGen = new StanceAwareCodeGenerator();
