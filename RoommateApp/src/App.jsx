import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import './App.css'
import Chores from './Chores.jsx'
import Chat from './Chat.jsx'
import Machine from './Machine.jsx'
import Setting from './Setting.jsx'
function App() {
  const [count, setCount] = useState(0)

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Chores />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Router>
  )
}

export default App
