import { Metadata } from "next"

import LoginTemplate from "@modules/account/templates/login-template"

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke akun Medusa Store Anda.",
}

export default function Login() {
  return <LoginTemplate />
}
