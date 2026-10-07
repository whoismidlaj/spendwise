import { redirect } from 'next/navigation'

export default function DebtsRedirect() {
  redirect('/accounts?section=loans')
}
