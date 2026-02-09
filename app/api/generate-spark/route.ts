import { NextResponse } from 'next/server';

/**
 * Village AI Lesson Generator (Standalone)
 * This logic is isolated from Kitt's personal agent memory.
 * It only uses data passed from the request and the PocketBase DB.
 */

const OPENROUTER_API_KEY = process.env.VILLAGE_SPARK_OPENROUTER_KEY;

export async function POST(req: Request) {
  try {
    const { childId, subject, courseName, gradeLevel } = await req.json();

    if (!childId || !subject) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
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

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free", // Use a free model for now
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'AI API Error');
    }

    const content = data.choices[0].message.content;
    const tailoredLesson = JSON.parse(content);

    return NextResponse.json(tailoredLesson);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to generate spark: ' + error.message }, { status: 500 });
  }
}
