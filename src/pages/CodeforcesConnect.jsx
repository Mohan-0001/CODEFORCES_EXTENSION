/* global chrome */
import React, { useState } from 'react'

const CodeforcesConnect = ({ isDark, onSuccess }) => {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    const trimmedUsername = username.trim()

    if (!trimmedUsername) {
      setError('Username is required.')
      setIsSubmitting(false)
      return
    }

    try {
      // Verify if the Codeforces handle exists using public API
      const response = await fetch(
        `https://codeforces.com/api/user.info?handles=${trimmedUsername}`
      )
      const data = await response.json()

      if (data.status !== 'OK') {
        setError('Codeforces handle not found. Please check and try again.')
        setIsSubmitting(false)
        return
      }

      // Save username and proceed to GitHub step
      await chrome.storage.sync.set({
        codeforcesUsername: trimmedUsername,
      })

      onSuccess() // Move to GitHub connect page
    } catch (err) {
      setError('Connection failed. Please check your internet connection.')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-lg p-8 border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
      <div className="text-center mb-8">
        <img src="/ext-icon.png" alt="CFPusher" className="w-16 h-16 mx-auto mb-4 rounded-full" />
        <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Connect Codeforces
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          Enter your Codeforces handle to get started
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            Enter Codeforces UserName
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. tourist"
            disabled={isSubmitting}
            className={`w-full px-4 py-3 rounded-lg border ${isDark
                ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500'
                : 'bg-white border-gray-300 placeholder-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 transition`}
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg transition"
        >
          {isSubmitting ? 'Verifying...' : 'Continue to GitHub'}
        </button>
      </form>
    </div>
  )
}

export default CodeforcesConnect