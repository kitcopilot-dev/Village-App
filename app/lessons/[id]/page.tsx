'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Lesson, StudentProgress } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';

export default function LessonPlayerPage() {
  const { id } = useParams();
  const router = useRouter();
  const pb = getPocketBase();
  
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    if (id) loadLesson(id as string);
  }, [id]);

  const loadLesson = async (lessonId: string) => {
    try {
      const record = await pb.collection('lessons').getOne(lessonId);
      setLesson(record as unknown as Lesson);
    } catch (error) {
      console.error('Lesson load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId: string, value: string) => {
    if (showFeedback) return; // Prevent changing after check
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const checkAnswer = () => {
    setShowFeedback(true);
  };

  const handleNext = () => {
    setShowFeedback(false);
    if (lesson && currentQuestion < lesson.interactive_data.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      submitProgress();
    }
  };

  const submitProgress = async () => {
    if (!lesson) return;
    try {
      const userId = pb.authStore.model?.id;
      // For prototype, we'll assume the child is the one selected in profile
      // In production, we'd have a specific student login
      const childId = lesson.child; 

      let correctCount = 0;
      lesson.interactive_data.questions.forEach(q => {
        if (q.type === 'multiple-choice' && answers[q.id] === q.answer) {
          correctCount++;
        }
      });

      const score = (correctCount / lesson.interactive_data.questions.length) * 100;

      await pb.collection('student_progress').create({
        user: userId,
        child: childId,
        lesson: lesson.id,
        score,
        data: { answers },
        feedback: score >= 80 ? 'Excellent work!' : 'Good effort! Let\'s review some concepts.'
      });

      setCompleted(true);
      setToast({ message: 'Lesson completed and graded!', type: 'success' });
    } catch (error) {
      setToast({ message: 'Failed to save progress', type: 'error' });
    }
  };

  if (loading) return <LoadingScreen message="Opening lesson materials..." />;
  if (!lesson) return <div className="p-20 text-center">Lesson not found.</div>;

  if (completed) {
    return (
      <>
        <Header />
        <main className="max-w-3xl mx-auto my-20 px-8 text-center animate-fade-in">
          <Card className="p-12">
            <div className="text-6xl mb-8">🏆</div>
            <h2 className="font-display text-4xl font-extrabold mb-4">Lesson Complete!</h2>
            <p className="text-xl text-text-muted mb-8 font-serif italic">Fantastic job on &ldquo;{lesson.title}&rdquo;</p>
            <Button size="lg" onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
          </Card>
        </main>
      </>
    );
  }

  const q = lesson.interactive_data.questions[currentQuestion];

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary bg-primary/10 px-3 py-1 rounded-full">{lesson.subject} • Grade {lesson.grade_level}</span>
          <h2 className="font-display text-4xl font-extrabold mt-4 mb-2">{lesson.title}</h2>
          <div className="w-full bg-bg-alt h-1 rounded-full mt-8">
            <div 
              className="bg-primary h-1 rounded-full transition-all duration-500" 
              style={{ width: `${((currentQuestion + 1) / lesson.interactive_data.questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* The Lesson Content (The Hook / The Story) */}
        {currentQuestion === 0 && (
          <Card className="p-8 mb-12 bg-primary/5 border-primary/20 animate-fade-in">
            <h3 className="font-serif italic text-2xl mb-4">The Spark</h3>
            <p className="text-lg leading-relaxed text-text-main">{lesson.content.hook}</p>
          </Card>
        )}

        {/* The Interactive Part */}
        <Card className="p-8 md:p-12 shadow-hover min-h-[400px] flex flex-col">
          <div className="flex-1">
            <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-8">Activity {currentQuestion + 1} of {lesson.interactive_data.questions.length}</p>
            <h3 className="text-2xl font-bold mb-10 leading-tight">{q.text}</h3>

            {q.type === 'multiple-choice' && (
              <div className="grid grid-cols-1 gap-4">
                {q.options?.map((opt, i) => {
                  const isSelected = answers[q.id] === opt;
                  const isCorrect = q.answer === opt;
                  let buttonClass = 'bg-bg-alt text-text-main border-transparent hover:border-primary/30';
                  
                  if (isSelected) {
                    if (showFeedback) {
                      buttonClass = isCorrect ? 'bg-green-500 text-white border-green-600' : 'bg-red-500 text-white border-red-600';
                    } else {
                      buttonClass = 'bg-primary text-white border-primary shadow-lg scale-[1.02]';
                    }
                  } else if (showFeedback && isCorrect) {
                    buttonClass = 'bg-green-100 text-green-700 border-green-500 border-dashed';
                  }

                  return (
                    <button
                      key={i}
                      disabled={showFeedback}
                      onClick={() => handleAnswer(q.id, opt)}
                      className={`w-full p-6 rounded-2xl text-left font-bold transition-all border-2 ${buttonClass}`}
                    >
                      <div className="flex justify-between items-center">
                        <span>{opt}</span>
                        {showFeedback && isSelected && (isCorrect ? '✓' : '✗')}
                        {showFeedback && !isSelected && isCorrect && '← Correct Answer'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === 'reflection' && (
              <textarea
                className="w-full p-6 rounded-2xl bg-bg-alt border-2 border-transparent focus:border-primary focus:bg-white transition-all min-h-[200px] font-body"
                placeholder="Type your thoughts here..."
                value={answers[q.id] || ''}
                onChange={(e) => handleAnswer(q.id, e.target.value)}
              />
            )}
          </div>

          <div className="mt-12 flex justify-end gap-4">
            {!showFeedback && q.type === 'multiple-choice' && (
              <Button variant="secondary" size="lg" onClick={checkAnswer} disabled={!answers[q.id]}>
                Check Answer
              </Button>
            )}
            {(showFeedback || q.type !== 'multiple-choice') && (
              <Button 
                size="lg" 
                onClick={handleNext} 
                disabled={!answers[q.id]}
              >
                {currentQuestion === lesson.interactive_data.questions.length - 1 ? 'Finish Lesson' : 'Next Step →'}
              </Button>
            )}
          </div>
        </Card>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
