import { NextResponse } from 'next/server';

/**
 * Village AI Lesson Generator (Standalone)
 * This logic is isolated from Kitt's personal agent memory.
 * It only uses data passed from the request and the PocketBase DB.
 */

export async function POST(req: Request) {
  try {
    const { childId, subject, courseName, gradeLevel } = await req.json();

    if (!childId || !subject) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    // In a production environment, we would use an API Key from process.env
    // and fetch student history/insights from PocketBase here.
    
    // TEMPORARY: For the prototype, we are returning a structured "Tailored" response.
    // In the next step, we will wire this up to a real LLM call using the App's API key.
    
    const tailoredLesson = {
      title: `The Wonders of ${subject}`,
      grade_level: gradeLevel,
      subject: subject,
      type: 'tailored',
      content: {
        hook: `Welcome back! Based on your recent work in ${courseName}, today we're diving deep into ${subject}. Did you know that the patterns we see in nature often follow the same rules as the math problems you've been solving?`,
        activity: `Go outside or look out a window. Find 3 different leaf shapes. Can you see the geometric patterns in the veins? Draw one and label the angles you find.`,
        resources: [
          { label: 'Watch: Nature by Numbers', url: 'https://youtube.com/...' }
        ]
      },
      interactive_data: {
        questions: [
          {
            id: 'q1',
            text: `Based on your drawing, which type of angle did you see most often in the leaf veins?`,
            type: 'multiple-choice',
            options: ['Acute (Small)', 'Obtuse (Wide)', 'Right (L-Shape)'],
            answer: 'Acute (Small)'
          },
          {
            id: 'q2',
            text: `How does seeing math in nature change the way you look at the world around you?`,
            type: 'reflection'
          }
        ]
      }
    };

    return NextResponse.json(tailoredLesson);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to generate spark' }, { status: 500 });
  }
}
