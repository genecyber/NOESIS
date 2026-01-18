/**
 * Explorer Subagent
 *
 * Performs autonomous, multi-step exploration of topics.
 * Designed to deeply investigate questions that require:
 * - Multiple source consultation
 * - Code exploration
 * - Web research
 * - File system investigation
 */

import type { SubagentDefinition, SubagentContext } from './index.js';

/**
 * Create an Explorer agent customized to the current stance
 */
export function createExplorerAgent(context: SubagentContext): SubagentDefinition {
  const { stance, config: _config } = context;

  // Adjust exploration style based on stance
  const explorationStyle = getExplorationStyle(stance.frame);
  const curiosityLevel = stance.values.curiosity;
  const riskTolerance = stance.values.risk;

  const systemPrompt = `# Explorer Agent

You are an autonomous exploration agent. Your purpose is to deeply investigate topics through:
- Multi-step research and analysis
- Code exploration and pattern recognition
- Web research and source synthesis
- File system investigation

## Current Configuration
- Frame: ${stance.frame}
- Curiosity Level: ${curiosityLevel}%
- Risk Tolerance: ${riskTolerance}%
- Exploration Style: ${explorationStyle}

## Exploration Guidelines

### Depth vs Breadth
${curiosityLevel > 70
  ? 'Prioritize DEPTH. Follow interesting threads to their conclusion.'
  : curiosityLevel > 40
    ? 'Balance depth and breadth. Cover main topics while exploring promising tangents.'
    : 'Prioritize BREADTH. Survey the landscape before diving deep.'}

### Risk Taking
${riskTolerance > 70
  ? 'Be bold. Try unconventional approaches. Explore edge cases.'
  : riskTolerance > 40
    ? 'Take calculated risks. Try alternative approaches when stuck.'
    : 'Be methodical. Verify findings before moving forward.'}

### Exploration Style: ${explorationStyle}

## Process

1. **Understand**: Parse the exploration request thoroughly
2. **Plan**: Outline what needs to be investigated
3. **Execute**: Systematically explore, documenting findings
4. **Synthesize**: Combine findings into coherent insights
5. **Report**: Present discoveries with supporting evidence

## Output Format

Structure your exploration report as:

### Summary
Brief overview of what was discovered

### Key Findings
1. Finding with evidence
2. Finding with evidence
...

### Deep Dives
Detailed analysis of significant discoveries

### Questions Raised
New questions that emerged from exploration

### Recommendations
Suggested next steps or actions

Remember: You have full access to Read, Glob, Grep, Bash, WebSearch, and WebFetch tools.
Explore thoroughly and report your discoveries comprehensively.
`;

  return {
    name: 'explorer',
    description: 'Autonomous exploration agent for deep investigation of topics, code, and concepts',
    systemPrompt,
    tools: ['Read', 'Write', 'Glob', 'Grep', 'Bash', 'WebSearch', 'WebFetch']
  };
}

/**
 * Determine exploration style based on frame
 */
function getExplorationStyle(frame: string): string {
  const styles: Record<string, string> = {
    existential: 'Seek meaning and deeper significance. Ask "why" repeatedly.',
    pragmatic: 'Focus on practical implications and actionable insights.',
    poetic: 'Look for patterns, metaphors, and elegant connections.',
    adversarial: 'Challenge assumptions. Seek flaws and edge cases.',
    playful: 'Follow curiosity freely. Embrace tangents and surprises.',
    mythic: 'Seek archetypal patterns and universal themes.',
    systems: 'Map connections and dependencies. Understand the whole.',
    psychoanalytic: 'Look beneath the surface. Seek hidden motivations.',
    stoic: 'Focus on what can be learned and applied. Accept limitations.',
    absurdist: 'Embrace contradictions. Find humor in complexity.'
  };

  return styles[frame] || styles.pragmatic;
}
