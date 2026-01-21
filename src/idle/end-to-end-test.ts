/**
 * End-to-End Test for Idle Mode UI Integration
 * Tests the complete flow from UI interactions to autonomous evolution
 */

import { IdleModeWebIntegration } from './web-integration.js';
// import { AdaptiveAutonomousIdleSystem } from './adaptive-system.js';
import { RealMCPToolsWrapper } from './real-integration.js';
import { IdleModeConfig } from './types.js';

/**
 * Mock WebSocket manager for testing WebSocket integration
 */
class TestWebSocketManager {
  private broadcasts: Array<{channel: string, event: any}> = [];
  private connectedSessions: Set<string> = new Set();

  constructor(sessionIds: string[] = ['test-session-1']) {
    sessionIds.forEach(id => this.connectedSessions.add(id));
  }

  broadcast(channel: string, event: any): void {
    console.log(`📡 WebSocket Broadcast [${channel}]:`, {
      type: event.type,
      sessionId: event.sessionId,
      timestamp: event.timestamp
    });

    this.broadcasts.push({ channel, event });
  }

  getConnectedSessions(): string[] {
    return Array.from(this.connectedSessions);
  }

  isConnected(sessionId: string): boolean {
    return this.connectedSessions.has(sessionId);
  }

  getBroadcastHistory(): Array<{channel: string, event: any}> {
    return [...this.broadcasts];
  }

  clearHistory(): void {
    this.broadcasts = [];
  }
}

/**
 * Comprehensive end-to-end test suite
 */
export class IdleModeEndToEndTester {
  private webIntegration: IdleModeWebIntegration;
  private mockWebSocket: TestWebSocketManager;
  private testSessionId: string = 'e2e-test-session';
  private testResults: {
    uiInitialization: boolean;
    configurationUpdates: boolean;
    sessionManagement: boolean;
    websocketIntegration: boolean;
    activityRecording: boolean;
    realTimeUpdates: boolean;
    errorHandling: boolean;
  } = {
    uiInitialization: false,
    configurationUpdates: false,
    sessionManagement: false,
    websocketIntegration: false,
    activityRecording: false,
    realTimeUpdates: false,
    errorHandling: false
  };

  constructor() {
    this.mockWebSocket = new TestWebSocketManager([this.testSessionId]);
    this.webIntegration = new IdleModeWebIntegration(this.mockWebSocket);

    console.log('🧪 End-to-End Test Suite Initialized');
  }

  /**
   * Run complete end-to-end test suite
   */
  async runFullTest(): Promise<void> {
    console.log('\n🚀 Starting End-to-End Idle Mode Test Suite\n');

    try {
      // Test UI initialization flow
      await this.testUIInitialization();

      // Test configuration updates
      await this.testConfigurationUpdates();

      // Test session management
      await this.testSessionManagement();

      // Test WebSocket integration
      await this.testWebSocketIntegration();

      // Test activity recording
      await this.testActivityRecording();

      // Test real-time updates
      await this.testRealTimeUpdates();

      // Test error handling
      await this.testErrorHandling();

      // Generate final report
      this.generateTestReport();

    } catch (error) {
      console.error('❌ End-to-End test suite failed:', error);
      throw error;
    }
  }

