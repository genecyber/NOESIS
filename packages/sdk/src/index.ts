/**
 * METAMORPH Plugin SDK
 *
 * Create plugins for METAMORPH web UI and CLI.
 *
 * @example Web Plugin (React)
 * ```ts
 * import { defineWebPlugin, useAutoPlugin } from '@metamorph/plugin-sdk/web';
 *
 * const myPlugin = defineWebPlugin({
 *   manifest: {
 *     id: 'my-plugin',
 *     name: 'My Plugin',
 *     version: '1.0.0',
 *     description: 'Does something cool',
 *     capabilities: ['webcam'],
 *     permissions: ['emotion:read'],
 *   },
 *   panel: {
 *     id: 'my-panel',
 *     label: 'My Panel',
 *     icon: MyIcon,
 *     component: MyPanelComponent,
 *   },
 * });
 *
 * // In your app:
 * function App() {
 *   useAutoPlugin(myPlugin);
 *   return <MyApp />;
 * }
 * ```
 *
 * @example CLI Plugin (Node.js)
 * ```ts
 * import { defineCliPlugin, registerCliPlugin } from '@metamorph/plugin-sdk/cli';
 *
 * const myPlugin = defineCliPlugin({
 *   manifest: {
 *     id: 'my-plugin',
 *     name: 'My Plugin',
 *     version: '1.0.0',
 *     description: 'Enhances CLI',
 *     capabilities: ['storage'],
 *     permissions: ['stance:read', 'stance:write'],
 *   },
 *   operators: [
 *     {
 *       name: 'enhance',
 *       description: 'Enhance response',
 *       category: 'meta',
 *       triggers: ['creative_request'],
 *       intensity: { min: 0, max: 100, default: 50 },
 *       execute: (stance, ctx) => ({
 *         stanceModifications: { values: { ...stance.values, novelty: 80 } },
 *       }),
 *     },
 *   ],
 * });
 *
 * registerCliPlugin(myPlugin);
 * ```
 *
 * @example CDN Usage
 * ```html
 * <script src="https://unpkg.com/@metamorph/plugin-sdk/dist/umd/metamorph-sdk.min.js"></script>
 * <script>
 *   const { defineWebPlugin, webPluginRegistry } = MetamorphSDK;
 *   // Use the SDK...
 * </script>
 * ```
 *
 * @packageDocumentation
 */

// Core (platform-agnostic)
export * from './core/index.js';

// Detect environment and export appropriate module
// Note: For tree-shaking, use specific imports like '@metamorph/plugin-sdk/web'
