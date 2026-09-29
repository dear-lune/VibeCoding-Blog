import { useState, type FormEvent } from 'react'

type ArticleForm = {
  title: string
  excerpt: string
  date: string
  tags: string
  markdown: string
}

const emptyForm: ArticleForm = {
  title: '',
  excerpt: '',
  date: '',
  tags: '',
  markdown: '',
}

export default function CreateArticle() {
  const [form, setForm] = useState<ArticleForm>(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  const updateField = (field: keyof ArticleForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setToast('')

    try {
      const response = await fetch('http://127.0.0.1:8000/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          excerpt: form.excerpt.trim(),
          date: form.date,
          tags: form.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          markdown: form.markdown,
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok || (result && result.code !== undefined && result.code !== 0)) {
        throw new Error(result?.message || '发布失败，请稍后重试。')
      }

      setForm(emptyForm)
      setToast('发布成功')
      window.setTimeout(() => setToast(''), 3000)
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : '发布失败，请稍后重试。',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClassName =
    'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20'

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">写文章</h1>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="article-title" className="mb-2 block text-sm font-medium text-gray-700">
            标题
          </label>
          <input
            id="article-title"
            className={inputClassName}
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            placeholder="输入文章标题"
            required
          />
        </div>

        <div>
          <label htmlFor="article-excerpt" className="mb-2 block text-sm font-medium text-gray-700">
            摘要
          </label>
          <textarea
            id="article-excerpt"
            className={`${inputClassName} min-h-24 resize-y`}
            value={form.excerpt}
            onChange={(event) => updateField('excerpt', event.target.value)}
            placeholder="简要介绍文章内容"
            required
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="article-date" className="mb-2 block text-sm font-medium text-gray-700">
              日期
            </label>
            <input
              id="article-date"
              type="date"
              className={inputClassName}
              value={form.date}
              onChange={(event) => updateField('date', event.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="article-tags" className="mb-2 block text-sm font-medium text-gray-700">
              标签
            </label>
            <input
              id="article-tags"
              className={inputClassName}
              value={form.tags}
              onChange={(event) => updateField('tags', event.target.value)}
              placeholder="例如：生活, 技术"
            />
          </div>
        </div>

        <div>
          <label htmlFor="article-markdown" className="mb-2 block text-sm font-medium text-gray-700">
            Markdown 正文
          </label>
          <textarea
            id="article-markdown"
            className={`${inputClassName} min-h-80 resize-y font-mono`}
            value={form.markdown}
            onChange={(event) => updateField('markdown', event.target.value)}
            placeholder="使用 Markdown 编写文章正文"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? '发布中…' : '发布文章'}
        </button>
      </form>

      {toast && (
        <div
          className="fixed bottom-6 right-6 rounded-md bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}
    </main>
  )
}