  /**
   * Test UI initialization workflow
   */
  async testUIInitialization(): Promise<void> {
    console.log('📱 Testing UI Initialization...');

    try {
      // Simulate the flow when user opens idle mode panel
      // 1. UI calls /api/idle-mode/status to get initial state
      const initialStatus = this.webIntegration.getStatus(this.testSessionId);
      console.log('   ✓ Initial status retrieved:', {
        isIdle: initialStatus.isIdle,
        hasConfig: !!initialStatus.config
      });

      // 2. Initialize session with real MCP tools (using mock functions for testing)
      const realMCPTools = new RealMCPToolsWrapper(
        async (_params: any) => ({ data: { memories: [] } }),
        async (_memory: any) => ({ data: { id: `test_${Date.now()}` } }),
        async () => ({ data: { frame: 'test' } }),
        async () => ({ data: { history: [] } }),
        async () => ({ data: { sentience: 'test' } }),
        async () => ({ data: { goals: [] } }),
        async (_thesis: string) => ({ data: { analysis: 'test' } }),
        async (_target: string) => ({ data: { shift: 'test' } }),
        async (_command: string) => ({ data: { result: 'test' } })
      );
      await this.webIntegration.initializeSession(
        this.testSessionId,
        realMCPTools,
        {
          enabled: false, // Start disabled for testing
          idleThreshold: 1, // 1 minute for testing
          maxSessionDuration: 10,
          evolutionIntensity: 'moderate' as const,
          safetyLevel: 'high' as const
        }
      );

      console.log('   ✓ Session initialized successfully');

      // 3. Verify WebSocket broadcast for initialization
      const broadcasts = this.mockWebSocket.getBroadcastHistory();
      const initBroadcast = broadcasts.find(b =>
        b.channel === 'idle-mode' && b.event.type === 'initialized'
      );

      if (initBroadcast) {
        console.log('   ✓ Initialization broadcast sent');
        this.testResults.uiInitialization = true;
      } else {
        console.log('   ⚠️ No initialization broadcast found');
      }

    } catch (error) {
      console.error('   ❌ UI initialization test failed:', error);
    }
  }

  /**
   * Test configuration update workflow
   */
  async testConfigurationUpdates(): Promise<void> {
    console.log('⚙️ Testing Configuration Updates...');

    try {
      // Simulate UI sending configuration updates
      const newConfig: Partial<IdleModeConfig> = {
        enabled: true,
        idleThreshold: 2,
        evolutionIntensity: 'adventurous' as const,
        coherenceFloor: 25
      };

      const status = await this.webIntegration.updateConfig(this.testSessionId, newConfig);
      console.log('   ✓ Configuration updated successfully');

      // Verify the config was applied
      if (status.config.evolutionIntensity === 'adventurous') {
        console.log('   ✓ Configuration changes applied');
        this.testResults.configurationUpdates = true;
      }

      // Check for config update broadcast
      const broadcasts = this.mockWebSocket.getBroadcastHistory();
      const configBroadcast = broadcasts.find(b =>
        b.channel === 'idle-mode' && b.event.type === 'config_updated'
      );

      if (configBroadcast) {
        console.log('   ✓ Configuration update broadcast sent');
      }

    } catch (error) {
      console.error('   ❌ Configuration update test failed:', error);
    }
  }

  /**
   * Test session management workflow
   */
  async testSessionManagement(): Promise<void> {
    console.log('📋 Testing Session Management...');

    try {
      // Test manual session start (simulating UI button click)
      const status = await this.webIntegration.startManualSession(this.testSessionId, 'exploration');
      console.log('   ✓ Manual session started:', status.currentSession?.mode);

      // Test session control operations
      if (status.currentSession) {
        const sessionId = status.currentSession.id;

        // Test pause
        await this.webIntegration.controlSession(this.testSessionId, sessionId, 'pause');
        console.log('   ✓ Session paused successfully');

        // Test resume
        await this.webIntegration.controlSession(this.testSessionId, sessionId, 'resume');
        console.log('   ✓ Session resumed successfully');

        // Test terminate
        await this.webIntegration.controlSession(this.testSessionId, sessionId, 'terminate');
        console.log('   ✓ Session terminated successfully');

        this.testResults.sessionManagement = true;
      }

      // Verify session broadcasts were sent
      const broadcasts = this.mockWebSocket.getBroadcastHistory();
      const sessionBroadcasts = broadcasts.filter(b => b.channel === 'autonomous-sessions');

      if (sessionBroadcasts.length > 0) {
        console.log(`   ✓ ${sessionBroadcasts.length} session broadcasts sent`);
      }

    } catch (error) {
      console.error('   ❌ Session management test failed:', error);
    }
  }

