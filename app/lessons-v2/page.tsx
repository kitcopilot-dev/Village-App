'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { getPocketBase } from '@/lib/pocketbase';

type MasteryStatus = 'ready' | 'assigned' | 'in_progress' | 'mastered' | 'reinforce';

type Lesson = {
  id: string;
  title: string;
  subject: string;
  child: string;
  age: number;
  gradeBand: string;
  order: number;
  minutes: number;
  sourceStyle: string;
  status: MasteryStatus;
  objective: string;
  skills: string[];
  blocks: string[];
  parentRecommendation: string;
  evidence: string[];
};

const LESSONS: Lesson[] = [
  {
    id: 'photosynthesis-9',
    title: 'Photosynthesis: Nature’s Food Factory',
    subject: 'Science',
    child: '9yo learner',
    age: 9,
    gradeBand: '3rd–4th',
    order: 1,
    minutes: 25,
    sourceStyle: 'OER-style explainer + simulation + exit ticket',
    status: 'ready',
    objective: 'Explain how plants use sunlight, water, and carbon dioxide to make sugar and oxygen.',
    skills: ['life-science.energy-flow', 'vocabulary.chlorophyll', 'diagram-labeling', 'cause-effect'],
    blocks: ['Warm-up question', 'Interactive diagram', 'AI teacher chat', 'Vocabulary match', 'Exit ticket'],
    parentRecommendation: 'Assign next. This is the recommended science lesson before food chains.',
    evidence: ['Diagram labels', 'Vocabulary accuracy', 'Short answer exit ticket'],
  },
  {
    id: 'division-remainders-9',
    title: 'Division with Remainders in Real Life',
    subject: 'Math',
    child: '9yo learner',
    age: 9,
    gradeBand: '3rd–4th',
    order: 2,
    minutes: 20,
    sourceStyle: 'Khan-style mastery practice + story problems',
    status: 'assigned',
    objective: 'Solve division problems with remainders and explain what the remainder means.',
    skills: ['division.facts', 'remainders', 'word-problems', 'multiplication-check'],
    blocks: ['Mini lesson', 'Guided practice', 'Word problem builder', '4-question mastery check'],
    parentRecommendation: 'Assigned for today. Move forward if mastery check is 3/4 or better with explanation.',
    evidence: ['Practice attempts', 'Mastery score', 'Explanation quality'],
  },
  {
    id: 'animal-habitats-6',
    title: 'Animal Habitats: Who Lives Where?',
    subject: 'Science',
    child: '6yo learner',
    age: 6,
    gradeBand: 'K–1st',
    order: 1,
    minutes: 15,
    sourceStyle: 'PBS Kids-style picture matching + oral narration',
    status: 'mastered',
    objective: 'Match animals to habitats and describe why the habitat helps them survive.',
    skills: ['classification', 'oral-explanation', 'habitat-needs'],
    blocks: ['Picture sort', 'Listen and choose', 'Draw one habitat', 'Parent oral check'],
    parentRecommendation: 'Move forward to food chains. Student showed mastery with picture matching and oral explanation.',
    evidence: ['5/5 matches correct', 'Parent oral check complete', 'Drawing uploaded'],
  },
  {
    id: 'chemical-equations-13',
    title: 'Balancing Chemical Equations',
    subject: 'Science',
    child: '13yo learner',
    age: 13,
    gradeBand: '7th–8th',
    order: 4,
    minutes: 35,
    sourceStyle: 'PhET-style simulation + scaffolded problem set',
    status: 'reinforce',
    objective: 'Balance chemical equations by conserving atoms on both sides of a reaction.',
    skills: ['conservation-of-mass', 'coefficients', 'equation-balancing', 'scientific-reasoning'],
    blocks: ['Concept animation', 'Atom counter', 'Guided examples', 'Mastery challenge', 'Reflection'],
    parentRecommendation: 'Reinforce before moving forward. Student understands the idea but changes subscripts on harder items.',
    evidence: ['6/10 challenge score', 'Two subscript errors', 'Reflection mentions conservation correctly'],
  },
];

