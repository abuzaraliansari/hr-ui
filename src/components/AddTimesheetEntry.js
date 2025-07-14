import React, { useState } from 'react';
import { createTimesheetEntry } from '../api';
import { useAuth } from '../AuthContext';
import '../App.css';

const AddTimesheetEntry = () => {

    const { user } = useAuth();
    const employeeId = user?.EmployeeID;
    const roleName = user?.roles && user.roles.length > 0 ? user.roles[0].roleName.toLowerCase() : '';
  const [formData, setFormData] = useState({
    ProjectID: '',
    Date: '',
    TotalHours: '',
    Comment: '',
    ManagerComment: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const data = {
        ...formData,
        EmployeeID: employeeId,
        CreatedBy: 'system',
      };
      await createTimesheetEntry(data);
      setMessage('Timesheet entry added successfully!');
      setFormData({ ProjectID: '', Date: '', TotalHours: '', Comment: '', ManagerComment: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add timesheet entry');
    }
  };

  return (
    <div className="add-timesheet-container">
      <h2>Add Timesheet Entry</h2>
      <form onSubmit={handleSubmit} className="add-timesheet-form">
        <input
          type="text"
          name="ProjectID"
          placeholder="Project ID"
          value={formData.ProjectID}
          onChange={handleChange}
          required
        />
        <input
          type="date"
          name="Date"
          placeholder="Date"
          value={formData.Date}
          onChange={handleChange}
          required
        />
        <input
          type="number"
          name="TotalHours"
          placeholder="Total Hours"
          value={formData.TotalHours}
          onChange={handleChange}
          required
        />
        <textarea
          name="Comment"
          placeholder="Comment"
          value={formData.Comment}
          onChange={handleChange}
        ></textarea>
        {/* <textarea
          name="ManagerComment"
          placeholder="Manager Comment"
          value={formData.ManagerComment}
          onChange={handleChange}
        ></textarea> */}
        <button type="submit">Add Entry</button>
      </form>
      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default AddTimesheetEntry;