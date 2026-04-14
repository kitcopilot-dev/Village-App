import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const subPath = searchParams.get('path') || '';
    
    // Resolve path relative to the village-v2 project root, escaping into /.openclaw/workspace/memory
    const fullPath = path.resolve(process.cwd(), '..', 'memory', subPath);
    
    // Security check: Ensure we're only reading from the memory directory
    const memoryRoot = path.resolve(process.cwd(), '..', 'memory');
    if (!fullPath.startsWith(memoryRoot)) {
       console.error('API memory list error: Access denied for path', fullPath);
       return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const items = await fs.readdir(fullPath, { withFileTypes: true });
    
    const files = items
      .filter(item => !item.name.startsWith('.'))
      .map(item => ({
        name: item.name,
        path: path.join(subPath, item.name),
        type: item.isDirectory() ? 'directory' : 'file'
      }))
      .sort((a, b) => {
        // Directories first, then alphabetical
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });

    return NextResponse.json({ files });
  } catch (error) {
    console.error('API memory/read error:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}
