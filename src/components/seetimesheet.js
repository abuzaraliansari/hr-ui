import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  getAllTimesheetEntries,
} from '../api';
import { useAuth } from '../AuthContext';
import ExcelJS from 'exceljs';
import '../App.css';

const monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const weekDayNames = [
  'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
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

// ✅ FIXED: Helper to get all weeks in a month
const getWeeksInMonth = (year, month) => {
  const weeks = [];
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  // Find the Monday of the week containing the first day of the month
  let date = new Date(firstDayOfMonth);
  const dayOfWeek = date.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setDate(date.getDate() - daysToMonday);
  
  // Loop through weeks until we pass the last day of the month
  let iterationCount = 0; // Safety counter
  const MAX_WEEKS = 6; // No month has more than 6 weeks
  
  while (iterationCount < MAX_WEEKS) {
    const weekStart = new Date(date);
    const weekEnd = new Date(date);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    // Stop if this week starts after the last day of the month
    if (weekStart > lastDayOfMonth) break;
    
    weeks.push([new Date(weekStart), new Date(weekEnd)]);
    date.setDate(date.getDate() + 7);
    iterationCount++;
  }
  
  return weeks;
};

// ✅ FIXED: Reusable MultiSelectDropdown component
const MultiSelectDropdown = ({ label, options, selected, onChange, allLabel = 'All', style = {} }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef(null);

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

  // ✅ REMOVED: Auto-select useEffect that was causing infinite loop

  const handleOptionChange = (value) => {
    if (value === 'ALL') {
      onChange([]); // All means no filter
    } else {
      if (selected.includes(value)) {
        const newSelected = selected.filter(v => v !== value);
        onChange(newSelected);
      } else {
        const newSelected = [...selected, value];
        onChange(newSelected);
      }
    }
  };

  const handleAllChange = () => onChange([]);

  // Filter options by search
  const filteredOptions = options.filter(opt => {
    const label = (opt.label || opt).toLowerCase();
    return label.includes(search.toLowerCase());
  });

  // Move selected options to top (in selection order), rest in original order
  const selectedSet = new Set(selected);
  const selectedOptions = filteredOptions.filter(opt => selectedSet.has(String(opt.value || opt)));
  const unselectedOptions = filteredOptions.filter(opt => !selectedSet.has(String(opt.value || opt)));
  const displayOptions = [...selectedOptions, ...unselectedOptions];

  // Compute label with selected values
  let displayLabel = label;
  if (selected.length === 1) {
    const selOpt = options.find(opt => String(opt.value || opt) === selected[0]);
    displayLabel = selOpt ? selOpt.label || selOpt : selected[0];
  } else if (selected.length > 1) {
    const selOpt = options.find(opt => String(opt.value || opt) === selected[0]);
    let firstLabel = selOpt ? (selOpt.label || selOpt) : selected[0];
    if (firstLabel.length > 10) firstLabel = firstLabel.slice(0, 10);
    displayLabel = `${firstLabel} +${selected.length - 1}`;
  }

  return (
    <div className="msd-container" style={{ minWidth: 120, ...style }} ref={containerRef}>
      <div className="msd-label" onClick={() => setOpen(o => !o)}>
        {displayLabel}
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
          {displayOptions.map(opt => (
            <label className="msd-option" key={opt.value || opt}>
              <input
                type="checkbox"
                checked={selected.includes(String(opt.value || opt))}
                onChange={() => handleOptionChange(String(opt.value || opt))}
              /> {opt.label || opt}
            </label>
          ))}
          {displayOptions.length === 0 && (
            <div className="msd-no-options">No options found</div>
          )}
        </div>
      )}
    </div>
  );
};

