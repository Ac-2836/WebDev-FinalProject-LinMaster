import {pageTitle} from '@/core/i18n/page-title';
import {RegisterPage} from '@/features/auth';

export const generateMetadata = pageTitle('register');

export default function Register() {
  return <RegisterPage />;
}
