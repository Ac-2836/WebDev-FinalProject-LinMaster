import {useTranslations} from 'next-intl';

const key = (value: string) => value.trim().toLowerCase().replaceAll(' ', '_');

/**
 * Names for what the AI and the quick filter store as English words: a topic ("urban life") or a part of speech
 * ("verb"). Known ones are translated; anything else, such as a topic the learner typed, is shown as it is (QA Q-21).
 * An unknown topic gets a capital first letter like the translated ones, so a list never mixes "Education" and
 * "statistics" (QA V5).
 */
export function useVocabLabels() {
  const t = useTranslations('vocab.labels');
  const label = (group: 'topic' | 'pos', value: string, fallback: string) =>
    t.has(`${group}.${key(value)}`) ? t(`${group}.${key(value)}`) : fallback;
  const sentence = (value: string) => value.trim().charAt(0).toUpperCase() + value.trim().slice(1).toLowerCase();
  return {
    topic: (value: string) => label('topic', value, sentence(value)),
    pos: (value: string) => label('pos', value, value),
  };
}
