import { describe, it, expect, beforeEach } from 'vitest';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import {
  applyInputForce,
  capLinearVelocity,
  capAngularVelocity,
  isColliding,
  findCollidingCollectibles,
  stickItem,
  growKatamari,
  MOVE_FORCE,
  MAX_VELOCITY,
  MAX_ANGULAR_VELOCITY,
  KeyState,
  Collectible,
} from './gameLogic';

describe('Katamari movement based on keyboard input', () => {
  let katamariBody: CANNON.Body;

  beforeEach(() => {
    katamariBody = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Sphere(1),
      position: new CANNON.Vec3(0, 0, 0),
    });
  });

  it('should apply negative Z force when W is pressed', () => {
    const keys: KeyState = { w: true, a: false, s: false, d: false };
    const force = applyInputForce(keys, katamariBody);

    expect(force.x).toBe(0);
    expect(force.z).toBe(-MOVE_FORCE);
  });

  it('should apply positive Z force when S is pressed', () => {
    const keys: KeyState = { w: false, a: false, s: true, d: false };
    const force = applyInputForce(keys, katamariBody);

    expect(force.x).toBe(0);
    expect(force.z).toBe(MOVE_FORCE);
  });

  it('should apply negative X force when A is pressed', () => {
    const keys: KeyState = { w: false, a: true, s: false, d: false };
    const force = applyInputForce(keys, katamariBody);

    expect(force.x).toBe(-MOVE_FORCE);
    expect(force.z).toBe(0);
  });

  it('should apply positive X force when D is pressed', () => {
    const keys: KeyState = { w: false, a: false, s: false, d: true };
    const force = applyInputForce(keys, katamariBody);

    expect(force.x).toBe(MOVE_FORCE);
    expect(force.z).toBe(0);
  });

  it('should apply diagonal force when W and D are pressed', () => {
    const keys: KeyState = { w: true, a: false, s: false, d: true };
    const force = applyInputForce(keys, katamariBody);

    expect(force.x).toBe(MOVE_FORCE);
    expect(force.z).toBe(-MOVE_FORCE);
  });

  it('should apply no force when no keys are pressed', () => {
    const keys: KeyState = { w: false, a: false, s: false, d: false };
    const force = applyInputForce(keys, katamariBody);

    expect(force.x).toBe(0);
    expect(force.z).toBe(0);
  });

  it('should cancel out force when opposite keys are pressed', () => {
    const keys: KeyState = { w: true, a: false, s: true, d: false };
    const force = applyInputForce(keys, katamariBody);

    expect(force.x).toBe(0);
    expect(force.z).toBe(0);
  });
});

describe('Katamari velocity capping', () => {
  let body: CANNON.Body;

  beforeEach(() => {
    body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Sphere(1),
    });
  });

  describe('linear velocity capping', () => {
    it('should not cap velocity below maximum', () => {
      body.velocity.set(5, 0, 0);
      const wasCapped = capLinearVelocity(body);

      expect(wasCapped).toBe(false);
      expect(body.velocity.length()).toBeCloseTo(5);
    });

    it('should cap velocity at maximum when exceeded', () => {
      body.velocity.set(20, 0, 0);
      const wasCapped = capLinearVelocity(body);

      expect(wasCapped).toBe(true);
      expect(body.velocity.length()).toBeCloseTo(MAX_VELOCITY);
    });

    it('should preserve velocity direction when capping', () => {
      body.velocity.set(20, 20, 0);
      capLinearVelocity(body);

      // Direction should be preserved (45 degrees)
      expect(body.velocity.x).toBeCloseTo(body.velocity.y);
      expect(body.velocity.length()).toBeCloseTo(MAX_VELOCITY);
    });

    it('should cap velocity exactly at maximum', () => {
      body.velocity.set(MAX_VELOCITY, 0, 0);
      const wasCapped = capLinearVelocity(body);

      expect(wasCapped).toBe(false);
      expect(body.velocity.length()).toBeCloseTo(MAX_VELOCITY);
    });

    it('should handle custom max velocity', () => {
      body.velocity.set(10, 0, 0);
      const customMax = 5;
      const wasCapped = capLinearVelocity(body, customMax);

      expect(wasCapped).toBe(true);
      expect(body.velocity.length()).toBeCloseTo(customMax);
    });
  });

  describe('angular velocity capping', () => {
    it('should not cap angular velocity below maximum', () => {
      body.angularVelocity.set(2, 0, 0);
      const wasCapped = capAngularVelocity(body);

      expect(wasCapped).toBe(false);
      expect(body.angularVelocity.length()).toBeCloseTo(2);
    });

    it('should cap angular velocity at maximum when exceeded', () => {
      body.angularVelocity.set(10, 0, 0);
      const wasCapped = capAngularVelocity(body);

      expect(wasCapped).toBe(true);
      expect(body.angularVelocity.length()).toBeCloseTo(MAX_ANGULAR_VELOCITY);
    });

    it('should preserve angular velocity direction when capping', () => {
      body.angularVelocity.set(10, 10, 0);
      capAngularVelocity(body);

      expect(body.angularVelocity.x).toBeCloseTo(body.angularVelocity.y);
      expect(body.angularVelocity.length()).toBeCloseTo(MAX_ANGULAR_VELOCITY);
    });

    it('should handle custom max angular velocity', () => {
      body.angularVelocity.set(10, 0, 0);
      const customMax = 3;
      const wasCapped = capAngularVelocity(body, customMax);

      expect(wasCapped).toBe(true);
      expect(body.angularVelocity.length()).toBeCloseTo(customMax);
    });
  });
});

