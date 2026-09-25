import { redirect } from 'next/navigation'
import { requireAdminUser } from '@/lib/auth'
import ControlCenter from './control-center'

export const metadata = {
  title: 'Quantix Prime Control Center',
  robots: { index: false, follow: false },
}

export default async function AdminPage() {
  try {
    await requireAdminUser()
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      redirect('/sign-in?next=/qx7-ops-4m9k2')
    }
    redirect('/')
  }
  return <ControlCenter />
}
