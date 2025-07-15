import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  getAllTimesheetEntries,
  updateTimesheetEntry,
  deleteTimesheetEntry,
  bulkUpdateTimesheetStatus,
  createTimesheetEntry,
  approveTimesheetEntry,
  bulkApproveTimesheetEntries
} from '../api';

import { useAuth } from '../AuthContext';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import '../App.css';

const monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const weekDayNames = [
 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' , 'Sun'
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

// Enhanced MultiSelectDropdown with search and auto-select
const MultiSelectDropdown = ({ label, options, selected, onChange, allLabel = 'All', style = {} }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef(null);

  // Filtered options based on search
  const filteredOptions = search
    ? options.filter(opt => (opt.label || opt).toLowerCase().includes(search.toLowerCase()))
    : options;

  // Auto-select all matching options on search
  useEffect(() => {
    if (search) {
      const matching = filteredOptions.map(opt => String(opt.value || opt));
      onChange(matching);
    }
  }, [search]);

  // Close dropdown on outside click
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

  const handleOptionChange = (value) => {
    if (value === 'ALL') {
      onChange([]);
      setSearch('');
    } else {
      if (selected.includes(value)) {
        onChange(selected.filter(v => v !== value));
      } else {
        onChange([...selected, value]);
      }
    }
  };
  const handleAllChange = () => {
    onChange([]);
    setSearch('');
  };
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
            style={{ width: '95%', margin: '0.5rem' }}
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
        </div>
      )}
    </div>
  );
};

