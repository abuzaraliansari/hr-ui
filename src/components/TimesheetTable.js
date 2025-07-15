import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  getAllTimesheetEntries,
  updateTimesheetEntry,
  deleteTimesheetEntry,
  bulkUpdateTimesheetStatus,
  createTimesheetEntry
} from '../api';
import { useAuth } from '../AuthContext';
import '../App.css';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

// Helper to get current week's dates (Mon-Sun) with offset
const getCurrentWeekDates = (offset = 0) => {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

// Helper to get all weeks in a month (returns array of [startDate, endDate] for each week)
const getWeeksInMonth = (year, month) => {
  const weeks = [];
  let date = new Date(year, month, 1);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  while (date.getMonth() <= month) {
    const weekStart = new Date(date);
    const weekEnd = new Date(date);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weeks.push([new Date(weekStart), new Date(weekEnd)]);
    date.setDate(date.getDate() + 7);
    if (weekStart.getMonth() > month || (weekStart.getMonth() === month && weekStart.getDate() > new Date(year, month + 1, 0).getDate())) break;
  }
  return weeks;
};

// Helper to get min/max date for add row based on filter
const getAddRowDateLimits = (dateFilterType, weekOffset, selectedMonth) => {
  const today = new Date();
  let minDate, maxDate;
  if (dateFilterType === 'today') {
    minDate = maxDate = today;
  } else if (dateFilterType === 'week') {
    const weekDates = getCurrentWeekDates(weekOffset);
    minDate = weekDates[0];
    maxDate = weekDates[6];
  } else if (dateFilterType === 'month') {
    minDate = new Date(today.getFullYear(), selectedMonth, 1);
    maxDate = new Date(today.getFullYear(), selectedMonth + 1, 0);
  }
  // Restrict to within 15 days past/future from today
  const minAllowed = new Date(today); minAllowed.setDate(today.getDate() - 15);
  const maxAllowed = new Date(today); maxAllowed.setDate(today.getDate() + 15);
  if (minDate < minAllowed) minDate = minAllowed;
  if (maxDate > maxAllowed) maxDate = maxAllowed;
  return { minDate, maxDate };
};

const monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const weekDayNames = [
  'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat','Sun'
];

const categoryOptions = [
  'Dev',
  'Bug',
  'Test',
  'Meeting',
  'Support',
  'Other',
  'Assistance'
];

const statusOptions = ['Draft', 'Pending'];

// Reusable MultiSelectDropdown component with search and auto-select on search
const MultiSelectDropdown = ({ label, options, selected, onChange, allLabel = 'All', style = {} }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Auto-select all matching options and clear previous selections when search changes
  useEffect(() => {
    if (search.length > 0) {
      const filtered = options.filter(opt => {
        const labelText = (opt.label || opt).toLowerCase();
        return labelText.includes(search.toLowerCase());
      });
      const filteredValues = filtered.map(opt => String(opt.value || opt));
      if (JSON.stringify(selected) !== JSON.stringify(filteredValues)) {
        onChange(filteredValues);
      }
    }
  }, [search]);

  const handleOptionChange = (value) => {
    if (value === 'ALL') {
      onChange([]);
    } else {
      if (selected.includes(value)) {
        onChange(selected.filter(v => v !== value));
      } else {
        onChange([...selected, value]);
      }
    }
  };
  const handleAllChange = () => onChange([]);

  // Filter options by search
  const filteredOptions = options.filter(opt => {
    const label = (opt.label || opt).toLowerCase();
    return label.includes(search.toLowerCase());
  });

  return (
    <div className="msd-container" style={{ minWidth: 120, ...style }} ref={containerRef}>
      <div className="msd-label" onClick={() => setOpen(o => !o)}>
        {label}
        <span className="msd-arrow">{open ? '\u25B2' : '\u25BC'}</span>
      </div>
      {open && (
        <div className="msd-dropdown">
          <input
            type="text"
            className="msd-search"
            placeholder={`Search ${label}`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '95%', margin: '6px 0', padding: '4px' }}
          />
          <label className="msd-option">
            <input type="checkbox" checked={selected.length === 0} onChange={handleAllChange} /> {allLabel}
          </label>
          {filteredOptions.map(opt => (
            <label className="msd-option" key={opt.value || opt}>
              <input
                type="checkbox"
                checked={selected.includes(String(opt.value || opt))}
                onChange={() => handleOptionChange(String(opt.value || opt))}
              /> {opt.label || opt}
            </label>
          ))}
          {filteredOptions.length === 0 && (
            <div className="msd-no-options">No options found</div>
          )}
        </div>
      )}
    </div>
  );
};

