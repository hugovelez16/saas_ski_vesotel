import asyncio
from sqlalchemy.future import select
from backend.database import SessionLocal
from backend.models import Company

async def main():
    async with SessionLocal() as db:
        result = await db.execute(select(Company))
        companies = result.scalars().all()
        for c in companies:
            print(f"Company: {c.name}")
            print(f"  worklog_definitions: {c.worklog_definitions}")
            print(f"  settings: {c.settings}")

if __name__ == "__main__":
    asyncio.run(main())
