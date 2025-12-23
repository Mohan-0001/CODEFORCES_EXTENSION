/* global chrome */
import React, { useState, useEffect } from 'react'

const RepoSelectPage = ({ isDark, onSuccess }) => {
  const [repos, setRepos] = useState([])
  const [selectedOption, setSelectedOption] = useState('') // 'existing:owner/repo' or 'create-new'
  const [newRepoName, setNewRepoName] = useState('')
  const [visibility, setVisibility] = useState('public') // 'public' or 'private'
  const [description, setDescription] = useState('My Codeforces contest solutions')
  const [username, setUsername] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await chrome.storage.sync.get(['ghToken', 'ghUsername'])
        if (!stored.ghToken || !stored.ghUsername) {
          setError('GitHub authentication missing')
          setLoading(false)
          return
        }

        setUsername(stored.ghUsername)
        setToken(stored.ghToken)

        const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
          headers: {
            Authorization: `token ${stored.ghToken}`,
            Accept: 'application/vnd.github+json',
          },
        })

        if (!res.ok) throw new Error('Failed to load repositories')

        const data = await res.json()
        const sorted = data.sort((a, b) => a.full_name.localeCompare(b.full_name))
        setRepos(sorted)

        // Auto-select Codeforces-Solutions if exists
        const preferred = sorted.find(r => r.name.toLowerCase() === 'codeforces-solutions')
        if (preferred) {
          setSelectedOption(`existing:${preferred.full_name}`)
        }
      } catch (e) {
        setError('Failed to load repositories')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const isCreatingNew = selectedOption === 'create-new'

  const handleContinue = async () => {
    setError('')
    setProcessing(true)

    let finalRepoFullName = ''

    if (isCreatingNew) {
      if (!newRepoName.trim()) {
        setError('Repository name is required')
        setProcessing(false)
        return
      }

      const repoName = newRepoName.trim().replace(/\s+/g, '-')
      if (!/^[a-zA-Z0-9._-]+$/.test(repoName)) {
        setError('Invalid name: only letters, numbers, -, _, . allowed')
        setProcessing(false)
        return
      }

      finalRepoFullName = `${username}/${repoName}`

      try {
        const createRes = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: repoName,
            description: description.trim() || undefined,
            private: visibility === 'private',
            auto_init: true,
          }),
        })

        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}))
          throw new Error(err.message || 'Failed to create repository')
        }
      } catch (e) {
        setError(
          e.message.includes('already exists')
            ? 'Repository name already exists'
            : `Creation failed: ${e.message}`
        )
        setProcessing(false)
        return
      }
    } else {
      if (!selectedOption.startsWith('existing:')) {
        setError('Please select a repository')
        setProcessing(false)
        return
      }
      finalRepoFullName = selectedOption.replace('existing:', '')
    }

    try {
      await chrome.storage.sync.set({ githubRepo: finalRepoFullName })
      onSuccess()
    } catch (e) {
      setError('Failed to save selection')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-5 border ${isDark ? 'border-gray-700' : 'border-gray-200'} h-full flex flex-col`}>
      {/* Header */}
      <div className="text-center mb-6">
        <img src="/ext-icon.png" alt="CFPusher" className="w-12 h-12 mx-auto mb-3 rounded-full" />
        <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Choose Repository
        </h1>
        <p className="text-xs text-gray-500 mt-1">@{username}</p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main Dropdown */}
          <select
            value={selectedOption}
            onChange={(e) => setSelectedOption(e.target.value)}
            className={`w-full px-4 py-3 text-sm overflow-x-auto font-medium rounded-lg border ${
              isDark
                ? 'bg-gray-900 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 transition`}
          >
            <option value="">Select a repository</option>
            <option value="create-new" className="font-semibold text-blue-600">
              ➕ Create new repository...
            </option>
            <optgroup label="Your repositories">
              {repos.map((repo) => (
                <option key={repo.id} value={`existing:${repo.full_name}`}>
                  {repo.full_name} {repo.private ? '🔒 Private' : '🌐 Public'}
                </option>
              ))}
            </optgroup>
          </select>

          {/* Create New Fields - Shown only when selected */}
          {isCreatingNew && (
            <div className="space-y-4 p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
              <input
                type="text"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                placeholder="Repository name"
                className={`w-full px-4 py-2.5 text-sm rounded-lg border ${
                  isDark
                    ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />

              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className={`w-full px-4 py-2.5 text-sm rounded-lg border ${
                  isDark
                    ? 'bg-gray-900 border-gray-600 text-white'
                    : 'bg-white border-gray-300'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="public">🌐 Public</option>
                <option value="private">🔒 Private</option>
              </select>

              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className={`w-full px-4 py-2.5 text-sm rounded-lg border ${
                  isDark
                    ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 text-center bg-red-50 dark:bg-red-900/20 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            onClick={handleContinue}
            disabled={processing || !selectedOption || (isCreatingNew && !newRepoName.trim())}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition shadow-md"
          >
            {processing ? 'Processing...' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  )
}

export default RepoSelectPage