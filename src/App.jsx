import { useState, useEffect } from 'react'
import CodeforcesConnect from './pages/CodeforcesConnect'
import GitHubConnect from './pages/GitHubConnect'
import RepoSelectPage from './pages/RepoSelectPage'
import SuccessPage from './pages/SuccessPage'

function App() {
  const [isDark, setIsDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [currentPage, setCurrentPage] = useState('codeforces') // 'codeforces' | 'github' | 'repoSelect' | 'success'
  console.log(chrome.storage.sync.get('githubToken'));

  // Dark mode listener
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Resume flow based on stored data
  useEffect(() => {
    if (!chrome?.storage?.sync) return

    chrome.storage.sync.get(['codeforcesUsername', 'ghToken', 'githubRepo'], (data) => {
      console.log(data)
      if (data.codeforcesUsername && data.ghToken && data.githubRepo) {
        setCurrentPage('success')
      } else if (data.codeforcesUsername && data.ghToken) {
        setCurrentPage('repoSelect')
      } else if (data.codeforcesUsername) {
        setCurrentPage('github')
      }
      // else stay on codeforces
    })
  }, [])

  // Navigation functions
  const goToGitHub = () => setCurrentPage('github')
  const goToRepoSelect = () => setCurrentPage('repoSelect')
  const goToSuccess = () => setCurrentPage('success')
  const goBack = () => {
    if (currentPage === 'github') setCurrentPage('codeforces')
    if (currentPage === 'repoSelect') setCurrentPage('github')
    // success page has no back (final step)
  }

  // Determine if back button should be shown
  const showBackButton = currentPage === 'github' || currentPage === 'repoSelect'

  return (
    <div className={`w-[360px] min-h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-black'} flex flex-col p-5 relative`}>
      {/* Back Button - Top Left */}
      {showBackButton && (
        <button
          onClick={goBack}
          className="absolute top-5 left-5 flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      )}

      {/* Main Content - Centered */}
      <div className="flex-1 flex items-start justify-center w-full mt-12"> {/* mt-12 to make space for back button */}
        {currentPage === 'codeforces' && (
          <CodeforcesConnect isDark={isDark} onSuccess={goToGitHub} />
        )}

        {currentPage === 'github' && (
          <GitHubConnect isDark={isDark} onSuccess={goToRepoSelect} />
        )}

        {currentPage === 'repoSelect' && (
          <RepoSelectPage isDark={isDark} onSuccess={goToSuccess} />
        )}

        {currentPage === 'success' && (
          <SuccessPage isDark={isDark} />
        )}
      </div>
    </div>
  )
}

export default App