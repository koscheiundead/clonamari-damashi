// --- physics world management ---
import { ref, onBeforeUnmount } from 'vue';
import * as CANNON from 'cannon-es';

/**
 * Composable for managing physics world and katamari body
 *
 * why?
 * - separates physics concerns from rendering and vue lifecycle
 * - physics is testable in isolation
 * - easy to swap physics engines if needed/desired
 */
export function usePhysics() {
  // reactive reference to the physics world (need to access across multiple functions/components)
  const world = ref<CANNON.World | null>(null);
  const katamariBody = ref<CANNON.Body | null>(null);

  /**
   * initializes physics world with gravity and materials
   */
  function initPhysics() {
    // create main physics world with earth-like gravity
    world.value = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });

    // materials: surface properties for friction/bounce
    const groundMat = new CANNON.Material('ground');
    const ballMat = new CANNON.Material('ball');

    // contact materials (what happens when two materials touch?)
    const contactMat = new CANNON.ContactMaterial(groundMat, ballMat, {
      friction: 0.8, // high friction -> ball grips ground better
      restitution: 0.3, // low bounce -> more realistic rolling
    });
    world.value.addContactMaterial(contactMat);

    // create the physics body (katamari is a sphere)
    // damping -> prevents infinite acceleration and spinning
    katamariBody.value = new CANNON.Body({
      mass: 1, // light enough to move easily, not so light that it'll float away
      shape: new CANNON.Sphere(1), //radius of 1m
      material: ballMat,
      position: new CANNON.Vec3(0, 5, 0), // start in the air for a cute fall and bounce
      linearDamping: 0.5, // air resistance for movement
      angularDamping: 0.5 // rotational friction (stops spinning gradually)
    });
    world.value.addBody(katamariBody.value);

    // create the ground
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC, // immovable object
      shape: new CANNON.Plane(), // infinite plane
      material: groundMat
    });

    // rotate the plane to be horizontal (default is vertical)
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // 90 deg rotation on the X axis
    world.value.addBody(groundBody);
  }

  /**
   * steps the physics simulation forward one fixed timestamp
   * (consistent physics regardless of framerate)
   */
  function stepPhysics() {
    if (world.value) {
      world.value.fixedStep(); // this runs at 60fps internally, regardless of render fps
    }
  }

  /**
   * cleanup function (called when component unmounts)
   * prevents memory leakage and strange behavior
   */
  onBeforeUnmount(() => {
    // clear all references
    world.value = null;
    katamariBody.value = null;
  });

  return {
    world,
    katamariBody,
    initPhysics,
    stepPhysics
  };
}
