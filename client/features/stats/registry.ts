import type {ComponentType} from 'react';

import {ActivityWidget, BandsWidget, OverviewWidget, TopicsWidget, VocabWidget, WeaknessesWidget} from './widgets';

export type DashboardWidget = {
  id: string;
  /** `wide`: full-width rows on top. `main`: the two-column grid. `side`: stacked in the last grid cell. */
  place: 'wide' | 'main' | 'side';
  Component: ComponentType;
};

/**
 * Dashboard widget registry (PLAN B4, C6). A widget is added here instead of editing the page.
 * Order is display order within its place. Community joins `side` after P4-02 (`GET /stats/community`).
 */
export const dashboardWidgets: DashboardWidget[] = [
  {id: 'activity', place: 'wide', Component: ActivityWidget},
  {id: 'overview', place: 'wide', Component: OverviewWidget},
  {id: 'bands', place: 'main', Component: BandsWidget},
  {id: 'vocab', place: 'main', Component: VocabWidget},
  {id: 'weaknesses', place: 'main', Component: WeaknessesWidget},
  {id: 'topics', place: 'side', Component: TopicsWidget},
];
