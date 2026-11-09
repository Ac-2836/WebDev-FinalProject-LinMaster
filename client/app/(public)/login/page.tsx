import {LoginPage} from '@/features/auth';

export default async function Login({searchParams}: {searchParams: Promise<{next?: string | string[]}>}) {
  const {next} = await searchParams;
  return <LoginPage next={typeof next === 'string' ? next : undefined} />;
}
