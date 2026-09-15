import { redirect } from 'next/navigation'

export default function DepositPage() {
  redirect('/?tab=wallet&action=deposit')
}
