import {pageTitle} from '@/core/i18n/page-title';
import {HomePage} from '@/features/home';

export const generateMetadata = pageTitle('home');

export default function Home() {
  return <HomePage />;
}
