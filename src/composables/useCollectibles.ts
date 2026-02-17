// --- item management ---
import { shallowRef, ref } from 'vue';
import type { Ref } from 'vue';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { Collectible } from '../gameLogic';

/**
 * Composable for managing collectible items (spawning, tracking)
 *
 * why?
 * - collectibles have their own lifecycle (spawn, collect, respawn)
 * - keeps the main game component clean
 * - easy to add different collectible types or power-ups
 */
export function useCollectibles(scene: Ref<THREE.Scene | null>, world: Ref<CANNON.World | null>) {
  const collectibles = shallowRef<Collectible | []>([]); // array holding all collectibles (collected and not)
  const collectedCount = ref(0); // how many items have been collected? (for score display)

  /**
   * spawns random collectibles across plane
   * - random shapes (visual interest)
   * - random colors (easy to distinguish items)
   * - random positions (spread across 100mx100m area)
   *
   * @param count - how many collectibles to spawn
   */
  function spawnCollectibles(count: number = 50) {
    if (!scene.value || !world.value) {
      console.warn('Scene or world not initialized!');
      return;
    }

    // predefined geometries for variety
    const geometries = [
      new THREE.BoxGeometry(0.5, 0.5, 0.5), //cube
      new THREE.SphereGeometry(0.3, 16, 16), // sphere
      new THREE.ConeGeometry(0.4, 0.8, 16), // cone
    ];

    for (let i = 0; i < count; i++) {
      // pick a random geo from the array
      const geometry = geometries[Math.floor(Math.random() * geometries.length)];

      // random color for visual variety (any RGB color can be produced here)
      const material = new THREE.MeshStandardMaterial({
        color: Math.random() * 0xffffff
      });
      const mesh = new THREE.Mesh(geometry, material);

      // random position on the plane
      // (Math.Random() - 0.5) gives a range [-0.5, 0.5]
      // multiply by 100 for the 100m x 100m area
      mesh.position.set(
        (Math.random() - 0.5) * 100, // x
        0.5, // y (slightly above ground to prevent clipping)
        (Math.random() - 0.5) * 100, // z
      );

      // --- physics body for collectible ---
      // box shape (good enough for simple approximation)
      // 0.25 size -> half visual size
      const shape = new CANNON.Box(new CANNON.Vec3(0.25, 0.25, 0.25));
      const body = new CANNON.Body({
        mass: 0, // static until collected (no physics computes)
        position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
        shape: shape
      });

      // add to scene and physics world
      scene.value.add(mesh);
      world.value.addBody(body);

      // store to collections array (0.4 radius -> slightly smaller than visual size for forgiving collision)
      collectibles.value.push({
        mesh,
        body,
        collected: false,
        radius: 0.4
      });
    }
  }

  /**
   * clears all collectibles from scene and physics world
   * - for respawn functionality (clean slate before adding new items)
   * - prevent memory leaks
   */
  function clearCollectibles() {
    if (!scene.value || !world.value) return;

    collectibles.value.forEach((item) => {
      // remove from three.js scene
      scene.value!.remove(item.mesh);

      // remove from physics world
      if (world.value!.bodies.includes(item.body)) {
        world.value!.removeBody(item.body);
      }
    });

    // clear the array as well
    collectibles.value = [];
  }

  /**
   * respawns all collectibles (clears old, spawns new)
   * - user-triggered (r key)
   */
  function respawnCollectibles() {
    clearCollectibles();
    spawnCollectibles(50);
    //TODO: scrub score on reset
  }

  /**
   * increments the collected count
   * - encapsulation (only this composable should modify its own state)
   */
  function incrementCollectedCount() {
    collectedCount.value++;
  }

  return {
    collectibles,
    collectedCount,
    spawnCollectibles,
    clearCollectibles,
    respawnCollectibles,
    incrementCollectedCount
  };
}
