import PocketBase from 'pocketbase';

const PB_URL = 'https://bear-nan.exe.xyz';

// Create a singleton instance
let pbInstance: PocketBase | null = null;

export function getPocketBase(): PocketBase {
  if (typeof window === 'undefined') {
    // Server-side: create new instance each time
    return new PocketBase(PB_URL);
  }

  // Client-side: use singleton
  if (!pbInstance) {
    pbInstance = new PocketBase(PB_URL);
    
    // Restore auth from localStorage
    const storedAuth = localStorage.getItem('village_pb_auth');
    if (storedAuth) {
      try {
        const parsed = JSON.parse(storedAuth);
        pbInstance.authStore.save(parsed.token, parsed.model);
      } catch (e) {
        console.warn('Failed to restore auth:', e);
        localStorage.removeItem('village_pb_auth');
      }
    }

    // Persist auth changes
    pbInstance.authStore.onChange((token, model) => {
      if (token && model) {
        localStorage.setItem('village_pb_auth', JSON.stringify({ token, model }));
      } else {
        localStorage.removeItem('village_pb_auth');
      }
    });
  }

  return pbInstance;
}

export const pb = getPocketBase();
