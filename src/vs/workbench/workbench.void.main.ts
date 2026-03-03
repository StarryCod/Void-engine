/*---------------------------------------------------------------------------------------------
 *  Void Engine product entrypoint
 *--------------------------------------------------------------------------------------------*/

/**
 * Dedicated product entrypoint for Void profile.
 * It currently reuses `workbench.common.main` where the product whitelist is applied.
 * Keeping this file allows build-time switching without touching common entrypoints again.
 */
import './workbench.common.main.js';

