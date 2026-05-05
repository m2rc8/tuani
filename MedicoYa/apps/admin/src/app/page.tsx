import OtpForm from '../components/OtpForm'

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen -m-8">
      <div className="w-full max-w-sm px-4">
        <h1 className="text-2xl font-bold text-center mb-8 text-sky-400">MédicoYa Admin</h1>
        <OtpForm />
      </div>
    </div>
  )
}
