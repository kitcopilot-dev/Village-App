import { NextResponse } from 'next/server';

/**
 * Community Sparks API
 * Allows fetching the global library of curated AI lessons.
 * This powers the 'Explore' section of the Lesson Library.
 */

// In a real production app, these would come from a 'global_lessons' PocketBase collection.
// For the current MVP, we hardcode the community-vetted lessons from how-november's OpenMAIC instance.
const COMMUNITY_SPARKS = [
  // Math
  { id: 'L-SBEY_U3i', topic: 'Fractions', subject: 'Math', grade: '3rd Grade', url: 'https://how-november.exe.xyz:3002/classroom/L-SBEY_U3i', description: 'Master the basics of parts of a whole with interactive visuals.' },
  { id: 'N-E_S0eZ4E', topic: 'Decimals', subject: 'Math', grade: '5th Grade', url: 'https://how-november.exe.xyz:3002/classroom/N-E_S0eZ4E', description: 'Go beyond the decimal point and explore place values.' },
  { id: '15A6OjrzZj', topic: 'Introduction to Algebra', subject: 'Math', grade: '6th Grade', url: 'https://how-november.exe.xyz:3002/classroom/15A6OjrzZj', description: 'Solve for X! A beginner-friendly guide to algebraic thinking.' },
  { id: 'NrbiZQaiKt', topic: 'Pre-Algebra', subject: 'Math', grade: '7th Grade', url: 'https://how-november.exe.xyz:3002/classroom/NrbiZQaiKt', description: 'Bridge the gap between arithmetic and complex algebra.' },
  { id: '3upEahoQVh', topic: 'Geometry', subject: 'Math', grade: 'High School', url: 'https://how-november.exe.xyz:3002/classroom/3upEahoQVh', description: 'Shapes, angles, and proofs: visualizing the world through math.' },
  // Science
  { id: 'OxHVofRcWy', topic: 'Plant Life Cycle', subject: 'Science', grade: 'Elementary', url: 'https://how-november.exe.xyz:3002/classroom/OxHVofRcWy', description: 'From seed to sprout: follow the journey of plant life.' },
  { id: 'nvCsEwRqoy', topic: 'Ecosystems', subject: 'Science', grade: 'Middle School', url: 'https://how-november.exe.xyz:3002/classroom/nvCsEwRqoy', description: 'Nature in balance: how living things depend on each other.' },
  { id: 'd9BKAW5lBf', topic: 'Chemistry Basics', subject: 'Science', grade: 'High School', url: 'https://how-november.exe.xyz:3002/classroom/d9BKAW5lBf', description: 'Atoms, molecules, and reactions that power the universe.' },
  // History
  { id: 'BukDLdIRei', topic: 'Ancient Egypt', subject: 'History', grade: 'Elementary', url: 'https://how-november.exe.xyz:3002/classroom/BukDLdIRei', description: 'Pyramids, pharaohs, and life along the Nile.' },
  { id: 'Yrae3zUZAA', topic: 'World War II', subject: 'History', grade: 'Middle School', url: 'https://how-november.exe.xyz:3002/classroom/Yrae3zUZAA', description: 'A deep dive into the turning points of the Second World War.' },
  { id: 'ohDg0tpE7r', topic: 'US Constitution', subject: 'History', grade: 'High School', url: 'https://how-november.exe.xyz:3002/classroom/ohDg0tpE7r', description: 'The framework of freedom: analyzing the US founding document.' },
  // Language Arts
  { id: 'g0PbloFUWr', topic: 'Reading Comprehension', subject: 'Language Arts', grade: 'Elementary', url: 'https://how-november.exe.xyz:3002/classroom/g0PbloFUWr', description: 'Strategies for understanding and enjoying every story.' },
  { id: 'eZ7mfsVgdB', topic: 'Animals & Nature Reading', subject: 'Language Arts', grade: 'Elementary', url: 'https://how-november.exe.xyz:3002/classroom/eZ7mfsVgdB', description: 'Enhance literacy while learning about the natural world.' },
  { id: 'oJiiVxpIU1', topic: 'Essay Writing', subject: 'Language Arts', grade: 'Middle School', url: 'https://how-november.exe.xyz:3002/classroom/oJiiVxpIU1', description: 'Structure, voice, and persuasion: how to write great essays.' },
  { id: 'Bo9e6KLyu7', topic: 'Literature Analysis', subject: 'Language Arts', grade: 'High School', url: 'https://how-november.exe.xyz:3002/classroom/Bo9e6KLyu7', description: 'Unlocking themes and symbolism in classic literature.' },
];

export async function GET() {
  return NextResponse.json(COMMUNITY_SPARKS);
}
