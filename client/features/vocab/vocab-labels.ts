import {useTranslations} from 'next-intl';

const key = (value: string) => value.trim().toLowerCase().replaceAll(' ', '_');

/**
 * Names for what the AI and the quick filter store as English words: a topic ("urban life") or a part of speech
 * ("verb"). Known ones are translated; anything else, such as a topic the learner typed, is shown as it is (QA Q-21).
 */
export function useVocabLabels() {
  const t = useTranslations('vocab.labels');
  const label = (group: 'topic' | 'pos', value: string) =>
    t.has(`${group}.${key(value)}`) ? t(`${group}.${key(value)}`) : value;
  return {topic: (value: string) => label('topic', value), pos: (value: string) => label('pos', value)};
}
