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

// Child records
export async function getChildren(): Promise<Child[]> {
  const pb = getPocketBase();
  if (!pb.authStore.model) return [];
  const records = await pb.collection('children').getFullList({
    filter: `user = "${pb.authStore.model.id}"`
  });
  return records as unknown as Child[];
}

// Attendance records
export async function getAttendance(weekStart: string): Promise<Attendance[]> {
  const pb = getPocketBase();
  if (!pb.authStore.model) return [];
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const records = await pb.collection('attendance').getFullList({
    filter: `user = "${pb.authStore.model.id}" && date >= "${weekStart}" && date <= "${weekEnd.toISOString().split('T')[0]}"`
  });
  return records as unknown as Attendance[];
}

// Mark attendance (create or update)
export async function markAttendance(childId: string, date: string, status: Attendance['status'], notes?: string): Promise<Attendance> {
  const pb = getPocketBase();
  if (!pb.authStore.model) throw new Error('Not authenticated');
  
  // Check if attendance record exists for this child/date
  const existing = await pb.collection('attendance').getFirstListItem(`child = "${childId}" && date = "${date}"`).catch(() => null);
  
  if (existing) {
    const updated = await pb.collection('attendance').update(existing.id, { status, notes });
    return updated as unknown as Attendance;
  } else {
    const created = await pb.collection('attendance').create({
      user: pb.authStore.model.id,
      child: childId,
      date,
      status,
      notes
    });
    return created as unknown as Attendance;
  }
}
