import * as CANNON from 'cannon-es';
import * as THREE from 'three';

// game constants
export const MOVE_FORCE = 15;
export const MAX_VELOCITY = 10;
export const MAX_ANGULAR_VELOCITY = 5;

export interface KeyState {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
}

export interface Collectible {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  collected: boolean;
  radius: number;
  collectedAtSize?: number;
}

/**
 * Applies movement force to the katamari body based on keyboard input.
 * Returns the force vector that was applied.
 */
export function applyInputForce(
  keys: KeyState,
  katamariBody: CANNON.Body,
  moveForce: number = MOVE_FORCE
): CANNON.Vec3 {
  const force = new CANNON.Vec3(0, 0, 0);

  if (keys.w) force.z -= moveForce;
  if (keys.s) force.z += moveForce;
  if (keys.a) force.x -= moveForce;
  if (keys.d) force.x += moveForce;

  katamariBody.applyForce(force, katamariBody.position);
  return force;
}

/**
 * Caps the linear velocity of a body to the maximum value.
 * Returns true if capping was applied.
 */
export function capLinearVelocity(
  body: CANNON.Body,
  maxVelocity: number = MAX_VELOCITY
): boolean {
  const velocity = body.velocity;
  if (velocity.length() > maxVelocity) {
    velocity.normalize();
    velocity.scale(maxVelocity, body.velocity);
    return true;
  }
  return false;
}

/**
 * Caps the angular velocity of a body to the maximum value.
 * Returns true if capping was applied.
 */
export function capAngularVelocity(
  body: CANNON.Body,
  maxAngularVelocity: number = MAX_ANGULAR_VELOCITY
): boolean {
  const angularVelocity = body.angularVelocity;
  if (angularVelocity.length() > maxAngularVelocity) {
    angularVelocity.normalize();
    angularVelocity.scale(maxAngularVelocity, body.angularVelocity);
    return true;
  }
  return false;
}

/**
 * Checks if the katamari is colliding with a collectible.
 * Returns true if they are touching (distance < sum of radii).
 */
export function isColliding(
  katamariBody: CANNON.Body,
  collectible: Collectible,
  katamariSize: number
): boolean {
  const dist = katamariBody.position.distanceTo(collectible.body.position);
  return dist < katamariSize + collectible.radius;
}

/**
 * Finds all collectibles that the katamari is currently colliding with.
 */
export function findCollidingCollectibles(
  katamariBody: CANNON.Body,
  collectibles: Collectible[],
  katamariSize: number
): Collectible[] {
  return collectibles.filter(
    (item) => !item.collected && isColliding(katamariBody, item, katamariSize)
  );
}

/**
 * Sticks an item to the katamari mesh.
 * - Marks the item as collected
 * - Removes the physics body from the world
 * - Reparents the mesh to the katamari mesh
 * - Records the size at which it was collected
 */
export function stickItem(
  item: Collectible,
  katamariMesh: THREE.Mesh,
  world: CANNON.World,
  katamariSize: number
): void {
  item.collected = true;

  // remove physics from world so it doesn't bump again
  world.removeBody(item.body);

  // "stick" it (reparent mesh to katamari mesh)
  // keep position same during the transition
  const worldPos = new THREE.Vector3();
  item.mesh.getWorldPosition(worldPos);

  // attach it to the ball
  katamariMesh.add(item.mesh);

  // convert world position to local position (relative to ball)
  item.mesh.position.copy(katamariMesh.worldToLocal(worldPos));

  // store the CURRENT size when item was collected (baseline for counter-scaling)
  item.collectedAtSize = katamariSize;
}

/**
 * Grows the katamari by the specified amount.
 * Updates:
 * - Visual scale of the katamari mesh
 * - Counter-scales all collected items so they stay the same visual size
 * - Updates the physics shape radius
 *
 * Returns the new size.
 */
export function growKatamari(
  amount: number,
  currentSize: number,
  katamariMesh: THREE.Mesh,
  katamariBody: CANNON.Body,
  collectibles: Collectible[]
): number {
  const newSize = currentSize + amount;

  // update visual size
  katamariMesh.scale.set(newSize, newSize, newSize);

  // counter-scale all collected items so they stay the same visual size
  katamariMesh.children.forEach((child) => {
    // find corresponding collectible data
    const collectibleData = collectibles.find((col) => col.mesh === child);

    if (collectibleData && collectibleData.collectedAtSize) {
      // calculate scale relative to size at collection
      // e.g. if collected at 1.0 and katamari is now 1.5, scale should be 1/1.5 == 0.667
      const targetScale = 1 / newSize;
      child.scale.setScalar(targetScale);
    }
  });

  // update physics shape size
  (katamariBody.shapes[0] as CANNON.Sphere).radius = newSize;
  katamariBody.updateBoundingRadius();

  return newSize;
}
