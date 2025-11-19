import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import StudentPg from './Pages/StudentPg'

function App(){
    return(
        <Router>
            <nav>
                <Link to="/studentdash">Student Page</Link>
            </nav>
            <Routes>
                <Route path="/studentdash" element={<StudentPg />} /> 
            </Routes>
        </Router>
    )
}

export default App