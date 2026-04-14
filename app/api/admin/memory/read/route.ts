import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const subPath = searchParams.get('path') || '';

    // Relative to the project root's memory directory
    // Correctly resolve relative to the village-v2 project root
    const fullPath = path.resolve(process.cwd(), '..', 'memory', subPath);
    
    // Security check: Ensure we're only reading from the memory directory
    const memoryRoot = path.resolve(process.cwd(), '..', 'memory');
    if (!fullPath.startsWith(memoryRoot)) {
       console.error('API memory/read/file error: Access denied for path', fullPath);
       return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory() || stats.size > 2 * 1024 * 1024) {
          return NextResponse.json({ error: 'File too large or is a directory' }, { status: 400 });
      }

      const content = await fs.readFile(fullPath, 'utf8');
      return NextResponse.json({ content });
    } catch (e) {
      console.error('API memory/read/file error: File not found', fullPath);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('API memory/read/file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
