import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getAllTimesheetEntries } from '../api';
import '../App.css';

const projectOptions = [
  { value: '1', label: 'TMS' },
  { value: '2', label: 'IntMavens' },
  { value: '3', label: 'USLBM' },
  { value: '4', label: 'Leave' }
];

const employeeOptions = [
  { value: '1', label: 'ab' },
  { value: '2', label: 'Hr' },
  { value: '3', label: 'Ad' },
  { value: '18', label: 'ShelendraTomar' },
  { value: '19', label: 'Faisal' },
  { value: '20', label: 'Sandeep' },
  { value: '21', label: 'bhagyaSankar' },
  { value: '22', label: 'MahipalButola' },
  { value: '23', label: 'Abuzar' },
  { value: '24', label: 'Shelendra Tomar' },
  { value: '25', label: 'Hemant' },
  { value: '26', label: 'VandanaKumari' }
];

const Home = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuth();
  const [rejectedEntries, setRejectedEntries] = React.useState([]);

  // If user is passed via navigation (e.g., after login), update context
  React.useEffect(() => {
    if (location.state && location.state.user) {
      setUser(location.state.user);
    }
    // Print user from param and from AuthContext
    console.log('user from param:', location.state?.user);
    console.log('user from AuthContext:', user);
    // eslint-disable-next-line
  }, [location.state, setUser]);

  // Get first roleName if available
  const roleName = user?.roles && user.roles.length > 0 ? user.roles[0].roleName : '';

  React.useEffect(() => {
    // Get EmployeeID from navigation or AuthContext
    const empId = location.state?.user?.EmployeeID || user?.EmployeeID;
    if (!empId) return;
    getAllTimesheetEntries(empId)
      .then(res => {
        // Filter for rejected status (case-insensitive)
        const rejected = (res.data || []).filter(e => String(e.Status).toLowerCase() === 'rejected');
        setRejectedEntries(rejected);
      })
      .catch(() => setRejectedEntries([]));
  }, [location.state, user]);

  const sendMailHidden = async () => {
    try {
      await fetch('https://babralauatapi-d9abe9h8frescchd.centralindia-01.azurewebsites.net/api/getUserData', {
        method: 'POST', // If GET, change to 'GET'
        // No body as per requirement
      });
      // Optionally handle response
    } catch (err) {
      // Optionally handle error
      console.error('Send mail API error:', err);
    }
  };

  return (
    <div className="home-container">
      <h2 className="welcome-heading">
        {user
          ? `Welcome ${user.username}`
          : 'Welcome'}
      </h2>
      <div className="button-group">
        <button className="home-btn" onClick={() => navigate(`/TimesheetEntry`)}>
          TimeSheet Entry
        </button>
        <button className="home-btn" onClick={() => navigate(`/password`)}>
          Change Password
        </button>
         <button className="home-btn" onClick={() => navigate(`/AddUser`)}>
          Add user
        </button>
        {roleName !== 'user' && (
          <>
            <button className="home-btn" onClick={() => navigate(`/ApproveTimesheet`)}>
              Approve  TimeSheet Entry
            </button>
            <button className="home-btn" onClick={sendMailHidden} id="hidden-send-mail-btn">Send Mail</button>
          </>
        )}
      </div>

      {/* Rejected Entries Table with Details */}
      {rejectedEntries.length > 0 && (
        <div className="rejected-entries-container">
          <h3 className="rejected-entries-heading">Rejected Timesheet Entries</h3>
          <table className="rejected-entries-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee Name</th>
                <th>Project</th>
                <th>Category</th>
                <th>TaskID</th>
                <th>Task</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Comment</th>
                <th>Manager Comment</th>
              </tr>
            </thead>
            <tbody>
              {rejectedEntries.map(entry => (
                <tr key={entry.EntryID}>
                  <td>{entry.Date ? new Date(entry.Date).toLocaleDateString() : ''}</td>
                  <td>{employeeOptions.find(opt => opt.value === String(entry.EmployeeID))?.label || entry.EmployeeID}</td>
                  <td>{projectOptions.find(opt => opt.value === String(entry.ProjectID))?.label || entry.ProjectsName || entry.ProjectID}</td>
                  <td>{entry.Cateogary}</td>
                  <td>{entry.TaskID}</td>
                  <td>{entry.Task}</td>
                  <td>{entry.TotalHours}</td>
                  <td>{entry.Status}</td>
                  <td>{entry.Comment}</td>
                  <td>{entry.ManagerComment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Home;