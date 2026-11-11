import type {FlashcardSet, StudyMode} from '@linmaster/shared';
import {Brain, type LucideIcon, Rotate3d} from 'lucide-react';

import {FlipMode} from './flip-mode';
import {LearnMode} from './learn-mode';

export interface StudyModeEntry {
  id: StudyMode;
  icon: LucideIcon;
  component: (props: {set: FlashcardSet}) => React.ReactNode;
}

/**
 * Study mode registry (PLAN B4). A new mode (test, match, exercise) adds one entry here;
 * the set page lists them and `/flashcards/[id]/study/[mode]` renders them. Labels: `flashcard.set.<id>`.
 */
export const studyModes: StudyModeEntry[] = [
  {id: 'learn', icon: Brain, component: LearnMode},
  {id: 'flip', icon: Rotate3d, component: FlipMode},
];

export const findStudyMode = (id: string) => studyModes.find(m => m.id === id);
