import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

type Article = {
  id: number
  title: string
  excerpt: string
  date: string
  tags: string[]
  markdown: string
}

type Comment = {
  nickname: string
  content: string
  createdAt: string
}

type ToastType = 'success' | 'error' | 'warning'
type Toast = { type: ToastType; message: string }

type ArticleDetailProps = {
  article: Article
  onToast: (toast: Toast) => void
}

function readStoredValue<T>(key: string, fallback: T): T {
  try {
    const storedValue = window.localStorage.getItem(key)
    return storedValue === null ? fallback : (JSON.parse(storedValue) as T)
  } catch {
    return fallback
  }
}

function ArticleDetail({ article, onToast }: ArticleDetailProps) {
  const likeKey = `blog-liked-${article.id}`
  const commentsKey = `blog-comments-${article.id}`
  const [progress, setProgress] = useState(0)
  const [liked, setLiked] = useState(() => readStoredValue(likeKey, false))
  const [likeAnimationKey, setLikeAnimationKey] = useState(0)
  const [comments, setComments] = useState<Comment[]>(() =>
    readStoredValue(commentsKey, []),
  )
  const [isDeleting, setIsDeleting] = useState(false)
  const [validationMessage, setValidationMessage] = useState('')
  const [validationKey, setValidationKey] = useState(0)

  useEffect(() => {
    window.scrollTo(0, 0)

    const updateProgress = () => {
      const scrollableHeight =
        document.documentElement.scrollHeight - window.innerHeight
      const nextProgress =
        scrollableHeight > 0 ? (window.scrollY / scrollableHeight) * 100 : 0
      setProgress(Math.min(100, Math.max(0, nextProgress)))
    }

    updateProgress()
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)

    const resizeObserver = new ResizeObserver(updateProgress)
    resizeObserver.observe(document.documentElement)

    return () => {
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
      resizeObserver.disconnect()
    }
  }, [])

  const toggleLike = () => {
    const nextLiked = !liked

    try {
      window.localStorage.setItem(likeKey, JSON.stringify(nextLiked))
      setLiked(nextLiked)
      if (nextLiked) setLikeAnimationKey((key) => key + 1)
      onToast({
        type: 'success',
        message: nextLiked ? '感谢点赞' : '已取消点赞',
      })
    } catch {
      onToast({ type: 'error', message: '点赞状态保存失败，请检查浏览器存储设置。' })
    }
  }

  const submitComment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(form)
    const nickname = String(formData.get('nickname') ?? '').trim()
    const email = String(formData.get('email') ?? '').trim()
    const content = String(formData.get('content') ?? '').trim()
    const issues: string[] = []

    if (!nickname) issues.push('请填写昵称')
    else if (nickname.length > 50) issues.push('昵称不能超过 50 个字符')

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      issues.push('请填写有效的邮箱地址')
    }

    if (!content) issues.push('请填写评论内容')
    else if (content.length > 2000) issues.push('评论不能超过 2000 个字符')

    if (issues.length > 0) {
      setValidationMessage(`${issues.join('，')}。`)
      setValidationKey((key) => key + 1)
      onToast({ type: 'warning', message: '请检查评论表单后再提交。' })
      return
    }

    const nextComments = [
      { nickname, content, createdAt: new Date().toISOString() },
      ...comments,
    ]

    try {
      window.localStorage.setItem(commentsKey, JSON.stringify(nextComments))
      setComments(nextComments)
      setValidationMessage('')
      form.reset()
      onToast({ type: 'success', message: '评论已发布。' })
    } catch {
      onToast({ type: 'error', message: '评论保存失败，请检查浏览器存储设置。' })
    }
  }

  const deleteArticle = async () => {
    if (!window.confirm('确定要删除这篇文章吗？此操作无法撤销。')) return

    setIsDeleting(true)
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/articles/${article.id}`,
        { method: 'DELETE' },
      )
      const result = (await response.json()) as {
        code: number
        message: string
      }

      if (!response.ok || result.code !== 0) {
        throw new Error(result.message || `删除失败（${response.status}）`)
      }

      onToast({ type: 'success', message: result.message || '文章删除成功' })
      window.location.hash = '#/'
    } catch (error) {
      onToast({
        type: 'error',
        message: error instanceof Error ? error.message : '文章删除失败',
      })
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="reading-progress" aria-hidden="true">
        <div
          className="reading-progress-value"
          style={{ transform: `scaleX(${progress / 100})` }}
        />
      </div>
      <div
        className="reading-progress-accessible"
        role="progressbar"
        aria-label="阅读进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      />

      <article className="article-detail">
        <a href="#/" className="article-back-link">
          ← 返回文章列表
        </a>

        <header className="article-detail-header">
          <p className="eyebrow">PERSONAL JOURNAL</p>
          <div className="article-title-row">
            <h1>{article.title}</h1>
            <button
              type="button"
              className={`like-button${liked ? ' is-liked' : ''}`}
              onClick={toggleLike}
              aria-label={liked ? '取消点赞' : '点赞文章'}
              aria-pressed={liked}
            >
              <svg
                key={likeAnimationKey}
                className={likeAnimationKey ? 'like-heart like-heart-pop' : 'like-heart'}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M20.8 8.7c0 4.1-8.8 10-8.8 10s-8.8-5.9-8.8-10a4.7 4.7 0 0 1 8.8-2.3 4.7 4.7 0 0 1 8.8 2.3Z" />
              </svg>
              <span>{liked ? '已赞' : '点赞'}</span>
            </button>
          </div>
          <p className="article-detail-excerpt">{article.excerpt}</p>
          <div className="article-detail-meta">
            <time dateTime={article.date}>{article.date}</time>
            <ul aria-label="文章标签">
              {article.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          </div>
        </header>

        <div className="markdown-body">
          {article.markdown.trim() ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                img: ({ src, alt, title }) => (
                  <img
                    src={src}
                    alt={alt ?? ''}
                    title={title}
                    loading="lazy"
                    decoding="async"
                  />
                ),
              }}
            >
              {article.markdown}
            </ReactMarkdown>
          ) : (
            <p className="markdown-empty">这篇文章还没有正文内容。</p>
          )}
        </div>

        <div className="article-delete-action">
          <button
            type="button"
            className="primary-button"
            onClick={deleteArticle}
            disabled={isDeleting}
            style={{ backgroundColor: '#b42318', borderColor: '#b42318', color: '#fff' }}
          >
            {isDeleting ? '正在删除...' : '删除文章'}
          </button>
        </div>

        <section className="comment-section" aria-labelledby="comments-title">
          <div className="comment-section-heading">
            <h2 id="comments-title">留下评论</h2>
            <span>{comments.length} 条</span>
          </div>

          <form className="comment-form" onSubmit={submitComment} noValidate>
            {validationMessage && (
              <p
                key={validationKey}
                className="comment-validation"
                role="alert"
              >
                {validationMessage}
              </p>
            )}

            <div className="comment-form-fields">
              <label>
                昵称
                <input
                  name="nickname"
                  type="text"
                  autoComplete="nickname"
                  maxLength={50}
                  required
                  aria-required="true"
                />
              </label>
              <label>
                邮箱
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  aria-required="true"
                />
              </label>
            </div>

            <label className="comment-content-field">
              评论内容
              <textarea
                name="content"
                rows={5}
                maxLength={2000}
                required
                aria-required="true"
              />
            </label>

            <div className="comment-form-actions">
              <span>邮箱不会公开显示</span>
              <button type="submit" className="primary-button">
                发布评论
              </button>
            </div>
          </form>

          {comments.length > 0 && (
            <ol className="comment-list" aria-label="评论列表">
              {comments.map((comment, index) => (
                <li key={`${comment.createdAt}-${index}`}>
                  <div className="comment-author-row">
                    <strong>{comment.nickname}</strong>
                    <time dateTime={comment.createdAt}>
                      {new Date(comment.createdAt).toLocaleDateString('zh-CN')}
                    </time>
                  </div>
                  <p>{comment.content}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </article>
    </>
  )
}

export default ArticleDetail