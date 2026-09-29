import json
import os
import sqlite3
from contextlib import closing
from datetime import date as Date
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

DATABASE_PATH = Path(
    os.getenv("BLOG_DATABASE_PATH", Path(__file__).with_name("blog.db"))
)

app = FastAPI(title="Personal Blog API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


class ArticleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    excerpt: str = Field(min_length=1, max_length=1000)
    date: Date = Field(default_factory=Date.today)
    tags: list[str] = Field(default_factory=list, max_length=20)
    markdown: str = Field(default="", max_length=100000)


class ArticleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    excerpt: str | None = Field(default=None, min_length=1, max_length=1000)
    date: Date | None = None
    tags: list[str] | None = Field(default=None, max_length=20)
    markdown: str | None = Field(default=None, max_length=100000)


def get_connection() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    with closing(get_connection()) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                excerpt TEXT NOT NULL,
                date TEXT NOT NULL,
                tags TEXT NOT NULL DEFAULT '[]',
                markdown TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """)
        connection.commit()


def article_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "excerpt": row["excerpt"],
        "date": row["date"],
        "tags": json.loads(row["tags"]),
        "markdown": row["markdown"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def response_data(data: Any, message: str = "success") -> dict[str, Any]:
    return {"code": 0, "message": message, "data": data}


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.status_code, "message": str(exc.detail), "data": None},
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"code": 422, "message": "请求参数校验失败", "data": exc.errors()},
    )


@app.get("/api/health")
def health_check() -> dict[str, Any]:
    return response_data({"status": "ok"})


@app.get("/api/articles")
def list_articles(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None),
) -> dict[str, Any]:
    offset = (page - 1) * page_size
    search = search.strip() if search else ""
    where_clause = " WHERE title LIKE ? ESCAPE '!'" if search else ""
    search_params = (
        (f"%{search.replace('!', '!!').replace('%', '!%').replace('_', '!_')}%",)
        if search
        else ()
    )
    with closing(get_connection()) as connection:
        total = connection.execute(
            f"SELECT COUNT(*) FROM articles{where_clause}", search_params
        ).fetchone()[0]
        rows = connection.execute(
            f"SELECT * FROM articles{where_clause} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?",
            (*search_params, page_size, offset),
        ).fetchall()
    return response_data(
        {
            "items": [article_from_row(row) for row in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@app.get("/api/articles/{article_id}")
def get_article(article_id: int) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        row = connection.execute(
            "SELECT * FROM articles WHERE id = ?", (article_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="文章不存在")
    return response_data(article_from_row(row))


@app.post("/api/articles", status_code=201)
def create_article(article: ArticleCreate) -> dict[str, Any]:
    title = article.title.strip()
    excerpt = article.excerpt.strip()
    if not title or not excerpt:
        raise HTTPException(status_code=422, detail="标题和摘要不能为空")
    now = datetime.now(timezone.utc).isoformat()
    with closing(get_connection()) as connection:
        cursor = connection.execute(
            """
            INSERT INTO articles (title, excerpt, date, tags, markdown, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                title,
                excerpt,
                article.date.isoformat(),
                json.dumps(article.tags, ensure_ascii=False),
                article.markdown,
                now,
                now,
            ),
        )
        connection.commit()
        row = connection.execute(
            "SELECT * FROM articles WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
    return response_data(article_from_row(row), "文章创建成功")


@app.put("/api/articles/{article_id}")
def update_article(article_id: int, article: ArticleUpdate) -> dict[str, Any]:
    updates = article.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="至少提供一个需要修改的字段")
    if any(value is None for value in updates.values()):
        raise HTTPException(status_code=422, detail="修改字段不能为 null")
    for field in ("title", "excerpt"):
        if field in updates:
            updates[field] = updates[field].strip()
            if not updates[field]:
                raise HTTPException(status_code=422, detail="标题和摘要不能为空")
    if "date" in updates and updates["date"] is not None:
        updates["date"] = updates["date"].isoformat()
    if "tags" in updates and updates["tags"] is not None:
        updates["tags"] = json.dumps(updates["tags"], ensure_ascii=False)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    with closing(get_connection()) as connection:
        cursor = connection.execute(
            "SELECT id FROM articles WHERE id = ?", (article_id,)
        )
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="文章不存在")
        assignments = ", ".join(f"{field} = ?" for field in updates)
        connection.execute(
            f"UPDATE articles SET {assignments} WHERE id = ?",
            (*updates.values(), article_id),
        )
        connection.commit()
        row = connection.execute(
            "SELECT * FROM articles WHERE id = ?", (article_id,)
        ).fetchone()
    return response_data(article_from_row(row), "文章修改成功")


@app.delete("/api/articles/{article_id}")
def delete_article(article_id: int) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        cursor = connection.execute("DELETE FROM articles WHERE id = ?", (article_id,))
        connection.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="文章不存在")
    return response_data({"id": article_id}, "文章删除成功")


initialize_database()
