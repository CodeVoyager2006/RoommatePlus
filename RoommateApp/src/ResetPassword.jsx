import { useState } from 'react'
import { supabaseClient } from './config/supabaseClient'

export default function ResetPassword() {
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')

  const update = async () => {
    setMsg('')
    const { error } = await supabaseClient.auth.updateUser({ password: pw })
    setMsg(error ? error.message : 'Password updated. You can close this tab.')
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Reset password</h2>
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" />
      <button onClick={update}>Update</button>
      {msg && <p>{msg}</p>}
    </div>
  )
}
