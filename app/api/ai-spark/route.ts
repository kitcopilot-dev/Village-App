import { NextResponse } from 'next/server';

/**
 * Village AI Lesson Generator - OpenRouter Direct
 * Calls OpenRouter API directly with rate limiting
 */

const OPENROUTER_API_KEY = process.env.VILLAGE_SPARK_OPENROUTER_KEY || '';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Rate limiting: 5 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

export async function POST(req: Request) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute before trying again.' },
        { status: 429 }
      );
    }

    const { childId, subject, courseName, gradeLevel } = await req.json();

    if (!childId || !subject) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'API not configured' }, { status: 500 });
    }

    const prompt = `
      You are an expert homeschool tutor. Generate an interactive lesson for a student in ${gradeLevel} who is studying ${subject} (Course: ${courseName}).
      
      Format the response as a valid JSON object with the following structure:
      {
        "title": "A creative title for the lesson",
        "grade_level": "${gradeLevel}",
        "subject": "${subject}",
        "type": "tailored",
        "content": {
          "hook": "A 2-3 sentence engaging introduction or story-based 'did you know?' to spark interest.",
          "activity": "A hands-on or simple thought activity they can do right now.",
          "resources": [
            { "label": "Label for a helpful resource", "url": "A real URL to a helpful video or article (use https://youtube.com for placeholders if unsure)" }
          ]
        },
        "interactive_data": {
          "questions": [
            {
              "id": "q1",
              "text": "A multiple choice question about the lesson hook.",
              "type": "multiple-choice",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "answer": "The correct option text exactly"
            },
            {
              "id": "q2",
              "text": "An open-ended reflection question about the activity.",
              "type": "reflection"
            }
          ]
        }
      }
      
      Only return the JSON object. No other text.
    `;

    // Call OpenRouter directly
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://village.homeschool",
        "X-Title": "Village Homeschool"
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'OpenRouter API Error');
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid API response structure');
    }

    const content = data.choices[0].message.content;
    const tailoredLesson = JSON.parse(content);

    return NextResponse.json(tailoredLesson);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to generate spark: ' + error.message }, { status: 500 });
  }
}
