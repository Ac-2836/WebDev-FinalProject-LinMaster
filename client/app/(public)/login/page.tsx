import {pageTitle} from '@/core/i18n/page-title';
import {LoginPage} from '@/features/auth';

export const generateMetadata = pageTitle('login');

export default async function Login({searchParams}: {searchParams: Promise<{next?: string | string[]}>}) {
  const {next} = await searchParams;
  return <LoginPage next={typeof next === 'string' ? next : undefined} />;
}
