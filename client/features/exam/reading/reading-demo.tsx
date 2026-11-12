'use client';

// shortcut: temporary demo of P3-13 with a fake test, delete with app/(exam)/reading-demo before handover.
import {useEffect, useState} from 'react';

import type {ExamGroup, ExamPassage, Highlight, Struck} from './reading-logic';
import {toggleStruck} from './reading-logic';
import {ReadingRoom} from './reading-room';

const PASSAGE: ExamPassage = {
  title: 'The history of glass',
  paragraphs: [
    {
      label: 'A',
      text: 'From our earliest origins, people have used glass. Natural glass, formed when lightning strikes sand or volcanic rock cools rapidly, was shaped into tools long before anyone learned to make it.',
    },
    {
      label: 'B',
      text: 'The first manufactured glass probably appeared as a glaze on pottery. Over centuries, craftsmen discovered that adding lime and soda made the material more durable, and glass vessels became objects of trade across the region.',
    },
    {
      label: 'C',
      text: 'It was the invention of the blowpipe, around the first century BC, that transformed the industry. Glassblowers could now produce thin, transparent containers quickly and cheaply, and for the first time glass was within reach of ordinary households.',
    },
    {
      label: 'D',
      text: 'In medieval Europe, the most celebrated use of glass was in religious buildings, where coloured windows told stories to congregations who could not read. Production remained a closely guarded skill, passed from master to apprentice.',
    },
    {
      label: 'E',
      text: 'Today, glass is engineered for purposes its early makers could never have imagined, from fibre-optic cables that carry data across oceans to screens that respond to the lightest touch.',
    },
  ],
};

const letters = (keys: string) => keys.split('').map(key => ({key, text: ''}));

const GROUPS: ExamGroup[] = [
  {
    kind: 'matching',
    fromNo: 14,
    toNo: 16,
    instructions:
      'The reading passage has five paragraphs, A–E. Which paragraph contains the following information?\nWrite the correct letter, A–E.',
    sharedOptions: letters('ABCDE'),
    questions: [
      {number: 14, prompt: 'a reference to glass being used to communicate with people who could not read'},
      {number: 15, prompt: 'the reason glass became affordable for most people'},
      {number: 16, prompt: 'an example of glass made without human involvement'},
    ],
  },
  {
    kind: 'tfng',
    fromNo: 17,
    toNo: 18,
    instructions: 'Do the following statements agree with the information given in the passage?',
    questions: [
      {number: 17, prompt: 'Early manufactured glass was first used as a surface coating on pottery.'},
      {number: 18, prompt: 'The blowpipe was invented in Europe.'},
    ],
  },
  {
    kind: 'ynng',
    fromNo: 19,
    toNo: 19,
    instructions: 'Do the following statements agree with the views of the writer?',
    questions: [{number: 19, prompt: 'Modern uses of glass would surprise its first makers.'}],
  },
  {
    kind: 'single_choice',
    fromNo: 20,
    toNo: 20,
    instructions: 'Choose the correct letter, A, B, C or D.',
    questions: [
      {
        number: 20,
        prompt: 'What made glass vessels more durable?',
        options: [
          {key: 'A', text: 'a new glaze'},
          {key: 'B', text: 'lime and soda'},
          {key: 'C', text: 'the blowpipe'},
          {key: 'D', text: 'volcanic rock'},
        ],
      },
    ],
  },
  {
    kind: 'multi_choice',
    fromNo: 21,
    toNo: 22,
    instructions: 'Choose TWO letters, A–E.',
    sharedOptions: [
      {key: 'A', text: 'tools'},
      {key: 'B', text: 'windows'},
      {key: 'C', text: 'coins'},
      {key: 'D', text: 'cables'},
      {key: 'E', text: 'mirrors'},
    ],
    questions: [
      {number: 21, prompt: 'Which TWO uses of glass are mentioned in the passage?'},
      {number: 22, prompt: 'Which TWO uses of glass are mentioned in the passage?'},
    ],
  },
  {
    kind: 'completion',
    fromNo: 23,
    toNo: 24,
    wordLimit: 2,
    instructions: 'Complete the summary below.\nChoose NO MORE THAN TWO WORDS from the passage for each answer.',
    questions: [
      {number: 23, prompt: 'Glassmaking changed after the {{blank}} was invented.'},
      {number: 24, prompt: 'Glass in medieval churches was used in {{blank}} that told stories.'},
    ],
  },
  {
    kind: 'short_answer',
    fromNo: 25,
    toNo: 25,
    wordLimit: 3,
    instructions: 'Answer the question below. Choose NO MORE THAN THREE WORDS from the passage.',
    questions: [{number: 25, prompt: 'Who learned the skill of glassmaking from a master?'}],
  },
  {
    kind: 'diagram_label',
    fromNo: 26,
    toNo: 26,
    wordLimit: 1,
    instructions: 'Label the diagram below. Choose ONE WORD ONLY from the passage.',
    questions: [{number: 26, prompt: 'Tube used to shape hot glass'}],
  },
];

interface DemoState {
  answers: Record<number, string | null>;
  highlights: Highlight[];
  struck: Struck;
}

const KEY = 'lm_reading_demo';

export function ReadingRoomDemo() {
  const [state, setState] = useState<DemoState>({answers: {}, highlights: [], struck: {}});
  const [current, setCurrent] = useState(14);
  const [loaded, setLoaded] = useState(false);

  // Stands in for the attempt autosave (P3-08): reload keeps answers, highlights and crossed-out options.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setState(JSON.parse(saved) as DemoState);
    } catch {
      // Ignore broken demo data.
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Private mode.
    }
  }, [state, loaded]);

  return (
    <div className="flex h-dvh flex-col bg-white text-[15px] text-black">
      <div className="shrink-0 border-b bg-muted/60 px-4 py-2.5 text-sm">
        <strong>Part 2</strong> &nbsp;Read the text and answer questions 14–26.
      </div>
      <ReadingRoom
        passage={PASSAGE}
        groups={GROUPS}
        answers={state.answers}
        onAnswer={patch => setState(s => ({...s, answers: {...s.answers, ...patch}}))}
        highlights={state.highlights}
        onHighlightsChange={highlights => setState(s => ({...s, highlights}))}
        struck={state.struck}
        onStrike={(n, key) => setState(s => ({...s, struck: toggleStruck(s.struck, n, key)}))}
        current={current}
        onCurrentChange={setCurrent}
      />
    </div>
  );
}
