<script setup lang="ts">
/**
 * main game component - orchestrates all game systems
 *
 * architecture:
 *  this component is the "conductor" (doesn't do work itself)
 * it coordinates specialized composables that handle one concern each
 * - usePhysics: physics simulation (cannon.js)
 * - useThreeJS: 3D rendering (three.js)
 * - useCollectibles: item spawning and management
 * - useKeyboardInput: player controls
 * - useGameLoop: main game loop coordination
 */

import { ref, onMounted } from 'vue';
import { usePhysics } from '../composables/usePhysics';
import { useThreeJS } from '../composables/useThreeJs';
import { useCollectibles } from '../composables/useCollectibles';
import { useKeyboardInput } from '../composables/useKeyboardInput';
import { useGameLoop } from '../composables/useGameLoop';

// --- reactive state ---
const canvasContainer = ref<HTMLElement | null>(null); // reference to dom element where we'll attach the canvas
const katamariSize = ref(1.0); // current size of katamari (in meters)

// --- composables setup ---
// initialize each game system (dependency injection)
const physics = usePhysics();
const threeJS = useThreeJS(canvasContainer);
const collectiblesManager = useCollectibles(threeJS.scene, physics.world);
const input = useKeyboardInput();

// game loop depends on everything else being set up first, so set it up last
const gameLoop = useGameLoop(
  physics.world,
  physics.katamariBody,
  physics.katamariMesh,
  input.keys,
  collectiblesManager.collectibles,
  katamariSize,
  // callback when item is collected to keep composables decoupled
  () => {
    collectiblesManager.incrementCollectedCount();
  }
);

// --- event handlers ---
/**
 * handles respawn request from keyboard input
 * custom event: decouples input from game logic
 */
function handleRespawn() {
  collectiblesManager.respawnCollectibles();
}

// --- lifecycle ---
/**
 * initialize the game when the component mounts
 *
 * 1. physics world (foundational)
 * 2. three.js scene (visual representation)
 * 3. collectibles (game objects)
 * 4. input listeners (player interaction)
 * 5. respawn listener (game feature)
 * 6. game loop (ties everything together)
 */
onMounted(() => {
  physics.initPhysics() // initialize physics
  threeJS.initThreeJS(); // initialize 3d rendering
  collectiblesManager.spawnCollectibles(50); // spawn initial collectibles
  input.setupListeners(); // set up keyboard controls
  window.addEventListener('respawn-collectibles', handleRespawn); // listen for respawn events
  gameLoop.start(); // start the game loop last when everything's ready
});

/**
 * cleanup is automatically handled by composables' onBeforeUnmount hooks -- they tidy after themselves
 */
</script>

<template>
  <div class="game-container">
    <!-- ui layer, overlays 3d canvas with game info -->
    <div class="ui-layer">
      <h1>Katamari Prototype</h1>

      <div class="stats">
        <!-- current size and score display -->
        <p>Size: <strong>{{ katamariSize.toFixed(2) }} m</strong></p>
        <p>Items Collected: <strong>{{ collectiblesManager.collectedCount.value }}</strong></p>

        <!-- control instructions-->
        <p class="controls-hint">Use W, A, S, D to move</p>
        <p class="controls-hint">Press R to respawn items</p>
      </div>
    </div>

    <!-- canvas container -->
    <div ref="canvasContainer" class="canvas-container"></div>
  </div>
</template>

<style scoped>
.game-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.canvas-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0; /* right behind the UI layer */
}

.ui-layer {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10; /* above 3d canvas */
  padding: 20px;
  color: #333;
  pointer-events: none /* lets mouse clicks pass through to 3d canvas */
}

h1 {
  margin: 0 0 10px 0;
  font-family: sans-serif;
  text-shadow: 2px 2px 0px white; /* makes text readable on any background*/
}

.stats {
  background: rgba(255, 255, 255, 0.8);
  padding: 10px 20px;
  border-radius: 8px;
  font-family: monospace;
  font-size: 1.2rem;
  display: inline-block;
}

.stats p {
  margin: 5px 0;
}

.controls-hint {
  font-size: 0.9rem;
  opacity: 0.7; /* subtle hint text */
}
</style>
