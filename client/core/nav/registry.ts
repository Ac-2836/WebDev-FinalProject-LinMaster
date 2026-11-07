import type {LucideIcon} from 'lucide-react';
import {BookOpenText, ChartColumn, ClipboardCheck, House, Layers, Library, NotebookPen} from 'lucide-react';

export type NavItem = {
  id: string;
  href: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar; the rest go under "More". */
  mobile?: boolean;
};

/**
 * Nav registry (PLAN B4). A feature adds its destination here instead of editing the navbar.
 * Order is display order. Labels live in messages under `core.nav.<id>`.
 */
export const navItems: NavItem[] = [
  {id: 'home', href: '/home', icon: House, mobile: true},
  {id: 'read', href: '/read', icon: BookOpenText, mobile: true},
  {id: 'vocab', href: '/vocab', icon: NotebookPen},
  {id: 'flashcards', href: '/flashcards', icon: Layers, mobile: true},
  {id: 'tests', href: '/tests', icon: ClipboardCheck, mobile: true},
  {id: 'library', href: '/library', icon: Library},
  {id: 'dashboard', href: '/dashboard', icon: ChartColumn},
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
