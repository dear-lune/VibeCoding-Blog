import CreateArticle from './CreateArticle'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'

const ArticleDetail = lazy(() => import('./ArticleDetail'))

const API_BASE_URL = 'http://127.0.0.1:8000'
const PAGE_SIZE = 6
const API_PAGE_SIZE = 100

type Theme = 'light' | 'dark'
type Route = {
  page: 'home' | 'about' | 'article' | 'create'
  articleId?: number
}

type Article = {
  id: number
  title: string
  excerpt: string
  date: string
  tags: string[]
  markdown: string
  created_at?: string
  updated_at?: string
}

type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

type ArticlePage = {
  items: Article[]
  total: number
  page: number
  page_size: number
}

type Toast = {
  type: 'success' | 'error' | 'warning'
  message: string
}

function getRouteFromHash(): Route {
  const [page, rawArticleId] = window.location.hash
    .replace(/^#\/?/, '')
    .split('/')

  if (page === 'about') return { page: 'about' }
  if (page === 'create') return { page: 'create' }

  if (page === 'article') {
    const articleId = Number(rawArticleId)
    if (Number.isInteger(articleId) && articleId > 0) {
      return { page: 'article', articleId }
    }
  }

  return { page: 'home' }
}

function getSavedTheme(): Theme {
  try {
    return window.localStorage.getItem('blog-theme') === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

async function requestApi<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  const result = (await response.json()) as ApiEnvelope<T>

  if (!response.ok || result.code !== 0) {
    throw new Error(result.message || `请求失败（${response.status}）`)
  }

  return result.data
}

async function fetchAllArticles(signal: AbortSignal): Promise<Article[]> {
  const articles: Article[] = []
  let page = 1
  let total = 0

  do {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(API_PAGE_SIZE),
    })
    const data = await requestApi<ArticlePage>(
      `${API_BASE_URL}/api/articles?${params.toString()}`,
      signal,
    )

    articles.push(...data.items)
    total = data.total
    page += 1
  } while (articles.length < total)

  return articles
}

function ArticleSkeleton() {
  return (
    <div className="article-skeleton" aria-hidden="true">
      <span className="skeleton-line skeleton-date" />
      <span className="skeleton-line skeleton-title" />
      <span className="skeleton-line" />
      <span className="skeleton-line skeleton-short" />
      <span className="skeleton-line skeleton-tags" />
    </div>
  )
}

