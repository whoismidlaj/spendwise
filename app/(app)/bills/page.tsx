import { redirect } from 'next/navigation'

export default function BillsRedirect() {
  redirect('/payments')
}
