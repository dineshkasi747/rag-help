import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as session:
        await session.execute(text("DELETE FROM sections;"))
        await session.execute(text("DELETE FROM papers;"))
        await session.commit()
        print("Database cleared successfully! All previous uploads have been wiped.")

if __name__ == "__main__":
    asyncio.run(main())