describe('Collision detection', () => {
  let katamariBody: CANNON.Body;
  let collectible: Collectible;

  beforeEach(() => {
    katamariBody = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Sphere(1),
      position: new CANNON.Vec3(0, 0, 0),
    });

    collectible = {
      mesh: new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5)),
      body: new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(0.25, 0.25, 0.25)),
        position: new CANNON.Vec3(0, 0, 0),
      }),
      collected: false,
      radius: 0.4,
    };
  });

  it('should detect collision when katamari touches collectible', () => {
    // Katamari at origin (size 1), collectible at (1.2, 0, 0) with radius 0.4
    // Distance = 1.2, sum of radii = 1 + 0.4 = 1.4, so they overlap
    collectible.body.position.set(1.2, 0, 0);
    const katamariSize = 1;

    expect(isColliding(katamariBody, collectible, katamariSize)).toBe(true);
  });

  it('should not detect collision when katamari is far from collectible', () => {
    // Distance = 5, sum of radii = 1 + 0.4 = 1.4, no overlap
    collectible.body.position.set(5, 0, 0);
    const katamariSize = 1;

    expect(isColliding(katamariBody, collectible, katamariSize)).toBe(false);
  });

  it('should detect collision when katamari overlaps completely', () => {
    // Same position = distance 0, always colliding
    collectible.body.position.set(0, 0, 0);
    const katamariSize = 1;

    expect(isColliding(katamariBody, collectible, katamariSize)).toBe(true);
  });

  it('should not detect collision when just outside touch range', () => {
    // Distance = 1.5, sum of radii = 1 + 0.4 = 1.4, no overlap
    collectible.body.position.set(1.5, 0, 0);
    const katamariSize = 1;

    expect(isColliding(katamariBody, collectible, katamariSize)).toBe(false);
  });

  it('should account for katamari size in collision detection', () => {
    collectible.body.position.set(2, 0, 0);
    
    // Small katamari (size 1): distance 2 > 1 + 0.4 = no collision
    expect(isColliding(katamariBody, collectible, 1)).toBe(false);
    
    // Large katamari (size 2): distance 2 < 2 + 0.4 = collision
    expect(isColliding(katamariBody, collectible, 2)).toBe(true);
  });

  describe('findCollidingCollectibles', () => {
    it('should return only colliding uncollected items', () => {
      const collectibles: Collectible[] = [
        {
          mesh: new THREE.Mesh(),
          body: new CANNON.Body({ position: new CANNON.Vec3(1, 0, 0) }),
          collected: false,
          radius: 0.4,
        },
        {
          mesh: new THREE.Mesh(),
          body: new CANNON.Body({ position: new CANNON.Vec3(10, 0, 0) }),
          collected: false,
          radius: 0.4,
        },
        {
          mesh: new THREE.Mesh(),
          body: new CANNON.Body({ position: new CANNON.Vec3(0.5, 0, 0) }),
          collected: true, // Already collected
          radius: 0.4,
        },
      ];

      const colliding = findCollidingCollectibles(katamariBody, collectibles, 1);

      expect(colliding).toHaveLength(1);
      expect(colliding[0]).toBe(collectibles[0]);
    });

    it('should return empty array when no collisions', () => {
      const collectibles: Collectible[] = [
        {
          mesh: new THREE.Mesh(),
          body: new CANNON.Body({ position: new CANNON.Vec3(10, 0, 0) }),
          collected: false,
          radius: 0.4,
        },
      ];

      const colliding = findCollidingCollectibles(katamariBody, collectibles, 1);

      expect(colliding).toHaveLength(0);
    });
  });
});

