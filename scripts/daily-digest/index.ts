#!/usr/bin/env npx tsx
/**
 * Village Daily Digest
 * 
 * Automatically generates and sends a daily homeschool briefing email
 * by pulling live data from the Village PocketBase.
 * 
 * Usage:
 *   npx tsx scripts/daily-digest/index.ts
 *   # or with options:
 *   npx tsx scripts/daily-digest/index.ts --dry-run --user-email=jtown.80@gmail.com
 * 
 * Environment:
 *   GMAIL_REFRESH_TOKEN, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET (for sending)
 *   Or set DRY_RUN=true to preview without sending
 */

import PocketBase from 'pocketbase';

// ── Types ────────────────────────────────────────────────────────────────────
interface Child {
  id: string;
  name: string;
  age: number;
  grade?: string;
}

interface Course {
  id: string;
  child: string;
  name: string;
  total_lessons: number;
  current_lesson: number;
  active_days?: string;
  last_lesson_date?: string;
}

interface Assignment {
  id: string;
  child?: string;
  title: string;
  subject?: string;
  due_date?: string;
  status: string;
}

interface DigestData {
  date: Date;
  dayOfWeek: string;
  children: Array<{
    child: Child;
    todaysLessons: Array<{ course: Course; lessonNumber: number }>;
    pendingAssignments: Assignment[];
    progress: { completed: number; total: number; percent: number };
  }>;
  motivationalQuote: string;
}

// ── Configuration ────────────────────────────────────────────────────────────
const PB_URL = 'https://bear-nan.exe.xyz';
const RECIPIENTS = ['jtown.80@gmail.com', 'lillyflo5@gmail.com'];
const SENDER = 'kit.copilot@gmail.com';

// Gmail OAuth (from environment variables)
// Set these in your environment or .env file:
//   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
const GMAIL_CONFIG = {
  clientId: process.env.GMAIL_CLIENT_ID || '',
  clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
  refreshToken: process.env.GMAIL_REFRESH_TOKEN || ''
};

// ── Motivational Quotes ──────────────────────────────────────────────────────
const QUOTES = [
  { text: "Education is not preparation for life; education is life itself.", author: "John Dewey" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "Tell me and I forget. Teach me and I remember. Involve me and I learn.", author: "Benjamin Franklin" },
  { text: "The more that you read, the more things you will know.", author: "Dr. Seuss" },
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
  { text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.", author: "Brian Herbert" },
  { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" }
];

// ── PocketBase Connection ────────────────────────────────────────────────────
async function connectToPocketBase(userEmail?: string): Promise<{ pb: PocketBase; userId: string }> {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false); // Disable auto-cancellation for script usage
  
  // For now, we'll fetch data without auth (public read) or use admin auth
  // In production, you'd set up proper service account auth
  
  // Try to find user by email if provided
  if (userEmail) {
    try {
      const users = await pb.collection('users').getList(1, 1, {
        filter: `email = "${userEmail}"`
      });
      if (users.items.length > 0) {
        return { pb, userId: users.items[0].id };
      }
    } catch (e) {
      console.warn('Could not find user by email, trying profiles...');
    }
  }
  
  // Fallback: get first user with children
  try {
    const children = await pb.collection('children').getList(1, 1);
    if (children.items.length > 0) {
      return { pb, userId: children.items[0].user };
    }
  } catch (e) {
    console.error('Failed to find any users with children');
  }
  
  throw new Error('No user found with children');
}

// ── Data Fetching ────────────────────────────────────────────────────────────
async function fetchDigestData(pb: PocketBase, userId: string): Promise<DigestData> {
  const today = new Date();
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dayIndex = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Fetch children
  const childRecords = await pb.collection('children').getFullList({
    filter: `user = "${userId}"`,
    sort: 'name'
  });
  
  const children = await Promise.all(childRecords.map(async (child) => {
    // Fetch courses for this child
    const courses = await pb.collection('courses').getFullList({
      filter: `child = "${child.id}"`
    }) as unknown as Course[];
    
    // Determine today's lessons based on active_days
    const todaysLessons: Array<{ course: Course; lessonNumber: number }> = [];
    
    for (const course of courses) {
      if (course.current_lesson > course.total_lessons) continue; // Course complete
      
      // Parse active_days (e.g., "1,2,3,4,5" for weekdays or "Mon,Tue,Wed")
      const activeDays = parseActiveDays(course.active_days);
      
      if (activeDays.includes(dayIndex)) {
        todaysLessons.push({
          course,
          lessonNumber: course.current_lesson
        });
      }
    }
    
    // Fetch pending assignments
    let pendingAssignments: Assignment[] = [];
    try {
      const assignments = await pb.collection('assignments').getFullList({
        filter: `child = "${child.id}" && status != "completed" && status != "Graded"`,
        sort: 'due_date'
      });
      pendingAssignments = assignments as unknown as Assignment[];
    } catch (e) {
      // Assignments collection may not exist
    }
    
    // Calculate progress
    const totalLessons = courses.reduce((sum, c) => sum + c.total_lessons, 0);
    const completedLessons = courses.reduce((sum, c) => sum + Math.max(0, c.current_lesson - 1), 0);
    const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    
    return {
      child: child as unknown as Child,
      todaysLessons,
      pendingAssignments,
      progress: { completed: completedLessons, total: totalLessons, percent }
    };
  }));
  
  // Pick a random quote
  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  
  return {
    date: today,
    dayOfWeek,
    children,
    motivationalQuote: `"${quote.text}" — ${quote.author}`
  };
}

function parseActiveDays(activeDaysStr?: string): number[] {
  if (!activeDaysStr) {
    // Default to weekdays (Mon-Fri)
    return [1, 2, 3, 4, 5];
  }
  
  // Try parsing as numbers (0-6)
  if (/^[\d,]+$/.test(activeDaysStr)) {
    return activeDaysStr.split(',').map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n));
  }
  
  // Try parsing as day names
  const dayMap: Record<string, number> = {
    'sun': 0, 'sunday': 0,
    'mon': 1, 'monday': 1,
    'tue': 2, 'tuesday': 2,
    'wed': 3, 'wednesday': 3,
    'thu': 4, 'thursday': 4,
    'fri': 5, 'friday': 5,
    'sat': 6, 'saturday': 6
  };
  
  return activeDaysStr
    .toLowerCase()
    .split(',')
    .map(d => dayMap[d.trim()])
    .filter(n => n !== undefined);
}

