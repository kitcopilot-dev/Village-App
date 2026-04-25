import { NextResponse } from 'next/server';

/**
 * Village AI Assignment Generator
 * Generates personalized assignments based on learning styles
 */

const OPENROUTER_API_KEY = process.env.VILLAGE_SPARK_OPENROUTER_KEY;

const LEARNING_STYLE_DESCRIPTIONS = {
  visual: 'This student learns best through pictures, diagrams, charts, and videos. Include visual aids and demonstrations.',
  auditory: 'This student learns best through listening, discussions, and verbal explanations. Include audio resources and spoken activities.',
  kinesthetic: 'This student learns best through hands-on activities, movement, and physical interaction. Include practical experiments and manipulatives.',
  'reading-writing': 'This student learns best through reading texts and writing notes. Include books, articles, and written exercises.'
};

export async function POST(req: Request) {
  try {
    const { childId, subject, gradeLevel, learningStyle, assignmentType, curriculum } = await req.json();

    if (!childId || !subject || !gradeLevel) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    const learningStyleNote = learningStyle && LEARNING_STYLE_DESCRIPTIONS[learningStyle as keyof typeof LEARNING_STYLE_DESCRIPTIONS]
      ? `\n\nLEARNING STYLE: ${LEARNING_STYLE_DESCRIPTIONS[learningStyle as keyof typeof LEARNING_STYLE_DESCRIPTIONS]}`
      : '';

    const curriculumNote = curriculum ? `\n\nCURRICULUM PREFERENCE: ${curriculum}` : '';

    const prompt = `
      You are an expert homeschool educator. Generate a personalized assignment for a ${gradeLevel} student studying ${subject}.
      ${learningStyleNote}${curriculumNote}
      
      Assignment type: ${assignmentType || 'practice'}
      
      Create an assignment that matches their learning style with appropriate activities and resources.
      
      Format the response as a valid JSON object with the following structure:
      {
        "title": "Clear, engaging assignment title",
        "subject": "${subject}",
        "description": "Detailed instructions for the assignment (2-3 paragraphs). Tailor the language and activities to the learning style.",
        "activities": [
          "Activity 1 (specific to learning style)",
          "Activity 2 (specific to learning style)",
          "Activity 3 (specific to learning style)"
        ],
        "resources": [
          {
            "label": "Resource name",
            "url": "Real URL to helpful resource matching learning style",
            "type": "${learningStyle || 'general'}"
          }
        ],
        "estimatedTime": "X minutes/hours",
        "grading_criteria": [
          "Criterion 1",
          "Criterion 2",
          "Criterion 3"
        ]
      }
      
      IMPORTANT LEARNING STYLE GUIDELINES:
      - Visual: Include diagrams, charts, videos, color-coding activities
      - Auditory: Include podcasts, verbal explanations, discussion prompts, music
      - Kinesthetic: Include hands-on experiments, building activities, movement-based tasks
      - Reading/Writing: Include books, articles, essay prompts, note-taking exercises
      
      Only return the JSON object. No other text.
    `;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    
    console.log('OpenRouter response:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      throw new Error(data.error.message || 'AI API Error');
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid API response structure');
    }

    const content = data.choices[0].message.content;
    console.log('AI generated assignment:', content);
    
    const assignment = JSON.parse(content);

    return NextResponse.json(assignment);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to generate assignment: ' + error.message }, { status: 500 });
  }
}
