import { NextResponse } from 'next/server';

export async function GET() {
  throw new Error('🧪 Sentry Test Error - This is intentional!');
  return NextResponse.json({ message: 'This will never be reached' });
}