describe('Item collection (stickItem)', () => {
  let world: CANNON.World;
  let katamariMesh: THREE.Mesh;
  let collectible: Collectible;

  beforeEach(() => {
    world = new CANNON.World();

    katamariMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1),
      new THREE.MeshBasicMaterial()
    );
    katamariMesh.position.set(0, 1, 0);

    const collectibleMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshBasicMaterial()
    );
    collectibleMesh.position.set(2, 1, 0);

    const collectibleBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(0.25, 0.25, 0.25)),
      position: new CANNON.Vec3(2, 1, 0),
    });
    world.addBody(collectibleBody);

    collectible = {
      mesh: collectibleMesh,
      body: collectibleBody,
      collected: false,
      radius: 0.4,
    };
  });

  it('should mark item as collected', () => {
    stickItem(collectible, katamariMesh, world, 1);

    expect(collectible.collected).toBe(true);
  });

  it('should remove physics body from world', () => {
    expect(world.bodies).toContain(collectible.body);

    stickItem(collectible, katamariMesh, world, 1);

    expect(world.bodies).not.toContain(collectible.body);
  });

  it('should attach mesh to katamari mesh', () => {
    expect(katamariMesh.children).not.toContain(collectible.mesh);

    stickItem(collectible, katamariMesh, world, 1);

    expect(katamariMesh.children).toContain(collectible.mesh);
  });

  it('should record the size at which item was collected', () => {
    const katamariSize = 1.5;

    stickItem(collectible, katamariMesh, world, katamariSize);

    expect(collectible.collectedAtSize).toBe(katamariSize);
  });

  it('should maintain world position when reparenting', () => {
    const originalWorldPos = new THREE.Vector3();
    collectible.mesh.getWorldPosition(originalWorldPos);

    stickItem(collectible, katamariMesh, world, 1);

    const newWorldPos = new THREE.Vector3();
    collectible.mesh.getWorldPosition(newWorldPos);

    expect(newWorldPos.x).toBeCloseTo(originalWorldPos.x);
    expect(newWorldPos.y).toBeCloseTo(originalWorldPos.y);
    expect(newWorldPos.z).toBeCloseTo(originalWorldPos.z);
  });
});

describe('Katamari growth', () => {
  let katamariMesh: THREE.Mesh;
  let katamariBody: CANNON.Body;
  let collectibles: Collectible[];

  beforeEach(() => {
    katamariMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1),
      new THREE.MeshBasicMaterial()
    );

    katamariBody = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Sphere(1),
    });

    collectibles = [];
  });

  it('should update visual size correctly', () => {
    const newSize = growKatamari(0.5, 1, katamariMesh, katamariBody, collectibles);

    expect(newSize).toBe(1.5);
    expect(katamariMesh.scale.x).toBe(1.5);
    expect(katamariMesh.scale.y).toBe(1.5);
    expect(katamariMesh.scale.z).toBe(1.5);
  });

  it('should update physics shape radius correctly', () => {
    growKatamari(0.5, 1, katamariMesh, katamariBody, collectibles);

    const sphereShape = katamariBody.shapes[0] as CANNON.Sphere;
    expect(sphereShape.radius).toBe(1.5);
  });

  it('should counter-scale collected items to maintain their visual size', () => {
    // Create a collected item
    const collectedMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshBasicMaterial()
    );
    katamariMesh.add(collectedMesh);

    const collectedItem: Collectible = {
      mesh: collectedMesh,
      body: new CANNON.Body(),
      collected: true,
      radius: 0.4,
      collectedAtSize: 1.0,
    };
    collectibles.push(collectedItem);

    // Grow from 1 to 1.5
    growKatamari(0.5, 1, katamariMesh, katamariBody, collectibles);

    // Counter-scale should be 1/1.5 ≈ 0.667
    expect(collectedMesh.scale.x).toBeCloseTo(1 / 1.5);
    expect(collectedMesh.scale.y).toBeCloseTo(1 / 1.5);
    expect(collectedMesh.scale.z).toBeCloseTo(1 / 1.5);
  });

  it('should handle multiple growth increments correctly', () => {
    let currentSize = 1;
    
    currentSize = growKatamari(0.1, currentSize, katamariMesh, katamariBody, collectibles);
    expect(currentSize).toBeCloseTo(1.1);
    
    currentSize = growKatamari(0.2, currentSize, katamariMesh, katamariBody, collectibles);
    expect(currentSize).toBeCloseTo(1.3);
    
    expect(katamariMesh.scale.x).toBeCloseTo(1.3);
    const sphereShape = katamariBody.shapes[0] as CANNON.Sphere;
    expect(sphereShape.radius).toBeCloseTo(1.3);
  });

  it('should not affect children without collectedAtSize', () => {
    // A child that wasn't collected through the normal process
    const randomChild = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );
    randomChild.scale.set(1, 1, 1);
    katamariMesh.add(randomChild);

    growKatamari(0.5, 1, katamariMesh, katamariBody, collectibles);

    // Scale should remain unchanged since no collectible data matches
    expect(randomChild.scale.x).toBe(1);
    expect(randomChild.scale.y).toBe(1);
    expect(randomChild.scale.z).toBe(1);
  });

  it('should correctly scale multiple collected items', () => {
    const mesh1 = new THREE.Mesh();
    const mesh2 = new THREE.Mesh();
    katamariMesh.add(mesh1);
    katamariMesh.add(mesh2);

    collectibles.push({
      mesh: mesh1,
      body: new CANNON.Body(),
      collected: true,
      radius: 0.3,
      collectedAtSize: 1.0,
    });
    collectibles.push({
      mesh: mesh2,
      body: new CANNON.Body(),
      collected: true,
      radius: 0.5,
      collectedAtSize: 1.2, // Collected at a different size
    });

    // Grow to size 2
    growKatamari(1, 1, katamariMesh, katamariBody, collectibles);

    // Both should be scaled to 1/newSize = 0.5
    expect(mesh1.scale.x).toBeCloseTo(0.5);
    expect(mesh2.scale.x).toBeCloseTo(0.5);
  });
});
