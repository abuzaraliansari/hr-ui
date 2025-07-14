import React, { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';

import Login from './components/Login';
import Home from './components/Home';
import TimesheetTable from './components/TimesheetTable';
import AddTimesheetEntry from './components/AddTimesheetEntry';
import ApproveTimeSheet from './components/ApproveTimeSheet';
import SeeTimesheetTable from './components/seetimesheet';
import ChangePassword from './components/ChangePassword';
import AddUser from './components/AddUser';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { useAuth } from './AuthContext';
import ManagerTimesheetPage from './components/ManagerTimesheetPage';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/" replace />;
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const isLoginPage = location.pathname === '/';

  useEffect(() => {
    if (isLoginPage) {
      // Clear auth data
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Disable back button
      window.history.pushState(null, '', window.location.href);
      const handlePopState = (e) => {
        if (window.location.pathname === '/') {
          window.history.pushState(null, '', window.location.href);
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [isLoginPage, setUser]);

  return (
    <>
    <div className='app-container' >
    <div className='header'>
      {<Navbar />}
      </div>
      <div className="main-content"> 
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
          <Route path="/TimesheetEntry" element={<PrivateRoute><TimesheetTable /></PrivateRoute>} />
          <Route path="/AddTimesheet" element={<PrivateRoute><AddTimesheetEntry /></PrivateRoute>} />
          <Route path="/ApproveTimesheet" element={<PrivateRoute><ApproveTimeSheet /></PrivateRoute>} />
          <Route path="/ViewTimesheetentries" element={<PrivateRoute><SeeTimesheetTable /></PrivateRoute>} />
          <Route path="/AddUser" element={<PrivateRoute><AddUser /></PrivateRoute>} />
          <Route path="/password" element={<PrivateRoute><ChangePassword /></PrivateRoute>} />
          <Route path="/managerTimesheet" element={<ManagerTimesheetPage />} />
          <Route path="*" element={<h2>404 - Page Not Found</h2>} />
        </Routes>
      </div>
      <div className='footer'>
      {<Footer />}
      </div>
      </div>
    </>
  );
}

export default App;
