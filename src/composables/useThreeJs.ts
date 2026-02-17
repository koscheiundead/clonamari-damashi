// --- 3d rendering ---
import { ref, onBeforeUnmount } from 'vue';
import type { Ref } from 'vue';
import * as THREE from 'three';

/**
 * Composable for managing Three.js scene, camera, renderer, and meshes
 *
 * why?
 * - rendering logic is separate from game logic and physics
 * - easy to add post-processing effects, change camera angles, etc.
 * - can be reused for different views
 */
export function useThreeJS(canvasContainer: Ref<HTMLElement | null>) {
  const scene = ref<THREE.Scene | null>(null); // holds all 3d object
  const camera = ref<THREE.PerspectiveCamera | null>(null);  // our eye into the world
  const renderer = ref<THREE.WebGLRenderer | null>(null); //draws the scene to the canvas
  const katamariMesh = ref<THREE.Mesh | null>(null); // visual representation of the player

  /**
   * initializes the three.js rendering pipeline
   *
   * waiting for canvasContainer to exist before setting up prevents attaching DOM to nothing
   */
  function initThreeJS() {
    if (!canvasContainer.value) {
      console.warn('Canvas container not ready!');
      return;
    }

    // --- scene setup ---
    scene.value = new THREE.Scene();
    scene.value.background = new THREE.Color('#87ceeb'); // sky blue for the sky :)

    // --- camera setup ---
    camera.value = new THREE.PerspectiveCamera(
      75, // field of view in degrees, wider -> more fish-eye
      window.innerWidth / window.innerHeight, //aspect ration (prevent stretching)
      0.1, // near clipping plane (don't render what's too close)
      1000, // far clipping plane (don't render what's too far)
    );

    // position camera behind/above start so player can see
    camera.value.position.set(0, 5, 10);
    camera.value.lookAt(0, 0, 0);

    // --- renderer setup ---
    renderer.value = new THREE.WebGLRenderer({
      antialias: true, // smooths jagged edges
    });
    renderer.value.setSize(window.innerWidth, window.innerHeight);

    // attach canvas to vue component's div
    canvasContainer.value.appendChild(renderer.value.domElement);

    // --- lighting setup ---
    // ambient light (no shadows - bright enough to see color, dark enough for directional light to still matter)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.value.add(ambientLight);

    // directional light (simulates sunlight - strong enough to create depth perception)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5); // afternoon sun
    scene.value.add(dirLight);

    // --- katamari mesh ---
    const geometry = new THREE.SphereGeometry(1, 32, 32); // radius 1m, 32 segments (for smoothness)
    const material = new THREE.MeshStandardMaterial({
      color: '#32cd32', // lime green
      wireframe: true, // easy to see rotation, debug-friendly
    });
    katamariMesh.value = new THREE.Mesh(geometry, material);
    katamariMesh.value.position.y = 1; // start at ground level
    scene.value.add(katamariMesh.value);

    // --- ground mesh ---
    const planeGeo = new THREE.PlaneGeometry(500, 500); // 500m square
    const planeMat = new THREE.MeshStandardMaterial({
      color: '#f0f0f0', // light gray
      side: THREE.DoubleSide, // visible from below (if camera goes under)
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);

    // rotate horizontal to match physics plane
    plane.rotation.x = -Math.PI / 2;
    scene.value.add(plane);

    // --- window resize handler ---
    window.addEventListener('resize', onWindowResize);
  }

  /**
   * updates camera aspect ratio and renderer size when window resizes
   * prevents game from looking squishy after window resize
   */
  function onWindowResize() {
    if (!camera.value || !renderer.value) return;

    // update camera to new aspect ratio
    camera.value.aspect = window.innerWidth / window.innerHeight;
    // update projection matrix bc it's cached for performance -- we need to manually refresh
    camera.value.updateProjectionMatrix();

    // update renderer to new window size
    renderer.value.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * renders one frame of the scene from the camera's perspective
   * called every frame by game loop
   */
  function render() {
    if (scene.value && camera.value && renderer.value) {
      renderer.value.render(scene.value, camera.value);
    }
  }

  /**
   * updates camera to follow katamari from behind
   * later we can update this to camera.position.lerp() perhaps
   */
  function updateCamera() {
    if (!katamariMesh.value || !camera.value) return;

    const ballPos = katamariMesh.value.position;

    // camera position is offset by (0, 5, 10) from ball, keeping ball centered with good viz
    camera.value.position.set(
      ballPos.x,
      ballPos.y + 5,
      ballPos.z + 10
    );

    camera.value.lookAt(ballPos);
  }

  /**
   * cleanup function (prevents memory leaks)
   */
  onBeforeUnmount(() => {
    // remove window listener
    window.removeEventListener('resize', onWindowResize);

    // dispose of three.js resources
    if (renderer.value) {
      renderer.value.dispose();
    }

    // clear refs
    scene.value = null;
    camera.value = null;
    renderer.value = null;
    katamariMesh.value = null;
  });

  return {
    scene,
    camera,
    renderer,
    katamariMesh,
    initThreeJS,
    render,
    updateCamera
  };
}
