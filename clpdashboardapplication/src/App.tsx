import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPg from './Login/LoginPg';
import StudentPg from './Pages/StudentPg';
import ProfPg from './Pages/ProfPg';
import AdminPg from './Pages/AdminPg';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LoginPg />} />
                <Route path="/studentdash" element={<StudentPg />} />
                <Route path="/professordash" element={<ProfPg />} />
                <Route path="/admindash" element={<AdminPg />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;