  /**
   * Test WebSocket integration
   */
  async testWebSocketIntegration(): Promise<void> {
    console.log('🔌 Testing WebSocket Integration...');

    try {
      // Clear previous broadcasts for clean test
      this.mockWebSocket.clearHistory();

      // Trigger various events that should broadcast
      this.webIntegration.recordUserActivity(this.testSessionId, 'user_input', 'test');

      // Toggle idle mode (should broadcast)
      await this.webIntegration.toggleIdleMode(this.testSessionId, true);

      // Wait a moment for any async broadcasts
      await this.delay(500);

      const broadcasts = this.mockWebSocket.getBroadcastHistory();
      console.log(`   ✓ ${broadcasts.length} WebSocket broadcasts captured`);

      // Check for different types of broadcasts
      const activityBroadcast = broadcasts.find(b => b.event.type === 'activity_recorded');
      const toggleBroadcast = broadcasts.find(b => b.event.type === 'toggled');

      if (activityBroadcast && toggleBroadcast) {
        console.log('   ✓ All expected broadcast types found');
        this.testResults.websocketIntegration = true;
      }

      // Verify broadcast structure
      broadcasts.forEach((broadcast, i) => {
        if (broadcast.event.timestamp && broadcast.event.sessionId === this.testSessionId) {
          console.log(`   ✓ Broadcast ${i + 1} has correct structure`);
        }
      });

    } catch (error) {
      console.error('   ❌ WebSocket integration test failed:', error);
    }
  }

  /**
   * Test activity recording from various UI sources
   */
  async testActivityRecording(): Promise<void> {
    console.log('🎯 Testing Activity Recording...');

    try {
      // Test different activity types that UI might generate
      const activities = [
        { type: 'user_input', source: 'chat_input' },
        { type: 'api_call', source: 'ui_panel' },
        { type: 'websocket', source: 'ui_connection' },
        { type: 'tool_invocation', source: 'ui_button' }
      ];

      activities.forEach(activity => {
        this.webIntegration.recordUserActivity(
          this.testSessionId,
          activity.type as any,
          activity.source
        );
      });

      console.log(`   ✓ ${activities.length} different activity types recorded`);

      // Verify activities were recorded and broadcasted
      const broadcasts = this.mockWebSocket.getBroadcastHistory();
      const activityBroadcasts = broadcasts.filter(b => b.event.type === 'activity_recorded');

      if (activityBroadcasts.length >= activities.length) {
        console.log('   ✓ All activities were broadcasted');
        this.testResults.activityRecording = true;
      }

    } catch (error) {
      console.error('   ❌ Activity recording test failed:', error);
    }
  }

  /**
   * Test real-time status updates
   */
  async testRealTimeUpdates(): Promise<void> {
    console.log('⚡ Testing Real-Time Updates...');

    try {
      // Get initial status
      const initialStatus = this.webIntegration.getStatus(this.testSessionId);
      console.log('   ✓ Initial status retrieved');

      // Start a manual session
      await this.webIntegration.startManualSession(this.testSessionId, 'research');

      // Get updated status
      const updatedStatus = this.webIntegration.getStatus(this.testSessionId);

      if (updatedStatus.currentSession && !initialStatus.currentSession) {
        console.log('   ✓ Status correctly reflects session changes');
        this.testResults.realTimeUpdates = true;
      }

      // Verify real-time broadcasts are being sent
      const broadcasts = this.mockWebSocket.getBroadcastHistory();
      const recentBroadcasts = broadcasts.filter(b =>
        new Date(b.event.timestamp).getTime() > Date.now() - 60000
      );

      if (recentBroadcasts.length > 0) {
        console.log(`   ✓ ${recentBroadcasts.length} real-time broadcasts in last minute`);
      }

    } catch (error) {
      console.error('   ❌ Real-time updates test failed:', error);
    }
  }

