import React, { useState, useEffect } from 'react';
import { getScrapperData } from '../api';

const ScrapperPage = () => {
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    connection_from: '',
    connection_type: ''
  });

  const fetchData = async () => {
    try {
      const res = await getScrapperData(filters);
      setData(res.data || []);
      console.log('Scrapper data:', res.data);
    } catch (err) {
      console.error('Error fetching scrapper data:', err);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  const handleFilterChange = (e) => {
    setFilters(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  return (
    <div className="scrapper-page" style={{ padding: '24px' }}>
      <h2>Scrapper Data (Excel-like View)</h2>
      <form onSubmit={handleFilterSubmit} style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <input type="date" name="from" value={filters.from} onChange={handleFilterChange} />
        <input type="date" name="to" value={filters.to} onChange={handleFilterChange} />
        <input type="text" name="connection_from" placeholder="Connection From" value={filters.connection_from} onChange={handleFilterChange} />
        <input type="text" name="connection_type" placeholder="Connection Type" value={filters.connection_type} onChange={handleFilterChange} />
        <button type="submit">Filter</button>
      </form>
      <div style={{
        overflowX: 'auto',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        background: '#f9fafb',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <table
          className="scrapper-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'Segoe UI, Arial, sans-serif',
            fontSize: '14px',
            background: '#fff'
          }}
        >
          <thead>
            <tr style={{ background: '#e5e7eb' }}>
              <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>Profile ID</th>
              <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>Post</th>
              <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>Designation</th>
              <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>Author</th>
              <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>Email</th>
              <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>ISMail</th>
              <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>Contact Info</th>
              <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>Connection Type</th>
              <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>Profile URL</th>
              <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>Company</th>
              <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>Unique Post ID</th>
              <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>Connection From</th>
              <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>Created Date</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ textAlign: 'center', padding: '16px', color: '#888' }}>
                  No data found.
                </td>
              </tr>
            ) : (
              data.map(row => (
                <tr key={row.profile_id + '-' + row.unique_post_id}>
                  <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{row.profile_id}</td>
                  <td style={{ padding: '8px', border: '1px solid #d1d5db', whiteSpace: 'pre-line', maxWidth: 300 }}>{row.post}</td>
                  <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{row.Designation}</td>
                  <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{row.author}</td>
                  <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{row.email}</td>
                  <td style={{ padding: '8px', border: '1px solid #d1d5db', textAlign: 'center' }}>{row.ISMail ? '✔️' : ''}</td>
                  <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{row.contact_info}</td>
                  <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{row.connection_type}</td>
                  <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>
                    <a href={row.profile_url} target="_blank" rel="noopener noreferrer">{row.profile_url}</a>
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{row.company}</td>
                  <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{row.unique_post_id}</td>
                  <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{row.connection_from}</td>
                  <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{row.created_date}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScrapperPage;