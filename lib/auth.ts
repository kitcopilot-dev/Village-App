import PocketBase from 'pocketbase';
import { Profile } from './types';

export function getAuthCollectionName(pb: PocketBase): string | undefined {
  const model = pb.authStore.model as any;
  return model?.collectionName || model?.collectionId;
}

export function isProfileAuth(pb: PocketBase): boolean {
  return pb.authStore.isValid && getAuthCollectionName(pb) === 'profiles';
}

export function getCurrentProfile(pb: PocketBase): Profile | null {
  if (!isProfileAuth(pb)) return null;
  return pb.authStore.model as unknown as Profile;
}

export function getCurrentProfileId(pb: PocketBase): string | null {
  return getCurrentProfile(pb)?.id || null;
}

export function clearLegacyAuth(pb: PocketBase): void {
  if (pb.authStore.isValid && !isProfileAuth(pb)) {
    pb.authStore.clear();
  }
}
