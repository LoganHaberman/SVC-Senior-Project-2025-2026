import React from 'react'; 
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'; 
import LoginPg from './Login/LoginPg'; 
import FacilitatorPg from './Pages/FacilitatorPg'; 
import ProfPg from './Pages/ProfPg'; 
import AdminPg from './Pages/AdminPg'; 

const ProtectedRoute = ({ element, allowedRoles }: { element: React.ReactElement, allowedRoles: string[] }) => { 
  const role = localStorage.getItem('role'); 
  const userId = localStorage.getItem('userId'); 

  if (!userId || !role) return <Navigate to="/" replace />; 
  if (!allowedRoles.includes(role)) return <Navigate to="/" replace />; 

  return element; 
}; 

  

function App() { 
  return ( 
    <BrowserRouter basename="/CLP"> 
      <Routes> 
        <Route path="/" element={<LoginPg />} /> 
        <Route path="/facilitatordash" element={ 
          <ProtectedRoute element={<FacilitatorPg />} allowedRoles={['student']} /> 
        } /> 
        <Route path="/professordash" element={ 
          <ProtectedRoute element={<ProfPg />} allowedRoles={['professor']} /> 
        } /> 
        <Route path="/admindash" element={ 
          <ProtectedRoute element={<AdminPg />} allowedRoles={['admin']} /> 
        } /> 
        <Route path="*" element={<Navigate to="/" replace />} /> 
      </Routes> 
    </BrowserRouter> 
  ); 
} 

export default App; 