'use client';

import React, { useState, useEffect, useCallback } from 'react';
// Firebase imports removed for MongoDB migration

// NOTE
// This is a single-file client component intended for use as app/page.jsx in a Next.js 15 (App Router)
// project. It keeps your original logic and Tailwind styling but adapts Firebase initialization
// and client-only analytics usage. Place this file at: /app/page.jsx (or import/compose it
// into your page structure). Make sure Tailwind is configured in your Next project.

// Firebase config and initialization removed for MongoDB migration

// Helper function to format date to YYYY-MM-DD
const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Default prayer names and habits
const defaultPrayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'witr'];
const defaultHabits = [
  { id: 'quran', name: 'Quran', type: 'number' },
  { id: 'zikr', name: 'Zikr', type: 'number' },
];

export default function Page() {
  // Use a hardcoded userId for single-user mode
  const userId = 'singleUser';
  const [qazaData, setQazaData] = useState(null); // Will store user data from MongoDB in future
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dailyLog'); // 'dailyLog', 'summary', 'initialSetup', 'settings', 'bulkEntry'

  // State for daily logging
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [currentDayPrayerStatus, setCurrentDayPrayerStatus] = useState({}); // { fajr: { current: 'none', qaza: 'none' }, ... }
  const [currentDayHabitValues, setCurrentDayHabitValues] = useState({}); // { quran: 0, zikr: 0, customHabit1: 'value' }

  // State for initial Qaza backlog and target daily make-up
  const [initialQazaBacklog, setInitialQazaBacklog] = useState({}); // { fajr: { count: 0, targetDaily: 1 }, ... }

  // State for custom field names (UI display names)
  const [customFieldNames, setCustomFieldNames] = useState({});

  // State for custom habits configuration
  const [customHabitsConfig, setCustomHabitsConfig] = useState([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitType, setNewHabitType] = useState('number');

  // State for bulk entry
  const [bulkStartDate, setBulkStartDate] = useState(formatDate(new Date()));
  const [bulkEndDate, setBulkEndDate] = useState(formatDate(new Date()));
  const [bulkPrayerCounts, setBulkPrayerCounts] = useState({}); // { fajr: { missed: 0, made_up: 0 }, ... }

  // Fetch Qaza data from MongoDB API on mount
  useEffect(() => {
    const fetchQazaData = async () => {
      setLoading(true);
      setError(null);
      try {
  const res = await fetch('/api/qaza');
  if (!res.ok) throw new Error('Failed to fetch data');
  const data = await res.json();
  setQazaData(data || {});

        // Initialize state from fetched data
        // Initial Qaza Backlog
        const initialQaza = {};
        defaultPrayerNames.forEach(p => {
          initialQaza[p] = {
            count: data.initialQaza?.[p]?.count || 0,
            targetDaily: data.initialQaza?.[p]?.targetDaily || 1
          };
        });
        setInitialQazaBacklog(initialQaza);

        setCustomFieldNames(data.customFieldNames || {});
        setCustomHabitsConfig(data.customHabitsConfig || defaultHabits);

        // Daily log for selected date
        const logsForSelectedDate = data.logs?.[selectedDate];
        if (logsForSelectedDate) {
          const prayerStatus = {};
          defaultPrayerNames.forEach(p => {
            prayerStatus[p] = logsForSelectedDate[p] || { current: 'none', qaza: 'none' };
          });
          setCurrentDayPrayerStatus(prayerStatus);

          const habitValues = {};
          (data.customHabitsConfig || defaultHabits).forEach(h => {
            habitValues[h.id] = logsForSelectedDate[h.id] || (h.type === 'number' ? 0 : '');
          });
          setCurrentDayHabitValues(habitValues);
        } else {
          // Reset to defaults if no log for selected date
          const defaultPrayerStatus = {};
          defaultPrayerNames.forEach(p => defaultPrayerStatus[p] = { current: 'none', qaza: 'none' });
          setCurrentDayPrayerStatus(defaultPrayerStatus);

          const defaultHabitValues = {};
          (data.customHabitsConfig || defaultHabits).forEach(h => {
            defaultHabitValues[h.id] = (h.type === 'number' ? 0 : '');
          });
          setCurrentDayHabitValues(defaultHabitValues);
        }

        // Bulk prayer counts
        const initialBulkCounts = {};
        defaultPrayerNames.forEach(p => {
          initialBulkCounts[p] = { missed: 0, made_up: 0 };
        });
        setBulkPrayerCounts(initialBulkCounts);
      } catch (err) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchQazaData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Get display name for a field
  const getDisplayName = useCallback((fieldId) => {
    return customFieldNames[fieldId] || fieldId.charAt(0).toUpperCase() + fieldId.slice(1);
  }, [customFieldNames]);

  // Calculate total Qaza for each prayer
  const calculateTotals = useCallback(() => {
    if (!qazaData) {
      return Object.fromEntries(defaultPrayerNames.map(p => [p, 0]));
    }

    const totals = {};
    defaultPrayerNames.forEach(p => {
      totals[p] = initialQazaBacklog[p]?.count || 0;
    });

    // Add from daily logs
    if (qazaData.logs) {
      Object.values(qazaData.logs).forEach(dayLog => {
        defaultPrayerNames.forEach(prayer => {
          if (dayLog[prayer]?.current === 'missed') {
            totals[prayer] = (totals[prayer] || 0) + 1;
          }
          if (dayLog[prayer]?.qaza === 'made_up') {
            totals[prayer] = (totals[prayer] || 0) - 1;
          }
        });
      });
    }

    // Add from bulk adjustments
    if (qazaData.bulkAdjustments) {
      Object.values(qazaData.bulkAdjustments).forEach(adjustment => {
        defaultPrayerNames.forEach(prayer => {
          totals[prayer] = (totals[prayer] || 0) + (adjustment[prayer]?.missed || 0);
          totals[prayer] = (totals[prayer] || 0) - (adjustment[prayer]?.made_up || 0);
        });
      });
    }

    return totals;
  }, [qazaData, initialQazaBacklog]);

  const totals = calculateTotals();

  // Calculate estimated finish date for each prayer based on target daily make-up
  const calculateFinishDates = useCallback(() => {
    const finishDates = {};
    const today = new Date();

    defaultPrayerNames.forEach(prayer => {
      const currentPendingQaza = totals[prayer] || 0;
      const targetDailyMakeUp = initialQazaBacklog[prayer]?.targetDaily || 0;

      if (currentPendingQaza <= 0) {
        finishDates[prayer] = 'Completed!';
      } else if (targetDailyMakeUp <= 0) {
        finishDates[prayer] = 'Set a daily target to estimate.';
      } else {
        const daysToFinish = currentPendingQaza / targetDailyMakeUp;
        const estimatedFinishDate = new Date(today);
        estimatedFinishDate.setDate(today.getDate() + Math.ceil(daysToFinish));
        finishDates[prayer] = formatDate(estimatedFinishDate);
      }
    });
    return finishDates;
  }, [totals, initialQazaBacklog]);

  const finishDates = calculateFinishDates();


  // Handle changes in daily prayer status (radio buttons)
  const handlePrayerStatusChange = (prayer, type, status) => {
    setCurrentDayPrayerStatus(prev => ({
      ...prev,
      [prayer]: {
        ...prev[prayer],
        [type]: status,
      },
    }));
  };

  // Handle changes in daily habit values
  const handleHabitValueChange = (habitId, value) => {
    setCurrentDayHabitValues(prev => ({
      ...prev,
      [habitId]: value,
    }));
  };

  // Save daily log to MongoDB
  const saveDailyLog = async () => {
    setLoading(true);
    setError(null);
    try {
      // Compose the log object for the selected date
      const log = {
        date: selectedDate,
        prayers: currentDayPrayerStatus,
        habits: currentDayHabitValues,
        type: 'dailyLog',
      };
      const res = await fetch('/api/qaza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      });
      if (!res.ok) throw new Error('Failed to save daily log');
      // Optimistically update local qazaData.logs for instant UI update
      setQazaData(prev => {
        if (!prev) return prev;
        const newLogs = { ...(prev.logs || {}) };
        newLogs[selectedDate] = { ...currentDayPrayerStatus, ...currentDayHabitValues };
        return { ...prev, logs: newLogs };
      });
      // Refetch data to ensure sync with backend
      const refetch = await fetch('/api/qaza');
      const data = await refetch.json();
      setQazaData(data || {});
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to save daily log');
    } finally {
      setLoading(false);
    }
  };

  // Save initial Qaza backlog and target daily make-up to MongoDB
  const saveInitialQaza = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        type: 'initialQaza',
        initialQaza: initialQazaBacklog,
      };
      const res = await fetch('/api/qaza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save initial Qaza');
      // Refetch data to update UI
      const refetch = await fetch('/api/qaza');
      const dataArr = await refetch.json();
      setQazaData(dataArr[0] || {});
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to save initial Qaza');
    } finally {
      setLoading(false);
    }
  };

  // Handle custom field name changes
  const handleFieldNameChange = async (fieldId, newName) => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        type: 'customFieldName',
        fieldId,
        newName,
      };
      const res = await fetch('/api/qaza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update field name');
      const refetch = await fetch('/api/qaza');
      const dataArr = await refetch.json();
      setQazaData(dataArr[0] || {});
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to update field name');
    } finally {
      setLoading(false);
    }
  };

  // Add new custom habit
  const addCustomHabit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!newHabitName.trim()) throw new Error('Habit name cannot be empty.');
      const newHabitId = newHabitName.trim().toLowerCase().replace(/\s+/g, '_');
      const payload = {
        type: 'addHabit',
        habit: { id: newHabitId, name: newHabitName.trim(), type: newHabitType },
      };
      const res = await fetch('/api/qaza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add custom habit');
      setNewHabitName('');
      setNewHabitType('number');
      const refetch = await fetch('/api/qaza');
      const dataArr = await refetch.json();
      setQazaData(dataArr[0] || {});
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to add custom habit');
    } finally {
      setLoading(false);
    }
  };

  // Remove custom habit
  const removeCustomHabit = async (habitId) => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        type: 'removeHabit',
        habitId,
      };
      const res = await fetch('/api/qaza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to remove custom habit');
      const refetch = await fetch('/api/qaza');
      const dataArr = await refetch.json();
      setQazaData(dataArr[0] || {});
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to remove custom habit');
    } finally {
      setLoading(false);
    }
  };

  // Handle bulk prayer count changes
  const handleBulkPrayerChange = (prayer, type, value) => {
    setBulkPrayerCounts(prev => ({
      ...prev,
      [prayer]: {
        ...prev[prayer],
        [type]: Number(value),
      },
    }));
  };

  // Apply bulk log to MongoDB
  const applyBulkLog = async () => {
    setLoading(true);
    setError(null);
    try {
      if (new Date(bulkStartDate) > new Date(bulkEndDate)) throw new Error('Start Date cannot be after End Date for bulk entry.');
      const payload = {
        type: 'bulkLog',
        bulkStartDate,
        bulkEndDate,
        bulkPrayerCounts,
      };
      const res = await fetch('/api/qaza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to apply bulk log');
      // Refetch data to update UI
      const refetch = await fetch('/api/qaza');
      const dataArr = await refetch.json();
      setQazaData(dataArr[0] || {});
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to apply bulk log');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading Qaza Tracker...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error:</strong>
        <span className="block sm:inline ml-2">{error}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 font-inter text-gray-800 flex flex-col items-center">
      <div className="max-w-4xl w-full bg-white shadow-xl rounded-2xl p-6 md:p-8 space-y-8">
        <h1 className="text-4xl font-extrabold text-center text-indigo-700 mb-6">Qaza Namaz & Habits Tracker</h1>

        {/* User ID Display (optional, can remove if not needed) */}
        <div className="text-center text-sm text-gray-600 mb-4 p-2 bg-gray-50 rounded-lg shadow-inner">
          User: <span className="font-mono text-indigo-600 break-all">Single User Mode</span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-6">
          <button
            className={`px-4 py-2 rounded-l-lg font-semibold transition-colors duration-200 ${activeTab === 'dailyLog' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            onClick={() => setActiveTab('dailyLog')}
          >
            Daily Log
          </button>
          <button
            className={`px-4 py-2 font-semibold transition-colors duration-200 ${activeTab === 'summary' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
          <button
            className={`px-4 py-2 font-semibold transition-colors duration-200 ${activeTab === 'initialSetup' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            onClick={() => setActiveTab('initialSetup')}
          >
            Initial Qaza
          </button>
          <button
            className={`px-4 py-2 font-semibold transition-colors duration-200 ${activeTab === 'bulkEntry' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            onClick={() => setActiveTab('bulkEntry')}
          >
            Bulk Entry
          </button>
          <button
            className={`px-4 py-2 rounded-r-lg font-semibold transition-colors duration-200 ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>

        {/* Daily Log Tab Content */}
        {activeTab === 'dailyLog' && (
          <div className="bg-blue-50 p-6 rounded-xl shadow-md">
            <h2 className="text-2xl font-bold text-blue-700 mb-4">Daily Log</h2>
            <div className="mb-4">
              <label htmlFor="logDate" className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
              <input
                type="date"
                id="logDate"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              />
            </div>

            <div className="space-y-4 mb-6">
              <h3 className="text-xl font-semibold text-blue-800">Prayers</h3>
              {defaultPrayerNames.map(prayer => (
                <div key={prayer} className="flex flex-col md:flex-row items-start md:items-center justify-between bg-blue-100 p-4 rounded-lg shadow-sm">
                  <span className="text-lg font-semibold text-blue-800 capitalize mb-2 md:mb-0">{getDisplayName(prayer)}</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name={`${prayer}-${selectedDate}-current`}
                        value="prayed"
                        checked={currentDayPrayerStatus[prayer]?.current === 'prayed'}
                        onChange={() => handlePrayerStatusChange(prayer, 'current', 'prayed')}
                        className="form-radio text-green-600 h-5 w-5"
                      />
                      <span className="ml-2 text-green-700">Prayed</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name={`${prayer}-${selectedDate}-current`}
                        value="missed"
                        checked={currentDayPrayerStatus[prayer]?.current === 'missed'}
                        onChange={() => handlePrayerStatusChange(prayer, 'current', 'missed')}
                        className="form-radio text-red-600 h-5 w-5"
                      />
                      <span className="ml-2 text-red-700">Missed</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name={`${prayer}-${selectedDate}-current`}
                        value="none"
                        checked={currentDayPrayerStatus[prayer]?.current === 'none'}
                        onChange={() => handlePrayerStatusChange(prayer, 'current', 'none')}
                        className="form-radio text-gray-600 h-5 w-5"
                      />
                      <span className="ml-2 text-gray-700">None</span>
                    </label>
                    <div className="border-l border-blue-200 pl-4 ml-4">
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          name={`${prayer}-${selectedDate}-qaza`}
                          checked={currentDayPrayerStatus[prayer]?.qaza === 'made_up'}
                          onChange={(e) => handlePrayerStatusChange(prayer, 'qaza', e.target.checked ? 'made_up' : 'none')}
                          className="form-checkbox text-purple-600 h-5 w-5 rounded"
                        />
                        <span className="ml-2 text-purple-700">Made Up Qaza</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
              {/* Mark All Buttons */}
              <div className="flex gap-4 mt-4 justify-end">
                <button
                  type="button"
                  className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded shadow"
                  onClick={() => {
                    // Mark all as prayed
                    const allPrayed = {};
                    defaultPrayerNames.forEach(p => {
                      allPrayed[p] = { ...currentDayPrayerStatus[p], current: 'prayed' };
                    });
                    setCurrentDayPrayerStatus(allPrayed);
                  }}
                >
                  Mark All Prayed
                </button>
                <button
                  type="button"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded shadow"
                  onClick={() => {
                    // Mark all as made up
                    const allMadeUp = {};
                    defaultPrayerNames.forEach(p => {
                      allMadeUp[p] = { ...currentDayPrayerStatus[p], qaza: 'made_up' };
                    });
                    setCurrentDayPrayerStatus(allMadeUp);
                  }}
                >
                  Mark All Made Up
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-blue-800">Habits</h3>
              {customHabitsConfig.map(habit => (
                <div key={habit.id} className="flex items-center justify-between bg-blue-100 p-4 rounded-lg shadow-sm">
                  <label htmlFor={habit.id} className="text-lg font-semibold text-blue-800 capitalize">{getDisplayName(habit.id)}</label>
                  <input
                    type={habit.type === 'number' ? 'number' : 'text'}
                    id={habit.id}
                    value={currentDayHabitValues[habit.id] || (habit.type === 'number' ? 0 : '')}
                    onChange={(e) => handleHabitValueChange(habit.id, habit.type === 'number' ? Number(e.target.value) : e.target.value)}
                    className="w-24 p-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-center"
                    min={habit.type === 'number' ? "0" : undefined}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={saveDailyLog}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
              disabled={loading || !qazaData}
            >
              {loading ? 'Saving Daily Log...' : 'Save Daily Log'}
            </button>
          </div>
        )}

        {/* Summary Tab Content */}
        {activeTab === 'summary' && (
          <div className="space-y-8">
            {/* Overall Qaza Summary */}
            <div className="bg-green-50 p-6 rounded-xl shadow-md">
              <h2 className="text-2xl font-bold text-green-700 mb-4">Current Qaza Backlog</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {defaultPrayerNames.map(prayer => (
                  <div key={prayer} className="flex flex-col items-center p-3 bg-green-100 rounded-lg shadow-sm">
                    <span className="text-lg font-semibold text-green-800 capitalize">{getDisplayName(prayer)}</span>
                    <span className="text-3xl font-extrabold text-green-900 mt-1">{totals[prayer] || 0}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-4 text-center">Positive numbers indicate pending Qaza.</p>
            </div>

            {/* Estimated Finish Dates */}
            <div className="bg-purple-50 p-6 rounded-xl shadow-md">
              <h2 className="text-2xl font-bold text-purple-700 mb-4">Estimated Finish Dates</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {defaultPrayerNames.map(prayer => (
                  <div key={prayer} className="flex flex-col p-3 bg-purple-100 rounded-lg shadow-sm">
                    <span className="text-lg font-semibold text-purple-800 capitalize">{getDisplayName(prayer)}</span>
                    <span className="text-xl font-bold text-purple-900 mt-1">{finishDates[prayer]}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-4 text-center">Estimates are based on your set "Target Daily Qaza Made Up" rate.</p>
            </div>
          </div>
        )}

        {/* Initial Qaza Setup Tab Content */}
        {activeTab === 'initialSetup' && (
          <div className="bg-yellow-50 p-6 rounded-xl shadow-md">
            <h2 className="text-2xl font-bold text-yellow-700 mb-4">Initial Qaza Backlog & Targets</h2>
            <p className="text-gray-700 mb-4">Set your initial estimated Qaza backlog and your target number of Qaza prayers to make up daily for each Salah.</p>
            <div className="space-y-4">
              {defaultPrayerNames.map(prayer => (
                <div key={prayer} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-yellow-100 p-4 rounded-lg shadow-sm">
                  <label htmlFor={`initial-${prayer}`} className="text-lg font-semibold text-yellow-800 capitalize sm:w-1/3">{getDisplayName(prayer)}</label>
                  <div className="flex items-center gap-4 mt-2 sm:mt-0 sm:w-2/3">
                    <div className="flex flex-col">
                      <label htmlFor={`initial-count-${prayer}`} className="text-sm text-gray-700 mb-1">Backlog Count</label>
                      <input
                        type="number"
                        id={`initial-count-${prayer}`}
                        value={initialQazaBacklog[prayer]?.count || 0}
                        onChange={(e) => setInitialQazaBacklog(prev => ({
                          ...prev,
                          [prayer]: { ...prev[prayer], count: Number(e.target.value) }
                        }))}
                        className="w-24 p-2 rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-center"
                        min="0"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor={`initial-target-${prayer}`} className="text-sm text-gray-700 mb-1">Target Daily Made Up</label>
                      <input
                        type="number"
                        id={`initial-target-${prayer}`}
                        value={initialQazaBacklog[prayer]?.targetDaily || 0}
                        onChange={(e) => setInitialQazaBacklog(prev => ({
                          ...prev,
                          [prayer]: { ...prev[prayer], targetDaily: Number(e.target.value) }
                        }))}
                        className="w-24 p-2 rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-center"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={saveInitialQaza}
              className="mt-6 w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
              disabled={loading || !qazaData}
            >
              {loading ? 'Saving...' : 'Save Initial Qaza & Targets'}
            </button>
          </div>
        )}

        {/* Bulk Entry Tab Content */}
        {activeTab === 'bulkEntry' && (
          <div className="bg-orange-50 p-6 rounded-xl shadow-md">
            <h2 className="text-2xl font-bold text-orange-700 mb-4">Bulk Log Entry</h2>
            <p className="text-gray-700 mb-4">Enter total missed and made-up Qaza for a date range. This will adjust your overall backlog.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label htmlFor="bulkStartDate" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  id="bulkStartDate"
                  value={bulkStartDate}
                  onChange={(e) => setBulkStartDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2 border"
                />
              </div>
              <div>
                <label htmlFor="bulkEndDate" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  id="bulkEndDate"
                  value={bulkEndDate}
                  onChange={(e) => setBulkEndDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2 border"
                />
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <h3 className="text-xl font-semibold text-orange-800">Prayer Counts in Range</h3>
              {defaultPrayerNames.map(prayer => (
                <div key={prayer} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-orange-100 p-4 rounded-lg shadow-sm">
                  <span className="text-lg font-semibold text-orange-800 capitalize sm:w-1/3">{getDisplayName(prayer)}</span>
                  <div className="flex items-center gap-4 mt-2 sm:mt-0 sm:w-2/3">
                    <div className="flex flex-col">
                      <label htmlFor={`bulk-missed-${prayer}`} className="text-sm text-gray-700 mb-1">Missed</label>
                      <input
                        type="number"
                        id={`bulk-missed-${prayer}`}
                        value={bulkPrayerCounts[prayer]?.missed || 0}
                        onChange={(e) => handleBulkPrayerChange(prayer, 'missed', e.target.value)}
                        className="w-24 p-2 rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-center"
                        min="0"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor={`bulk-madeup-${prayer}`} className="text-sm text-gray-700 mb-1">Made Up Qaza</label>
                      <input
                        type="number"
                        id={`bulk-madeup-${prayer}`}
                        value={bulkPrayerCounts[prayer]?.made_up || 0}
                        onChange={(e) => handleBulkPrayerChange(prayer, 'made_up', e.target.value)}
                        className="w-24 p-2 rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-center"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={applyBulkLog}
              className="mt-6 w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
              disabled={loading || !qazaData}
            >
              {loading ? 'Applying Bulk Log...' : 'Apply Bulk Log'}
            </button>
          </div>
        )}

        {/* Settings Tab Content */}
        {activeTab === 'settings' && (
          <div className="bg-gray-50 p-6 rounded-xl shadow-md">
            <h2 className="text-2xl font-bold text-gray-700 mb-6">Settings & Customization</h2>

            {/* Rename Fields */}
            <div className="mb-8 p-4 bg-gray-100 rounded-lg shadow-inner">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Rename Prayer & Habit Fields</h3>
              <div className="space-y-3">
                {[...defaultPrayerNames, ...customHabitsConfig.map(h => h.id)].map(fieldId => (
                  <div key={fieldId} className="flex items-center justify-between">
                    <label htmlFor={`rename-${fieldId}`} className="text-md font-medium text-gray-700 capitalize">Original: {fieldId.replace(/_/g, ' ')}</label>
                    <input
                      type="text"
                      id={`rename-${fieldId}`}
                      value={customFieldNames[fieldId] || ''}
                      placeholder={fieldId.charAt(0).toUpperCase() + fieldId.slice(1)}
                      onChange={(e) => handleFieldNameChange(fieldId, e.target.value)}
                      className="w-48 p-2 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-4">Changes are saved automatically as you type.</p>
            </div>

            {/* Manage Custom Habits */}
            <div className="p-4 bg-gray-100 rounded-lg shadow-inner">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Manage Custom Habits</h3>
              <div className="space-y-3 mb-6">
                {customHabitsConfig.map(habit => (
                  <div key={habit.id} className="flex items-center justify-between bg-white p-3 rounded-md shadow-sm border border-gray-200">
                    <span className="text-lg font-medium text-gray-700 capitalize">{getDisplayName(habit.id)} ({habit.type})</span>
                    <button
                      onClick={() => removeCustomHabit(habit.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm transition duration-200"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="New Habit Name"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  className="flex-grow p-2 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <select
                  value={newHabitType}
                  onChange={(e) => setNewHabitType(e.target.value)}
                  className="p-2 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="number">Number</option>
                  <option value="text">Text</option>
                </select>
                <button
                  onClick={addCustomHabit}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-md transition duration-300 ease-in-out"
                  disabled={loading || !qazaData}
                >
                  Add Habit
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
