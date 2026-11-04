import uuid

from fastapi import APIRouter, Depends

from app.core.database import DbSession
from app.core.pagination import Page, Pagination
from app.modules.auth.dependencies import get_current_user
from app.modules.news.schemas import ArticleRead
from app.modules.news.service import list_news

router = APIRouter(
    prefix="/instruments/{instrument_id}/news",
    tags=["news"],
    dependencies=[Depends(get_current_user)],
)


@router.get("")
async def list_all(
    session: DbSession, instrument_id: uuid.UUID, page: Pagination
) -> Page[ArticleRead]:
    articles = await list_news(session, instrument_id, page)
    return articles.to_page(ArticleRead)