const ManagerTimesheetPage = () => {
  const { user } = useAuth();
  // Dynamic managerOptions based on EmployeeID
  let managerOptions = [];
  if (user?.EmployeeID === 24) {
    managerOptions = [{ value: 'Abuzar', label: 'Abuzar' }];
  } else if (user?.EmployeeID === 25) {
    managerOptions = [{ value: 'ShelendraTomar', label: 'ShelendraTomar' }];
  } else if (user?.EmployeeID === 26) {
    managerOptions = [{ value: 'Hemant', label: 'Hemant' }];
  }

  // Auto-select the first manager option on mount
  const [localManager, setLocalManager] = useState(managerOptions[0]?.value || '');
  const [showManagerDropdown, setShowManagerDropdown] = useState(false);
  const [managerSearch, setManagerSearch] = useState('');
  const managerDropdownRef = React.useRef(null);

  useEffect(() => {
    // If managerOptions change (e.g., on login), auto-select the first option
    if (managerOptions.length > 0) {
      setLocalManager(managerOptions[0].value);
    }
  }, [user?.EmployeeID]);

  const employeeIdMap = {
    ShelendraTomar: [19, 20, 22, 23, 27],
    Hemant: [20, 24, 26, 27, 28, 30],
    Abuzar: [1, 2, 3],
  };

  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [projectOptions, setProjectOptions] = useState([]);

  let employeeId = user?.EmployeeID;
  if (!employeeId && user?.name) {
    const found = employeeOptions.find(opt => opt.label === user.name);
    if (found) employeeId = found.value;
  }
  const roleName = user?.roles && user.roles.length > 0 ? user.roles[0].roleName.toLowerCase() : '';
  const allowedEmployeeOption = employeeOptions.find(opt => opt.value === String(employeeId));
  const allowedProjectOptions = projectOptions;

  const [entries, setEntries] = useState([]);
  const [editRowId, setEditRowId] = useState(null);
  const [editData, setEditData] = useState({});
  // Change filter state to arrays for multi-select
  const [filters, setFilters] = useState({
    ProjectsName: [],
    EmployeeID: [],
    Status: [],
    Cateogary: []
  });
  const [filterOptions, setFilterOptions] = useState({
    ProjectsName: [],
    EmployeeID: [],
    Status: []
  });
  const [dateFilterType, setDateFilterType] = useState('today');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedWeekDay, setSelectedWeekDay] = useState(null);
  const [selectedMonthWeek, setSelectedMonthWeek] = useState(null);

  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [prevClicked, setPrevClicked] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [rowEdits, setRowEdits] = useState({});
  const [approveStatus, setApproveStatus] = useState('');
  const [approveError, setApproveError] = useState('');

  // Manager dropdown filter logic
  useEffect(() => {
    if (!showManagerDropdown) return;
    const handleClickOutside = (e) => {
      if (managerDropdownRef.current && !managerDropdownRef.current.contains(e.target)) {
        setShowManagerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showManagerDropdown]);

  useEffect(() => {
    // No external managerFilter, so just local state
  }, [localManager]);

  const fetchEntries = useCallback(async () => {
    try {
      const response = await getAllTimesheetEntries();
      setEntries(response.data);
      const uniqueOptions = {
        ProjectsName: [
          ...new Set(
            response.data
              .map((entry) => projectOptions.find(opt => opt.value === String(entry.ProjectID))?.label)
              .filter(Boolean)
          )
        ],
        EmployeeID: [...new Set(response.data.map((entry) => entry.EmployeeID))],
        Status: [...new Set(response.data.map((entry) => entry.Status))]
      };
      setFilterOptions(uniqueOptions);
    } catch (error) {
      console.error('Error fetching timesheet entries:', error);
    }
  }, [projectOptions]);
  
  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (employeeId) {
      fetchEntries();
    }
    // eslint-disable-next-line
  }, [employeeId]);

  useEffect(() => {
    if (dateFilterType === 'month') {
      setSelectedMonth(new Date().getMonth());
    }
    if (dateFilterType !== 'week') {
      setSelectedWeekDay(null);
    }
  }, [dateFilterType]);

  useEffect(() => {
    if (dateFilterType === 'week') {
      setWeekOffset(0);
      setPrevClicked(false);
    }
  }, [dateFilterType]);

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
    // Manager filter
    const allowedIds = employeeIdMap[localManager];
    if (Array.isArray(allowedIds) && !allowedIds.includes(Number(entry.EmployeeID))) {
      return false;
    }
    return (
      (entry.Status === 'Pending' || entry.Status === 'Approved') &&
      (filters.ProjectsName.length === 0 || filters.ProjectsName.includes(String(entry.ProjectID))) &&
      (filters.EmployeeID.length === 0 || filters.EmployeeID.includes(String(entry.EmployeeID))) &&
      (filters.Status.length === 0 || filters.Status.includes(entry.Status)) &&
      (filters.Cateogary.length === 0 || filters.Cateogary.includes(entry.Cateogary)) &&
      dateMatch
    );
  });

  // Sort filteredEntries by Date ascending
  filteredEntries = filteredEntries.slice().sort((a, b) => new Date(a.Date) - new Date(b.Date));

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

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const options = {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    };
    return date.toLocaleString('en-GB', options);
  };

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

  const handleRowEditChange = (entryId, field, value, projectId) => {
    let max = projectId === '4' ? 8 : 3;
    if (field === 'TotalHours' && Number(value) > max) value = max;
    setRowEdits(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        [field]: value
      }
    }));
  };

  const handleRowSelect = (entryId) => {
    setSelectedRows(prev =>
      prev.includes(entryId)
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId]
    );
  };

  const handleSelectAll = () => {
    if (selectedRows.length === filteredEntries.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredEntries.map(e => e.EntryID));
    }
  };

  // Download Excel handler
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

  const handleBulkApprove = async () => {
    setApproveError('');
    let status = approveStatus || 'Approved';
    const rowsToApprove = selectedRows.length > 0
      ? filteredEntries.filter(e => selectedRows.includes(e.EntryID))
      : filteredEntries;

    let entriesPayload = rowsToApprove.map(e => {
      let rowStatus = rowEdits[e.EntryID]?.Status !== undefined
        ? rowEdits[e.EntryID].Status
        : status;
      if (approveStatus === 'Rejected' && rowEdits[e.EntryID]?.Status === undefined) {
        rowStatus = 'Rejected';
      }
      return {
        EntryID: e.EntryID,
        EmployeeID: e.EmployeeID,
        Status: rowStatus,
        ManagerComment: rowEdits[e.EntryID]?.ManagerComment !== undefined
          ? rowEdits[e.EntryID].ManagerComment
          : e.ManagerComment,
        TotalHours: rowEdits[e.EntryID]?.TotalHours !== undefined
          ? rowEdits[e.EntryID].TotalHours
          : e.TotalHours
      };
    });

    const missingComment = entriesPayload.some(e =>
      e.Status === 'Rejected' && (!e.ManagerComment || e.ManagerComment.trim() === '')
    );
    if (missingComment) {
      setApproveError('Manager comment is required for all rejected entries.');
      return;
    }

    try {
      await bulkApproveTimesheetEntries({ entries: entriesPayload });
      setApproveStatus('');
      setSelectedRows([]);
      setRowEdits({});
      await fetchEntries();
    } catch (err) {
      setApproveError('Bulk approve failed.');
    }
  };

  // Fetch employeeOptions and projectOptions from backend
  useEffect(() => {
    axios.get('https://babralauatapi-d9abe9h8frescchd.centralindia-01.azurewebsites.net/api/employeeOptions')
      .then(res => setEmployeeOptions(res.data))
      .catch(() => setEmployeeOptions([]));
    axios.get('https://babralauatapi-d9abe9h8frescchd.centralindia-01.azurewebsites.net/api/projectOptions')
      .then(res => setProjectOptions(res.data))
      .catch(() => setProjectOptions([]));
  }, []);

  return (
    <div className="timesheet-table-container">
      <h2>Approve On Behalf</h2>
      {/* Manager single-select dropdown above filters */}
      <div className="filters" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <div className="msd-container" style={{ minWidth: 180 }} ref={managerDropdownRef}>
          <div className="msd-label" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => setShowManagerDropdown(o => !o)}>
            Approve On Behalf Of
            <span className="msd-arrow">&#9660;</span>
          </div>
          {showManagerDropdown && (
            <div className="msd-dropdown" style={{ display: 'block' }}>
              {/* Search bar for manager options */}
              <input
                type="text"
                className="msd-search"
                placeholder="Search Manager"
                value={managerSearch || ''}
                onChange={e => {
                  const val = e.target.value;
                  setManagerSearch(val);
                  if (val) {
                    // Auto-select all matching options, deselect others
                    const matching = managerOptions.filter(opt => opt.label.toLowerCase().includes(val.toLowerCase()));
                    if (matching.length > 0) {
                      setLocalManager(matching[0].value); // select first match
                    }
                  }
                }}
                style={{ width: '95%', margin: '0.5rem' }}
              />
              {/* Only show manager options, no 'All' option */}
              {(managerSearch
                ? managerOptions.filter(opt => opt.label.toLowerCase().includes(managerSearch.toLowerCase()))
                : managerOptions
              ).map(opt => (
                <label className="msd-option" key={opt.value}>
                  <input
                    type="radio"
                    name="manager"
                    checked={localManager === opt.value}
                    onChange={() => setLocalManager(opt.value)}
                  /> {opt.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="date-filter-buttons">
        <button className={dateFilterType === 'today' ? 'active' : ''} onClick={() => { setDateFilterType('today'); setSelectedWeekDay(null); }}>Current Day</button>
        <button className={dateFilterType === 'week' ? 'active' : ''} onClick={() => { setDateFilterType('week'); setSelectedWeekDay(null); }}>Weekly</button>
        <button className={dateFilterType === 'month' ? 'active' : ''} onClick={() => { setDateFilterType('month'); setSelectedWeekDay(null); }}>Monthly</button>
      </div>

      {/* Download Excel Button */}
      <div className="download-excel-btn-container">
        <button onClick={handleDownloadExcel} className="download-excel-btn">
          Download Excel
        </button>
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
            {monthWeeks.map(([start, end], idx) => (
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
          label="Employee"
          options={employeeOptions.map(opt => ({ value: String(opt.value), label: opt.label }))}
          selected={filters.EmployeeID}
          onChange={vals => setFilters(prev => ({ ...prev, EmployeeID: vals }))}
          allLabel="All"
          style={{ minWidth: 160 }}
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
          options={filterOptions.Status.map(opt => ({ value: opt, label: opt }))}
          selected={filters.Status}
          onChange={vals => setFilters(prev => ({ ...prev, Status: vals }))}
          allLabel="All"
          style={{ minWidth: 120 }}
        />
      </div>
       <div className="approve-btns-container">
        <button className="edit-btn approve-all-btn" onClick={handleBulkApprove}>
          Approve Selected
        </button>
        <button
          className="edit-btn approve-all-btn"
          onClick={() => {
            setSelectedRows([]); // clear selection to trigger approve all
            handleBulkApprove();
          }}
        >
          Approve All
        </button>
        {approveError && <span className="approve-error">{approveError}</span>}
      </div>
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
            <th>
              <input
                type="checkbox"
                checked={filteredEntries.length > 0 && filteredEntries.every(e => selectedRows.includes(e.EntryID))}
                onChange={handleSelectAll}
              />
            </th>
            <th>S.No</th>
            <th>Date</th>
            <th>Employee Name</th>
            <th>Category</th>
            <th>Project</th>
            <th>TaskID</th>
            <th>Task</th>
            <th>Hours</th>
            <th>Status</th>
            <th>Comment</th>
            <th>ManagerComment</th>
          </tr>
        </thead>
        <tbody>
          {filteredEntries.map((entry, idx) => {
            const isSelected = selectedRows.includes(entry.EntryID);
            const rowEdit = rowEdits[entry.EntryID] || {};
            return (
              <tr key={entry.EntryID}>
                <td>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleRowSelect(entry.EntryID)}
                  />
                </td>
                <td>{idx + 1}</td>
                <td>{formatDateTime(entry.Date)}</td>
                <td>
                  {employeeOptions.find(opt => opt.value == entry.EmployeeID)?.label || entry.EmployeeID}
                </td>
                <td>{entry.Cateogary}</td>
                <td>
                  {projectOptions.find(opt => opt.value == entry.ProjectID)?.label || entry.ProjectID}
                </td>
                <td>{entry.TaskID}</td>
                <td className="task-cell">{entry.Task}</td>
                <td>
                  <input
                    type="number"
                    value={rowEdit.TotalHours !== undefined ? rowEdit.TotalHours : entry.TotalHours}
                    min={0}
                    max={entry.ProjectID === '4' ? 8 : 3}
                    onChange={e => handleRowEditChange(entry.EntryID, 'TotalHours', e.target.value, entry.ProjectID)}
                    className="input-hours"
                  />
                </td>
                <td>
                  <select
                    value={rowEdit.Status !== undefined ? rowEdit.Status : entry.Status}
                    onChange={e => handleRowEditChange(entry.EntryID, 'Status', e.target.value, entry.ProjectID)}
                    className="input-status"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </td>
                <td>{entry.Comment}</td>
                <td className="comment-read">
                  <input
                    type="text"
                    value={rowEdit.ManagerComment !== undefined ? rowEdit.ManagerComment : (entry.ManagerComment || '')}
                    onChange={e => handleRowEditChange(entry.EntryID, 'ManagerComment', e.target.value, entry.ProjectID)}
                    className="input-manager-comment"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    
      <div className="approve-btns-container">
        <button className="edit-btn approve-all-btn" onClick={handleBulkApprove}>
          Approve Selected
        </button>
        <button
          className="edit-btn approve-all-btn"
          onClick={() => {
            setSelectedRows([]); // clear selection to trigger approve all
            handleBulkApprove();
          }}
        >
          Approve All
        </button>
        {approveError && <span className="approve-error">{approveError}</span>}
      </div>
    </div>
  );
};

export default ManagerTimesheetPage;