function App() {
  const [currentRoute, setCurrentRoute] = useState<Route>(getRouteFromHash)
  const [theme, setTheme] = useState<Theme>(getSavedTheme)
  const [articles, setArticles] = useState<Article[]>([])
  const [articlesLoading, setArticlesLoading] = useState(true)
  const [articlesError, setArticlesError] = useState('')
  const [detailArticle, setDetailArticle] = useState<Article | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    fetchAllArticles(controller.signal)
      .then((result) => {
        setArticles(result)
        setArticlesError('')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setArticlesError(error instanceof Error ? error.message : '文章列表加载失败')
      })
      .finally(() => {
        if (!controller.signal.aborted) setArticlesLoading(false)
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLocaleLowerCase())
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, selectedTags])

  useEffect(() => {
    const updateRoute = () => {
      setCurrentRoute(getRouteFromHash())
      setIsMenuOpen(false)
    }

    window.addEventListener('hashchange', updateRoute)
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme

    try {
      window.localStorage.setItem('blog-theme', theme)
    } catch {
      // Theme still applies when browser storage is unavailable.
    }
  }, [theme])

  useEffect(() => {
    if (!toast) return
    const timeoutId = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  useEffect(() => {
    if (currentRoute.page !== 'article' || !currentRoute.articleId) {
      setDetailArticle(null)
      setDetailError('')
      setDetailLoading(false)
      return
    }

    const controller = new AbortController()
    const articleId = currentRoute.articleId

    setDetailArticle(null)
    setDetailError('')
    setDetailLoading(true)

    requestApi<Article>(
      `${API_BASE_URL}/api/articles/${articleId}`,
      controller.signal,
    )
      .then((article) => setDetailArticle(article))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setDetailError(error instanceof Error ? error.message : '文章加载失败')
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false)
      })

    return () => controller.abort()
  }, [currentRoute.page, currentRoute.articleId])

  const allTags = useMemo(
    () => Array.from(new Set(articles.flatMap((article) => article.tags))).sort(),
    [articles],
  )

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchesSearch =
        !debouncedSearch ||
        [article.title, article.excerpt, ...article.tags].some((value) =>
          value.toLocaleLowerCase().includes(debouncedSearch),
        )

      const matchesTags =
        selectedTags.length === 0 ||
        article.tags.some((tag) => selectedTags.includes(tag))

      return matchesSearch && matchesTags
    })
  }, [articles, debouncedSearch, selectedTags])

  const pageCount = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE))
  const visibleArticles = filteredArticles.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  const toggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'))
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((selected) => selected !== tag)
        : [...current, tag],
    )
  }

  const homeLinkClass =
    currentRoute.page !== 'about' ? 'nav-link nav-link-active' : 'nav-link'
  const aboutLinkClass =
    currentRoute.page === 'about' ? 'nav-link nav-link-active' : 'nav-link'

  return (
    <main className="app-shell">
      {toast && (
        <div
          className={`toast-notice toast-${toast.type}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <span className="toast-indicator" aria-hidden="true" />
          <p>{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="关闭通知"
          >
            ×
          </button>
        </div>
      )}

      <div className="site-container">
        <header className="site-header">
          <div className="header-row">
            <a href="#/" className="site-brand">
              Personal Journal
            </a>

            <nav className="desktop-navigation" aria-label="主导航">
              <a
                href="#/"
                className={homeLinkClass}
                aria-current={currentRoute.page !== 'about' ? 'page' : undefined}
              >
                首页
              </a>
              <a
                href="#/about"
                className={aboutLinkClass}
                aria-current={currentRoute.page === 'about' ? 'page' : undefined}
              >
                关于
              </a>
              <a href="#/create">写文章</a>
            </nav>

            <div className="header-actions">
              <button
                type="button"
                className="icon-button"
                onClick={toggleTheme}
                aria-label={`切换到${theme === 'light' ? '深色' : '浅色'}主题`}
                title={`切换到${theme === 'light' ? '深色' : '浅色'}主题`}
              >
                {theme === 'light' ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42m0-12.72-1.42 1.42m-9.88 9.88-1.42 1.42M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                className="icon-button mobile-menu-button"
                onClick={() => setIsMenuOpen((open) => !open)}
                aria-label={isMenuOpen ? '收起导航菜单' : '展开导航菜单'}
                aria-expanded={isMenuOpen}
                aria-controls="mobile-navigation"
              >
                {isMenuOpen ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {isMenuOpen && (
            <nav
              id="mobile-navigation"
              className="mobile-navigation"
              aria-label="移动端主导航"
            >
              <a href="#/" className={homeLinkClass}>
                首页
              </a>
              <a href="#/about" className={aboutLinkClass}>
                关于
              </a>
            </nav>
          )}
        </header>

        {currentRoute.page === 'home' && (
          <>
            <section className="page-heading">
              <div>
                <p className="eyebrow">NOTES FROM EVERYDAY LIFE</p>
                <h1>我的博客</h1>
              </div>
              <span className="heading-mark">文字 · 记录 · 思考</span>
            </section>

            <section aria-labelledby="articles-title" className="articles-section">
              <div className="section-heading">
                <div className="section-title-wrap">
                  <span className="section-mark" aria-hidden="true" />
                  <h2 id="articles-title">文章列表</h2>
                </div>
                <span className="article-count">
                  {filteredArticles.length} / {articles.length} 篇
                </span>
              </div>

              <div className="article-filters">
                <label className="search-field">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="10.8" cy="10.8" r="6.8" />
                    <path d="m16 16 4.5 4.5" />
                  </svg>
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="搜索标题、摘要或标签..."
                    aria-label="搜索文章标题、摘要或标签"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      className="search-clear"
                      onClick={() => setSearchInput('')}
                      aria-label="清空搜索"
                    >
                      ×
                    </button>
                  )}
                </label>

                {allTags.length > 0 && (
                  <div className="tag-filter-row">
                    <span className="tag-filter-label">按标签</span>
                    <div
                      className="tag-filter-options"
                      role="group"
                      aria-label="按标签筛选文章，可多选"
                    >
                      {allTags.map((tag) => {
                        const selected = selectedTags.includes(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            className={`tag-filter-option${selected ? ' is-active' : ''}`}
                            aria-pressed={selected}
                            onClick={() => toggleTag(tag)}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                    {selectedTags.length > 0 && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setSelectedTags([])}
                      >
                        清除标签
                      </button>
                    )}
                  </div>
                )}
              </div>

              {articlesError ? (
                <div className="notice-panel" role="alert">
                  <h3>文章暂时无法加载</h3>
                  <p>{articlesError}</p>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => window.location.reload()}
                  >
                    重新加载
                  </button>
                </div>
              ) : (
                <div aria-live="polite" aria-busy={articlesLoading}>
                  {articlesLoading ? (
                    <div className="article-list">
                      {Array.from({ length: 3 }, (_, index) => (
                        <ArticleSkeleton key={index} />
                      ))}
                    </div>
                  ) : visibleArticles.length > 0 ? (
                    <div className="article-list">
                      {visibleArticles.map((article) => (
                        <a
                          key={article.id}
                          href={`#/article/${article.id}`}
                          className="article-card-link"
                          aria-label={`阅读全文：${article.title}`}
                        >
                          <article className="article-card">
                            <time dateTime={article.date}>{article.date}</time>
                            <h3>{article.title}</h3>
                            <p>{article.excerpt}</p>
                            <ul className="article-tags" aria-label="文章标签">
                              {article.tags.map((tag) => (
                                <li key={tag}>{tag}</li>
                              ))}
                            </ul>
                          </article>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state" role="status">
                      <span className="empty-state-mark" aria-hidden="true">
                        <svg viewBox="0 0 48 48">
                          <circle cx="21" cy="21" r="12" />
                          <path d="m30 30 9 9M16 21h10" />
                        </svg>
                      </span>
                      <h3>没有找到匹配的文章</h3>
                      <p>试试其他关键词，或调整已选标签。</p>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setSearchInput('')
                          setSelectedTags([])
                        }}
                      >
                        清除筛选条件
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!articlesLoading && !articlesError && filteredArticles.length > 0 && (
                <nav className="pagination" aria-label="文章分页">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    上一页
                  </button>
                  <span>
                    {currentPage} / {pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.min(pageCount, page + 1))
                    }
                    disabled={currentPage === pageCount}
                  >
                    下一页
                  </button>
                </nav>
              )}
            </section>
          </>
        )}

        {currentRoute.page === 'about' && (
          <section className="about-page" aria-labelledby="about-title">
            <p className="eyebrow">A LITTLE ABOUT ME</p>
            <h1 id="about-title">关于</h1>
            <p>
              你好，欢迎来到我的个人博客。这里记录日常观察、阅读与思考，也收集那些值得慢慢完成的小事。
            </p>
            <p>希望这些文字能为忙碌的生活留下一点空白。谢谢你的来访。</p>
          </section>
        )}

        {currentRoute.page === 'article' && (
          <>
            {detailLoading && (
              <div className="detail-loading" role="status">
                正在打开文章...
              </div>
            )}
            {detailError && (
              <div className="notice-panel" role="alert">
                <h2>文章无法打开</h2>
                <p>{detailError}</p>
                <a className="text-button" href="#/">
                  返回文章列表
                </a>
              </div>
            )}
            {detailArticle && (
              <Suspense
                fallback={
                  <div className="detail-loading" role="status">
                    正在加载文章...
                  </div>
                }
              >
                <ArticleDetail
                  key={detailArticle.id}
                  article={detailArticle}
                  onToast={setToast}
                />
              </Suspense>
            )}
          </>
        )}

        {currentRoute.page === 'create' ? <CreateArticle /> : null}
        <footer className="site-footer">
          <span>用文字，留住日常。</span>
          <a href="#/">回到首页 ↑</a>
        </footer>
      </div>
    </main>
  )
}

export default App