const TimesheetTable = () => {
  const { user } = useAuth();
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [projectOptions, setProjectOptions] = useState([]);
  let employeeId = user?.EmployeeID;
  if (!employeeId && user?.name) {
    const found = employeeOptions.find(opt => opt.label === user.name);
    if (found) employeeId = found.value;
  }
  const roleName = user?.roles && user.roles.length > 0 ? user.roles[0].roleName.toLowerCase() : '';
  const allowedProjectOptions = projectOptions;

  const [entries, setEntries] = useState([]);
  const [editRowId, setEditRowId] = useState(null);
  const [editData, setEditData] = useState({});
  const [filters, setFilters] = useState({
    ProjectsName: [],
    Status: [],
    Cateogary: []
  });
  const [filterOptions, setFilterOptions] = useState({
    ProjectsName: [],
    Status: []
  });
  const [dateFilterType, setDateFilterType] = useState('today');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedWeekDay, setSelectedWeekDay] = useState(null);
  const [selectedMonthWeek, setSelectedMonthWeek] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const [showAddRow, setShowAddRow] = useState(false);
  const [addRowData, setAddRowData] = useState({
    EmployeeID: employeeId || '',
    ProjectID: '',
    Cateogary: '',
    TaskID: '',
    Task: '',
    Date: new Date().toISOString().slice(0, 10),
    TotalHours: '',
    Comment: '',
    ManagerComment: '',
    Status: 'Draft'
  });
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileInputRef = React.useRef(null);

  const fetchEntries = useCallback(async () => {
    try {
      const payloadEmployeeId = Number(employeeId);
      const response = await getAllTimesheetEntries(payloadEmployeeId);
      setEntries(response.data);

      const uniqueOptions = {
        ProjectsName: [
          ...new Set(
            response.data
              .map((entry) => projectOptions.find(opt => opt.value === String(entry.ProjectID))?.label)
              .filter(Boolean)
          )
        ],
        Status: [...new Set(response.data.map((entry) => entry.Status))]
      };
      setFilterOptions(uniqueOptions);
    } catch (error) {
      console.error('Error fetching timesheet entries:', error);
    }
  }, [employeeId, projectOptions]);

  useEffect(() => {
    if (employeeId) {
      fetchEntries();
    }
  }, [employeeId, fetchEntries]);

  useEffect(() => {
    if (dateFilterType === 'month') {
      setSelectedMonth(new Date().getMonth());
    }
    if (dateFilterType !== 'week') {
      setSelectedWeekDay(null);
    }
  }, [dateFilterType]);

  useEffect(() => {
    axios.get('https://babralauatapi-d9abe9h8frescchd.centralindia-01.azurewebsites.net/api/employeeOptions')
      .then(res => setEmployeeOptions(res.data))
      .catch(() => setEmployeeOptions([]));
    axios.get('https://babralauatapi-d9abe9h8frescchd.centralindia-01.azurewebsites.net/api/projectOptions')
      .then(res => setProjectOptions(res.data))
      .catch(() => setProjectOptions([]));
  }, []);

  const currentYear = new Date().getFullYear();
  const firstDayOfYear = new Date(currentYear, 0, 1);
  const lastDayOfYear = new Date(currentYear, 11, 31);
  const firstMonday = new Date(firstDayOfYear);
  firstMonday.setDate(firstDayOfYear.getDate() - ((firstDayOfYear.getDay() + 6) % 7));
  const today = new Date();
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const lastMonday = new Date(lastDayOfYear);
  lastMonday.setDate(lastDayOfYear.getDate() - ((lastDayOfYear.getDay() + 6) % 7));
  const getWeekDiff = (d1, d2) => Math.round((d1 - d2) / (7 * 24 * 60 * 60 * 1000));
  const minWeekOffset = getWeekDiff(firstMonday, currentMonday);
  const maxWeekOffset = getWeekDiff(lastMonday, currentMonday);

  const monthWeeks = getWeeksInMonth(new Date().getFullYear(), selectedMonth);
  let filteredEntries = entries.filter((entry) => {
    let dateMatch = true;
    if (dateFilterType === 'today') {
      const today = new Date();
      const entryDate = new Date(entry.Date);
      dateMatch =
        entryDate.getDate() === today.getDate() &&
        entryDate.getMonth() === today.getMonth() &&
        entryDate.getFullYear() === today.getFullYear();
    } else if (dateFilterType === 'week') {
      const weekDates = getCurrentWeekDates(weekOffset);
      if (selectedWeekDay !== null) {
        const selectedDate = weekDates[selectedWeekDay];
        const entryDate = new Date(entry.Date);
        dateMatch =
          entryDate.getFullYear() === selectedDate.getFullYear() &&
          entryDate.getMonth() === selectedDate.getMonth() &&
          entryDate.getDate() === selectedDate.getDate();
      } else {
        const entryDate = new Date(entry.Date);
        dateMatch = weekDates.some(
          d =>
            entryDate.getFullYear() === d.getFullYear() &&
            entryDate.getMonth() === d.getMonth() &&
            entryDate.getDate() === d.getDate()
        );
      }
    } else if (dateFilterType === 'month') {
      const entryDate = new Date(entry.Date);
      if (selectedMonthWeek !== null) {
        const [weekStart, weekEnd] = monthWeeks[selectedMonthWeek];
        dateMatch = entryDate >= weekStart && entryDate <= weekEnd && entryDate.getMonth() === selectedMonth;
      } else {
        dateMatch = entryDate.getMonth() === selectedMonth && entryDate.getFullYear() === new Date().getFullYear();
      }
    }
    let projectName = projectOptions.find(opt => opt.value === String(entry.ProjectID))?.label || '';
    return (
      (filters.ProjectsName.length === 0 || filters.ProjectsName.includes(String(entry.ProjectID))) &&
      (filters.Status.length === 0 || filters.Status.includes(entry.Status)) &&
      (filters.Cateogary.length === 0 || filters.Cateogary.includes(entry.Cateogary)) &&
      dateMatch
    );
  });

  filteredEntries = filteredEntries.slice().sort((a, b) => new Date(a.Date) - new Date(b.Date));

  const handleAddRowChange = (e) => {
    const { name, value } = e.target;
    if (name === 'ProjectID') {
      let maxHours = value === '4' ? 8 : 3;
      let newHours = addRowData.TotalHours;
      if (Number(newHours) > maxHours) newHours = maxHours;
      setAddRowData((prev) => ({
        ...prev,
        [name]: value,
        TotalHours: newHours
      }));
      return;
    }
    if (name === 'TotalHours') {
      let val = value;
      let maxHours = addRowData.ProjectID === '4' ? 8 : 3;
      if (Number(val) > maxHours) val = maxHours;
      setAddRowData((prev) => ({ ...prev, [name]: val }));
      return;
    }
    if (name === 'Date') {
      const { minDate, maxDate } = getAddRowDateLimits(dateFilterType, weekOffset, selectedMonth);
      if (value < minDate.toISOString().slice(0, 10) || value > maxDate.toISOString().slice(0, 10)) {
        return;
      }
    }
    setAddRowData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddRowSave = async () => {
    setAddError('');
    setAddSuccess('');
    if (!addRowData.Date || !addRowData.Cateogary || !addRowData.ProjectID || !addRowData.Task || !addRowData.TotalHours || Number(addRowData.TotalHours) <= 0) {
      setAddError('Please fill all required fields and hours must be more than 0.');
      return;
    }
    let maxHours = addRowData.ProjectID === '4' ? 8 : 3;
    if (Number(addRowData.TotalHours) > maxHours) {
      setAddError(`Total Hours cannot be more than ${maxHours}.`);
      return;
    }
    try {
      const data = {
        ...addRowData,
        Status: 'Draft',
        CreatedBy: 'system'
      };
      await createTimesheetEntry(data);
      setAddSuccess('Timesheet entry added!');
      setAddRowData({
        EmployeeID: employeeId || '',
        ProjectID: '',
        Cateogary: '',
        TaskID: '',
        Task: '',
        Date: new Date().toISOString().slice(0, 10),
        TotalHours: '',
        Comment: '',
        ManagerComment: '',
        Status: 'Draft'
      });
      setShowAddRow(false);
      await fetchEntries();
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add timesheet entry');
    }
  };

  const handleAddRowCancel = () => {
    setShowAddRow(false);
    setAddRowData({
      EmployeeID: employeeId || '',
      ProjectID: '',
      Cateogary: '',
      TaskID: '',
      Task: '',
      Date: new Date().toISOString().slice(0, 10),
      TotalHours: '',
      Comment: '',
      ManagerComment: '',
      Status: 'Draft'
    });
    setAddError('');
    setAddSuccess('');
  };

  const handleEditClick = (entry) => {
    setEditRowId(entry.EntryID);
    setEditData({ ...entry });
  };

  const handleInputChange = (e, field) => {
    if (field === 'ProjectID') {
      let maxHours = e.target.value === '4' ? 8 : 3;
      let newHours = editData.TotalHours;
      if (Number(newHours) > maxHours) newHours = maxHours;
      setEditData({ ...editData, [field]: e.target.value, TotalHours: newHours });
      return;
    }
    if (field === 'TotalHours') {
      let value = e.target.value;
      let maxHours = editData.ProjectID === '4' ? 8 : 3;
      if (Number(value) > maxHours) value = maxHours;
      setEditData({ ...editData, [field]: value });
      return;
    }
    setEditData({ ...editData, [field]: e.target.value });
  };

  const handleSave = async (entry) => {
    if (!editData.Date || !editData.Cateogary || !editData.ProjectID || !editData.Task || !editData.TotalHours || Number(editData.TotalHours) <= 0) {
      setAddError('Please fill all required fields and hours must be more than 0.');
      return;
    }
    let maxHours = editData.ProjectID === '4' ? 8 : 3;
    if (Number(editData.TotalHours) > maxHours) {
      setAddError(`Total Hours cannot be more than ${maxHours}.`);
      return;
    }
    try {
      const payload = {
        ...editData,
        Status: 'Draft',
        EmployeeID: editData.EmployeeID,
        ModifiedBy: 'system'
      };
      await updateTimesheetEntry(entry.EntryID, payload);
      setAddSuccess('Timesheet entry updated successfully!');
      setEditRowId(null);
      setEditData({});
      await fetchEntries();
    } catch (error) {
      setAddError('Failed to update timesheet entry.');
    }
  };

  const handleCancel = () => {
    setEditRowId(null);
    setEditData({});
    setAddError('');
    setAddSuccess('');
  };

  const handleDelete = async (entry) => {
    setAddError('');
    setAddSuccess('');
    try {
      const payload = {
        EntryID: entry.EntryID,
        EmployeeID: employeeId,
        Status: entry.Status
      };
      await deleteTimesheetEntry(entry.EntryID, payload);
      setAddSuccess('Timesheet entry deleted successfully!');
      await fetchEntries();
    } catch (error) {
      setAddError('Failed to delete timesheet entry.');
    }
  };

  const handleBulkUpdate = async () => {
    setAddError('');
    setAddSuccess('');
    if (
      (dateFilterType === 'today' && !(totalHours >= 6 && totalHours <= 10)) ||
      (dateFilterType === 'week' && !(totalHours >= 35 && totalHours <= 45)) ||
      (dateFilterType === 'month' && !(totalHours >= 140 && totalHours <= 160))
    ) {
      setAddError("Please take manager's approval before submitting.");
      return;
    }
    const draftEntries = filteredEntries.filter(e => e.Status === 'Draft');
    const entryIds = draftEntries.map(e => e.EntryID);
    if (entryIds.length === 0) {
      setAddError('No draft entries to update.');
      return;
    }
    try {
      await bulkUpdateTimesheetStatus(entryIds, 'Pending', 'admin');
      setAddSuccess('Status updated to Pending for all filtered draft entries!');
      await fetchEntries();
    } catch (err) {
      setAddError('Bulk update failed');
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const options = {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    };
    return date.toLocaleString('en-GB', options);
  };

  const handleDownloadExcel = async () => {
    if (filteredEntries.length === 0) return;

    // Group entries by EmployeeID
    const entriesByEmployee = {};
    filteredEntries.forEach(entry => {
      const empId = String(entry.EmployeeID);
      if (!entriesByEmployee[empId]) entriesByEmployee[empId] = [];
      entriesByEmployee[empId].push(entry);
    });

    const workbook = new ExcelJS.Workbook();

    // For each employee, create a worksheet
    Object.entries(entriesByEmployee).forEach(([empId, entries]) => {
      const empLabel = employeeOptions.find(opt => String(opt.value) === empId)?.label || empId;
      // Excel worksheet names max 31 chars, remove special chars
      const safeLabel = empLabel.replace(/[^a-zA-Z0-9 _-]/g, '').substring(0, 31) || `Employee_${empId}`;
      const worksheet = workbook.addWorksheet(safeLabel);

      // Prepare data for Excel: show labels for EmployeeName and Project, add S.No
      const data = entries.map((entry, idx) => ({
        SNo: idx + 1,
        Date: formatDateTime(entry.Date),
        EmployeeName: empLabel,
        Cateogary: entry.Cateogary,
        Project: projectOptions.find(opt => String(opt.value) === String(entry.ProjectID))?.label || entry.ProjectID,
        TaskID: entry.TaskID,
        Task: entry.Task,
        Hours: entry.TotalHours,
        Status: entry.Status,
        Comment: entry.Comment,
        ManagerComment: entry.ManagerComment
      }));
      // Calculate total hours
      const totalHours = data.reduce((sum, row) => sum + (parseFloat(row.Hours) || 0), 0);
      // Add a total row at the end: label in Task, value in Hours
      data.push({
        SNo: '',
        Date: '',
        EmployeeName: '',
        Cateogary: '',
        Project: '',
        TaskID: '',
        Task: 'Total Hours =',
        Hours: totalHours,
        Status: '',
        Comment: '',
        ManagerComment: ''
      });
      worksheet.columns = [
        { header: 'S.No', key: 'SNo', width: 8 },
        { header: 'Date', key: 'Date', width: 12 },
        { header: 'Employee Name', key: 'EmployeeName', width: 20 },
        { header: 'Category', key: 'Cateogary', width: 14 },
        { header: 'Project', key: 'Project', width: 18 },
        { header: 'TaskID', key: 'TaskID', width: 10 },
        { header: 'Task', key: 'Task', width: 30 },
        { header: 'Hours', key: 'Hours', width: 10 },
        { header: 'Status', key: 'Status', width: 12 },
        { header: 'Comment', key: 'Comment', width: 20 },
        { header: 'ManagerComment', key: 'ManagerComment', width: 20 }
      ];
      data.forEach(row => worksheet.addRow(row));
      // Header styling
      worksheet.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0070C0' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      // Banded rows styling
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        row.eachCell(cell => {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          if (rowNumber % 2 === 0) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFEAF3FB' }
            };
          }
        });
      });
      // Autofilter
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: worksheet.columns.length }
      };
      // Bold and colored total row
      const totalRow = worksheet.getRow(data.length + 1);
      totalRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FF0070C0' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFDE9D9' }
        };
      });
    });

    // Download file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'TimesheetData.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Excel upload handler
  const handleUploadClick = () => {
    setUploadError("");
    setUploadSuccess("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  // Helper to convert Excel serial date to yyyy-mm-dd
  const excelDateToISO = (excelDate) => {
    // Excel date is days since 1899-12-31
    const jsDate = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    // Adjust for Excel's leap year bug
    if (excelDate < 60) jsDate.setDate(jsDate.getDate() - 1);
    return jsDate.toISOString().slice(0, 10);
  };

  const handleFileChange = async (e) => {
    setUploadError("");
    setUploadSuccess("");
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const header = rows[0];
      const expectedHeader = [
        "S.No", "Date", "Employee Name", "Category", "Project", "TaskID", "Task", "Hours", "Status", "Comment", "ManagerComment"
      ];
      if (!header || header.length < 11 || !expectedHeader.every((h, i) => header[i] === h)) {
        setUploadError("Invalid Excel format. Please use the provided template.");
        return;
      }
      // Parse rows
      const entries = rows.slice(1).map((row, idx) => ({
        rowNum: idx + 2,
        Date: row[1],
        Cateogary: row[3],
        Project: row[4],
        TaskID: row[5],
        Task: row[6],
        TotalHours: row[7],
        Status: row[8],
        Comment: row[9],
        ManagerComment: row[10]
      })).filter(row => row.Date && row.Cateogary && row.Project && row.Task && row.TotalHours);

      // Validate total hours for all entries
      const totalHours = entries.reduce((sum, e) => sum + (parseFloat(e.TotalHours) || 0), 0);
      if (totalHours > 45) {
        setUploadError("Total Hours cannot be more than 45");
        return;
      }
      if (totalHours < 35) {
        setUploadError("Total Hours cannot be less than 35");
        return;
      }
      // Get current week dates (Mon-Sun) based on weekOffset
      const weekDates = getCurrentWeekDates(weekOffset).map(d => d.toISOString().slice(0, 10));
      let successRows = [];
      let errorRows = [];
      for (const entry of entries) {
        let entryDateStr = "";
        try {
          if (typeof entry.Date === "number") {
            // Excel serial date
            entryDateStr = excelDateToISO(entry.Date);
          } else if (typeof entry.Date === "string" && entry.Date.includes("/")) {
            // dd/mm/yy or dd/mm/yyyy
            const parts = entry.Date.split("/");
            if (parts.length === 3) {
              let [d, m, y] = parts;
              if (y.length === 2) y = "20" + y;
              entryDateStr = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
            } else {
              throw new Error("Invalid date format");
            }
          } else if (typeof entry.Date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.Date)) {
            // yyyy-mm-dd
            entryDateStr = entry.Date;
          } else {
            throw new Error("Invalid date format");
          }
        } catch (dateErr) {
          errorRows.push({ row: entry.rowNum, reason: `Invalid date format: ${entry.Date}` });
          continue;
        }
        if (!weekDates.includes(entryDateStr)) {
          errorRows.push({ row: entry.rowNum, reason: `Date ${entry.Date} is not in the current week (Mon-Sun).` });
          continue;
        }
        const projectOpt = projectOptions.find(opt => opt.label.toLowerCase() === String(entry.Project).toLowerCase());
        const projectID = projectOpt ? projectOpt.value : "";
        let maxHours = 3;
        if (String(entry.Project).toLowerCase() === "leave") {
          maxHours = 8;
        } else if (projectID === "4") {
          maxHours = 8;
        }
        if (Number(entry.TotalHours) > maxHours) {
          errorRows.push({ row: entry.rowNum, reason: `Row with Task '${entry.Task}' and Project '${entry.Project}' has more than allowed hours (${maxHours})` });
          continue;
        }
        const payload = {
          EmployeeID: employeeId,
          ProjectID: projectID,
          Cateogary: entry.Cateogary,
          TaskID: entry.TaskID || "",
          Task: entry.Task,
          Date: entryDateStr,
          TotalHours: entry.TotalHours,
          Comment: entry.Comment || "",
          ManagerComment: entry.ManagerComment || "",
          Status: "Draft",
          CreatedBy: "system"
        };
        try {
          await createTimesheetEntry(payload);
          successRows.push(entry.rowNum);
        } catch (err) {
          errorRows.push({ row: entry.rowNum, reason: err.response?.data?.error || "Failed to save entry." });
        }
      }
      let msg = "";
      if (successRows.length > 0) {
        msg += `Successfully uploaded please review and submit.`;
      }
      if (errorRows.length > 0) {
        msg += " Errors:\n" + errorRows.map(er => `Row ${er.row}: ${er.reason}`).join("\n");
      }
      if (successRows.length > 0) {
        setUploadSuccess(msg);
        await fetchEntries();
      } else {
        setUploadError(msg);
      }
    } catch (err) {
      console.error("Excel upload error:", err);
      if (err instanceof Error) {
        setUploadError("Failed to read Excel file: " + err.message);
      } else {
        setUploadError("Failed to read Excel file.");
      }
    }
  };

  const totalHours = filteredEntries.reduce((sum, e) => sum + (parseFloat(e.TotalHours) || 0), 0);

  let tfootColor = 'red';
  if (dateFilterType === 'today') {
    tfootColor = totalHours >= 6 && totalHours <= 10 ? 'green' : 'red';
  } else if (dateFilterType === 'week') {
    tfootColor = totalHours >= 35 && totalHours <= 45 ? 'green' : 'red';
  } else if (dateFilterType === 'month') {
    tfootColor = totalHours >= 140 && totalHours <= 160 ? 'green' : 'red';
  } else {
    tfootColor = 'green';
  }

  return (
    <div className="timesheet-table-container">
      <h2>Timesheet Entry</h2>
      {addError && <div className="error-message">{addError}</div>}
      {addSuccess && <div className="success-message">{addSuccess}</div>}
      {uploadError && <div className="error-message">{uploadError}</div>}
      {uploadSuccess && <div className="success-message">{uploadSuccess}</div>}
      <div className="date-filter-buttons">
        <button className={dateFilterType === 'today' ? 'active date-filter-btn' : 'date-filter-btn'} onClick={() => { setDateFilterType('today'); setSelectedWeekDay(null); }}>Current Day</button>
        <button className={dateFilterType === 'week' ? 'active date-filter-btn' : 'date-filter-btn'} onClick={() => { setDateFilterType('week'); setSelectedWeekDay(null); }}>Weekly</button>
        <button className={dateFilterType === 'month' ? 'active date-filter-btn' : 'date-filter-btn'} onClick={() => { setDateFilterType('month'); setSelectedWeekDay(null); }}>Monthly</button>
      </div>
      {dateFilterType === 'month' && (
        <>
          <div className="month-grid">
            {monthNames.map((name, idx) => (
              <button
                key={name}
                className={`month-grid-btn${selectedMonth === idx ? ' active' : ''}`}
                onClick={() => { setSelectedMonth(idx); setSelectedMonthWeek(null); }}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="week-grid">
            {getWeeksInMonth(new Date().getFullYear(), selectedMonth).map(([start, end], idx) => (
              <button
                key={idx}
                className={`week-grid-btn${selectedMonthWeek === idx ? ' active' : ''}`}
                onClick={() => setSelectedMonthWeek(idx)}
              >
                {`Week ${idx + 1} (${start.getDate()}-${end.getDate()})`}
              </button>
            ))}
            <button
              className={`all-weeks-btn${selectedMonthWeek === null ? ' active' : ''}`}
              onClick={() => setSelectedMonthWeek(null)}
            >
              All Weeks
            </button>
          </div>
        </>
      )}
      {dateFilterType === 'week' && (
        <div className="week-grid week-grid-days">
          <button
            className="week-grid-btn"
            disabled={weekOffset <= minWeekOffset}
            onClick={() => {
              if (weekOffset > minWeekOffset) {
                setWeekOffset(weekOffset - 1);
              }
            }}
          >
            Previous Week
          </button>
          {getCurrentWeekDates(weekOffset).map((date, idx) => (
            <button
              key={weekDayNames[idx]}
              className={`week-grid-btn${selectedWeekDay === idx ? ' active' : ''}`}
              onClick={() => setSelectedWeekDay(idx)}
            >
              <div>{weekDayNames[idx]}</div>
             <div className="week-grid-date">{date.getDate()}/{date.getMonth() + 1}</div>
            </button>
          ))}
          <button
            className="week-grid-btn"
            disabled={weekOffset >= maxWeekOffset}
            onClick={() => {
              if (weekOffset < maxWeekOffset) {
                setWeekOffset(weekOffset + 1);
              }
            }}
          >
            Next Week
          </button>
          <button
            className={`all-days-btn${selectedWeekDay === null ? ' active' : ''}`}
            onClick={() => setSelectedWeekDay(null)}
            title="Show all days"
          >
            All
          </button>
        </div>
      )}
      <div className="filters" style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginBottom: '2rem' }}>
        <MultiSelectDropdown
          label="Project"
          options={projectOptions.map(opt => ({ value: String(opt.value), label: opt.label }))}
          selected={filters.ProjectsName}
          onChange={vals => setFilters(prev => ({ ...prev, ProjectsName: vals }))}
          allLabel="All"
          style={{ minWidth: 180 }}
        />
        <MultiSelectDropdown
          label="Category"
          options={categoryOptions.map(opt => ({ value: opt, label: opt }))}
          selected={filters.Cateogary}
          onChange={vals => setFilters(prev => ({ ...prev, Cateogary: vals }))}
          allLabel="All"
          style={{ minWidth: 140 }}
        />
        <MultiSelectDropdown
          label="Status"
          options={statusOptions.map(opt => ({ value: opt, label: opt }))}
          selected={filters.Status}
          onChange={vals => setFilters(prev => ({ ...prev, Status: vals }))}
          allLabel="All"
          style={{ minWidth: 120 }}
        />
      </div>
      <div className="download-excel-btn-container">
        <button
          onClick={handleDownloadExcel}
          className="download-excel-btn"
        >
          Download Excel
        </button>
        {dateFilterType === 'week' && (
          <button
            className="download-excel-btn"
            title="Upload Timesheet"
            onClick={handleUploadClick}
            style={{ marginLeft: '1rem' }}
          >
            Upload Excel
          </button>
        )}
      </div>
     <div className="submit-btn-container">
      <button
        className="submit-btn"
        onClick={handleBulkUpdate}
      >
        Submit TimeSheet
      </button>
    </div>
  
      <div>
        {(dateFilterType === 'week' || dateFilterType === 'today') && (
          <>
            <button
              className="add-entry-btn"
              title="Add Entry"
              onClick={() => setShowAddRow(true)}
            >
              +
            </button>
            {dateFilterType === 'week' && (
              <>
                
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </>
            )}
          </>
        )}
        {dateFilterType === 'month' && null}
      </div>
      <div className="timesheet-table-scroll">
            <tfoot>
        <tr>
          <td
            colSpan="12"
            className={`tfoot-total tfoot-total-${tfootColor}`}
          >
            {(() => {
              if (dateFilterType === 'today') return `Total hours of today: ${totalHours}`;
              if (dateFilterType === 'week') return `Total hours of this week: ${totalHours}`;
              if (dateFilterType === 'month') return `Total hours of this month: ${totalHours}`;
              return `Total hours: ${totalHours}`;
            })()}
          </td>
        </tr>
      </tfoot>
        <table className="timesheet-table">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Date</th>
              <th>Category</th>
              <th>Project</th>
              <th>TaskID</th>
              <th>Task</th>
              <th>Hours</th>
              <th>Status</th>
              <th>Comment</th>
              <th>ManagerComment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {showAddRow && (
              <tr>
                <td>1</td>
                <td>
                  {(() => {
                    const { minDate, maxDate } = getAddRowDateLimits(dateFilterType, weekOffset, selectedMonth);
                    return (
                      <input
                        type="date"
                        name="Date"
                        value={addRowData.Date}
                        onChange={handleAddRowChange}
                        className="input-date"
                        required
                        min={minDate.toISOString().slice(0, 10)}
                        max={maxDate.toISOString().slice(0, 10)}
                      />
                    );
                  })()}
                </td>
                <td>
                  <select
                    name="Cateogary"
                    value={addRowData.Cateogary || ''}
                    onChange={handleAddRowChange}
                    className="input-category"
                    required
                  >
                    <option value="">Select Category</option>
                    {categoryOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    name="ProjectID"
                    value={addRowData.ProjectID}
                    onChange={handleAddRowChange}
                    className="input-project"
                    required
                  >
                    <option value="">Select Project</option>
                    {allowedProjectOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    name="TaskID"
                    value={addRowData.TaskID || ''}
                    onChange={handleAddRowChange}
                    className="input-taskid"
                    required
                  />
                </td>
                <td>
                  <textarea
                    name="Task"
                    value={addRowData.Task || ''}
                    onChange={handleAddRowChange}
                    className="comment-textarea"
                  />
                </td>
                <td>
                 <input
                    type="number"
                    name="TotalHours"
                    value={addRowData.TotalHours}
                    onChange={handleAddRowChange}
                    className="input-hours"
                    required
                    min={0}
                    max={addRowData.ProjectID === '4' ? 8 : 3}
                  />
                </td>
                <td>
                <input
                    type="text"
                    name="Status"
                    value="Draft"
                    className="input-status"
                    disabled
                  />
                </td>
                <td>
                  <textarea
                    name="Comment"
                    value={addRowData.Comment}
                    onChange={handleAddRowChange}
                    className="comment-textarea"
                  />
                </td>
                <td>
                  <textarea
                    name="ManagerComment"
                    value={addRowData.ManagerComment}
                    disabled
                    className="comment-textarea"
                  />
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="edit-btn" type="button" onClick={handleAddRowSave}>Save</button>
                    <button className="delete-btn" type="button" onClick={handleAddRowCancel}>Cancel</button>
                  </div>
                </td>
              </tr>
            )}
            {filteredEntries.map((entry, idx) => {
              const isEdit = editRowId === entry.EntryID;
              return (
                <tr key={entry.EntryID}>
                  <td>{idx + 1}</td>
                  <td>
                    {isEdit ? (
                      <input
                        type="date"
                        value={editData.Date ? editData.Date.slice(0, 10) : ''}
                        onChange={e => handleInputChange(e, 'Date')}
                        className="input-date"
                      />
                    ) : formatDateTime(entry.Date)}
                  </td>
                  <td>
                    {isEdit ? (
                      <select
                        name="Cateogary"
                        value={editData.Cateogary || ''}
                        onChange={e => handleInputChange(e, 'Cateogary')}
                        className="input-category"
                        required
                      >
                        <option value="">Select Category</option>
                        {categoryOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : entry.Cateogary}
                  </td>
                  <td>
                    {isEdit ? (
                      <select
                        name="ProjectID"
                        value={editData.ProjectID || ''}
                        onChange={e => handleInputChange(e, 'ProjectID')}
                        className="input-project"
                        required
                      >
                        <option value="">Select Project</option>
                        {allowedProjectOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      projectOptions.find(opt => String(opt.value) === String(entry.ProjectID))?.label || entry.ProjectID
                    )}
                  </td>
                  <td>
                    {isEdit ? (
                      <input
                        type="text"
                        value={editData.TaskID || ''}
                        onChange={e => handleInputChange(e, 'TaskID')}
                        className="input-taskid"
                        required
                      />
                    ) : entry.TaskID}
                  </td>
                  <td>
                    {isEdit ? (
                      <textarea
                        name="Task"
                        value={editData.Task || ''}
                        onChange={e => handleInputChange(e, 'Task')}
                        className="comment-textarea"
                      />
                    ) : (
                      <div className="comment-read">{entry.Task}</div>
                    )}
                  </td>
                  <td>
                    {isEdit ? (
                      <input
                        type="number"
                        value={editData.TotalHours || ''}
                        onChange={e => handleInputChange(e, 'TotalHours')}
                        className="input-hours"
                        min={0}
                        max={editData.ProjectID === '4' ? 8 : 3}
                        required
                      />
                    ) : entry.TotalHours}
                  </td>
                  <td>
                    {isEdit ? (
                      <select
                        name="Status"
                        value={editData.Status || ''}
                        onChange={e => handleInputChange(e, 'Status')}
                        className="input-status"
                        required
                      >
                        {statusOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : entry.Status}
                  </td>
                  <td>
                    {isEdit ? (
                      <textarea
                        name="Comment"
                        value={editData.Comment || ''}
                        onChange={e => handleInputChange(e, 'Comment')}
                        className="comment-textarea"
                      />
                    ) : (
                      <div className="comment-read">{entry.Comment}</div>
                    )}
                  </td>
                  <td>
                    {isEdit ? (
                      <textarea
                        name="ManagerComment"
                        value={editData.ManagerComment || ''}
                        disabled
                        className="comment-textarea"
                      />
                    ) : (
                      <div className="comment-read">{entry.ManagerComment}</div>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                    {(entry.Status === 'Draft' || entry.Status === 'Rejected') && (
        isEdit ? (
                            <>
                              <button className="edit-btn" onClick={() => handleSave(entry)}>Save</button>
                              <button className="delete-btn" onClick={handleCancel}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button className="edit-btn" onClick={() => handleEditClick(entry)}>Edit</button>
                              <button className="delete-btn" onClick={() => handleDelete(entry)}>Delete</button>
                            </>
                          )
                        )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
     <div className="submit-btn-container">
      <button
        className="submit-btn"
        onClick={handleBulkUpdate}
      >
        Submit TimeSheet
      </button>
    </div>
    </div>
  );
};

export default TimesheetTable;