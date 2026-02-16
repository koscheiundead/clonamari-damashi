<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// vue reactivity
const canvasContainer = ref(null);
const katamariSize = ref(1.0); // starting size in m

// game constants
const MOVE_FORCE = 15;
const MAX_VELOCITY = 10;

// three.js variables
let scene, camera, renderer, animationId;
let world, katamariBody, katamariMesh;

// keyboard state tracker
const keys = { w: false, a: false, s: false, d: false };

// spawn items and hold them here
const collectibles = [];

function spawnCollectibles() {
  const geometries = [
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.SphereGeometry(0.3, 16, 16),
    new THREE.ConeGeometry(0.4, 0.8, 16)
  ];

  for (let i = 0; i < 50; i++) {
    const geometry = geometries[Math.floor(Math.random() * geometries.length)];
    const material = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);

    // random position on the plane
    mesh.position.set(
      (Math.random() - 0.5) * 40,
      0.5,
      (Math.random() - 0.5) * 40
    );

    // physics for it
    const shape = new CANNON.Box(new CANNON.Vec3(0.25, 0.25, 0.25));
    const body = new CANNON.Body({
      mass: 0, //static til touched
      position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
      shape: shape
    });

    scene.add(mesh);
    world.addBody(body);

    collectibles.push({ mesh, body, collected: false, radius: 0.4 });
  }
}

function initPhysics() {
  // create physics world
  world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0)
  });

  // create physics material (need friction to roll!)
  const groundMat = new CANNON.Material('ground');
  const ballMat = new CANNON.Material('ball');
  const contactMat = new CANNON.ContactMaterial(groundMat, ballMat, {
    friction: 0.8, // it's friction dawg
    restitution: 0.3, // bounciness
  });
  world.addContactMaterial(contactMat);

  // physical ball
  katamariBody = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Sphere(1),
    material: ballMat,
    position: new CANNON.Vec3(0, 5, 0),
    linearDamping: 0.5, // air resistance for movement
    angularDamping: 0.5 // friction for spinning
  });
  world.addBody(katamariBody);

  // physical ground
  const groundBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
    material: groundMat
  });
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);
}

function handleInput() {
  // calculate force direction based on keys
  // to roll forward (z-axis) we need to apply torque or force to push the ball
  // applying force is typically more intuitive
  let force = new CANNON.Vec3(0, 0, 0);

  if (keys.w) force.z -= MOVE_FORCE;
  if (keys.s) force.z += MOVE_FORCE;
  if (keys.a) force.x -= MOVE_FORCE;
  if (keys.d) force.x += MOVE_FORCE;

  katamariBody.applyForce(force, katamariBody.position);

  // cap the speed so it doesn't just like. y'know. vroom.
  const velocity = katamariBody.velocity;
  if (velocity.length() > MAX_VELOCITY) {
    velocity.normalize();
    velocity.scale(MAX_VELOCITY, katamariBody.velocity);
  }

  // let's also cap angular velocity for the same reason, it's kinda disorienting
  const angularVelocity = katamariBody.angularVelocity;
  const maxAngularVelocity = 5;
  if (angularVelocity.length() > maxAngularVelocity) {
    angularVelocity.normalize();
    angularVelocity.scale(maxAngularVelocity, katamariBody.angularVelocity);
  }
}

function initThreeJS() {
  // scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#87ceeb'); // sky blue

  // camera setup
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);

  // renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  canvasContainer.value.appendChild(renderer.domElement);

  // lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  scene.add(dirLight);

  // create the player (the katamari)
  const geometry = new THREE.SphereGeometry(1, 32, 32);
  const material = new THREE.MeshStandardMaterial({ color: '#32cd32', wireframe: true }); // wireframe -> easy to see rotation
  katamariMesh = new THREE.Mesh(geometry, material);
  katamariMesh.position.y = 1; // put the player on the ground
  scene.add(katamariMesh);

  // create the ground
  const planeGeo = new THREE.PlaneGeometry(50, 50);
  const planeMat = new THREE.MeshStandardMaterial({ color: '#f0f0f0' });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2; // lay flat
  scene.add(plane);

  window.addEventListener('resize', onWindowResize);
}

function animate() {
  animationId = requestAnimationFrame(animate);

  // step the physics world (60fps)
  world.fixedStep();

  // process inputs and check if we have collected an item
  handleInput();
  checkCollisions();

  // copy physics position/rotation to body mesh
  katamariMesh.position.copy(katamariBody.position);
  katamariMesh.quaternion.copy(katamariBody.quaternion);

  // ensure the camera follows (offset for distance)
  camera.position.set(katamariMesh.position.x, katamariMesh.position.y + 5, katamariMesh.position.z + 10);
  camera.lookAt(katamariMesh.position);

  // render the scene
  renderer.render(scene, camera);
}

function checkCollisions() {
  collectibles.forEach((item) => {
    if (item.collected) return;

    // calculate distance between katamari and item
    const dist = katamariBody.position.distanceTo(item.body.position);

    // if touching (sum of radii)
    if (dist < katamariSize.value + item.radius) {
      stickItem(item);
    }
  });
}

function stickItem(item) {
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
  item.collectedAtSize = katamariSize.value;

  // grow the katamari
  growKatamari(0.05);

  // endless game - if we're out of collectibles, just make some more!
  
}

function growKatamari(amount) {
  const oldSize = katamariSize.value;
  const newSize = oldSize + amount;
  katamariSize.value = newSize;

  // update visual size
  katamariMesh.scale.set(newSize, newSize, newSize);
  // counter-scale all collected items so they stay the same visual size
  katamariMesh.children.forEach((child) => {
    // find corresponding collectible data
    const collectibleData = collectibles.find(col => col.mesh === child);

    if (collectibleData && collectibleData.collectedAtSize) {
      // calculate scale relative to size at collection
      // e.g. if collected at 1.0 and katamari is now 1.5, scale should be 1/1.5 == 0.667
      const targetScale = 1 / newSize;
      child.scale.setScalar(targetScale);
    }
  });

  // update physics shape size also also
  katamariBody.shapes[0].radius = newSize;
  katamariBody.updateBoundingRadius();

  // move camera back SLIGHTLY as we grow
  camera.position.set(katamariMesh.position.x, katamariMesh.position.y + 5, katamariMesh.position.z + 10);
  camera.lookAt(katamariMesh.position);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// event listeners
function onKeyDown(e) {
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
}

function onKeyUp(e) {
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
}

// lifecycle hooks
onMounted(() => {
  initPhysics();
  initThreeJS();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  spawnCollectibles();
  animate();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId);
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  scene = undefined;
  renderer = undefined;
  animationId = undefined;
  camera = undefined;
  world = undefined;
  katamariBody = undefined;
  katamariMesh = undefined;
});
</script>

<template>
  <div class="game-container">
    <div class="ui-layer">
      <h1>Katamari Prototype</h1>
      <div class="stats">
        <p>Size: <strong>{{ katamariSize.toFixed(2) }} m</strong></p>
        <p>Use W, A, S, D to move</p>
      </div>
    </div>

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
}

.ui-layer {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10; /* ensures ui is atop canvas */
  padding: 20px;
  color: #333;
  pointer-events: none; /* lets mouse clicks pass through to 3d canvas */
}

h1 {
  margin: 0 0 10px 0;
  font-family: sans-serif;
  text-shadow: 2px 2px 0px white;
}

.stats {
  background: rgba(255, 255, 255, 0.8);
  padding: 10px 20px;
  border-radius: 8px;
  font-family: monospace;
  font-size: 1.2rem;
  display: inline-block;
}
</style>