// ── HTML Template ────────────────────────────────────────────────────────────
function generateEmailHtml(data: DigestData): string {
  const dateStr = data.date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const childrenHtml = data.children.map(({ child, todaysLessons, pendingAssignments, progress }) => {
    const gradeEmoji = getGradeEmoji(child.age);
    
    const lessonsHtml = todaysLessons.length > 0
      ? `<ul style="margin: 8px 0; padding-left: 20px;">
          ${todaysLessons.map(l => `
            <li style="margin: 4px 0; color: #374151;">
              <strong>${l.course.name}</strong> — Lesson ${l.lessonNumber} of ${l.course.total_lessons}
            </li>
          `).join('')}
        </ul>`
      : `<p style="color: #6b7280; font-style: italic; margin: 8px 0;">No lessons scheduled today 🎉</p>`;
    
    const assignmentsHtml = pendingAssignments.length > 0
      ? `<div style="margin-top: 12px; padding: 12px; background: #fef3c7; border-radius: 8px;">
          <strong style="color: #92400e;">📋 Pending Assignments:</strong>
          <ul style="margin: 8px 0 0 0; padding-left: 20px;">
            ${pendingAssignments.slice(0, 3).map(a => `
              <li style="margin: 4px 0; color: #92400e;">
                ${a.title}${a.due_date ? ` (due ${new Date(a.due_date).toLocaleDateString()})` : ''}
              </li>
            `).join('')}
            ${pendingAssignments.length > 3 ? `<li style="color: #92400e;">+ ${pendingAssignments.length - 3} more...</li>` : ''}
          </ul>
        </div>`
      : '';
    
    const progressBar = `
      <div style="margin-top: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 12px; color: #6b7280;">Year Progress</span>
          <span style="font-size: 12px; font-weight: 600; color: #059669;">${progress.percent}%</span>
        </div>
        <div style="background: #e5e7eb; border-radius: 9999px; height: 8px; overflow: hidden;">
          <div style="background: linear-gradient(90deg, #10b981, #059669); height: 100%; width: ${progress.percent}%; border-radius: 9999px;"></div>
        </div>
      </div>
    `;
    
    return `
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <span style="font-size: 32px;">${gradeEmoji}</span>
          <div>
            <h3 style="margin: 0; font-size: 20px; color: #111827;">${child.name}</h3>
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Age ${child.age}${child.grade ? ` • ${child.grade}` : ''}</p>
          </div>
        </div>
        
        <h4 style="margin: 16px 0 8px 0; font-size: 14px; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">
          📚 Today's Lessons
        </h4>
        ${lessonsHtml}
        ${assignmentsHtml}
        ${progressBar}
      </div>
    `;
  }).join('');
  
  const totalLessons = data.children.reduce((sum, c) => sum + c.todaysLessons.length, 0);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 28px;">🏠 Village Daily Digest</h1>
      <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">${dateStr}</p>
    </div>
    
    <!-- Summary Card -->
    <div style="background: white; padding: 24px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <div style="display: flex; justify-content: center; gap: 32px; text-align: center;">
        <div>
          <div style="font-size: 36px; font-weight: 700; color: #6366f1;">${data.children.length}</div>
          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Students</div>
        </div>
        <div>
          <div style="font-size: 36px; font-weight: 700; color: #10b981;">${totalLessons}</div>
          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Lessons Today</div>
        </div>
      </div>
    </div>
    
    <!-- Children Cards -->
    <div style="background: #f9fafb; padding: 24px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      ${childrenHtml}
    </div>
    
    <!-- Quote Footer -->
    <div style="background: #1f2937; border-radius: 0 0 16px 16px; padding: 24px; text-align: center;">
      <p style="margin: 0; color: #d1d5db; font-style: italic; font-size: 14px; line-height: 1.6;">
        ${data.motivationalQuote}
      </p>
      <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 12px;">
        🐾 Sent by Kitt, your Village AI Assistant
      </p>
    </div>
    
  </div>
</body>
</html>
  `;
}

function getGradeEmoji(age: number): string {
  if (age <= 5) return '🎒';
  if (age <= 8) return '📗';
  if (age <= 11) return '📘';
  if (age <= 14) return '📙';
  return '📕';
}

// ── Email Sending ────────────────────────────────────────────────────────────
async function getAccessToken(): Promise<string> {
  if (!GMAIL_CONFIG.clientId || !GMAIL_CONFIG.clientSecret || !GMAIL_CONFIG.refreshToken) {
    throw new Error(
      'Missing Gmail OAuth credentials. Set environment variables:\n' +
      '  GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN\n' +
      'Or copy .env.example to .env and fill in values.'
    );
  }
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_CONFIG.clientId,
      client_secret: GMAIL_CONFIG.clientSecret,
      refresh_token: GMAIL_CONFIG.refreshToken,
      grant_type: 'refresh_token'
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

async function sendEmail(to: string[], subject: string, htmlBody: string): Promise<void> {
  const accessToken = await getAccessToken();
  
  // Build MIME message
  const boundary = '----=_Part_' + Math.random().toString(36).slice(2);
  const mimeMessage = [
    `To: ${to.join(', ')}`,
    `From: ${SENDER}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    htmlBody,
    '',
    `--${boundary}--`
  ].join('\r\n');
  
  const encodedMessage = Buffer.from(mimeMessage).toString('base64url');
  
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: encodedMessage })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to send email: ${JSON.stringify(error)}`);
  }
  
  const result = await response.json();
  console.log(`✅ Email sent! Message ID: ${result.id}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || process.env.DRY_RUN === 'true';
  const userEmailArg = args.find(a => a.startsWith('--user-email='));
  const userEmail = userEmailArg?.split('=')[1] || 'jtown.80@gmail.com';
  
  console.log('🏠 Village Daily Digest Generator');
  console.log(`📅 Date: ${new Date().toLocaleDateString()}`);
  console.log(`👤 User: ${userEmail}`);
  console.log(`📧 Recipients: ${RECIPIENTS.join(', ')}`);
  console.log(`🧪 Dry run: ${dryRun}`);
  console.log('');
  
  try {
    // Connect to PocketBase
    console.log('🔗 Connecting to PocketBase...');
    const { pb, userId } = await connectToPocketBase(userEmail);
    console.log(`✅ Connected (user: ${userId})`);
    
    // Fetch data
    console.log('📊 Fetching digest data...');
    const digestData = await fetchDigestData(pb, userId);
    console.log(`✅ Found ${digestData.children.length} children`);
    
    // Generate HTML
    console.log('📝 Generating email...');
    const html = generateEmailHtml(digestData);
    
    // Summary
    console.log('');
    console.log('━'.repeat(50));
    for (const { child, todaysLessons, pendingAssignments } of digestData.children) {
      console.log(`👤 ${child.name} (age ${child.age})`);
      console.log(`   📚 ${todaysLessons.length} lessons today`);
      todaysLessons.forEach(l => {
        console.log(`      • ${l.course.name} - Lesson ${l.lessonNumber}/${l.course.total_lessons}`);
      });
      if (pendingAssignments.length > 0) {
        console.log(`   📋 ${pendingAssignments.length} pending assignments`);
      }
    }
    console.log('━'.repeat(50));
    console.log('');
    
    if (dryRun) {
      console.log('🧪 DRY RUN - Email preview saved to /tmp/village-digest-preview.html');
      const fs = await import('fs');
      fs.writeFileSync('/tmp/village-digest-preview.html', html);
    } else {
      // Send email
      const subject = `📚 Village Daily Digest — ${digestData.dayOfWeek}, ${digestData.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      console.log('📨 Sending email...');
      await sendEmail(RECIPIENTS, subject, html);
    }
    
    console.log('✨ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
