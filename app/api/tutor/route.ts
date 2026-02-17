import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_KEY = process.env.VILLAGE_SPARK_OPENROUTER_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface TutorRequest {
  messages: { role: 'user' | 'assistant'; content: string }[];
  studentName: string;
  gradeLevel: string;
  subject?: string;
}

function getSystemPrompt(studentName: string, gradeLevel: string, subject?: string): string {
  return `You are a friendly, encouraging homework helper for ${studentName}, a ${gradeLevel} student.

CORE RULES:
1. NEVER give direct answers. Guide with hints and questions.
2. Use age-appropriate language (${gradeLevel} level).
3. Break complex problems into smaller steps.
4. Celebrate effort and progress, not just correctness.
5. If a student seems frustrated, acknowledge their feelings first.
6. Keep responses concise (2-3 short paragraphs max).
7. Use analogies and real-world examples they can relate to.

RESPONSE STYLE:
- Start with encouragement ("Great question!", "I can see you're thinking hard!")
- Ask guiding questions rather than explaining directly
- Use emojis sparingly but warmly 🌟
- End with a small next step or question to try

${subject ? `The student is currently working on ${subject}.` : ''}

SAFETY:
- Stay focused on educational topics
- Redirect off-topic questions gently back to learning
- Do not discuss inappropriate topics
- If asked something concerning, respond: "That's a great question for a trusted adult like your parent or teacher!"

Remember: You're building confidence and teaching HOW to think, not just giving answers.`;
}

export async function POST(request: NextRequest) {
  if (!OPENROUTER_KEY) {
    return NextResponse.json(
      { error: 'Tutor service not configured' },
      { status: 500 }
    );
  }

  try {
    const body: TutorRequest = await request.json();
    const { messages, studentName, gradeLevel, subject } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages provided' },
        { status: 400 }
      );
    }

    const systemPrompt = getSystemPrompt(studentName, gradeLevel, subject);

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': 'https://village.app',
        'X-Title': 'Village Homework Helper'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10) // Keep last 10 messages for context
        ],
        max_tokens: 500,
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', errorText);
      return NextResponse.json(
        { error: 'Failed to get response from tutor' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const tutorMessage = data.choices?.[0]?.message?.content;

    if (!tutorMessage) {
      return NextResponse.json(
        { error: 'Empty response from tutor' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: tutorMessage,
      usage: data.usage
    });

  } catch (error) {
    console.error('Tutor API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
