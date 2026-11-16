import {pageTitle} from '@/core/i18n/page-title';
import {ProfilePage} from '@/features/auth';

export const generateMetadata = pageTitle('profile');

export default function Profile() {
  return <ProfilePage />;
}
