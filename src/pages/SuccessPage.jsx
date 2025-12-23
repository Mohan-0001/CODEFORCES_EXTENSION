/* global chrome */
import React from 'react'

const SuccessPage = ({ isDark }) => {
  const handleReset = () => {
    if (window.confirm('Are you sure you want to disconnect and start over? This will remove all connections.')) {
      // Clear all stored credentials
      chrome.storage.sync.clear(() => {
        // Force reload the popup to restart the flow
        window.location.reload()
      })
    }
  }

  return (
    <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-lg p-10 text-center border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
      <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-8">
        <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        All Set!
      </h2>

      <p className={`text-base mb-8 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
        Your Codeforces submissions will now be automatically pushed to GitHub.
      </p>

      <div className="text-sm text-gray-500 mb-10">
        You can close this popup now.
      </div>

      {/* Change Settings Button */}
      <button
        onClick={handleReset}
        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition shadow-md"
      >
        Change Settings / Disconnect
      </button>

      <p className="text-xs text-gray-500 mt-6">
        Click above if you want to change your Codeforces handle, GitHub account, or repository.
      </p>
    </div>
  )
}

export default SuccessPage