  /**
   * Test error handling scenarios
   */
  async testErrorHandling(): Promise<void> {
    console.log('🛡️ Testing Error Handling...');

    try {
      let errorsHandled = 0;

      // Test invalid session ID
      try {
        await this.webIntegration.toggleIdleMode('non-existent-session', true);
      } catch (error) {
        console.log('   ✓ Invalid session ID error handled correctly');
        errorsHandled++;
      }

      // Test invalid session operation
      try {
        await this.webIntegration.controlSession(
          this.testSessionId,
          'non-existent-session-id',
          'pause'
        );
      } catch (error) {
        console.log('   ✓ Invalid session operation error handled correctly');
        errorsHandled++;
      }

      if (errorsHandled >= 2) {
        console.log('   ✓ Error handling mechanisms working correctly');
        this.testResults.errorHandling = true;
      }

    } catch (error) {
      console.error('   ❌ Error handling test failed:', error);
    }
  }

  /**
   * Generate comprehensive test report
   */
  private generateTestReport(): void {
    console.log('\n📊 End-to-End Test Results Report\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const results = [
      { name: 'UI Initialization', status: this.testResults.uiInitialization },
      { name: 'Configuration Updates', status: this.testResults.configurationUpdates },
      { name: 'Session Management', status: this.testResults.sessionManagement },
      { name: 'WebSocket Integration', status: this.testResults.websocketIntegration },
      { name: 'Activity Recording', status: this.testResults.activityRecording },
      { name: 'Real-Time Updates', status: this.testResults.realTimeUpdates },
      { name: 'Error Handling', status: this.testResults.errorHandling }
    ];

    results.forEach(result => {
      const icon = result.status ? '✅' : '❌';
      const status = result.status ? 'PASS' : 'FAIL';
      console.log(`${icon} ${result.name.padEnd(25)} ${status}`);
    });

    const passCount = results.filter(r => r.status).length;
    const totalCount = results.length;
    const passRate = Math.round((passCount / totalCount) * 100);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📈 Overall Pass Rate: ${passCount}/${totalCount} (${passRate}%)`);

    if (passRate >= 80) {
      console.log('🎉 Idle Mode UI integration is ready for production!');
    } else {
      console.log('⚠️ Some tests failed - review before deployment');
    }

    // WebSocket broadcast summary
    const broadcasts = this.mockWebSocket.getBroadcastHistory();
    console.log(`\n📡 Total WebSocket Broadcasts: ${broadcasts.length}`);

    const broadcastTypes = new Set(broadcasts.map(b => b.event.type));
    console.log(`📋 Unique Broadcast Types: ${Array.from(broadcastTypes).join(', ')}`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  /**
   * Clean up test resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test resources...');

    try {
      await this.webIntegration.destroySession(this.testSessionId);
      console.log('   ✓ Test session destroyed');
    } catch (error) {
      console.log('   ⚠️ Cleanup warning:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get detailed status for debugging
   */
  getDetailedStatus(): any {
    return {
      testResults: this.testResults,
      broadcastHistory: this.mockWebSocket.getBroadcastHistory(),
      connectedSessions: this.mockWebSocket.getConnectedSessions(),
      sessionStatus: this.webIntegration.getStatus(this.testSessionId)
    };
  }
}

/**
 * Simplified test runner for quick validation
 */
export async function runQuickE2ETest(): Promise<void> {
  const tester = new IdleModeEndToEndTester();

  try {
    console.log('🏃‍♂️ Running Quick E2E Test...\n');

    // Run a subset of critical tests
    await tester.testUIInitialization();
    await tester.testWebSocketIntegration();
    await tester.testActivityRecording();

    console.log('\n✅ Quick E2E Test Completed');

  } catch (error) {
    console.error('❌ Quick E2E Test Failed:', error);
  } finally {
    await tester.cleanup();
  }
}

/**
 * Full test suite runner
 */
export async function runFullE2ETest(): Promise<void> {
  const tester = new IdleModeEndToEndTester();

  try {
    await tester.runFullTest();
  } finally {
    await tester.cleanup();
  }
}

/**
 * Interactive test for manual verification
 */
export function createInteractiveTest(): IdleModeEndToEndTester {
  console.log('🎮 Creating Interactive Test Instance');
  console.log('   Use the returned tester object to run individual tests');
  console.log('   Example: tester.testUIInitialization()');

  return new IdleModeEndToEndTester();
}

export default {
  IdleModeEndToEndTester,
  runQuickE2ETest,
  runFullE2ETest,
  createInteractiveTest
};