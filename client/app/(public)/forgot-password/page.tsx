import {pageTitle} from '@/core/i18n/page-title';
import {ForgotPasswordPage} from '@/features/auth';

export const generateMetadata = pageTitle('forgotPassword');

export default function ForgotPassword() {
  return <ForgotPasswordPage />;
}
