// PocketBase Collection Types
export interface User {
  id: string;
  email: string;
  verified: boolean;
  created: string;
  updated: string;
}

export interface Profile {
  id: string;
  user: string;
  family_name: string;
  description?: string;
  location?: string;
  children_ages?: string;
  profile_latitude?: number;
  profile_longitude?: number;
  telegram_id?: string;
  created: string;
  updated: string;
  profile_complete?: boolean;
  family_code?: string;
  faith_preference?: 'none' | 'christian' | 'lds';
}

export interface Child {
  id: string;
  user: string;
  name: string;
  age: number;
  grade?: string;
  focus?: string;
  created: string;
  updated: string;
  courses?: Course[];
  family_code?: string;
}

export interface Course {
  id: string;
  child: string;
  name: string;
  total_lessons: number;
  current_lesson: number;
  grade_level?: string;
  start_date?: string;
  active_days?: string; // Comma-separated or JSON
  last_lesson_date?: string; // YYYY-MM-DD
  created: string;
  updated: string;
}

export interface ActivityLog {
  id: string;
  user: string;
  child: string;
  type: 'lesson_complete' | 'portfolio_add' | 'event_join';
  title: string;
  description?: string;
  date: string;
}

export interface Event {
  id: string;
  creator: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  location: string;
  age_suitability?: string;
  max_capacity?: number;
  latitude?: number;
  longitude?: number;
  supplies?: string;
  created: string;
  updated: string;
  expand?: {
    creator?: Profile;
  };
}

export interface PortfolioItem {
  id: string;
  child: string;
  title: string;
  subject?: string;
  image: string | string[]; // URL(s) or File ID(s)
  description?: string;
  date: string;
  created: string;
  updated: string;
}

export interface LegalGuide {
  id: string;
  state: string;
  regulation_level: 'Low' | 'Moderate' | 'High';
  requirements: string;
  notification_requirements?: string;
  testing_requirements?: string;
  record_keeping?: string;
  withdrawal_process?: string;
  resources?: string;
  created: string;
  updated: string;
}

export interface SchoolYear {
  id: string;
  user: string;
  name: string;
  start_date: string;
  end_date: string;
  created: string;
  updated: string;
}

export interface SchoolBreak {
  id: string;
  school_year: string;
  name: string;
  start_date: string;
  end_date: string;
  created: string;
  updated: string;
}

export interface Attendance {
  id: string;
  user: string;
  child: string;
  date: string;
  status: 'present' | 'absent' | 'half-day' | 'sick' | 'holiday';
  notes?: string;
  created: string;
  updated: string;
}

export interface Lesson {
  id: string;
  user: string;
  child?: string;
  title: string;
  grade_level: string;
  subject: string;
  type: 'shared' | 'tailored';
  content: {
    hook: string;
    activity: string;
    resources: { label: string; url: string }[];
  };
  interactive_data: {
    questions: {
      id: string;
      text: string;
      type: 'multiple-choice' | 'text' | 'reflection';
      options?: string[];
      answer?: string;
    }[];
  };
  created: string;
  updated: string;
}

export interface StudentProgress {
  id: string;
  user: string;
  child: string;
  lesson: string;
  score?: number;
  feedback?: string;
  data: any;
  created: string;
  updated: string;
}

export interface StudentInsight {
  id: string;
  user: string;
  child: string;
  subject: string;
  observation: string;
  last_updated: string;
  created: string;
  updated: string;
}

export interface Assignment {
  id: string;
  user: string;
  child?: string;
  title: string;
  description?: string;
  subject?: string;
  due_date?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'Graded';
  score?: number;
  feedback?: string;
  created: string;
  updated: string;
}

export interface FamilyChild {
  id: string;
  profile: string;
  first_name: string;
  nickname?: string;
  grade_level: string;
  birthdate?: string;
  interests: string[];
  family_code: string;
  pin?: string;
  created: string;
  updated: string;
}

export interface Resource {
  id: string;
  user: string;
  child?: string;
  title: string;
  description?: string;
  url?: string;
  type: 'website' | 'book' | 'video' | 'printable' | 'supply' | 'app' | 'other';
  subject?: string;
  tags?: string[];
  rating?: number;
  notes?: string;
  cost?: number;
  is_favorite?: boolean;
  archived?: boolean;
  created: string;
  updated: string;
}
