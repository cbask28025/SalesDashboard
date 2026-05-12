import { login } from './actions'
import LoginForm from './form'

export const metadata = { title: 'Sign in — CTB Sales Dashboard' }

export default function LoginPage({ searchParams }) {
  return <LoginForm action={login} error={searchParams?.error} />
}
