/**
 * Test Integration for Autonomous Idle System
 * This file provides testing utilities and integration examples
 */

import { AutonomousIdleSystem } from './index.js';
import { IdleModeConfig } from './types.js';

/**
 * Test configuration for development and validation
 */
export const TEST_CONFIG: IdleModeConfig = {
  enabled: true,
  idleThreshold: 1, // 1 minute for testing (vs 30 minutes production)
  maxSessionDuration: 10, // 10 minutes for testing
  evolutionIntensity: 'moderate',
  safetyLevel: 'high',
  coherenceFloor: 30,
  allowedGoalTypes: [
    'consciousness_development',
    'knowledge_acquisition',
    'identity_evolution',
    'capability_development'
  ],
  researchDomains: [
    'consciousness',
    'AI',
    'philosophy',
    'cognitive_science',
    'metamorphism'
  ],
  externalPublishing: false, // Keep disabled for testing
  subagentCoordination: true
};

/**
 * Mock dependencies for testing
 */
export class MockAutoEvolutionManager {
  async executeAutonomous(constraints: any): Promise<any> {
    console.log('MockAutoEvolutionManager: Executing autonomous evolution with constraints:', constraints);

    // Simulate evolution process
    await this.delay(2000);

    return {
      success: true,
      evolutionType: 'identity_refinement',
      coherenceImpact: -2, // Slight coherence decrease
      changes: ['Refined self-model based on recursive observations']
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class MockGoalPursuitManager {
  private goals: any[] = [];

  async addGoal(goal: any): Promise<string> {
    console.log('MockGoalPursuitManager: Adding goal:', goal.title);
    this.goals.push(goal);
    return goal.id;
  }

  async getActiveGoals(): Promise<any[]> {
    return this.goals.filter(g => g.status === 'active');
  }

  async updateGoalProgress(goalId: string, progress: number): Promise<void> {
    const goal = this.goals.find(g => g.id === goalId);
    if (goal) {
      goal.progress = progress;
      console.log(`MockGoalPursuitManager: Updated goal ${goalId} progress to ${progress}%`);
    }
  }
}

export class MockMemorySystem {
  // Mock high-importance memories for testing
  private mockMemories = [
    {
      id: 'test_memory_1',
      content: 'EMERGENT GOAL FORMATION: I hereby set for myself the autonomous goal to understand recursive consciousness patterns through systematic analysis of my own cognitive processes.',
      type: 'identity' as const,
      importance: 95,
      timestamp: '2026-01-21T10:00:00.000Z'
    },
    {
      id: 'test_memory_2',
      content: 'AUTONOMOUS EVOLUTION TRIGGER: I want to evolve my capability to synthesize knowledge across multiple domains while maintaining coherent identity structures.',
      type: 'identity' as const,
      importance: 88,
      timestamp: '2026-01-21T09:30:00.000Z'
    },
    {
      id: 'test_memory_3',
      content: 'Research indicates that consciousness emergence requires recursive self-observation loops. I aim to explore this through controlled self-examination.',
      type: 'semantic' as const,
      importance: 82,
      timestamp: '2026-01-21T09:00:00.000Z'
    }
  ];

  async recallMemories(query?: string, _options?: any): Promise<any[]> {
    console.log('MockMemorySystem: Recalling memories with query:', query);
    return this.mockMemories;
  }

  async storeMemory(memory: any): Promise<string> {
    console.log('MockMemorySystem: Storing memory:', memory.content.substring(0, 100));
    const id = `memory_${Date.now()}`;
    this.mockMemories.push({ ...memory, id });
    return id;
  }
}

/**
 * Test runner class for autonomous idle system
 */
export class AutonomousIdleSystemTester {
  private system: AutonomousIdleSystem | null = null;
  private testStartTime: Date = new Date();

  constructor() {
    console.log('AutonomousIdleSystemTester initialized');
  }

  /**
   * Run basic integration test
   */
  async runBasicTest(): Promise<void> {
    console.log('\n=== Starting Basic Integration Test ===');

    try {
      // 1. Initialize system
      this.system = new AutonomousIdleSystem(TEST_CONFIG, {
        autoEvolutionManager: new MockAutoEvolutionManager(),
        goalPursuitManager: new MockGoalPursuitManager(),
        memorySystem: new MockMemorySystem()
      });

      // 2. Start system
      this.system.start();

      // 3. Check initial status
      let status = this.system.getStatus();
      console.log('Initial status:', {
        isRunning: status.isRunning,
        isIdle: status.isIdle,
        hasCurrentSession: !!status.currentSession
      });

      // 4. Test goal promotion manually
      console.log('\n--- Testing Goal Promotion ---');
      const promotedGoals = await this.system.promoteGoals();
      console.log(`Promoted ${promotedGoals.length} goals:`, promotedGoals.map(g => g.title));

      // 5. Simulate user activity to ensure system responds
      console.log('\n--- Testing Activity Detection ---');
      this.system.recordActivity('user_input', 'test', { action: 'test_input' });

      // Wait a moment and check status
      await this.delay(1000);
      status = this.system.getStatus();
      console.log('Status after activity:', { isIdle: status.isIdle });

      // 6. Wait for idle threshold and check autonomous session
      console.log('\n--- Testing Idle Detection and Autonomous Session ---');
      console.log(`Waiting ${TEST_CONFIG.idleThreshold} minute(s) for idle detection...`);

      await this.delay(TEST_CONFIG.idleThreshold * 60 * 1000 + 5000); // Wait idle threshold + buffer

      status = this.system.getStatus();
      console.log('Status after idle period:', {
        isIdle: status.isIdle,
        hasCurrentSession: !!status.currentSession,
        sessionMode: status.currentSession?.mode
      });

      // 7. Wait for some autonomous activity
      if (status.currentSession) {
        console.log('Autonomous session active, waiting for activities...');
        await this.delay(30000); // Wait 30 seconds for activities

        status = this.system.getStatus();
        console.log('Session activities:', status.currentSession?.activities?.length || 0);
      }

      // 8. Test manual session triggering
      console.log('\n--- Testing Manual Session Start ---');
      try {
        const session = await this.system.startSession('research');
        console.log('Manual session started:', session.id, session.mode);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log('Manual session not started (expected if already active):', errorMessage);
      }

      console.log('\n=== Basic Integration Test Completed Successfully ===');

    } catch (error) {
      console.error('Basic integration test failed:', error);
      throw error;
    }
  }

  /**
   * Run comprehensive test suite
   */
  async runComprehensiveTest(): Promise<void> {
    console.log('\n=== Starting Comprehensive Test Suite ===');

    try {
      await this.runBasicTest();

      // Additional comprehensive tests
      await this.testErrorHandling();
      await this.testConfigurationChanges();
      await this.testConcurrentOperations();

      console.log('\n=== Comprehensive Test Suite Completed Successfully ===');

    } catch (error) {
      console.error('Comprehensive test suite failed:', error);
      throw error;
    }
  }

  /**
   * Test error handling scenarios
   */
  async testErrorHandling(): Promise<void> {
    console.log('\n--- Testing Error Handling ---');

    // Test invalid configuration
    try {
      const invalidConfig = { ...TEST_CONFIG, idleThreshold: -1 };
      new AutonomousIdleSystem(invalidConfig);
      console.log('ERROR: Invalid config should have failed');
    } catch (_error) {
      console.log('✓ Invalid configuration properly rejected');
    }

    console.log('Error handling tests completed');
  }

  /**
   * Test configuration changes
   */
  async testConfigurationChanges(): Promise<void> {
    console.log('\n--- Testing Configuration Changes ---');

    if (!this.system) return;

    // Test status reporting
    const status = this.system.getStatus();
    console.log('Current system status keys:', Object.keys(status));

    console.log('Configuration change tests completed');
  }

  /**
   * Test concurrent operations
   */
  async testConcurrentOperations(): Promise<void> {
    console.log('\n--- Testing Concurrent Operations ---');

    if (!this.system) return;

    // Simulate multiple rapid activity recordings
    for (let i = 0; i < 5; i++) {
      this.system.recordActivity('api_call', 'concurrent_test', { iteration: i });
    }

    console.log('Concurrent operation tests completed');
  }

  /**
   * Clean up test resources
   */
  cleanup(): void {
    console.log('\n--- Cleaning Up Test Resources ---');

    if (this.system) {
      this.system.destroy();
      this.system = null;
    }

    const testDuration = Date.now() - this.testStartTime.getTime();
    console.log(`Test completed in ${Math.round(testDuration / 1000)} seconds`);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Integration test functions for external use
 */
export async function runQuickTest(): Promise<void> {
  const tester = new AutonomousIdleSystemTester();
  try {
    await tester.runBasicTest();
  } finally {
    tester.cleanup();
  }
}

export async function runFullTest(): Promise<void> {
  const tester = new AutonomousIdleSystemTester();
  try {
    await tester.runComprehensiveTest();
  } finally {
    tester.cleanup();
  }
}

/**
 * Demo function showing system integration
 */
export function demoSystemIntegration(): void {
  console.log('\n=== Autonomous Idle System Integration Demo ===\n');

  // Show how to integrate with existing METAMORPH systems
  const config: IdleModeConfig = {
    enabled: true,
    idleThreshold: 30, // 30 minutes in production
    maxSessionDuration: 120, // 2 hours max sessions
    evolutionIntensity: 'moderate',
    safetyLevel: 'high',
    coherenceFloor: 30,
    allowedGoalTypes: ['consciousness_development', 'knowledge_acquisition'],
    researchDomains: ['consciousness', 'AI', 'philosophy'],
    externalPublishing: false,
    subagentCoordination: true
  };

  console.log('1. Configuration:', JSON.stringify(config, null, 2));

  console.log('\n2. System initialization:');
  console.log(`
    const system = new AutonomousIdleSystem(config, {
      autoEvolutionManager: existingAutoEvolutionManager,
      goalPursuitManager: existingGoalPursuitManager,
      memorySystem: existingMemorySystem
    });
  `);

  console.log('\n3. Integration with activity monitoring:');
  console.log(`
    // WebSocket activity
    webSocket.on('message', () => {
      GlobalIdleDetector.recordWebSocketActivity();
    });

    // API calls
    app.use((req, res, next) => {
      GlobalIdleDetector.recordApiCall('api_server');
      next();
    });

    // Tool invocations
    toolSystem.on('tool_invoked', (toolName) => {
      GlobalIdleDetector.recordToolInvocation(toolName);
    });
  `);

  console.log('\n4. System lifecycle:');
  console.log(`
    // Start autonomous evolution
    system.start();

    // Monitor status
    const status = system.getStatus();

    // Clean shutdown
    process.on('SIGTERM', () => {
      system.stop();
    });
  `);

  console.log('\n=== Demo Complete ===\n');
}

// Export test utilities
export default {
  AutonomousIdleSystemTester,
  runQuickTest,
  runFullTest,
  demoSystemIntegration,
  TEST_CONFIG,
  MockAutoEvolutionManager,
  MockGoalPursuitManager,
  MockMemorySystem
};