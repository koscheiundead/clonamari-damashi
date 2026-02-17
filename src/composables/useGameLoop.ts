// --- main game loop ---
import { ref, onBeforeUnmount } from 'vue';
import type { Ref } from 'vue';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  applyInputForce,
  capLinearVelocity,
  capAngularVelocity,
  findCollidingCollectibles,
  stickItem,
  growKatamari,
} from '../gameLogic';
import type { KeyState, Collectible } from '../gameLogic';

/**
 * Composable for managing the game loop (the heart of the game)
 *
 * why?
 * - game loop is complex coordination of physics, input, and rendering
 * - separating it makes the flow crystal clear
 * - easy to add pause/resume functionality
 * - performance monitoring can be added here
 */
export function useGameLoop(
  // dependencies injected from parent
  world: Ref<CANNON.World | null>,
  katamariBody: Ref<CANNON.Body | null>,
  katamariMesh: Ref<THREE.Mesh | null>,
  keys: Ref<KeyState>,
  collectibles: Ref<Collectible[]>,
  katamariSize: Ref<number>,
  onCollect: () => void, // callback when item is collected
  renderFn: () => void, // threeJS render function
  updateCameraFn: () => void, // camera follow function
) {
  // store animation frame ID so we can cancel it on unmount
  // prevents game loop from running after component is destroyed
  const animationId = ref<number | null>(null);

  /**
   * main gain loop - runs ~60 times per second
   * phases:
   * 1. request next frame
   * 2. step physics simulation
   * 3. process player input
   * 4. check collisions
   * 5. update visual positions from physics
   *
   * - physics-first ensures consistent simulation
   * - input affects physics for next frame
   * - visuals updated last
   */
  function gameLoop() {
    // request next frame first (we stay in the loop, even if something errors)
    animationId.value = requestAnimationFrame(gameLoop);

    // --- physics simulation ---
    if (world.value) {
      world.value.fixedStep(); // step physics forward 1/60th of a second
    }

    // --- process input ---
    if (katamariBody.value) {
      // apply force based on keys pressed
      applyInputForce(keys.value, katamariBody.value);

      // cap velocities to prevent runaway speed
      capLinearVelocity(katamariBody.value);
      capAngularVelocity(katamariBody.value);
    }

    // --- check collisions ---
    if (katamariBody.value) {
      checkCollisions();
    }

    // --- update visuals ---
    // copy physics body/rotation to visual mesh, physics = source of truth
    if (katamariMesh.value && katamariBody.value) {
      katamariMesh.value.position.copy(katamariBody.value.position);
      katamariMesh.value.quaternion.copy(katamariBody.value.quaternion);
    }

    // --- update camera and render ---
    updateCameraFn();
    renderFn();
  }

  /**
   * checks for collisions between katamari and collectibles
   * 1. fid all items touching katamari
   * 2. for each touching item:
   * - stick it to katamari
   * - grow katamari
   * - increment counter
   */
  function checkCollisions() {
    if (!katamariBody.value || !katamariMesh.value || !world.value) return;

    // identify colliding items
    const collidingItems = findCollidingCollectibles(katamariBody.value, collectibles.value, katamariSize.value);

    // process each collision
    collidingItems.forEach((item) => {
      // stick item to katamari
      stickItem(item, katamariMesh.value!, world.value!, katamariSize.value);

      // grow katamari (0.05m at a time)
      const newSize = growKatamari(0.05, katamariSize.value, katamariMesh.value!, katamariBody.value!, collectibles.value);
      katamariSize.value = newSize;

      // notify parent component (for score update)
      onCollect();
    });
  }

  /**
   * starts game loop
   *
   * why separate from constructor? allow setting up dependencies first
   */
  function start() {
    if (animationId.value === null) gameLoop();
  }

  /**
   * stops game loop
   * pause, game over, component unmount
   */
  function stop() {
    if (animationId.value !== null) {
      cancelAnimationFrame(animationId.value);
      animationId.value = null;
    }
  }

  /**
   * cleanup on component unmount
   */
  onBeforeUnmount(() => {
    stop();
  });

  return {
    start,
    stop,
    gameLoop
  };
}
