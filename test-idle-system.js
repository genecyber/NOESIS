/**
 * Quick test runner for the Autonomous Idle Evolution System
 */

import { runQuickTest, demoSystemIntegration } from './dist/idle/test-integration.js';

async function main() {
  console.log('🤖 Autonomous Idle Evolution System - Quick Test\n');

  try {
    // Show integration demo first
    demoSystemIntegration();

    console.log('\n⏳ Running integration tests...\n');

    // Run the actual test
    await runQuickTest();

    console.log('\n✅ All tests completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Review the documentation in docs/');
    console.log('2. Integrate with existing METAMORPH systems');
    console.log('3. Configure safety parameters for your use case');
    console.log('4. Enable autonomous mode when ready');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nThis is expected during development. Check the implementation for any integration issues.');
  }
}

main().catch(console.error);