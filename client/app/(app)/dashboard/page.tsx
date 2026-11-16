import {pageTitle} from '@/core/i18n/page-title';
import {DashboardPage} from '@/features/stats';

export const generateMetadata = pageTitle('dashboard');

export default function Dashboard() {
  return <DashboardPage />;
}
