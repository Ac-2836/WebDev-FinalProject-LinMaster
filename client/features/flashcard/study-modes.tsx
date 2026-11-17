import type {FlashcardSet, StudyMode} from '@linmaster/shared';
import {QUIZ_MIN_CARDS} from '@linmaster/shared';
import {Brain, ListChecks, type LucideIcon, Rotate3d, Timer} from 'lucide-react';

import {FlipMode} from './flip-mode';
import {LearnMode} from './learn-mode';
import {MatchMode} from './match-mode';
import {TestMode} from './test-mode';

export interface StudyModeEntry {
  id: StudyMode;
  icon: LucideIcon;
  /** Fewest cards the mode works with; the set page shows it locked below this. */
  minCards?: number;
  component: (props: {set: FlashcardSet}) => React.ReactNode;
}

/**
 * Study mode registry (PLAN B4). A new mode (exercise) adds one entry here;
 * the set page lists them and `/flashcards/[id]/study/[mode]` renders them. Labels: `flashcard.set.<id>`.
 */
export const studyModes: StudyModeEntry[] = [
  {id: 'learn', icon: Brain, component: LearnMode},
  {id: 'flip', icon: Rotate3d, component: FlipMode},
  {id: 'test', icon: ListChecks, component: TestMode, minCards: QUIZ_MIN_CARDS},
  {id: 'match', icon: Timer, component: MatchMode, minCards: QUIZ_MIN_CARDS},
];

export const findStudyMode = (id: string) => studyModes.find(m => m.id === id);
