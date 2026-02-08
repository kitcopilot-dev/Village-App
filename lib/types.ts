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
  created: string;
  updated: string;
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
}

export interface Course {
  id: string;
  child: string;
  name: string;
  total_lessons: number;
  current_lesson: number;
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
  user: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  age_suitability?: string;
  max_capacity?: number;
  supplies?: string; // JSON string
  created: string;
  updated: string;
  expand?: {
    user?: User;
  };
}

export interface Assignment {
  id: string;
  user: string;
  child?: string;
  title: string;
  description?: string;
  subject?: string;
  due_date: string;
  status?: string;
  score?: number;
  event_link?: string;
  created: string;
  updated: string;
}

export interface PortfolioItem {
  id: string;
  child: string;
  title: string;
  subject?: string;
  image: string; // URL or File ID
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
