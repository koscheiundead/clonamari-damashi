// --- player controls
import { ref, onBeforeUnmount } from 'vue';
import { KeyState } from '../gameLogic';

/**
 * Composable for managing keyboard input state
 *
 * why?
 * - decouples input handling from game logic
 * - easy to add gamepad support later
 * - easy to add key remapping
 * - clean event listener management
 */
export function useKeyboardInput() {
  // Reactive state tracking which keys are currently pressed
  const keys = ref<KeyState>({
    w: false,
    a: false,
    s: false,
    d: false
  });

  /**
   * handles keydown events
   */
  function onKeyDown(e: KeyboardEvent) {
    const key = e.key.toLowerCase();

    // only update if it's a tracked key
    if (key in keys.value) {
      keys.value[key as keyof KeyState] = true;
    }

    // handle respawn distinctly
    if (key === 'r') {
      // emit an event that the game can listen for
      // keep composable focused on input, not game logic
      window.dispatchEvent(new CustomEvent('respawn-collectibles'));
    }
  }

  /**
   * handles keyup events
   */
  function onKeyUp(e: KeyboardEvent) {
    const key = e.key.toLowerCase();

    if (key in keys.value) {
      keys.value[key as keyof KeyState] = false;
    }
  }

  /**
   * registers event listeners
   * (allows calling this after the DOM is ready)
   */
  function setupListeners() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  /**
   * cleanup to prevent memory loss
   * don't forget to remove event listeners!
   */
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  });

  return {
    keys,
    setupListeners
  };
}
