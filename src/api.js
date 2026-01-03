import axios from 'axios';

const API_URL = 'https://timesheetapi-exfxf7bnb7bja5g7.centralindia-01.azurewebsites.net/api';

export const getTimesheetEntries = (employeeId) =>
  axios.post(`${API_URL}/assigned`, { EmployeeID: employeeId });

export const createTimesheetEntry = (data) =>
  axios.post(`${API_URL}/entry`, data);

export const updateTimesheetEntry = (id, data) =>
  axios.post(`${API_URL}/edit`, data); 

export const deleteTimesheetEntry = (id, data) =>
  axios.post(`${API_URL}/delete`, data); 

export const approveTimesheetEntry = (data) =>
  axios.post(`${API_URL}/approve`, data);

export const submitTimesheet = (employeeId) =>
  axios.post(`${API_URL}/submit`, { EmployeeID: employeeId });

export const getAllTimesheetEntries = (employeeIds) => {
  // Accepts employeeIds as array or single value
  let body;
  if (Array.isArray(employeeIds)) {
    // Convert to numbers for API
    body = { EmployeeIDs: employeeIds.map(Number) };
  } else if (employeeIds) {
    body = { EmployeeIDs: [Number(employeeIds)] };
  } else {
    body = {};
  }
  console.log('Calling getAllTimesheetEntries with body:', body);
  return axios.post(`${API_URL}/entries`, body);
};


export const bulkUpdateTimesheetStatus = (entryIds, status, modifiedBy = 'admin') =>
  axios.post(`${API_URL}/bulk-update`, {
    entryIds,
    status,
    modifiedBy,
  });


  export const fetchProjectNames = async (projectIds) => {
    const response = await fetch('https://timesheetapi-exfxf7bnb7bja5g7.centralindia-01.azurewebsites.net/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectIds }),
    });
  
    if (!response.ok) {
      throw new Error('Failed to fetch project names');
    }
  
    return response.json(); // Should return something like [{ ProjectID: 101, ProjectName: 'Alpha' }, ...]
  };

 export const getScrapperData = async (filters) => {
  const response = await fetch('https://timesheetapi-exfxf7bnb7bja5g7.centralindia-01.azurewebsites.net/api/scrapper/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters || {})
  });
  if (!response.ok) {
    throw new Error('Failed to fetch scrapper data');
  }
  return await response.json();
};

// export const loginEmployee = async ({ employeeId, password }) => {
//     // For demo, just resolve if employeeId and password are not empty
//     if (employeeId && password) {
//       return { success: true, employeeId };
//     }
//     return { success: false, message: 'Invalid credentials' };
//   };

// Updated loginEmployee to use username and password, and call backend API
export const loginEmployee = async ({ username, password }) => {
  try {
    const response = await fetch(`https://timesheetapi-exfxf7bnb7bja5g7.centralindia-01.azurewebsites.net/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.message };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    return { success: false, message: 'Network error' };
  }
};

export const bulkApproveTimesheetEntry = (entries) =>
  axios.post(`${API_URL}/bulk`, { entries });

// Bulk approve timesheet entries
export async function bulkApproveTimesheetEntries({ entries }) {
  const response = await fetch(`${API_URL}/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ entries }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Bulk approve failed');
  }
  return response.json();
}



// Change Password API
export const changePassword = async ({ email, username, password, newPassword, confirmNewPassword }) => {
  try {
    const response = await fetch(`${API_URL}/changePassword`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password, newPassword, confirmNewPassword })
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, message: data.message || 'Failed to change password' };
    }
    return { success: true, message: data.message };
  } catch (err) {
    return { success: false, message: 'Network error' };
  }
};

export const forgotPassword = async ({ email }) => {
  try {
    const response = await fetch(`${API_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, message: data.message || 'Failed to send reset email' };
    }
    return { success: true, message: data.message };
  } catch (err) {
    return { success: false, message: 'Network error' };
  }
};


// Add this to your API utility (hr-ui/src/api.js)
export async function addUser(data) {
  try {
    const res = await fetch('https://timesheetapi-exfxf7bnb7bja5g7.centralindia-01.azurewebsites.net/api/addUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: 'Network error.' };
  }
}