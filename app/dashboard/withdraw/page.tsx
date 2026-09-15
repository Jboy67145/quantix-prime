import { redirect } from 'next/navigation'

export default function WithdrawPage() {
  redirect('/?tab=wallet&action=withdraw')
}