const statusStyle: Record<MasteryStatus, string> = {
  ready: 'bg-white text-primary border-border',
  assigned: 'bg-accent-soft text-primary-dark border-accent/40',
  in_progress: 'bg-secondary/10 text-secondary-hover border-secondary/30',
  mastered: 'bg-primary text-white border-primary',
  reinforce: 'bg-orange-50 text-orange-700 border-orange-200',
};

const statusLabel: Record<MasteryStatus, string> = {
  ready: 'Recommended next',
  assigned: 'Assigned today',
  in_progress: 'In progress',
  mastered: 'Mastered',
  reinforce: 'Reinforce',
};

function LessonCard({ lesson, selected, onSelect }: { lesson: Lesson; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[1.75rem] border p-4 text-left transition-all ${selected ? 'border-primary bg-white shadow-hover' : 'border-border/80 bg-white/70 hover:border-primary/40 hover:bg-white'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">{lesson.child} · {lesson.subject}</p>
          <h3 className="mt-1 font-display text-xl font-extrabold leading-tight text-text">{lesson.title}</h3>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-black ${statusStyle[lesson.status]}`}>{statusLabel[lesson.status]}</span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-text-muted">{lesson.objective}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {lesson.skills.slice(0, 3).map((skill) => (
          <span key={skill} className="rounded-full bg-bg-alt px-2.5 py-1 text-[11px] font-bold text-text-muted">{skill}</span>
        ))}
      </div>
    </button>
  );
}

function InteractivePreview({ lesson }: { lesson: Lesson }) {
  const [step, setStep] = useState(0);
  const activity = lesson.blocks[step];
  const progress = Math.round(((step + 1) / lesson.blocks.length) * 100);

  return (
    <section className="rounded-[2rem] border border-border bg-primary-dark p-5 text-white shadow-[0_24px_70px_-45px_rgba(45,59,41,.9)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-white/50">Student interactive mode</p>
          <h3 className="font-display text-2xl font-extrabold">{activity}</h3>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-black">{step + 1}/{lesson.blocks.length}</span>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[1.5rem] bg-white/10 p-4">
          <p className="text-sm font-semibold text-white/70">AI teacher prompt</p>
          <p className="mt-2 text-lg leading-relaxed">
            Let’s work through <strong>{lesson.title}</strong>. I’ll explain one idea, ask you to interact, then check if you’re ready to move on.
          </p>
          <div className="mt-4 rounded-2xl bg-white p-4 text-primary-dark">
            <p className="text-sm font-black">Your turn</p>
            <p className="mt-1 text-sm">Answer, drag, match, label, or explain here depending on the block type.</p>
          </div>
        </div>

        <div className="rounded-[1.5rem] bg-white p-4 text-primary-dark">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">Mastery evidence captured</p>
          <ul className="mt-3 space-y-2 text-sm font-semibold">
            {lesson.evidence.map((item) => <li key={item}>✓ {item}</li>)}
          </ul>
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="border-white/30 bg-white/10 text-white hover:bg-white/20">Back</Button>
        <Button onClick={() => setStep(Math.min(lesson.blocks.length - 1, step + 1))} disabled={step === lesson.blocks.length - 1} className="bg-accent text-primary-dark hover:bg-accent-soft">Next block</Button>
      </div>
    </section>
  );
}

export default function LessonsV2Page() {
  const router = useRouter();
  const pb = getPocketBase();
  const [selectedId, setSelectedId] = useState(LESSONS[0].id);
  const [assignedIds, setAssignedIds] = useState(() => LESSONS.filter((lesson) => lesson.status === 'assigned').map((lesson) => lesson.id));
  const lessons = useMemo(
    () => LESSONS.map((lesson) => (assignedIds.includes(lesson.id) && lesson.status === 'ready' ? { ...lesson, status: 'assigned' as MasteryStatus } : lesson)),
    [assignedIds]
  );
  const selected = useMemo(() => lessons.find((lesson) => lesson.id === selectedId) ?? lessons[0], [lessons, selectedId]);
  const recommended = lessons.filter((lesson) => lesson.status === 'ready' || lesson.status === 'reinforce');
  const isAssigned = assignedIds.includes(selected.id);

  const handleAssign = () => {
    setAssignedIds((current) => (current.includes(selected.id) ? current : [...current, selected.id]));
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="min-h-screen px-4 py-6 md:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="overflow-hidden rounded-[2.25rem] border border-border bg-white/75 shadow-hover backdrop-blur">
            <div className="grid gap-6 p-6 md:grid-cols-[1.1fr_.9fr] md:p-8">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-secondary">Lessons V2 prototype</p>
                <h1 className="mt-2 font-display text-4xl font-extrabold leading-none text-primary md:text-6xl">Structured learning, AI-assisted.</h1>
                <p className="mt-4 max-w-2xl text-lg text-text-muted">
                  A simpler flow: Village recommends the next lesson, the parent assigns it, students complete interactive blocks, and mastery results become documentation.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
                <div className="rounded-3xl bg-bg-alt p-4"><p className="text-3xl font-black text-primary">{LESSONS.length}</p><p className="text-sm font-bold text-text-muted">seed lesson examples</p></div>
                <div className="rounded-3xl bg-accent-soft p-4"><p className="text-3xl font-black text-primary">{recommended.length}</p><p className="text-sm font-bold text-text-muted">need parent decision</p></div>
                <div className="rounded-3xl bg-primary p-4 text-white"><p className="text-3xl font-black">1</p><p className="text-sm font-bold text-white/70">student interaction model</p></div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
            <section className="space-y-4">
              <div className="rounded-[2rem] border border-border bg-white/80 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Recommended order</p>
                <div className="mt-4 space-y-3">
                  {lessons.map((lesson) => (
                    <LessonCard key={lesson.id} lesson={lesson} selected={lesson.id === selected.id} onSelect={() => setSelectedId(lesson.id)} />
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="rounded-[2rem] border border-border bg-white/85 p-6 shadow">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Lesson preview</p>
                    <h2 className="mt-1 font-display text-3xl font-extrabold text-text">{selected.title}</h2>
                    <p className="mt-2 text-text-muted">{selected.objective}</p>
                  </div>
                  <Button onClick={handleAssign} disabled={isAssigned} className="bg-primary hover:bg-primary-light disabled:opacity-80">
                    {isAssigned ? 'Assigned ✓' : 'Assign lesson'}
                  </Button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-3xl bg-bg-alt p-4"><p className="text-xs font-black uppercase text-text-muted">Age / grade</p><p className="mt-1 font-bold">Age {selected.age} · {selected.gradeBand}</p></div>
                  <div className="rounded-3xl bg-bg-alt p-4"><p className="text-xs font-black uppercase text-text-muted">Time</p><p className="mt-1 font-bold">~{selected.minutes} minutes</p></div>
                  <div className="rounded-3xl bg-bg-alt p-4"><p className="text-xs font-black uppercase text-text-muted">Inspired by</p><p className="mt-1 font-bold">{selected.sourceStyle}</p></div>
                </div>

                <div className="mt-6">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Skill tags</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selected.skills.map((skill) => <span key={skill} className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-bold text-text-muted">{skill}</span>)}
                  </div>
                </div>
              </div>

              <InteractivePreview lesson={selected} />

              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[2rem] border border-border bg-white/85 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Parent update after completion</p>
                  <p className="mt-3 text-lg font-bold text-text">{selected.parentRecommendation}</p>
                </div>
                <div className="rounded-[2rem] border border-border bg-white/85 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Recorded automatically</p>
                  <ul className="mt-3 space-y-2 text-sm font-semibold text-text-muted">
                    <li>Completion date + duration</li>
                    <li>Responses, score, and attempts</li>
                    <li>Mastery status and next recommendation</li>
                    <li>Portfolio / weekly summary / transcript evidence</li>
                  </ul>
                </div>
              </section>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