const SeeTimesheet = () => {
  const { user } = useAuth();
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [projectOptions, setProjectOptions] = useState([]);
  const [managedEmployees, setManagedEmployees] = useState([]);

  let employeeId = user?.EmployeeID;
  if (!employeeId && user?.name) {
    const found = employeeOptions.find(opt => opt.label === user.name);
    if (found) employeeId = found.value;
  }

  const isManager = user?.roles?.some(role => role.roleName.toLowerCase() === 'manager');

  const [entries, setEntries] = useState([]);
  const [filters, setFilters] = useState({
    EmployeeID: [],
    ProjectsName: [],
    Status: [],
    Cateogary: []
  });

  const [dateFilterType, setDateFilterType] = useState('today');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedWeekDay, setSelectedWeekDay] = useState(null);
  const [selectedMonthWeek, setSelectedMonthWeek] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const fetchEntries = useCallback(async () => {
    try {
      let payloadEmployeeId;
      if (isManager && managedEmployees.length > 0) {
        payloadEmployeeId = 0;
      } else {
        payloadEmployeeId = Number(employeeId);
      }
      const response = await getAllTimesheetEntries(payloadEmployeeId);
      let data = response.data;

      if (isManager && managedEmployees.length > 0) {
        data = data.filter(entry => managedEmployees.includes(Number(entry.EmployeeID)));
      }

      setEntries(data);
    } catch (error) {
      console.error('Error fetching timesheet entries', error);
    }
  }, [employeeId, isManager, managedEmployees]);

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
    axios.get('https://timesheetapi-exfxf7bnb7bja5g7.centralindia-01.azurewebsites.net/api/employeeOptions')
      .then(res => setEmployeeOptions(res.data))
      .catch(() => setEmployeeOptions([]));
    axios.get('https://timesheetapi-exfxf7bnb7bja5g7.centralindia-01.azurewebsites.net/api/projectOptions')
      .then(res => setProjectOptions(res.data))
      .catch(() => setProjectOptions([]));
  }, []);

  useEffect(() => {
    if (isManager && employeeId) {
      axios.get(`https://timesheetapi-exfxf7bnb7bja5g7.centralindia-01.azurewebsites.net/api/managedEmployees/${employeeId}`)
        .then(res => setManagedEmployees(res.data.map(e => Number(e.EmployeeID))))
        .catch(() => setManagedEmployees([]));
    }
  }, [isManager, employeeId]);

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

    return (
      (filters.EmployeeID.length === 0 || filters.EmployeeID.includes(String(entry.EmployeeID))) &&
      (filters.ProjectsName.length === 0 || filters.ProjectsName.includes(String(entry.ProjectID))) &&
      (filters.Status.length === 0 || filters.Status.includes(entry.Status)) &&
      (filters.Cateogary.length === 0 || filters.Cateogary.includes(entry.Cateogary)) &&
      dateMatch
    );
  });

  filteredEntries = filteredEntries.slice().sort((a, b) => new Date(a.Date) - new Date(b.Date));

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

    const entriesByEmployee = {};
    filteredEntries.forEach(entry => {
      const empId = String(entry.EmployeeID);
      if (!entriesByEmployee[empId]) entriesByEmployee[empId] = [];
      entriesByEmployee[empId].push(entry);
    });

    const workbook = new ExcelJS.Workbook();

    Object.entries(entriesByEmployee).forEach(([empId, entries]) => {
      const empLabel = employeeOptions.find(opt => String(opt.value) === empId)?.label || empId;
      const safeLabel = empLabel.replace(/[^a-zA-Z0-9 _-]/g, '').substring(0, 31) || `Employee_${empId}`;
      const worksheet = workbook.addWorksheet(safeLabel);

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

      const totalHours = data.reduce((sum, row) => sum + (parseFloat(row.Hours) || 0), 0);
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

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
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

      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: worksheet.columns.length }
      };

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

  const totalHours = filteredEntries.reduce((sum, e) => sum + (parseFloat(e.TotalHours) || 0), 0);

  const statusOptions = [...new Set(entries.map(e => e.Status))];

  return (
    <div className="timesheet-table-container">
      <h2>See Timesheet</h2>
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
        {isManager && managedEmployees.length > 0 && (
          <MultiSelectDropdown
            label="Employee"
            options={employeeOptions
              .filter(opt => managedEmployees.includes(Number(opt.value)))
              .map(opt => ({ value: String(opt.value), label: opt.label }))}
            selected={filters.EmployeeID}
            onChange={vals => setFilters(prev => ({ ...prev, EmployeeID: vals }))}
            allLabel="All"
            style={{ minWidth: 180 }}
          />
        )}
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
        <button onClick={handleDownloadExcel} className="download-excel-btn">
          Download Excel
        </button>
      </div>

      <div className="timesheet-table-scroll">
        <table className="timesheet-table">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Date</th>
              {isManager && managedEmployees.length > 0 && <th>Employee Name</th>}
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
            {filteredEntries.map((entry, idx) => (
              <tr key={entry.EntryID}>
                <td>{idx + 1}</td>
                <td>{formatDateTime(entry.Date)}</td>
                {isManager && managedEmployees.length > 0 && (
                  <td>{employeeOptions.find(opt => opt.value == entry.EmployeeID)?.label || entry.EmployeeID}</td>
                )}
                <td>{entry.Cateogary}</td>
                <td>{projectOptions.find(opt => opt.value == entry.ProjectID)?.label || entry.ProjectID}</td>
                <td>{entry.TaskID}</td>
                <td><div className="comment-read">{entry.Task}</div></td>
                <td>{entry.TotalHours}</td>
                <td>{entry.Status}</td>
                <td><div className="comment-read">{entry.Comment}</div></td>
                <td><div className="comment-read">{entry.ManagerComment || ''}</div></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={isManager && managedEmployees.length > 0 ? "11" : "10"} className="tfoot-total">
                {(() => {
                  if (dateFilterType === 'today') return `Total hours of today: ${totalHours}`;
                  if (dateFilterType === 'week') return `Total hours of this week: ${totalHours}`;
                  if (dateFilterType === 'month') return `Total hours of this month: ${totalHours}`;
                  return `Total hours: ${totalHours}`;
                })()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default SeeTimesheet;
