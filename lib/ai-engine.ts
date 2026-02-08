/**
 * Village AI Lesson Engine - Logic Overview
 * 
 * This file documents how the feedback loop between student work and lesson generation works.
 */

export interface StudentStats {
    subject: string;
    averageScore: number;
    completedCount: number;
    weakPoints: string[];
    strongPoints: string[];
}

/**
 * STEP 1: Analyze Progress
 * I pull from 'student_progress' and 'portfolio' collections to build a context object.
 */
export async function buildStudentContext(childId: string) {
    // 1. Get recent quiz scores
    // 2. Read descriptions from recent portfolio samples (work products)
    // 3. Extract common keywords where score < 70% (weaknesses)
    // 4. Extract common keywords where score > 90% (strengths)
    
    return {
        childName: "...",
        grade: "5th",
        focus: "Visual learning",
        history: "Struggles with multiplication but excellent at spatial geometry.",
        recentWork: "Just completed a project on leaf patterns."
    };
}

/**
 * STEP 2: The Prompt
 * I use a specialized prompt to generate the structured JSON for the LessonPlayer.
 */
const SYSTEM_PROMPT = `
You are the Village Tutor, an adaptive AI educator. 
Generate a lesson for {childName} in {subject}.
Based on their history ({history}), ensure you use {focus} as the primary teaching method.

FORMAT:
Output structured JSON containing:
1. Hook: A story-based intro using their current interests.
2. Questions: A mix of Multiple Choice (auto-graded) and Reflection (AI-graded later).
3. Adaptation: If history shows struggles with X, include a bridge explanation in the hook.
`;

/**
 * STEP 3: Continuous Learning
 * After every lesson, I run a background task to update the 'student_insights' collection.
 */
export function updateInsights(progressData: any) {
    // Example logic:
    // If student mentions "I found this hard" in a reflection -> Add insight "Frustrated by abstract concepts."
    // If student answers all questions correctly in < 2 mins -> Add insight "Ready for advanced curriculum in this subject."
}
